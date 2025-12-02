import { sql } from "drizzle-orm";
import { mysqlTable, text, varchar, timestamp, int, boolean } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  email: text("email").notNull(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const employees = mysqlTable("employees", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  department: text("department").notNull(),
  jobDescription: text("job_description"),
  rules: text("rules"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const logs = mysqlTable("logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  employeeId: varchar("employee_id", { length: 36 }).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  source: text("source").notNull(),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reports = mysqlTable("reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  employeeId: varchar("employee_id", { length: 36 }).notNull(),
  reportType: text("report_type").notNull().default("performance"),
  dateRange: text("date_range").notNull(),
  summary: text("summary").notNull(),
  actions: text("actions"),
  risks: text("risks"),
  violations: text("violations"),
  nextSteps: text("next_steps"),
  metrics: text("metrics"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const templates = mysqlTable("templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  name: text("name").notNull(),
  role: text("role").notNull(),
  jobDescription: text("job_description"),
  policies: text("policies"),
  employeeIds: text("employee_ids"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const nmsSystems = mysqlTable("nms_systems", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  name: text("name").notNull(),
  description: text("description"),
  ipAddress: text("ip_address"),
  port: int("port").default(514),
  systemType: text("system_type").notNull().default("huawei_nms"),
  connectionType: text("connection_type").notNull().default("upload"),
  status: text("status").notNull().default("active"),
  retentionDays: int("retention_days").notNull().default(30),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const managers = mysqlTable("managers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  department: text("department"),
  nmsSystemId: varchar("nms_system_id", { length: 36 }),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const operatorGroups = mysqlTable("operator_groups", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  name: text("name").notNull(),
  managerId: varchar("manager_id", { length: 36 }),
  nmsSystemId: varchar("nms_system_id", { length: 36 }),
  jobDescription: text("job_description"),
  rules: text("rules"),
  allowedOperations: text("allowed_operations"),
  restrictedOperations: text("restricted_operations"),
  workingHours: text("working_hours"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const operators = mysqlTable("operators", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  username: text("username").notNull(),
  fullName: text("full_name"),
  email: text("email"),
  groupId: varchar("group_id", { length: 36 }),
  nmsSystemId: varchar("nms_system_id", { length: 36 }),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const nmsLogs = mysqlTable("nms_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  nmsSystemId: varchar("nms_system_id", { length: 36 }).notNull(),
  operatorId: varchar("operator_id", { length: 36 }),
  operatorUsername: text("operator_username").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  operation: text("operation").notNull(),
  level: text("level").notNull().default("Minor"),
  source: text("source"),
  terminalIp: text("terminal_ip"),
  operationObject: text("operation_object"),
  result: text("result").notNull(),
  details: text("details"),
  isViolation: boolean("is_violation").default(false),
  violationType: text("violation_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analysisReports = mysqlTable("analysis_reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  nmsSystemId: varchar("nms_system_id", { length: 36 }).notNull(),
  operatorId: varchar("operator_id", { length: 36 }),
  groupId: varchar("group_id", { length: 36 }),
  managerId: varchar("manager_id", { length: 36 }),
  reportType: text("report_type").notNull().default("daily"),
  dateRange: text("date_range").notNull(),
  summary: text("summary").notNull(),
  totalOperations: int("total_operations").default(0),
  successfulOperations: int("successful_operations").default(0),
  failedOperations: int("failed_operations").default(0),
  violations: text("violations"),
  risks: text("risks"),
  recommendations: text("recommendations"),
  complianceScore: int("compliance_score"),
  sentToEmail: boolean("sent_to_email").default(false),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const employeesRelations = relations(employees, ({ many }) => ({
  logs: many(logs),
  reports: many(reports),
}));

export const logsRelations = relations(logs, ({ one }) => ({
  employee: one(employees, {
    fields: [logs.employeeId],
    references: [employees.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  employee: one(employees, {
    fields: [reports.employeeId],
    references: [employees.id],
  }),
}));

export const nmsSystemsRelations = relations(nmsSystems, ({ many }) => ({
  managers: many(managers),
  operatorGroups: many(operatorGroups),
  operators: many(operators),
  nmsLogs: many(nmsLogs),
  analysisReports: many(analysisReports),
}));

export const managersRelations = relations(managers, ({ one, many }) => ({
  nmsSystem: one(nmsSystems, {
    fields: [managers.nmsSystemId],
    references: [nmsSystems.id],
  }),
  operatorGroups: many(operatorGroups),
  analysisReports: many(analysisReports),
}));

export const operatorGroupsRelations = relations(operatorGroups, ({ one, many }) => ({
  manager: one(managers, {
    fields: [operatorGroups.managerId],
    references: [managers.id],
  }),
  nmsSystem: one(nmsSystems, {
    fields: [operatorGroups.nmsSystemId],
    references: [nmsSystems.id],
  }),
  operators: many(operators),
  analysisReports: many(analysisReports),
}));

export const operatorsRelations = relations(operators, ({ one, many }) => ({
  group: one(operatorGroups, {
    fields: [operators.groupId],
    references: [operatorGroups.id],
  }),
  nmsSystem: one(nmsSystems, {
    fields: [operators.nmsSystemId],
    references: [nmsSystems.id],
  }),
  nmsLogs: many(nmsLogs),
  analysisReports: many(analysisReports),
}));

export const nmsLogsRelations = relations(nmsLogs, ({ one }) => ({
  nmsSystem: one(nmsSystems, {
    fields: [nmsLogs.nmsSystemId],
    references: [nmsSystems.id],
  }),
  operator: one(operators, {
    fields: [nmsLogs.operatorId],
    references: [operators.id],
  }),
}));

export const analysisReportsRelations = relations(analysisReports, ({ one }) => ({
  nmsSystem: one(nmsSystems, {
    fields: [analysisReports.nmsSystemId],
    references: [nmsSystems.id],
  }),
  operator: one(operators, {
    fields: [analysisReports.operatorId],
    references: [operators.id],
  }),
  group: one(operatorGroups, {
    fields: [analysisReports.groupId],
    references: [operatorGroups.id],
  }),
  manager: one(managers, {
    fields: [analysisReports.managerId],
    references: [managers.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true });
export const insertLogSchema = createInsertSchema(logs).omit({ id: true, createdAt: true });
export const insertReportSchema = createInsertSchema(reports).omit({ id: true, createdAt: true });
export const insertTemplateSchema = createInsertSchema(templates).omit({ id: true, createdAt: true });
export const insertNmsSystemSchema = createInsertSchema(nmsSystems).omit({ id: true, createdAt: true });
export const insertManagerSchema = createInsertSchema(managers).omit({ id: true, createdAt: true });
export const insertOperatorGroupSchema = createInsertSchema(operatorGroups).omit({ id: true, createdAt: true });
export const insertOperatorSchema = createInsertSchema(operators).omit({ id: true, createdAt: true });
export const insertNmsLogSchema = createInsertSchema(nmsLogs).omit({ id: true, createdAt: true });
export const insertAnalysisReportSchema = createInsertSchema(analysisReports).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;
export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type NmsSystem = typeof nmsSystems.$inferSelect;
export type InsertNmsSystem = z.infer<typeof insertNmsSystemSchema>;
export type Manager = typeof managers.$inferSelect;
export type InsertManager = z.infer<typeof insertManagerSchema>;
export type OperatorGroup = typeof operatorGroups.$inferSelect;
export type InsertOperatorGroup = z.infer<typeof insertOperatorGroupSchema>;
export type Operator = typeof operators.$inferSelect;
export type InsertOperator = z.infer<typeof insertOperatorSchema>;
export type NmsLog = typeof nmsLogs.$inferSelect;
export type InsertNmsLog = z.infer<typeof insertNmsLogSchema>;
export type AnalysisReport = typeof analysisReports.$inferSelect;
export type InsertAnalysisReport = z.infer<typeof insertAnalysisReportSchema>;
