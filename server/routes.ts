import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { hashPassword, comparePassword, generateAccessToken, generateRefreshToken, verifyRefreshToken, authenticateToken } from "./auth";
import { parseCSV, parseJSON, validateLogEntry } from "./services/logs";
import { generateEmployeeReport } from "./services/gemini";
import { insertEmployeeSchema, insertLogSchema } from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";

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

      const user = await storage.getUserByEmail(email);
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
      res.status(201).json(employee);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/employees/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      const employee = await storage.updateEmployee(req.params.id, req.body);
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

  const httpServer = createServer(app);
  return httpServer;
}
