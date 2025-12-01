import { 
  users, employees, logs, reports, templates, 
  nmsSystems, managers, operatorGroups, operators, nmsLogs, analysisReports,
  type User, type InsertUser, type Employee, type InsertEmployee, 
  type Log, type InsertLog, type Report, type InsertReport, 
  type Template, type InsertTemplate,
  type NmsSystem, type InsertNmsSystem,
  type Manager, type InsertManager,
  type OperatorGroup, type InsertOperatorGroup,
  type Operator, type InsertOperator,
  type NmsLog, type InsertNmsLog,
  type AnalysisReport, type InsertAnalysisReport
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, like, or, sql, count } from "drizzle-orm";
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

  // NMS System methods
  getNmsSystem(id: string): Promise<NmsSystem | undefined>;
  getNmsSystemByName(name: string): Promise<NmsSystem | undefined>;
  getNmsSystems(): Promise<NmsSystem[]>;
  createNmsSystem(system: InsertNmsSystem): Promise<NmsSystem>;
  updateNmsSystem(id: string, system: Partial<InsertNmsSystem>): Promise<NmsSystem>;
  deleteNmsSystem(id: string): Promise<void>;

  // Manager methods
  getManager(id: string): Promise<Manager | undefined>;
  getManagers(nmsSystemId?: string): Promise<Manager[]>;
  createManager(manager: InsertManager): Promise<Manager>;
  updateManager(id: string, manager: Partial<InsertManager>): Promise<Manager>;
  deleteManager(id: string): Promise<void>;

  // Operator Group methods
  getOperatorGroup(id: string): Promise<OperatorGroup | undefined>;
  getOperatorGroups(filters?: { nmsSystemId?: string; managerId?: string }): Promise<OperatorGroup[]>;
  createOperatorGroup(group: InsertOperatorGroup): Promise<OperatorGroup>;
  updateOperatorGroup(id: string, group: Partial<InsertOperatorGroup>): Promise<OperatorGroup>;
  deleteOperatorGroup(id: string): Promise<void>;

  // Operator methods
  getOperator(id: string): Promise<Operator | undefined>;
  getOperatorByUsername(username: string, nmsSystemId: string): Promise<Operator | undefined>;
  getOperators(filters?: { nmsSystemId?: string; groupId?: string }): Promise<Operator[]>;
  createOperator(operator: InsertOperator): Promise<Operator>;
  updateOperator(id: string, operator: Partial<InsertOperator>): Promise<Operator>;
  deleteOperator(id: string): Promise<void>;

  // NMS Log methods
  getNmsLog(id: string): Promise<NmsLog | undefined>;
  getNmsLogs(filters?: { nmsSystemId?: string; operatorId?: string; operatorUsername?: string; startDate?: Date; endDate?: Date; result?: string; limit?: number }): Promise<NmsLog[]>;
  getNmsLogsPaginated(filters: { nmsSystemId?: string; operatorUsername?: string; startDate?: Date; endDate?: Date; result?: string; level?: string; search?: string }, offset: number, limit: number): Promise<NmsLog[]>;
  getNmsLogsCount(filters: { nmsSystemId?: string; operatorUsername?: string; startDate?: Date; endDate?: Date; result?: string; level?: string; search?: string }): Promise<number>;
  createNmsLog(log: InsertNmsLog): Promise<NmsLog>;
  createNmsLogs(logs: InsertNmsLog[]): Promise<NmsLog[]>;
  getNmsLogStats(nmsSystemId: string): Promise<{ total: number; successful: number; failed: number }>;
  deleteOldNmsLogs(nmsSystemId: string, olderThanDays: number): Promise<number>;
  deleteAllNmsLogs(nmsSystemId: string): Promise<number>;

  // Analysis Report methods
  getAnalysisReport(id: string): Promise<AnalysisReport | undefined>;
  getAnalysisReports(filters?: { nmsSystemId?: string; operatorId?: string; groupId?: string; managerId?: string }): Promise<AnalysisReport[]>;
  createAnalysisReport(report: InsertAnalysisReport): Promise<AnalysisReport>;
  updateAnalysisReport(id: string, report: Partial<InsertAnalysisReport>): Promise<AnalysisReport>;
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

  // NMS System methods
  async getNmsSystem(id: string): Promise<NmsSystem | undefined> {
    const result = await db.select().from(nmsSystems).where(eq(nmsSystems.id, id));
    return result[0] || undefined;
  }

  async getNmsSystemByName(name: string): Promise<NmsSystem | undefined> {
    const result = await db.select().from(nmsSystems).where(eq(nmsSystems.name, name));
    return result[0] || undefined;
  }

  async getNmsSystems(): Promise<NmsSystem[]> {
    return db.select().from(nmsSystems).orderBy(desc(nmsSystems.createdAt));
  }

  async createNmsSystem(insertSystem: InsertNmsSystem): Promise<NmsSystem> {
    const id = uuidv4();
    await db.insert(nmsSystems).values({ ...insertSystem, id } as any);
    const result = await db.select().from(nmsSystems).where(eq(nmsSystems.id, id));
    return result[0];
  }

  async updateNmsSystem(id: string, updateData: Partial<InsertNmsSystem>): Promise<NmsSystem> {
    await db.update(nmsSystems).set(updateData as any).where(eq(nmsSystems.id, id));
    const result = await db.select().from(nmsSystems).where(eq(nmsSystems.id, id));
    return result[0];
  }

  async deleteNmsSystem(id: string): Promise<void> {
    await db.delete(nmsSystems).where(eq(nmsSystems.id, id));
  }

  // Manager methods
  async getManager(id: string): Promise<Manager | undefined> {
    const result = await db.select().from(managers).where(eq(managers.id, id));
    return result[0] || undefined;
  }

  async getManagers(nmsSystemId?: string): Promise<Manager[]> {
    if (nmsSystemId) {
      return db.select().from(managers).where(eq(managers.nmsSystemId, nmsSystemId)).orderBy(desc(managers.createdAt));
    }
    return db.select().from(managers).orderBy(desc(managers.createdAt));
  }

  async createManager(insertManager: InsertManager): Promise<Manager> {
    const id = uuidv4();
    await db.insert(managers).values({ ...insertManager, id } as any);
    const result = await db.select().from(managers).where(eq(managers.id, id));
    return result[0];
  }

  async updateManager(id: string, updateData: Partial<InsertManager>): Promise<Manager> {
    await db.update(managers).set(updateData as any).where(eq(managers.id, id));
    const result = await db.select().from(managers).where(eq(managers.id, id));
    return result[0];
  }

  async deleteManager(id: string): Promise<void> {
    await db.delete(managers).where(eq(managers.id, id));
  }

  // Operator Group methods
  async getOperatorGroup(id: string): Promise<OperatorGroup | undefined> {
    const result = await db.select().from(operatorGroups).where(eq(operatorGroups.id, id));
    return result[0] || undefined;
  }

  async getOperatorGroups(filters?: { nmsSystemId?: string; managerId?: string }): Promise<OperatorGroup[]> {
    const conditions = [];
    if (filters?.nmsSystemId) {
      conditions.push(eq(operatorGroups.nmsSystemId, filters.nmsSystemId));
    }
    if (filters?.managerId) {
      conditions.push(eq(operatorGroups.managerId, filters.managerId));
    }

    if (conditions.length > 0) {
      return db.select().from(operatorGroups).where(and(...conditions)!).orderBy(desc(operatorGroups.createdAt));
    }
    return db.select().from(operatorGroups).orderBy(desc(operatorGroups.createdAt));
  }

  async createOperatorGroup(insertGroup: InsertOperatorGroup): Promise<OperatorGroup> {
    const id = uuidv4();
    await db.insert(operatorGroups).values({ ...insertGroup, id } as any);
    const result = await db.select().from(operatorGroups).where(eq(operatorGroups.id, id));
    return result[0];
  }

  async updateOperatorGroup(id: string, updateData: Partial<InsertOperatorGroup>): Promise<OperatorGroup> {
    await db.update(operatorGroups).set(updateData as any).where(eq(operatorGroups.id, id));
    const result = await db.select().from(operatorGroups).where(eq(operatorGroups.id, id));
    return result[0];
  }

  async deleteOperatorGroup(id: string): Promise<void> {
    await db.delete(operatorGroups).where(eq(operatorGroups.id, id));
  }

  // Operator methods
  async getOperator(id: string): Promise<Operator | undefined> {
    const result = await db.select().from(operators).where(eq(operators.id, id));
    return result[0] || undefined;
  }

  async getOperatorByUsername(username: string, nmsSystemId: string): Promise<Operator | undefined> {
    const result = await db.select().from(operators).where(
      and(eq(operators.username, username), eq(operators.nmsSystemId, nmsSystemId))
    );
    return result[0] || undefined;
  }

  async getOperators(filters?: { nmsSystemId?: string; groupId?: string }): Promise<Operator[]> {
    const conditions = [];
    if (filters?.nmsSystemId) {
      conditions.push(eq(operators.nmsSystemId, filters.nmsSystemId));
    }
    if (filters?.groupId) {
      conditions.push(eq(operators.groupId, filters.groupId));
    }

    if (conditions.length > 0) {
      return db.select().from(operators).where(and(...conditions)!).orderBy(desc(operators.createdAt));
    }
    return db.select().from(operators).orderBy(desc(operators.createdAt));
  }

  async createOperator(insertOperator: InsertOperator): Promise<Operator> {
    const id = uuidv4();
    await db.insert(operators).values({ ...insertOperator, id } as any);
    const result = await db.select().from(operators).where(eq(operators.id, id));
    return result[0];
  }

  async updateOperator(id: string, updateData: Partial<InsertOperator>): Promise<Operator> {
    await db.update(operators).set(updateData as any).where(eq(operators.id, id));
    const result = await db.select().from(operators).where(eq(operators.id, id));
    return result[0];
  }

  async deleteOperator(id: string): Promise<void> {
    await db.delete(operators).where(eq(operators.id, id));
  }

  // NMS Log methods
  async getNmsLog(id: string): Promise<NmsLog | undefined> {
    const result = await db.select().from(nmsLogs).where(eq(nmsLogs.id, id));
    return result[0] || undefined;
  }

  async getNmsLogs(filters?: { nmsSystemId?: string; operatorId?: string; operatorUsername?: string; startDate?: Date; endDate?: Date; result?: string; limit?: number }): Promise<NmsLog[]> {
    const conditions = [];
    if (filters?.nmsSystemId) {
      conditions.push(eq(nmsLogs.nmsSystemId, filters.nmsSystemId));
    }
    if (filters?.operatorId) {
      conditions.push(eq(nmsLogs.operatorId, filters.operatorId));
    }
    if (filters?.operatorUsername) {
      conditions.push(eq(nmsLogs.operatorUsername, filters.operatorUsername));
    }
    if (filters?.startDate) {
      conditions.push(gte(nmsLogs.timestamp, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(nmsLogs.timestamp, filters.endDate));
    }
    if (filters?.result) {
      conditions.push(eq(nmsLogs.result, filters.result));
    }

    let query = db.select().from(nmsLogs);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)!) as any;
    }

    if (filters?.limit) {
      return query.orderBy(desc(nmsLogs.timestamp)).limit(filters.limit);
    }
    return query.orderBy(desc(nmsLogs.timestamp));
  }

  private buildNmsLogConditions(filters: { nmsSystemId?: string; operatorUsername?: string; startDate?: Date; endDate?: Date; result?: string; level?: string; search?: string }) {
    const conditions = [];
    if (filters.nmsSystemId) {
      conditions.push(eq(nmsLogs.nmsSystemId, filters.nmsSystemId));
    }
    if (filters.operatorUsername) {
      conditions.push(like(nmsLogs.operatorUsername, `%${filters.operatorUsername}%`));
    }
    if (filters.startDate) {
      conditions.push(gte(nmsLogs.timestamp, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(nmsLogs.timestamp, filters.endDate));
    }
    if (filters.result) {
      conditions.push(like(nmsLogs.result, `%${filters.result}%`));
    }
    if (filters.level) {
      conditions.push(eq(nmsLogs.level, filters.level));
    }
    if (filters.search) {
      conditions.push(
        or(
          like(nmsLogs.operation, `%${filters.search}%`),
          like(nmsLogs.operationObject, `%${filters.search}%`),
          like(nmsLogs.details, `%${filters.search}%`)
        )!
      );
    }
    return conditions;
  }

  async getNmsLogsPaginated(filters: { nmsSystemId?: string; operatorUsername?: string; startDate?: Date; endDate?: Date; result?: string; level?: string; search?: string }, offset: number, limit: number): Promise<NmsLog[]> {
    const conditions = this.buildNmsLogConditions(filters);
    
    let query = db.select().from(nmsLogs);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)!) as any;
    }
    
    return query.orderBy(desc(nmsLogs.timestamp)).offset(offset).limit(limit);
  }

  async getNmsLogsCount(filters: { nmsSystemId?: string; operatorUsername?: string; startDate?: Date; endDate?: Date; result?: string; level?: string; search?: string }): Promise<number> {
    const conditions = this.buildNmsLogConditions(filters);
    
    let query = db.select({ count: count() }).from(nmsLogs);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)!) as any;
    }
    
    const result = await query;
    return Number(result[0]?.count || 0);
  }

  async createNmsLog(insertLog: InsertNmsLog): Promise<NmsLog> {
    const id = uuidv4();
    await db.insert(nmsLogs).values({ ...insertLog, id } as any);
    const result = await db.select().from(nmsLogs).where(eq(nmsLogs.id, id));
    return result[0];
  }

  async createNmsLogs(insertLogs: InsertNmsLog[]): Promise<NmsLog[]> {
    const BATCH_SIZE = 500;
    const allCreatedLogs: NmsLog[] = [];

    for (let i = 0; i < insertLogs.length; i += BATCH_SIZE) {
      const batch = insertLogs.slice(i, i + BATCH_SIZE);
      const batchWithIds = batch.map(log => ({ ...log, id: uuidv4() }));
      await db.insert(nmsLogs).values(batchWithIds as any);
      allCreatedLogs.push(...batchWithIds.map(l => ({ ...l } as NmsLog)));
    }

    return allCreatedLogs;
  }

  async getNmsLogStats(nmsSystemId: string): Promise<{ total: number; successful: number; failed: number }> {
    const allLogs = await db.select({ count: count() }).from(nmsLogs).where(eq(nmsLogs.nmsSystemId, nmsSystemId));
    const successLogs = await db.select({ count: count() }).from(nmsLogs).where(
      and(eq(nmsLogs.nmsSystemId, nmsSystemId), eq(nmsLogs.result, "Successful"))
    );
    const failedLogs = await db.select({ count: count() }).from(nmsLogs).where(
      and(eq(nmsLogs.nmsSystemId, nmsSystemId), eq(nmsLogs.result, "Failed"))
    );

    return {
      total: Number(allLogs[0]?.count || 0),
      successful: Number(successLogs[0]?.count || 0),
      failed: Number(failedLogs[0]?.count || 0),
    };
  }

  async deleteOldNmsLogs(nmsSystemId: string, olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await db.delete(nmsLogs).where(
      and(
        eq(nmsLogs.nmsSystemId, nmsSystemId),
        lte(nmsLogs.createdAt, cutoffDate)
      )
    );
    return 0; // Drizzle doesn't return count for delete
  }

  async deleteAllNmsLogs(nmsSystemId: string): Promise<number> {
    const countResult = await db.select({ count: count() }).from(nmsLogs).where(eq(nmsLogs.nmsSystemId, nmsSystemId));
    const deletedCount = Number(countResult[0]?.count || 0);
    
    await db.delete(nmsLogs).where(eq(nmsLogs.nmsSystemId, nmsSystemId));
    return deletedCount;
  }

  // Analysis Report methods
  async getAnalysisReport(id: string): Promise<AnalysisReport | undefined> {
    const result = await db.select().from(analysisReports).where(eq(analysisReports.id, id));
    return result[0] || undefined;
  }

  async getAnalysisReports(filters?: { nmsSystemId?: string; operatorId?: string; groupId?: string; managerId?: string }): Promise<AnalysisReport[]> {
    const conditions = [];
    if (filters?.nmsSystemId) {
      conditions.push(eq(analysisReports.nmsSystemId, filters.nmsSystemId));
    }
    if (filters?.operatorId) {
      conditions.push(eq(analysisReports.operatorId, filters.operatorId));
    }
    if (filters?.groupId) {
      conditions.push(eq(analysisReports.groupId, filters.groupId));
    }
    if (filters?.managerId) {
      conditions.push(eq(analysisReports.managerId, filters.managerId));
    }

    if (conditions.length > 0) {
      return db.select().from(analysisReports).where(and(...conditions)!).orderBy(desc(analysisReports.createdAt));
    }
    return db.select().from(analysisReports).orderBy(desc(analysisReports.createdAt));
  }

  async createAnalysisReport(insertReport: InsertAnalysisReport): Promise<AnalysisReport> {
    const id = uuidv4();
    await db.insert(analysisReports).values({ ...insertReport, id } as any);
    const result = await db.select().from(analysisReports).where(eq(analysisReports.id, id));
    return result[0];
  }

  async updateAnalysisReport(id: string, updateData: Partial<InsertAnalysisReport>): Promise<AnalysisReport> {
    await db.update(analysisReports).set(updateData as any).where(eq(analysisReports.id, id));
    const result = await db.select().from(analysisReports).where(eq(analysisReports.id, id));
    return result[0];
  }
}

export const storage = new DatabaseStorage();
