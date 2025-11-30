import { users, employees, logs, reports, templates, type User, type InsertUser, type Employee, type InsertEmployee, type Log, type InsertLog, type Report, type InsertReport, type Template, type InsertTemplate } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, like, or, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByName(name: string): Promise<User | undefined>;
  getUserByEmailOrName(identifier: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Employee methods
  getEmployee(id: string): Promise<Employee | undefined>;
  getEmployees(filters?: { search?: string; role?: string; department?: string; status?: string }): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee>;
  deleteEmployee(id: string): Promise<void>;
  createEmployees(employees: InsertEmployee[]): Promise<Employee[]>;

  // Log methods
  getLog(id: string): Promise<Log | undefined>;
  getLogs(filters?: { employeeId?: string; source?: string; action?: string; startDate?: Date; endDate?: Date }): Promise<Log[]>;
  createLog(log: InsertLog): Promise<Log>;
  createLogs(logs: InsertLog[]): Promise<Log[]>;

  // Report methods
  getReport(id: string): Promise<Report | undefined>;
  getReports(filters?: { employeeId?: string; reportType?: string; startDate?: Date; endDate?: Date }): Promise<Report[]>;
  createReport(report: InsertReport): Promise<Report>;

  // Template methods
  getTemplate(id: string): Promise<Template | undefined>;
  getTemplates(): Promise<Template[]>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: string, template: Partial<InsertTemplate>): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0] || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0] || undefined;
  }

  async getUserByName(name: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.name, name));
    return result[0] || undefined;
  }

  async getUserByEmailOrName(identifier: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(
      or(eq(users.email, identifier), eq(users.name, identifier))
    );
    return result[0] || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = uuidv4();
    await db.insert(users).values({ ...insertUser, id });
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  // Employee methods
  async getEmployee(id: string): Promise<Employee | undefined> {
    const result = await db.select().from(employees).where(eq(employees.id, id));
    return result[0] || undefined;
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
    const id = uuidv4();
    await db.insert(employees).values({ ...insertEmployee, id } as any);
    const result = await db.select().from(employees).where(eq(employees.id, id));
    return result[0];
  }

  async updateEmployee(id: string, updateData: Partial<InsertEmployee>): Promise<Employee> {
    await db.update(employees).set(updateData).where(eq(employees.id, id));
    const result = await db.select().from(employees).where(eq(employees.id, id));
    return result[0];
  }

  async deleteEmployee(id: string): Promise<void> {
    await db.delete(employees).where(eq(employees.id, id));
  }

  // Log methods
  async getLog(id: string): Promise<Log | undefined> {
    const result = await db.select().from(logs).where(eq(logs.id, id));
    return result[0] || undefined;
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
    const id = uuidv4();
    await db.insert(logs).values({ ...insertLog, id } as any);
    const result = await db.select().from(logs).where(eq(logs.id, id));
    return result[0];
  }

  async createLogs(insertLogs: InsertLog[]): Promise<Log[]> {
    const BATCH_SIZE = 100;
    const allCreatedLogs: Log[] = [];

    for (let i = 0; i < insertLogs.length; i += BATCH_SIZE) {
      const batch = insertLogs.slice(i, i + BATCH_SIZE);
      const batchWithIds = batch.map(log => ({ ...log, id: uuidv4() }));
      await db.insert(logs).values(batchWithIds as any);
      
      for (const log of batchWithIds) {
        const result = await db.select().from(logs).where(eq(logs.id, log.id));
        if (result[0]) allCreatedLogs.push(result[0]);
      }
    }

    return allCreatedLogs;
  }

  // Report methods
  async getReport(id: string): Promise<Report | undefined> {
    const result = await db.select().from(reports).where(eq(reports.id, id));
    return result[0] || undefined;
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
    const id = uuidv4();
    await db.insert(reports).values({ ...insertReport, id } as any);
    const result = await db.select().from(reports).where(eq(reports.id, id));
    return result[0];
  }

  // Employee bulk create
  async createEmployees(insertEmployees: InsertEmployee[]): Promise<Employee[]> {
    const BATCH_SIZE = 100;
    const allCreatedEmployees: Employee[] = [];

    for (let i = 0; i < insertEmployees.length; i += BATCH_SIZE) {
      const batch = insertEmployees.slice(i, i + BATCH_SIZE);
      const batchWithIds = batch.map(emp => ({ ...emp, id: uuidv4() }));
      await db.insert(employees).values(batchWithIds as any);
      
      for (const emp of batchWithIds) {
        const result = await db.select().from(employees).where(eq(employees.id, emp.id));
        if (result[0]) allCreatedEmployees.push(result[0]);
      }
    }

    return allCreatedEmployees;
  }

  // Template methods
  async getTemplate(id: string): Promise<Template | undefined> {
    const result = await db.select().from(templates).where(eq(templates.id, id));
    return result[0] || undefined;
  }

  async getTemplates(): Promise<Template[]> {
    return db.select().from(templates).orderBy(desc(templates.createdAt));
  }

  async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    const id = uuidv4();
    await db.insert(templates).values({ ...insertTemplate, id } as any);
    const result = await db.select().from(templates).where(eq(templates.id, id));
    return result[0];
  }

  async updateTemplate(id: string, updateData: Partial<InsertTemplate>): Promise<Template> {
    await db.update(templates).set(updateData as any).where(eq(templates.id, id));
    const result = await db.select().from(templates).where(eq(templates.id, id));
    return result[0];
  }

  async deleteTemplate(id: string): Promise<void> {
    await db.delete(templates).where(eq(templates.id, id));
  }
}

export const storage = new DatabaseStorage();
