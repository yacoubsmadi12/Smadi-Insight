import { parse } from "csv-parse/sync";
import { InsertLog } from "@shared/schema";

interface ParsedLog {
  timestamp: string;
  employeeId: string;
  source: string;
  action: string;
  details?: string;
}

function parseTimestamp(timeStr: string): Date {
  if (!timeStr) return new Date();
  
  timeStr = timeStr.trim();
  
  const isoMatch = timeStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  if (isoMatch) {
    return new Date(timeStr);
  }
  
  const customMatch = timeStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (customMatch) {
    const [, day, month, year, hours, minutes, seconds] = customMatch;
    return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`);
  }
  
  return new Date(timeStr);
}

export function parseCSV(csvContent: string): InsertLog[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  if (records.length === 0) return [];

  const firstRecord = records[0] as Record<string, any>;
  const hasOperationFormat = 'Operation' in firstRecord && 'Operator' in firstRecord && 'Time' in firstRecord;
  const hasStandardFormat = ('employee_id' in firstRecord || 'employeeId' in firstRecord) && 'timestamp' in firstRecord;

  if (hasOperationFormat) {
    return records.map((record: any) => ({
      employeeId: record.Operator || 'unknown',
      timestamp: parseTimestamp(record.Time),
      source: record.Source || 'System',
      action: record.Operation || 'Unknown',
      details: record.Details || null,
    }));
  } else if (hasStandardFormat) {
    return records.map((record: any) => ({
      employeeId: record.employee_id || record.employeeId,
      timestamp: parseTimestamp(record.timestamp),
      source: record.source || record.Source,
      action: record.action || record.Operation,
      details: record.details || record.Details || null,
    }));
  } else {
    return records.map((record: any) => ({
      employeeId: record.employee_id || record.employeeId || record.Operator || 'unknown',
      timestamp: parseTimestamp(record.timestamp || record.Time),
      source: record.source || record.Source || 'System',
      action: record.action || record.Operation || 'Unknown',
      details: record.details || record.Details || null,
    }));
  }
}

export function parseJSON(jsonContent: string): InsertLog[] {
  const data = JSON.parse(jsonContent);
  const logs = Array.isArray(data) ? data : [data];

  return logs.map((log: any) => ({
    employeeId: log.employeeId || log.employee_id || log.Operator || 'unknown',
    timestamp: parseTimestamp(log.timestamp || log.Time),
    source: log.source || log.Source || 'System',
    action: log.action || log.Operation || 'Unknown',
    details: log.details || log.Details || null,
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
