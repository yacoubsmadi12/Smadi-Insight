import { parse } from "csv-parse/sync";
import { InsertLog } from "@shared/schema";

interface ParsedLog {
  timestamp: string;
  employeeId: string;
  source: string;
  action: string;
  details?: string;
}

export function parseCSV(csvContent: string): InsertLog[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((record: any) => ({
    employeeId: record.employee_id || record.employeeId,
    timestamp: new Date(record.timestamp),
    source: record.source,
    action: record.action,
    details: record.details || null,
  }));
}

export function parseJSON(jsonContent: string): InsertLog[] {
  const data = JSON.parse(jsonContent);
  const logs = Array.isArray(data) ? data : [data];

  return logs.map((log: any) => ({
    employeeId: log.employeeId || log.employee_id,
    timestamp: new Date(log.timestamp),
    source: log.source,
    action: log.action,
    details: log.details || null,
  }));
}

export function validateLogEntry(log: InsertLog): boolean {
  return !!(
    log.employeeId &&
    log.timestamp &&
    log.source &&
    log.action
  );
}
