import type { InsertNmsLog } from "@shared/schema";

interface RawHuaweiLog {
  Operation: string;
  Level: string;
  Operator: string;
  Time: string;
  Source: string;
  "Terminal IP Address": string;
  "Operation Object": string;
  Result: string;
  Details: string;
}

export function parseHuaweiNmsLogs(csvContent: string, nmsSystemId: string): InsertNmsLog[] {
  const lines = csvContent.split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const logs: InsertNmsLog[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = parseCSVLine(line);
      const rawLog: Record<string, string> = {};
      
      headers.forEach((header, index) => {
        rawLog[header.trim()] = values[index]?.trim() || '';
      });

      const timestamp = parseHuaweiTimestamp(rawLog['Time']);
      if (!timestamp) continue;

      const log: InsertNmsLog = {
        nmsSystemId,
        operatorUsername: rawLog['Operator'] || 'Unknown',
        timestamp,
        operation: rawLog['Operation'] || '',
        level: rawLog['Level'] || 'Minor',
        source: rawLog['Source'] || '',
        terminalIp: rawLog['Terminal IP Address'] || '',
        operationObject: rawLog['Operation Object'] || '',
        result: rawLog['Result'] || 'Unknown',
        details: rawLog['Details'] || '',
        isViolation: false,
        violationType: null,
      };

      logs.push(log);
    } catch (error) {
      console.error(`Error parsing line ${i}:`, error);
      continue;
    }
  }

  return logs;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function parseHuaweiTimestamp(timeStr: string): Date | null {
  if (!timeStr) return null;

  const cleanTime = timeStr.replace(/\t/g, '').trim();
  
  const patterns = [
    /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/,
    /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/,
    /(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/,
  ];

  for (const pattern of patterns) {
    const match = cleanTime.match(pattern);
    if (match) {
      let year: number, month: number, day: number;
      
      if (pattern === patterns[0]) {
        day = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        year = parseInt(match[3]);
      } else if (pattern === patterns[1]) {
        year = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        day = parseInt(match[3]);
      } else {
        month = parseInt(match[1]) - 1;
        day = parseInt(match[2]);
        year = parseInt(match[3]);
      }

      const hour = parseInt(match[4]);
      const minute = parseInt(match[5]);
      const second = parseInt(match[6]);

      return new Date(year, month, day, hour, minute, second);
    }
  }

  try {
    const date = new Date(cleanTime);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (e) {
  }

  return null;
}

export function detectViolations(
  logs: InsertNmsLog[],
  rules: {
    allowedOperations?: string[];
    restrictedOperations?: string[];
    workingHours?: { start: string; end: string; days: string[] };
  }
): InsertNmsLog[] {
  return logs.map(log => {
    let isViolation = false;
    let violationType: string | null = null;

    if (rules.restrictedOperations && rules.restrictedOperations.length > 0) {
      const isRestricted = rules.restrictedOperations.some(op => 
        log.operation.toLowerCase().includes(op.toLowerCase())
      );
      if (isRestricted) {
        isViolation = true;
        violationType = 'RESTRICTED_OPERATION';
      }
    }

    if (rules.allowedOperations && rules.allowedOperations.length > 0) {
      const isAllowed = rules.allowedOperations.some(op => 
        log.operation.toLowerCase().includes(op.toLowerCase())
      );
      if (!isAllowed) {
        isViolation = true;
        violationType = violationType ? `${violationType},UNAUTHORIZED_OPERATION` : 'UNAUTHORIZED_OPERATION';
      }
    }

    if (rules.workingHours) {
      const logDate = new Date(log.timestamp);
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][logDate.getDay()];
      
      if (rules.workingHours.days && !rules.workingHours.days.includes(dayOfWeek)) {
        isViolation = true;
        violationType = violationType ? `${violationType},OUTSIDE_WORKING_DAYS` : 'OUTSIDE_WORKING_DAYS';
      } else {
        const logTime = `${String(logDate.getHours()).padStart(2, '0')}:${String(logDate.getMinutes()).padStart(2, '0')}`;
        if (logTime < rules.workingHours.start || logTime > rules.workingHours.end) {
          isViolation = true;
          violationType = violationType ? `${violationType},OUTSIDE_WORKING_HOURS` : 'OUTSIDE_WORKING_HOURS';
        }
      }
    }

    return {
      ...log,
      isViolation,
      violationType,
    };
  });
}
