import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  department: text("department").notNull(),
  jobDescription: text("job_description"),
  rules: text("rules"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const logs = pgTable("logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp").notNull(),
  source: text("source").notNull(),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  reportType: text("report_type").notNull().default("performance"),
  dateRange: text("date_range").notNull(),
  summary: text("summary").notNull(),
  actions: jsonb("actions").notNull().$type<Array<string>>(),
  risks: jsonb("risks").notNull().$type<Array<string>>(),
  violations: jsonb("violations").notNull().$type<Array<string>>(),
  nextSteps: jsonb("next_steps").$type<Array<string>>(),
  metrics: jsonb("metrics").$type<{
    totalActions: number;
    riskCount: number;
    violationCount: number;
    complianceScore?: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  role: text("role").notNull(),
  jobDescription: text("job_description"),
  policies: text("policies"),
  employeeIds: jsonb("employee_ids").notNull().$type<Array<string>>().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// NMS Systems - Each Huawei NMS system (e.g., NCE FAN HQ)
export const nmsSystems = pgTable("nms_systems", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  ipAddress: text("ip_address"),
  port: integer("port").default(514),
  systemType: text("system_type").notNull().default("huawei_nms"),
  connectionType: text("connection_type").notNull().default("upload"),
  status: text("status").notNull().default("active"),
  retentionDays: integer("retention_days").notNull().default(30),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Managers - Technical managers who oversee user groups
export const managers = pgTable("managers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  department: text("department"),
  nmsSystemId: varchar("nms_system_id").references(() => nmsSystems.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Operator Groups - Groups of operators with shared rules and job descriptions
export const operatorGroups = pgTable("operator_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  managerId: varchar("manager_id").references(() => managers.id, { onDelete: "cascade" }),
  nmsSystemId: varchar("nms_system_id").references(() => nmsSystems.id, { onDelete: "cascade" }),
  jobDescription: text("job_description"),
  rules: text("rules"),
  allowedOperations: jsonb("allowed_operations").$type<Array<string>>().default(sql`'[]'::jsonb`),
  restrictedOperations: jsonb("restricted_operations").$type<Array<string>>().default(sql`'[]'::jsonb`),
  workingHours: jsonb("working_hours").$type<{start: string; end: string; days: string[]}>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Operators - Individual operators within groups
export const operators = pgTable("operators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  fullName: text("full_name"),
  email: text("email"),
  groupId: varchar("group_id").references(() => operatorGroups.id, { onDelete: "set null" }),
  nmsSystemId: varchar("nms_system_id").references(() => nmsSystems.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// NMS Logs - Logs from Huawei NMS systems
export const nmsLogs = pgTable("nms_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nmsSystemId: varchar("nms_system_id").notNull().references(() => nmsSystems.id, { onDelete: "cascade" }),
  operatorId: varchar("operator_id").references(() => operators.id, { onDelete: "set null" }),
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

// Analysis Reports - Generated analysis reports per operator/group
export const analysisReports = pgTable("analysis_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nmsSystemId: varchar("nms_system_id").notNull().references(() => nmsSystems.id, { onDelete: "cascade" }),
  operatorId: varchar("operator_id").references(() => operators.id, { onDelete: "set null" }),
  groupId: varchar("group_id").references(() => operatorGroups.id, { onDelete: "set null" }),
  managerId: varchar("manager_id").references(() => managers.id, { onDelete: "set null" }),
  reportType: text("report_type").notNull().default("daily"),
  dateRange: text("date_range").notNull(),
  summary: text("summary").notNull(),
  totalOperations: integer("total_operations").default(0),
  successfulOperations: integer("successful_operations").default(0),
  failedOperations: integer("failed_operations").default(0),
  violations: jsonb("violations").$type<Array<{type: string; count: number; details: string[]}>>().default(sql`'[]'::jsonb`),
  risks: jsonb("risks").$type<Array<{level: string; description: string}>>().default(sql`'[]'::jsonb`),
  recommendations: jsonb("recommendations").$type<Array<string>>().default(sql`'[]'::jsonb`),
  complianceScore: integer("compliance_score"),
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

// NMS System Relations
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

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
});

export const insertLogSchema = createInsertSchema(logs).omit({
  id: true,
  createdAt: true,
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
});

export const insertNmsSystemSchema = createInsertSchema(nmsSystems).omit({
  id: true,
  createdAt: true,
});

export const insertManagerSchema = createInsertSchema(managers).omit({
  id: true,
  createdAt: true,
});

export const insertOperatorGroupSchema = createInsertSchema(operatorGroups).omit({
  id: true,
  createdAt: true,
});

export const insertOperatorSchema = createInsertSchema(operators).omit({
  id: true,
  createdAt: true,
});

export const insertNmsLogSchema = createInsertSchema(nmsLogs).omit({
  id: true,
  createdAt: true,
});

export const insertAnalysisReportSchema = createInsertSchema(analysisReports).omit({
  id: true,
  createdAt: true,
});

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
