import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { hashPassword, comparePassword, generateAccessToken, generateRefreshToken, verifyRefreshToken, authenticateToken } from "./auth";
import { parseCSV, parseJSON, validateLogEntry } from "./services/logs";
import { generateEmployeeReport } from "./services/gemini";
import { parseHuaweiNmsLogs } from "./services/huaweiParser";
import { analyzeOperatorLogs } from "./services/analysisEngine";
import { 
  insertEmployeeSchema, insertLogSchema, insertTemplateSchema,
  insertNmsSystemSchema, insertManagerSchema, insertOperatorGroupSchema,
  insertOperatorSchema
} from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";

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
      const { nmsSystemId, operatorUsername, startDate, endDate, result, limit } = req.query;
      const logs = await storage.getNmsLogs({
        nmsSystemId: nmsSystemId as string | undefined,
        operatorUsername: operatorUsername as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        result: result as string | undefined,
        limit: limit ? parseInt(limit as string) : 1000,
      });
      res.json(logs);
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

      const uniqueOperators = [...new Set(parsedLogs.map(l => l.operatorUsername))];
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
      const { nmsSystemId, operatorId, groupId, dateRange } = req.body;

      if (!nmsSystemId) {
        return res.status(400).json({ message: "NMS System ID is required" });
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
        case "today":
          startDate.setHours(0, 0, 0, 0);
          dateRangeText = "Today";
          break;
        default:
          startDate.setDate(endDate.getDate() - 7);
          dateRangeText = "Last 7 Days";
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
        reportType: 'daily',
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
