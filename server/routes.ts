import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { hashPassword, comparePassword, generateAccessToken, generateRefreshToken, verifyRefreshToken, authenticateToken } from "./auth";
import { parseCSV, parseJSON, validateLogEntry } from "./services/logs";
import { generateEmployeeReport } from "./services/gemini";
import { insertEmployeeSchema, insertLogSchema, insertTemplateSchema } from "@shared/schema";
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
