import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import * as XLSX from "xlsx";
import nodemailer from "nodemailer";
import { storage } from "./storage";
import { hashPassword, comparePassword, generateAccessToken, generateRefreshToken, verifyRefreshToken, authenticateToken } from "./auth";
import { parseCSV, parseJSON, validateLogEntry } from "./services/logs";
import { generateEmployeeReport } from "./services/gemini";
import { parseHuaweiNmsLogs } from "./services/huaweiParser";
import { analyzeOperatorLogs } from "./services/analysisEngine";
import { analyzeNmsLogs, generateHtmlReport } from "./services/logAnalytics";
import { getSyslogStats, simulateSyslogMessages, simulateTelecomLogs } from "./syslog";
import { 
  insertEmployeeSchema, insertLogSchema, insertTemplateSchema,
  insertNmsSystemSchema, insertManagerSchema, insertOperatorGroupSchema,
  insertOperatorSchema
} from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";

// Safe timestamp helper - handles Date objects, strings, and invalid values
function safeTimestamp(ts: any): Date {
  if (ts instanceof Date && !isNaN(ts.getTime())) {
    return ts;
  }
  if (typeof ts === 'string') {
    const parsed = new Date(ts);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date(); // fallback to current time
}

function safeTimestampString(ts: any): string {
  try {
    return safeTimestamp(ts).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

let wss: WebSocketServer;

export function broadcastLog(log: any) {
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'new_log', data: log }));
      }
    });
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        role: "user",
      });

      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });
      const refreshToken = generateRefreshToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      res.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        accessToken,
        refreshToken,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Support login by email or username (name)
      const user = await storage.getUserByEmailOrName(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValid = await comparePassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });
      const refreshToken = generateRefreshToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      res.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        accessToken,
        refreshToken,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      const payload = verifyRefreshToken(refreshToken);
      const accessToken = generateAccessToken(payload);

      res.json({ accessToken });
    } catch (error: any) {
      res.status(403).json({ message: "Invalid refresh token" });
    }
  });

  // Employee routes
  app.get("/api/employees", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { search, role, department, status } = req.query;
      const employees = await storage.getEmployees({
        search: search as string,
        role: role as string,
        department: department as string,
        status: status as string,
      });
      res.json(employees);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/employees/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      res.json(employee);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/employees", authenticateToken, async (req: Request, res: Response) => {
    try {
      const validatedData = insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployee(validatedData);
      
      const logs = await storage.getLogs({ employeeId: employee.id });
      if (logs.length > 0 && employee.jobDescription && process.env.GEMINI_API_KEY) {
        try {
          const reportData = await generateEmployeeReport(employee, logs, "All Time");
          await storage.createReport({
            employeeId: employee.id,
            reportType: "performance",
            dateRange: "All Time",
            summary: reportData.summary,
            actions: reportData.actions,
            risks: reportData.risks,
            violations: reportData.violations,
            nextSteps: reportData.nextSteps,
            metrics: reportData.metrics,
          });
        } catch (reportError) {
          console.error("Failed to generate initial report:", reportError);
        }
      }
      
      res.status(201).json(employee);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/employees/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const updateSchema = insertEmployeeSchema.partial();
      const validatedData = updateSchema.parse(req.body);
      const employee = await storage.updateEmployee(req.params.id, validatedData);
      
      if ((req.body.jobDescription || req.body.rules) && employee.jobDescription) {
        const logs = await storage.getLogs({ employeeId: employee.id });
        if (logs.length > 0 && process.env.GEMINI_API_KEY) {
          try {
            const reportData = await generateEmployeeReport(employee, logs, "All Time");
            await storage.createReport({
              employeeId: employee.id,
              reportType: "performance",
              dateRange: "All Time",
              summary: reportData.summary,
              actions: reportData.actions,
              risks: reportData.risks,
              violations: reportData.violations,
              nextSteps: reportData.nextSteps,
              metrics: reportData.metrics,
            });
          } catch (reportError) {
            console.error("Failed to generate updated report:", reportError);
          }
        }
      }
      
      res.json(employee);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/employees/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      await storage.deleteEmployee(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Log routes
  app.get("/api/logs", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { employeeId, source, action, startDate, endDate } = req.query;
      const logs = await storage.getLogs({
        employeeId: employeeId as string,
        source: source as string,
        action: action as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/logs", async (req: Request, res: Response) => {
    try {
      const logData = insertLogSchema.parse(req.body);
      
      const employee = await storage.getEmployee(logData.employeeId);
      if (!employee) {
        await db.execute(sql`
          INSERT INTO employees (id, name, email, role, department, status)
          VALUES (${logData.employeeId}, ${logData.employeeId}, ${logData.employeeId + '@integration.local'}, 'Integration User', 'System', 'active')
          ON CONFLICT (id) DO NOTHING
        `);
      }

      const createdLog = await storage.createLog(logData);
      
      broadcastLog(createdLog);
      
      res.status(200).json({ 
        message: "Log received successfully",
        log: createdLog 
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/logs/upload", authenticateToken, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileContent = req.file.buffer.toString("utf-8");
      const fileExtension = req.file.originalname.split(".").pop()?.toLowerCase();

      let parsedLogs;
      if (fileExtension === "csv") {
        parsedLogs = parseCSV(fileContent);
      } else if (fileExtension === "json") {
        parsedLogs = parseJSON(fileContent);
      } else {
        return res.status(400).json({ message: "Unsupported file format. Use CSV or JSON." });
      }

      const validLogs = parsedLogs.filter(validateLogEntry);
      
      if (validLogs.length === 0) {
        return res.status(400).json({ message: "No valid log entries found" });
      }

      const uniqueEmployeeIds = Array.from(new Set(validLogs.map(log => log.employeeId)));
      const allEmployees = await storage.getEmployees({});
      const existingIds = new Set(allEmployees.map(emp => emp.id));
      const newEmployees = uniqueEmployeeIds.filter(id => !existingIds.has(id));
      
      for (const employeeId of newEmployees) {
        await db.execute(sql`
          INSERT INTO employees (id, name, email, role, department, status)
          VALUES (${employeeId}, ${employeeId}, ${employeeId + '@system.local'}, 'System User', 'System', 'active')
        `);
      }

      const createdLogs = await storage.createLogs(validLogs);
      res.status(201).json({
        message: `Successfully uploaded ${createdLogs.length} logs`,
        count: createdLogs.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Report routes
  app.get("/api/reports", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { employeeId, reportType, startDate, endDate } = req.query;
      const reports = await storage.getReports({
        employeeId: employeeId as string,
        reportType: reportType as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      res.json(reports);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const report = await storage.getReport(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/reports/generate", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ message: "AI report generation is not configured. GEMINI_API_KEY is missing." });
      }

      const { employeeId, dateRange, reportType } = req.body;

      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      const endDate = new Date();
      let startDate = new Date();
      let dateRangeText = "";

      switch (dateRange) {
        case "last-7-days":
          startDate.setDate(endDate.getDate() - 7);
          dateRangeText = "Last 7 Days";
          break;
        case "last-30-days":
          startDate.setDate(endDate.getDate() - 30);
          dateRangeText = "Last 30 Days";
          break;
        case "last-90-days":
          startDate.setDate(endDate.getDate() - 90);
          dateRangeText = "Last 90 Days";
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
          dateRangeText = "Last 30 Days";
      }

      const logs = await storage.getLogs({
        employeeId,
        startDate,
        endDate,
      });

      if (logs.length === 0) {
        return res.status(400).json({ message: "No logs found for the specified period" });
      }

      const reportData = await generateEmployeeReport(employee, logs, dateRangeText);

      const report = await storage.createReport({
        employeeId,
        reportType: reportType || "performance",
        dateRange: dateRangeText,
        summary: reportData.summary,
        actions: reportData.actions,
        risks: reportData.risks,
        violations: reportData.violations,
        nextSteps: reportData.nextSteps,
        metrics: reportData.metrics,
      });

      res.status(201).json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Stats endpoint for dashboard
  app.get("/api/stats", authenticateToken, async (req: Request, res: Response) => {
    try {
      const employees = await storage.getEmployees({});
      const logs = await storage.getLogs({});
      const reports = await storage.getReports({});

      res.json({
        totalEmployees: employees.length,
        logsProcessed: logs.length,
        reportsGenerated: reports.length,
        activeEmployees: employees.filter(e => e.status === "active").length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/dashboard/stats", authenticateToken, async (req: Request, res: Response) => {
    try {
      const employees = await storage.getEmployees({});
      const logs = await storage.getLogs({});
      const reports = await storage.getReports({});
      const analysisReports = await storage.getAnalysisReports({});
      const nmsSystems = await storage.getNmsSystems();
      const operators = await storage.getOperators({});
      
      const nmsSystemStats = await Promise.all(
        nmsSystems.map(async (system) => {
          const systemLogs = await storage.getNmsLogs({ nmsSystemId: system.id, limit: 10000 });
          const successfulLogs = systemLogs.filter(l => l.result === 'Successful').length;
          const failedLogs = systemLogs.filter(l => l.result === 'Failed').length;
          const systemOperators = operators.filter(o => o.nmsSystemId === system.id);
          const lastLog = systemLogs.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0];
          
          return {
            id: system.id,
            name: system.name,
            connectionType: system.connectionType,
            status: system.status,
            totalLogs: systemLogs.length,
            successfulLogs,
            failedLogs,
            operatorCount: systemOperators.length,
            lastActivity: lastLog ? lastLog.timestamp : null
          };
        })
      );
      
      const globalStats = await storage.getGlobalNmsLogStats();
      const successfulOperations = globalStats.successful;
      const failedOperations = globalStats.failed;
      const totalViolations = globalStats.violations;
      
      const allNmsLogs = await storage.getNmsLogs({ limit: 50000 });
      
      const hourlyActivity = Array.from({ length: 24 }, (_, hour) => {
        const hourLogs = allNmsLogs.filter(log => {
          const logHour = safeTimestamp(log.timestamp).getHours();
          return logHour === hour;
        });
        return {
          hour,
          count: hourLogs.length,
          successful: hourLogs.filter(l => l.result === 'Successful').length,
          failed: hourLogs.filter(l => l.result === 'Failed').length
        };
      });
      
      const dailyMap = new Map<string, { count: number; successful: number; failed: number }>();
      allNmsLogs.forEach(log => {
        const date = safeTimestampString(log.timestamp).split('T')[0];
        const existing = dailyMap.get(date) || { count: 0, successful: 0, failed: 0 };
        existing.count++;
        if (log.result === 'Successful') existing.successful++;
        if (log.result === 'Failed') existing.failed++;
        dailyMap.set(date, existing);
      });
      
      const dailyActivity = Array.from(dailyMap.entries())
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);
      
      const operationMap = new Map<string, { count: number; successful: number }>();
      allNmsLogs.forEach(log => {
        const op = log.operation.length > 50 ? log.operation.substring(0, 50) + '...' : log.operation;
        const existing = operationMap.get(op) || { count: 0, successful: 0 };
        existing.count++;
        if (log.result === 'Successful') existing.successful++;
        operationMap.set(op, existing);
      });
      
      const topOperations = Array.from(operationMap.entries())
        .map(([operation, stats]) => ({
          operation,
          count: stats.count,
          successRate: stats.count > 0 ? (stats.successful / stats.count) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      const recentLogs = allNmsLogs
        .sort((a, b) => safeTimestamp(b.timestamp).getTime() - safeTimestamp(a.timestamp).getTime())
        .slice(0, 20);

      res.json({
        totalEmployees: employees.length,
        logsProcessed: logs.length,
        reportsGenerated: reports.length + analysisReports.length,
        activeEmployees: employees.filter(e => e.status === "active").length,
        totalNmsSystems: nmsSystems.length,
        activeNmsSystems: nmsSystems.filter(s => s.status === 'active').length,
        totalNmsLogs: globalStats.total,
        successfulOperations,
        failedOperations,
        totalViolations,
        operatorCount: operators.length,
        nmsSystems: nmsSystemStats,
        hourlyActivity,
        dailyActivity,
        topOperations,
        recentLogs
      });
    } catch (error: any) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Template routes
  app.get("/api/templates", authenticateToken, async (req: Request, res: Response) => {
    try {
      const templates = await storage.getTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/templates/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/templates", authenticateToken, async (req: Request, res: Response) => {
    try {
      const validatedData = insertTemplateSchema.parse(req.body);
      const template = await storage.createTemplate(validatedData);
      res.status(201).json(template);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/templates/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const updateSchema = insertTemplateSchema.partial();
      const validatedData = updateSchema.parse(req.body);
      const template = await storage.updateTemplate(req.params.id, validatedData);
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/templates/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      await storage.deleteTemplate(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk employee upload endpoint
  app.post("/api/employees/upload", authenticateToken, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileExtension = req.file.originalname.split(".").pop()?.toLowerCase();
      let employeesData: any[] = [];

      if (fileExtension === "xlsx" || fileExtension === "xls") {
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        employeesData = XLSX.utils.sheet_to_json(worksheet);
      } else if (fileExtension === "csv") {
        const fileContent = req.file.buffer.toString("utf-8");
        const lines = fileContent.trim().split("\n");
        const headers = lines[0].split(",").map(h => h.trim());
        
        employeesData = lines.slice(1).map(line => {
          const values = line.split(",").map(v => v.trim());
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = values[index];
          });
          return obj;
        });
      } else if (fileExtension === "txt") {
        const fileContent = req.file.buffer.toString("utf-8");
        const lines = fileContent.trim().split("\n");
        const headers = lines[0].split("\t").map(h => h.trim());
        
        employeesData = lines.slice(1).map(line => {
          const values = line.split("\t").map(v => v.trim());
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = values[index];
          });
          return obj;
        });
      } else {
        return res.status(400).json({ message: "Unsupported file format. Use Excel (.xlsx, .xls), CSV, or TXT." });
      }

      const validEmployees = employeesData.map(emp => ({
        name: emp.name || emp.Name || "",
        email: emp.email || emp.Email || "",
        role: emp.role || emp.Role || "Employee",
        department: emp.department || emp.Department || "General",
        jobDescription: emp.jobDescription || emp["Job Description"] || "",
        rules: emp.rules || emp.Rules || "",
        status: emp.status || emp.Status || "active",
      })).filter(emp => emp.name && emp.email);

      if (validEmployees.length === 0) {
        return res.status(400).json({ message: "No valid employee entries found in file" });
      }

      const createdEmployees = await storage.createEmployees(validEmployees);
      
      res.status(201).json({
        message: `Successfully uploaded ${createdEmployees.length} employees`,
        count: createdEmployees.length,
        employees: createdEmployees,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== NMS SYSTEM ROUTES ====================
  
  // NMS Systems CRUD
  app.get("/api/nms-systems", authenticateToken, async (req: Request, res: Response) => {
    try {
      const systems = await storage.getNmsSystems();
      res.json(systems);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/nms-systems/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const system = await storage.getNmsSystem(req.params.id);
      if (!system) {
        return res.status(404).json({ message: "NMS System not found" });
      }
      res.json(system);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/nms-systems", authenticateToken, async (req: Request, res: Response) => {
    try {
      const validatedData = insertNmsSystemSchema.parse(req.body);
      const system = await storage.createNmsSystem(validatedData);
      res.status(201).json(system);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/nms-systems/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const updateSchema = insertNmsSystemSchema.partial();
      const validatedData = updateSchema.parse(req.body);
      const system = await storage.updateNmsSystem(req.params.id, validatedData);
      res.json(system);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/nms-systems/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      await storage.deleteNmsSystem(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // NMS System Stats
  app.get("/api/nms-systems/:id/stats", authenticateToken, async (req: Request, res: Response) => {
    try {
      const stats = await storage.getNmsLogStats(req.params.id);
      const operators = await storage.getOperators({ nmsSystemId: req.params.id });
      const groups = await storage.getOperatorGroups({ nmsSystemId: req.params.id });
      const managers = await storage.getManagers(req.params.id);
      
      res.json({
        ...stats,
        operatorCount: operators.length,
        groupCount: groups.length,
        managerCount: managers.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete all logs for a specific NMS system
  app.delete("/api/nms-systems/:id/logs", authenticateToken, async (req: Request, res: Response) => {
    try {
      const deletedCount = await storage.deleteAllNmsLogs(req.params.id);
      res.json({ message: "All logs deleted successfully", deletedCount });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Managers CRUD
  app.get("/api/managers", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { nmsSystemId } = req.query;
      const managers = await storage.getManagers(nmsSystemId as string | undefined);
      res.json(managers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/managers/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const manager = await storage.getManager(req.params.id);
      if (!manager) {
        return res.status(404).json({ message: "Manager not found" });
      }
      res.json(manager);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/managers", authenticateToken, async (req: Request, res: Response) => {
    try {
      const validatedData = insertManagerSchema.parse(req.body);
      const manager = await storage.createManager(validatedData);
      res.status(201).json(manager);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/managers/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const updateSchema = insertManagerSchema.partial();
      const validatedData = updateSchema.parse(req.body);
      const manager = await storage.updateManager(req.params.id, validatedData);
      res.json(manager);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/managers/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      await storage.deleteManager(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Operator Groups CRUD
  app.get("/api/operator-groups", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { nmsSystemId, managerId } = req.query;
      const groups = await storage.getOperatorGroups({
        nmsSystemId: nmsSystemId as string | undefined,
        managerId: managerId as string | undefined,
      });
      res.json(groups);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/operator-groups/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const group = await storage.getOperatorGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Operator Group not found" });
      }
      res.json(group);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/operator-groups", authenticateToken, async (req: Request, res: Response) => {
    try {
      const validatedData = insertOperatorGroupSchema.parse(req.body);
      const group = await storage.createOperatorGroup(validatedData);
      res.status(201).json(group);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/operator-groups/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const updateSchema = insertOperatorGroupSchema.partial();
      const validatedData = updateSchema.parse(req.body);
      const group = await storage.updateOperatorGroup(req.params.id, validatedData);
      res.json(group);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/operator-groups/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      await storage.deleteOperatorGroup(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Operators CRUD
  app.get("/api/operators", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { nmsSystemId, groupId } = req.query;
      const operators = await storage.getOperators({
        nmsSystemId: nmsSystemId as string | undefined,
        groupId: groupId as string | undefined,
      });
      res.json(operators);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/operators/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const operator = await storage.getOperator(req.params.id);
      if (!operator) {
        return res.status(404).json({ message: "Operator not found" });
      }
      res.json(operator);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/operators", authenticateToken, async (req: Request, res: Response) => {
    try {
      const validatedData = insertOperatorSchema.parse(req.body);
      const operator = await storage.createOperator(validatedData);
      res.status(201).json(operator);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/operators/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const updateSchema = insertOperatorSchema.partial();
      const validatedData = updateSchema.parse(req.body);
      const operator = await storage.updateOperator(req.params.id, validatedData);
      res.json(operator);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/operators/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      await storage.deleteOperator(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // NMS Logs
  app.get("/api/nms-logs", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { nmsSystemId, operatorUsername, startDate, endDate, result, level, search, page, limit } = req.query;
      
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 50;
      const offset = (pageNum - 1) * limitNum;
      
      const filters = {
        nmsSystemId: nmsSystemId as string | undefined,
        operatorUsername: operatorUsername as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        result: result as string | undefined,
        level: level as string | undefined,
        search: search as string | undefined,
      };
      
      const logs = await storage.getNmsLogsPaginated(filters, offset, limitNum);
      const total = await storage.getNmsLogsCount(filters);
      
      res.json({
        logs,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get NMS Logs with violations only
  app.get("/api/nms-logs/violations", authenticateToken, async (req: Request, res: Response) => {
    try {
      const logs = await storage.getNmsLogs({ limit: 100 });
      const violations = logs.filter(log => log.isViolation === true);
      res.json(violations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Upload NMS Logs (Huawei CSV format)
  app.post("/api/nms-logs/upload", authenticateToken, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { nmsSystemId } = req.body;
      if (!nmsSystemId) {
        return res.status(400).json({ message: "NMS System ID is required" });
      }

      const system = await storage.getNmsSystem(nmsSystemId);
      if (!system) {
        return res.status(404).json({ message: "NMS System not found" });
      }

      const fileContent = req.file.buffer.toString("utf-8");
      const fileExtension = req.file.originalname.split(".").pop()?.toLowerCase();

      if (fileExtension !== "csv") {
        return res.status(400).json({ message: "Only CSV files are supported for Huawei NMS logs" });
      }

      let parsedLogs = parseHuaweiNmsLogs(fileContent, nmsSystemId);

      if (parsedLogs.length === 0) {
        return res.status(400).json({ message: "No valid log entries found in file" });
      }

      const uniqueOperators = Array.from(new Set(parsedLogs.map(l => l.operatorUsername)));
      for (const username of uniqueOperators) {
        const existingOperator = await storage.getOperatorByUsername(username, nmsSystemId);
        if (!existingOperator) {
          await storage.createOperator({
            username,
            nmsSystemId,
            status: 'active',
          });
        }
      }

      const createdLogs = await storage.createNmsLogs(parsedLogs);
      
      res.status(201).json({
        message: `Successfully uploaded ${createdLogs.length} logs`,
        count: createdLogs.length,
        uniqueOperators: uniqueOperators.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Receive NMS Logs (for server forwarding/syslog)
  app.post("/api/nms-logs/receive", async (req: Request, res: Response) => {
    try {
      const { nmsSystemId, logs } = req.body;
      
      if (!nmsSystemId || !logs || !Array.isArray(logs)) {
        return res.status(400).json({ message: "NMS System ID and logs array are required" });
      }

      const system = await storage.getNmsSystem(nmsSystemId);
      if (!system) {
        return res.status(404).json({ message: "NMS System not found" });
      }

      const parsedLogs = logs.map((log: any) => ({
        nmsSystemId,
        operatorUsername: log.operator || 'Unknown',
        timestamp: new Date(log.timestamp || Date.now()),
        operation: log.operation || '',
        level: log.level || 'Minor',
        source: log.source || '',
        terminalIp: log.terminalIp || '',
        operationObject: log.operationObject || '',
        result: log.result || 'Unknown',
        details: log.details || '',
        isViolation: false,
        violationType: null,
      }));

      const createdLogs = await storage.createNmsLogs(parsedLogs);
      
      createdLogs.forEach(log => broadcastLog({ type: 'nms_log', data: log }));
      
      res.status(200).json({ 
        message: `Received ${createdLogs.length} logs`,
        count: createdLogs.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Analysis Reports
  app.get("/api/analysis-reports", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { nmsSystemId, operatorId, groupId, managerId } = req.query;
      const reports = await storage.getAnalysisReports({
        nmsSystemId: nmsSystemId as string | undefined,
        operatorId: operatorId as string | undefined,
        groupId: groupId as string | undefined,
        managerId: managerId as string | undefined,
      });
      res.json(reports);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/analysis-reports/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const report = await storage.getAnalysisReport(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Analysis Report not found" });
      }
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/analysis-reports/generate", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { nmsSystemId, operatorId, groupId, reportType = "daily" } = req.body;

      if (!nmsSystemId) {
        return res.status(400).json({ message: "NMS System ID is required" });
      }

      const endDate = new Date();
      let startDate = new Date();
      let dateRangeText = "";

      switch (reportType) {
        case "weekly":
          startDate.setDate(endDate.getDate() - 7);
          dateRangeText = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
          break;
        case "monthly":
          startDate.setDate(endDate.getDate() - 30);
          dateRangeText = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
          break;
        case "daily":
        default:
          startDate.setHours(0, 0, 0, 0);
          dateRangeText = endDate.toLocaleDateString();
          break;
      }

      const logs = await storage.getNmsLogs({
        nmsSystemId,
        operatorId,
        startDate,
        endDate,
      });

      if (logs.length === 0) {
        return res.status(400).json({ message: "No logs found for the specified period" });
      }

      const operator = operatorId ? await storage.getOperator(operatorId) : null;
      let group = null;
      let manager = null;

      if (groupId) {
        group = await storage.getOperatorGroup(groupId);
        if (group?.managerId) {
          manager = await storage.getManager(group.managerId);
        }
      } else if (operator?.groupId) {
        group = await storage.getOperatorGroup(operator.groupId);
        if (group?.managerId) {
          manager = await storage.getManager(group.managerId);
        }
      }

      const analysis = await analyzeOperatorLogs(logs, operator, group, dateRangeText);

      const report = await storage.createAnalysisReport({
        nmsSystemId,
        operatorId: operatorId || null,
        groupId: groupId || group?.id || null,
        managerId: manager?.id || null,
        reportType,
        dateRange: dateRangeText,
        summary: analysis.summary,
        totalOperations: analysis.totalOperations,
        successfulOperations: analysis.successfulOperations,
        failedOperations: analysis.failedOperations,
        violations: analysis.violations,
        risks: analysis.risks,
        recommendations: analysis.recommendations,
        complianceScore: analysis.complianceScore,
        sentToEmail: false,
        sentAt: null,
      });

      res.status(201).json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Comprehensive Log Analysis Endpoint
  app.post("/api/nms-systems/:id/analyze", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { startDate, endDate, format = 'json' } = req.body;

      const system = await storage.getNmsSystem(id);
      if (!system) {
        return res.status(404).json({ message: "NMS System not found" });
      }

      const queryStartDate = startDate ? new Date(startDate) : undefined;
      const queryEndDate = endDate ? new Date(endDate) : undefined;

      const logs = await storage.getNmsLogs({
        nmsSystemId: id,
        startDate: queryStartDate,
        endDate: queryEndDate,
      });

      if (logs.length === 0) {
        return res.status(400).json({ message: "No logs found for analysis" });
      }

      const operators = await storage.getOperators({ nmsSystemId: id });
      const groups = await storage.getOperatorGroups({ nmsSystemId: id });
      const managers = await storage.getManagers(id);

      const analysis = analyzeNmsLogs(logs, operators, groups, managers);

      if (format === 'html') {
        const sanitizedName = system.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
        const htmlReport = generateHtmlReport(analysis, system.name);
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename="analysis-report-${sanitizedName}.html"`);
        return res.send(htmlReport);
      }

      res.json(analysis);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Analysis Summary for NMS System
  app.get("/api/nms-systems/:id/analysis-summary", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const system = await storage.getNmsSystem(id);
      if (!system) {
        return res.status(404).json({ message: "NMS System not found" });
      }

      const logs = await storage.getNmsLogs({ nmsSystemId: id });
      
      if (logs.length === 0) {
        return res.json({
          hasData: false,
          message: "No logs available for analysis",
        });
      }

      const operators = await storage.getOperators({ nmsSystemId: id });
      const groups = await storage.getOperatorGroups({ nmsSystemId: id });
      const managers = await storage.getManagers(id);

      const analysis = analyzeNmsLogs(logs, operators, groups, managers);

      res.json({
        hasData: true,
        overview: analysis.overview,
        performanceMetrics: analysis.performanceMetrics,
        anomaliesCount: analysis.anomalies.length,
        criticalAnomalies: analysis.anomalies.filter(a => a.severity === 'CRITICAL').length,
        recommendations: analysis.recommendations,
        executiveSummary: analysis.executiveSummary,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send Report Email
  app.post("/api/analysis-reports/:id/send-email", authenticateToken, async (req: Request, res: Response) => {
    try {
      const report = await storage.getAnalysisReport(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      if (!report.managerId) {
        return res.status(400).json({ message: "No manager assigned to this report" });
      }

      const manager = await storage.getManager(report.managerId);
      if (!manager) {
        return res.status(400).json({ message: "Manager not found" });
      }

      // TODO: Implement actual email sending here using nodemailer or similar
      // For now, we just mark it as sent
      const updatedReport = await storage.updateAnalysisReport(req.params.id, {
        sentToEmail: true,
        sentAt: new Date(),
      });

      res.json({ 
        message: `Report sent to ${manager.email}`,
        report: updatedReport,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // System Health Endpoint (CPU/RAM)
  app.get("/api/system-health", authenticateToken, async (req: Request, res: Response) => {
    try {
      const os = require('os');
      
      const cpuUsage = os.loadavg()[0];
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;

      res.json({
        cpu: {
          loadAverage: cpuUsage.toFixed(2),
          cores: os.cpus().length,
        },
        memory: {
          total: (totalMemory / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
          used: (usedMemory / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
          free: (freeMemory / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
          usagePercent: memoryUsagePercent.toFixed(1) + '%',
        },
        uptime: os.uptime(),
        platform: os.platform(),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Data Retention - Delete old logs
  app.post("/api/nms-systems/:id/cleanup", authenticateToken, async (req: Request, res: Response) => {
    try {
      const system = await storage.getNmsSystem(req.params.id);
      if (!system) {
        return res.status(404).json({ message: "NMS System not found" });
      }

      const deletedCount = await storage.deleteOldNmsLogs(req.params.id, system.retentionDays);
      
      res.json({ 
        message: `Cleanup completed`,
        retentionDays: system.retentionDays,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Database Management - Clear all NMS data
  app.delete("/api/admin/clear-nms-data", authenticateToken, async (req: Request, res: Response) => {
    try {
      const result = await storage.clearAllNmsData();
      res.json({ 
        message: "All NMS data cleared successfully",
        deleted: result
      });
    } catch (error: any) {
      console.error("Clear NMS data error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Database Management - Clear all legacy data (employees, logs, reports)
  app.delete("/api/admin/clear-legacy-data", authenticateToken, async (req: Request, res: Response) => {
    try {
      const result = await storage.clearAllLegacyData();
      res.json({ 
        message: "All legacy data cleared successfully",
        deleted: result
      });
    } catch (error: any) {
      console.error("Clear legacy data error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Database Statistics
  app.get("/api/admin/db-stats", authenticateToken, async (req: Request, res: Response) => {
    try {
      const nmsSystems = await storage.getNmsSystems();
      const nmsLogs = await storage.getNmsLogs({ limit: 100000 });
      const analysisReports = await storage.getAnalysisReports({});
      const operators = await storage.getOperators({});
      const operatorGroups = await storage.getOperatorGroups({});
      const managers = await storage.getManagers();
      const employees = await storage.getEmployees({});
      const logs = await storage.getLogs({});
      const reports = await storage.getReports({});

      res.json({
        nms: {
          systems: nmsSystems.length,
          logs: nmsLogs.length,
          analysisReports: analysisReports.length,
          operators: operators.length,
          operatorGroups: operatorGroups.length,
          managers: managers.length
        },
        legacy: {
          employees: employees.length,
          logs: logs.length,
          reports: reports.length
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Syslog Statistics - Get real-time syslog receiver stats
  app.get("/api/syslog/stats", authenticateToken, async (req: Request, res: Response) => {
    try {
      const stats = getSyslogStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Syslog Simulation - Generate test logs from multiple sources
  app.post("/api/syslog/simulate", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { count = 100, sources } = req.body;
      
      const defaultSources = [
        "192.168.1.10",
        "192.168.1.20", 
        "10.0.0.50",
        "172.16.0.100",
        "192.168.100.1"
      ];

      const sourcesToUse = sources && Array.isArray(sources) && sources.length > 0 
        ? sources 
        : defaultSources;

      const maxCount = Math.min(count, 1000);
      
      const result = await simulateSyslogMessages(maxCount, sourcesToUse);
      
      res.json({
        message: `Successfully simulated ${result.simulated} syslog messages`,
        ...result
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Telecom Logs Simulation - Generate realistic telecom NMS logs from 20 sources
  app.post("/api/telecom/simulate", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { count = 500, sourcesCount = 20 } = req.body;
      const maxCount = Math.min(count, 5000);
      const maxSources = Math.min(sourcesCount, 20);
      
      const result = await simulateTelecomLogs(maxCount, maxSources);
      
      res.json({
        message: `Successfully simulated ${result.simulated} telecom logs from ${result.sources} sources`,
        ...result
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Email Settings Routes
  app.get("/api/email-settings", authenticateToken, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getEmailSettings();
      if (settings) {
        const safeSettings = { ...settings, smtpPassword: '********' };
        res.json(safeSettings);
      } else {
        res.json(null);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/email-settings", authenticateToken, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getEmailSettings();
      
      // Prepare the data to save
      let dataToSave = { ...req.body };
      
      // If password is empty or masked (********), preserve the existing password
      if (existing && (!dataToSave.smtpPassword || dataToSave.smtpPassword === '********' || dataToSave.smtpPassword === '')) {
        dataToSave.smtpPassword = existing.smtpPassword;
      }
      
      if (existing) {
        const updated = await storage.updateEmailSettings(existing.id, dataToSave);
        res.json({ ...updated, smtpPassword: '********' });
      } else {
        const created = await storage.createEmailSettings(dataToSave);
        res.json({ ...created, smtpPassword: '********' });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/email-settings/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      await storage.deleteEmailSettings(req.params.id);
      res.json({ message: "Email settings deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Test email connection
  app.post("/api/email-settings/test", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { smtpHost, smtpPort, smtpUser, smtpPassword, fromEmail, fromName, enableSsl } = req.body;
      
      // Use provided values from form or fall back to saved settings
      let testSettings = {
        smtpHost,
        smtpPort,
        smtpUser: smtpUser || "",
        smtpPassword: smtpPassword || "",
        fromEmail,
        fromName,
        enableSsl
      };
      
      // If no form values provided, try to use saved settings
      if (!testSettings.smtpHost) {
        const savedSettings = await storage.getEmailSettings();
        if (!savedSettings) {
          return res.status(400).json({ 
            message: "Please provide SMTP host and port to test connection", 
            success: false 
          });
        }
        // Map database field names to form field names
        testSettings = {
          smtpHost: savedSettings.smtpHost,
          smtpPort: savedSettings.smtpPort,
          smtpUser: savedSettings.smtpUser || "",
          smtpPassword: savedSettings.smtpPassword || "",
          fromEmail: savedSettings.fromEmail,
          fromName: savedSettings.fromName || "",
          enableSsl: savedSettings.smtpSecure ?? true
        };
      }
      
      // Validate required fields
      if (!testSettings.smtpHost || !testSettings.fromEmail) {
        return res.status(400).json({ 
          message: "SMTP Host and From Email are required for testing", 
          success: false 
        });
      }
      
      // Validate port number
      const portNum = parseInt(String(testSettings.smtpPort));
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        return res.status(400).json({ 
          message: "Invalid SMTP port number", 
          success: false 
        });
      }
      
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(testSettings.fromEmail)) {
        return res.status(400).json({ 
          message: "Invalid from email address", 
          success: false 
        });
      }
      
      // Create nodemailer transporter and test connection
      // Get local hostname for EHLO command
      const os = await import('os');
      const localHostname = os.hostname() || 'localhost';
      
      const transporterConfig: any = {
        host: testSettings.smtpHost,
        port: portNum,
        secure: testSettings.enableSsl && portNum === 465, // true for 465, false for other ports
        connectionTimeout: 30000, // 30 second timeout for connection
        greetingTimeout: 30000, // 30 second timeout for greeting
        socketTimeout: 60000, // 60 second socket timeout
        name: localHostname, // Hostname for EHLO/HELO command
        ignoreTLS: !testSettings.enableSsl, // Ignore TLS when SSL is disabled
        requireTLS: false, // Don't require TLS upgrade
        opportunisticTLS: false, // Don't try to upgrade to TLS
      };
      
      // Add TLS options - completely disable for non-SSL
      if (!testSettings.enableSsl) {
        transporterConfig.tls = {
          rejectUnauthorized: false
        };
        transporterConfig.secure = false;
      } else if (testSettings.enableSsl && portNum !== 465) {
        transporterConfig.tls = {
          rejectUnauthorized: false // Allow self-signed certificates
        };
      }
      
      // Add authentication if credentials provided
      if (testSettings.smtpUser && testSettings.smtpPassword) {
        transporterConfig.auth = {
          user: testSettings.smtpUser,
          pass: testSettings.smtpPassword
        };
      }
      
      console.log(`[SMTP Test] Connecting to ${testSettings.smtpHost}:${portNum} (SSL: ${testSettings.enableSsl}, Auth: ${!!testSettings.smtpUser}, Hostname: ${localHostname})`);
      console.log(`[SMTP Test] Config:`, JSON.stringify(transporterConfig, null, 2));
      
      const transporter = nodemailer.createTransport(transporterConfig);
      
      // Verify SMTP connection
      await transporter.verify();
      
      // Success - connection verified
      const authInfo = testSettings.smtpUser ? "with authentication" : "without authentication";
      res.json({ 
        message: `SMTP connection successful (${authInfo}). Host: ${testSettings.smtpHost}:${portNum}`, 
        success: true 
      });
    } catch (error: any) {
      // Log detailed error for debugging
      console.error(`[SMTP Test Error] Code: ${error.code}, Message: ${error.message}`);
      
      // Provide helpful error messages based on error type
      let errorMessage = error.message || "SMTP connection failed";
      
      if (error.code === 'ECONNREFUSED') {
        errorMessage = `Connection refused - SMTP server at ${req.body.smtpHost}:${req.body.smtpPort} is not accepting connections. Check if the server is running and the port is open.`;
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = `Connection timed out - Could not reach ${req.body.smtpHost}:${req.body.smtpPort}. Check firewall rules and network connectivity.`;
      } else if (error.code === 'ESOCKET') {
        errorMessage = `Socket error - Network issue connecting to ${req.body.smtpHost}:${req.body.smtpPort}. Verify the server is reachable and port ${req.body.smtpPort} is open.`;
      } else if (error.code === 'EAUTH' || error.responseCode === 535) {
        errorMessage = `Authentication failed - check username and password`;
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = `Host not found - verify SMTP host address: ${req.body.smtpHost}`;
      } else if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        errorMessage = `SSL/TLS certificate error - try disabling SSL or contact your email provider`;
      } else if (error.code === 'ECONNRESET') {
        errorMessage = `Connection reset by server - the SMTP server closed the connection unexpectedly`;
      }
      
      res.status(400).json({ 
        message: errorMessage, 
        success: false,
        errorCode: error.code || 'UNKNOWN',
        details: error.message
      });
    }
  });

  // Scheduled Reports Routes
  app.get("/api/scheduled-reports", authenticateToken, async (req: Request, res: Response) => {
    try {
      const reports = await storage.getScheduledReports();
      res.json(reports);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/scheduled-reports/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const report = await storage.getScheduledReport(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Scheduled report not found" });
      }
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/scheduled-reports", authenticateToken, async (req: Request, res: Response) => {
    try {
      // Map frontend field names to database field names
      const reportData = {
        name: req.body.name,
        emailSubject: req.body.emailSubject || null,
        recipientEmails: req.body.recipients || req.body.recipientEmails,
        frequency: req.body.frequency,
        reportType: req.body.reportType,
        nmsSystemId: req.body.nmsSystemId || null,
        nmsSystemIds: req.body.nmsSystemIds || null,
        includeViolations: req.body.includeViolations ?? true,
        includeFailedOps: req.body.includeFailedOps ?? true,
        includeOperatorStats: req.body.includeOperatorStats ?? true,
        isActive: req.body.isActive ?? true,
      };
      const report = await storage.createScheduledReport(reportData);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/scheduled-reports/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      // Map frontend field names to database field names
      const updateData: any = {};
      if (req.body.name) updateData.name = req.body.name;
      if (req.body.emailSubject !== undefined) updateData.emailSubject = req.body.emailSubject;
      if (req.body.recipients) updateData.recipientEmails = req.body.recipients;
      if (req.body.recipientEmails) updateData.recipientEmails = req.body.recipientEmails;
      if (req.body.frequency) updateData.frequency = req.body.frequency;
      if (req.body.reportType) updateData.reportType = req.body.reportType;
      if (req.body.nmsSystemId !== undefined) updateData.nmsSystemId = req.body.nmsSystemId;
      if (req.body.nmsSystemIds !== undefined) updateData.nmsSystemIds = req.body.nmsSystemIds;
      if (req.body.includeViolations !== undefined) updateData.includeViolations = req.body.includeViolations;
      if (req.body.includeFailedOps !== undefined) updateData.includeFailedOps = req.body.includeFailedOps;
      if (req.body.includeOperatorStats !== undefined) updateData.includeOperatorStats = req.body.includeOperatorStats;
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
      
      const report = await storage.updateScheduledReport(req.params.id, updateData);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send report now (for testing)
  app.post("/api/scheduled-reports/:id/send-now", authenticateToken, async (req: Request, res: Response) => {
    try {
      const report = await storage.getScheduledReport(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Scheduled report not found", success: false });
      }
      
      // Get email settings
      const settings = await storage.getEmailSettings();
      if (!settings) {
        return res.status(400).json({ message: "Email settings not configured", success: false });
      }
      
      // Create transporter
      const os = await import('os');
      const localHostname = os.hostname() || 'localhost';
      
      const transporterConfig: any = {
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.smtpSecure && settings.smtpPort === 465,
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
        name: localHostname,
        ignoreTLS: !settings.smtpSecure,
        requireTLS: false,
        opportunisticTLS: false,
      };
      
      // Add TLS options - allow self-signed certificates
      if (!settings.smtpSecure) {
        transporterConfig.tls = { rejectUnauthorized: false };
        transporterConfig.secure = false;
      } else if (settings.smtpSecure && settings.smtpPort !== 465) {
        // For STARTTLS (ports like 25, 587), still allow self-signed certificates
        transporterConfig.tls = { rejectUnauthorized: false };
      } else {
        // For port 465 (implicit TLS), also allow self-signed certificates
        transporterConfig.tls = { rejectUnauthorized: false };
      }
      
      if (settings.smtpUser && settings.smtpPassword) {
        transporterConfig.auth = {
          user: settings.smtpUser,
          pass: settings.smtpPassword
        };
      }
      
      const transporter = nodemailer.createTransport(transporterConfig);
      
      // Generate report content
      const reportDate = new Date().toLocaleDateString();
      let subject = report.emailSubject || `[NMS Report] ${report.name}`;
      subject = subject.replace('{date}', reportDate);
      
      // Get NMS systems for the report
      let nmsSystemNames: string[] = [];
      if (report.nmsSystemIds) {
        const systemIds = report.nmsSystemIds.split(',').filter(id => id.trim());
        for (const id of systemIds) {
          const system = await storage.getNmsSystem(id);
          if (system) {
            nmsSystemNames.push(system.name);
          }
        }
      }
      
      // Generate analysis reports for each NMS system and create attachments
      const attachments: Array<{ filename: string; content: string; contentType: string }> = [];
      let totalLogs = 0;
      let totalViolations = 0;
      let totalFailed = 0;
      
      if (report.nmsSystemIds) {
        const systemIds = report.nmsSystemIds.split(',').filter(id => id.trim());
        for (const systemId of systemIds) {
          try {
            const system = await storage.getNmsSystem(systemId);
            if (system) {
              const logs = await storage.getNmsLogs({ nmsSystemId: systemId, limit: 50000 });
              const operators = await storage.getOperators(systemId);
              const groups = await storage.getOperatorGroups(systemId);
              const managers = await storage.getManagers(systemId);
              
              if (logs.length > 0) {
                const analysis = analyzeNmsLogs(logs, operators, groups, managers);
                const htmlReport = generateHtmlReport(analysis, system.name);
                
                const sanitizedName = system.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
                attachments.push({
                  filename: `analysis-report-${sanitizedName}.html`,
                  content: htmlReport,
                  contentType: 'text/html'
                });
                
                totalLogs += analysis.overview.totalLogs;
                totalViolations += analysis.overview.totalViolations;
                totalFailed += logs.filter(l => l.result === 'Failed').length;
              }
            }
          } catch (err) {
            console.error(`Error generating report for system ${systemId}:`, err);
          }
        }
      }
      
      // Generate email body content
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header { background-color: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -30px -30px 30px -30px; }
            .header h1 { margin: 0; font-size: 24px; }
            .section { margin-bottom: 20px; padding: 15px; background-color: #f9fafb; border-radius: 6px; }
            .section-title { font-weight: bold; color: #374151; margin-bottom: 10px; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
            .label { color: #6b7280; }
            .value { font-weight: 500; color: #111827; }
            .stat-box { display: inline-block; padding: 15px 25px; margin: 5px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border-radius: 8px; text-align: center; }
            .stat-number { font-size: 28px; font-weight: bold; display: block; }
            .stat-label { font-size: 12px; opacity: 0.9; }
            .warning { color: #dc2626; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${report.name}</h1>
            </div>
            
            <div class="section">
              <div class="section-title">Report Summary</div>
              <div style="text-align: center; padding: 20px 0;">
                <div class="stat-box">
                  <span class="stat-number">${totalLogs.toLocaleString()}</span>
                  <span class="stat-label">Total Logs</span>
                </div>
                <div class="stat-box" style="background: ${totalViolations > 0 ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'};">
                  <span class="stat-number">${totalViolations}</span>
                  <span class="stat-label">Violations</span>
                </div>
                <div class="stat-box" style="background: ${totalFailed > 0 ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'};">
                  <span class="stat-number">${totalFailed}</span>
                  <span class="stat-label">Failed Operations</span>
                </div>
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">Report Details</div>
              <div class="info-row">
                <span class="label">Report Type:</span>
                <span class="value">${report.reportType}</span>
              </div>
              <div class="info-row">
                <span class="label">Frequency:</span>
                <span class="value">${report.frequency}</span>
              </div>
              <div class="info-row">
                <span class="label">Generated:</span>
                <span class="value">${new Date().toLocaleString()}</span>
              </div>
              ${nmsSystemNames.length > 0 ? `
              <div class="info-row">
                <span class="label">NMS Systems:</span>
                <span class="value">${nmsSystemNames.join(', ')}</span>
              </div>
              ` : ''}
              <div class="info-row">
                <span class="label">Attachments:</span>
                <span class="value">${attachments.length} HTML Report(s)</span>
              </div>
            </div>
            
            ${attachments.length > 0 ? `
            <div class="section">
              <div class="section-title">Attached Reports</div>
              <p>Please find the detailed analysis reports attached to this email:</p>
              <ul>
                ${attachments.map(a => `<li>${a.filename}</li>`).join('')}
              </ul>
              <p style="color: #6b7280; font-size: 12px;">Open the HTML files in any web browser to view the full analysis with charts and detailed statistics.</p>
            </div>
            ` : `
            <div class="section">
              <div class="section-title">No Data Available</div>
              <p>No logs were found for the selected NMS systems. Reports will be generated once log data is available.</p>
            </div>
            `}
            
            <div class="footer">
              <p>This email was sent by Tracer Logs NMS - Log Analysis & Monitoring System</p>
              <p>Sent to: ${report.recipientEmails}</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      // Parse recipients
      const recipients = report.recipientEmails.split(',').map(e => e.trim()).filter(e => e);
      
      // Send email with attachments
      const mailOptions: any = {
        from: `"${settings.fromName || 'Tracer Logs System'}" <${settings.fromEmail}>`,
        to: recipients.join(', '),
        subject: subject,
        html: htmlContent,
      };
      
      // Add attachments if any
      if (attachments.length > 0) {
        mailOptions.attachments = attachments.map(a => ({
          filename: a.filename,
          content: Buffer.from(a.content, 'utf-8'),
          contentType: a.contentType,
        }));
      }
      
      await transporter.sendMail(mailOptions);
      
      // Update last sent timestamp
      await storage.updateScheduledReport(req.params.id, {
        lastSentAt: new Date(),
      });
      
      res.json({ 
        message: `Report email sent successfully to ${recipients.length} recipient(s)`, 
        success: true 
      });
    } catch (error: any) {
      console.error('[Send Now Error]', error);
      res.status(500).json({ message: error.message, success: false });
    }
  });

  app.delete("/api/scheduled-reports/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      await storage.deleteScheduledReport(req.params.id);
      res.json({ message: "Scheduled report deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Dashboard - Violations with Operator Details
  app.get("/api/dashboard/violations", authenticateToken, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const violations = await storage.getViolationsWithOperators(limit);
      res.json(violations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Dashboard - Failed Operations with Operator Details
  app.get("/api/dashboard/failed-operations", authenticateToken, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const failedOps = await storage.getFailedOperationsWithOperators(limit);
      res.json(failedOps);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Dashboard - Operator Statistics
  app.get("/api/dashboard/operator-stats", authenticateToken, async (req: Request, res: Response) => {
    try {
      const operatorStats = await storage.getOperatorStats();
      res.json(operatorStats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
  
  return httpServer;
}
