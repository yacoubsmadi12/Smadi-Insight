import { users, employees, logs, reports, type User, type InsertUser, type Employee, type InsertEmployee, type Log, type InsertLog, type Report, type InsertReport } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, like, or } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Employee methods
  getEmployee(id: string): Promise<Employee | undefined>;
  getEmployees(filters?: { search?: string; role?: string; department?: string; status?: string }): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee>;
  deleteEmployee(id: string): Promise<void>;

  // Log methods
  getLog(id: string): Promise<Log | undefined>;
  getLogs(filters?: { employeeId?: string; source?: string; action?: string; startDate?: Date; endDate?: Date }): Promise<Log[]>;
  createLog(log: InsertLog): Promise<Log>;
  createLogs(logs: InsertLog[]): Promise<Log[]>;

  // Report methods
  getReport(id: string): Promise<Report | undefined>;
  getReports(filters?: { employeeId?: string; reportType?: string; startDate?: Date; endDate?: Date }): Promise<Report[]>;
  createReport(report: InsertReport): Promise<Report>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Employee methods
  async getEmployee(id: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee || undefined;
  }

  async getEmployees(filters?: { search?: string; role?: string; department?: string; status?: string }): Promise<Employee[]> {
    let query = db.select().from(employees);

    const conditions = [];
    if (filters?.search) {
      conditions.push(
        or(
          like(employees.name, `%${filters.search}%`),
          like(employees.email, `%${filters.search}%`)
        )!
      );
    }
    if (filters?.role) {
      conditions.push(eq(employees.role, filters.role));
    }
    if (filters?.department) {
      conditions.push(eq(employees.department, filters.department));
    }
    if (filters?.status) {
      conditions.push(eq(employees.status, filters.status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)!) as any;
    }

    return query.orderBy(desc(employees.createdAt));
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const [employee] = await db.insert(employees).values(insertEmployee).returning();
    return employee;
  }

  async updateEmployee(id: string, updateData: Partial<InsertEmployee>): Promise<Employee> {
    const [employee] = await db.update(employees).set(updateData).where(eq(employees.id, id)).returning();
    return employee;
  }

  async deleteEmployee(id: string): Promise<void> {
    await db.delete(employees).where(eq(employees.id, id));
  }

  // Log methods
  async getLog(id: string): Promise<Log | undefined> {
    const [log] = await db.select().from(logs).where(eq(logs.id, id));
    return log || undefined;
  }

  async getLogs(filters?: { employeeId?: string; source?: string; action?: string; startDate?: Date; endDate?: Date }): Promise<Log[]> {
    let query = db.select().from(logs);

    const conditions = [];
    if (filters?.employeeId) {
      conditions.push(eq(logs.employeeId, filters.employeeId));
    }
    if (filters?.source) {
      conditions.push(eq(logs.source, filters.source));
    }
    if (filters?.action) {
      conditions.push(eq(logs.action, filters.action));
    }
    if (filters?.startDate) {
      conditions.push(gte(logs.timestamp, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(logs.timestamp, filters.endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)!) as any;
    }

    return query.orderBy(desc(logs.timestamp));
  }

  async createLog(insertLog: InsertLog): Promise<Log> {
    const [log] = await db.insert(logs).values(insertLog).returning();
    return log;
  }

  async createLogs(insertLogs: InsertLog[]): Promise<Log[]> {
    const BATCH_SIZE = 100;
    const allCreatedLogs: Log[] = [];

    for (let i = 0; i < insertLogs.length; i += BATCH_SIZE) {
      const batch = insertLogs.slice(i, i + BATCH_SIZE);
      const createdBatch = await db.insert(logs).values(batch).returning();
      allCreatedLogs.push(...createdBatch);
    }

    return allCreatedLogs;
  }

  // Report methods
  async getReport(id: string): Promise<Report | undefined> {
    const [report] = await db.select().from(reports).where(eq(reports.id, id));
    return report || undefined;
  }

  async getReports(filters?: { employeeId?: string; reportType?: string; startDate?: Date; endDate?: Date }): Promise<Report[]> {
    let query = db.select().from(reports);

    const conditions = [];
    if (filters?.employeeId) {
      conditions.push(eq(reports.employeeId, filters.employeeId));
    }
    if (filters?.reportType) {
      conditions.push(eq(reports.reportType, filters.reportType));
    }
    if (filters?.startDate) {
      conditions.push(gte(reports.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(reports.createdAt, filters.endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)!) as any;
    }

    return query.orderBy(desc(reports.createdAt));
  }

  async createReport(insertReport: InsertReport): Promise<Report> {
    const result = await db.insert(reports).values(insertReport as any).returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
