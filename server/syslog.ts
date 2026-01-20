import * as dgram from "dgram";
import { storage } from "./storage";
import { broadcastLog } from "./routes";
import type { NmsSystem, InsertNmsLog, InsertLog } from "@shared/schema";
import { getSourceConfigByIp, isOperatorBlockedForSource, getAllSourceConfigs } from "./source-configs";

const SYSLOG_PORT = parseInt(process.env.SYSLOG_PORT || "514");

const BATCH_SIZE = 50;
const BATCH_INTERVAL_MS = 1000;

const blockedStats: Map<string, number> = new Map();

let nmsLogBuffer: InsertNmsLog[] = [];
let legacyLogBuffer: InsertLog[] = [];
let batchTimer: NodeJS.Timeout | null = null;

interface SyslogStats {
  totalReceived: number;
  totalProcessed: number;
  totalErrors: number;
  lastMinuteCount: number;
  sourcesCount: Map<string, number>;
  startTime: Date;
}

const stats: SyslogStats = {
  totalReceived: 0,
  totalProcessed: 0,
  totalErrors: 0,
  lastMinuteCount: 0,
  sourcesCount: new Map(),
  startTime: new Date()
};

setInterval(() => {
  stats.lastMinuteCount = 0;
}, 60000);

export function getSyslogStats() {
  const sourceConfigs = getAllSourceConfigs();
  const totalBlocked = Array.from(blockedStats.values()).reduce((a, b) => a + b, 0);
  
  return {
    totalReceived: stats.totalReceived,
    totalProcessed: stats.totalProcessed,
    totalErrors: stats.totalErrors,
    totalBlocked,
    blockedBySource: Object.fromEntries(blockedStats),
    sourceConfigs: sourceConfigs.map(c => ({
      name: c.name,
      sourceIps: c.sourceIps,
      blockedOperators: c.blockedOperators
    })),
    lastMinuteCount: stats.lastMinuteCount,
    sourcesCount: Object.fromEntries(stats.sourcesCount),
    uptime: Math.floor((Date.now() - stats.startTime.getTime()) / 1000),
    bufferSize: nmsLogBuffer.length + legacyLogBuffer.length
  };
}

function normalizeTimestamp(ts: Date | string): Date {
  try {
    const d = ts instanceof Date ? ts : new Date(ts);
    if (isNaN(d.getTime())) return new Date();
    return d;
  } catch {
    return new Date();
  }
}

interface ParsedSyslog {
  facility: number;
  severity: number;
  timestamp: Date;
  hostname: string;
  message: string;
  rawMessage: string;
}

const severityNames = [
  "Emergency", "Alert", "Critical", "Error", "Warning",
  "Notice", "Informational", "Debug"
];

const severityLevels: Record<string, string> = {
  "Emergency": "Critical",
  "Alert": "Critical",
  "Critical": "Critical",
  "Error": "Major",
  "Warning": "Warning",
  "Notice": "Minor",
  "Informational": "Minor",
  "Debug": "Minor"
};

const facilityNames = [
  "kern","user","mail","daemon","auth","syslog","lpr","news",
  "uucp","cron","authpriv","ftp","ntp","audit","alert","clock",
  "local0","local1","local2","local3","local4","local5","local6","local7"
];

const ipToNmsSystemCache = new Map<string, NmsSystem | null>();
const cacheTimestamps = new Map<string, number>();
const CACHE_TTL = 60000;

const ipLocks = new Map<string, Promise<NmsSystem | null>>();

function isTimezoneOffset(str: string): boolean {
  return /^[+-]\d{2}:\d{2}$/.test(str);
}

function isValidHostname(str: string): boolean {
  if (!str || str === "unknown" || str === "-") return false;
  if (isTimezoneOffset(str)) return false;
  if (/^\d+$/.test(str)) return false;
  return true;
}

function parseSyslogMessage(msg: string): ParsedSyslog {
  const rawMessage = msg.trim();

  let facility = 1;
  let severity = 6;
  let hostname = "unknown";
  let message = rawMessage;
  let timestamp = new Date();

  const priMatch = rawMessage.match(/^<(\d{1,3})>/);
  if (priMatch) {
    const pri = parseInt(priMatch[1]);
    facility = Math.floor(pri / 8);
    severity = pri % 8;
    message = rawMessage.substring(priMatch[0].length);
  }

  const rfc5424WithSpaceTimezone = message.match(/^(\d)\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s*([+-]\d{2}:\d{2})\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)/);
  if (rfc5424WithSpaceTimezone) {
    const dateStr = rfc5424WithSpaceTimezone[2] + rfc5424WithSpaceTimezone[3];
    timestamp = new Date(dateStr);
    hostname = rfc5424WithSpaceTimezone[4];
    message = rfc5424WithSpaceTimezone[8];
  }

  const rfc5424Match = message.match(/^(\d)\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)/);
  if (rfc5424Match && hostname === "unknown") {
    timestamp = new Date(rfc5424Match[2]);
    const potentialHostname = rfc5424Match[3];
    if (isValidHostname(potentialHostname)) {
      hostname = potentialHostname;
    }
    message = rfc5424Match[7];
  }

  const rfc3164Match = message.match(/^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.*)/i);
  if (rfc3164Match && hostname === "unknown") {
    const dateStr = rfc3164Match[1];
    const potentialHostname = rfc3164Match[2];
    if (isValidHostname(potentialHostname)) {
      hostname = potentialHostname;
    }
    message = rfc3164Match[3];
    const now = new Date();
    const parsedDate = new Date(`${dateStr} ${now.getFullYear()}`);
    if (!isNaN(parsedDate.getTime())) timestamp = parsedDate;
  }

  if (!isValidHostname(hostname)) {
    const hostnameFromMessage = message.match(/(?:hostname|host|server|device)[=:\s]+['"]?([a-zA-Z][a-zA-Z0-9._-]+)['"]?/i);
    if (hostnameFromMessage) {
      hostname = hostnameFromMessage[1];
    } else {
      hostname = "system";
    }
  }

  return { facility, severity, timestamp, hostname, message, rawMessage };
}

interface ParsedNmsLog {
  operatorUsername: string;
  operation: string;
  operationObject: string;
  result: string;
  terminalIp: string;
  logFormat: string;
}

function parseNmsLogFromMessage(message: string, hostname: string): ParsedNmsLog {
  let operatorUsername = hostname;
  let operation = "System Event";
  let operationObject = "";
  let result = "Successful";
  let terminalIp = "";
  let logFormat = "generic";

  // Huawei NMS OperationLog format: OperationLog%%ID # SEVERITY # USERNAME # APPLICATION # OPERATION # TARGET # RESULT # DETAILS
  // Example: OperationLog%%559653282 # MINOR # kazema # NM Application(Access NetWork) # ACT-SERVICEPORT # Network Management # Failure # XML2TL1:...
  const huaweiOperationLogMatch = message.match(/OperationLog%%\d+\s*#\s*(\w+)\s*#\s*([^#]+)\s*#\s*([^#]+)\s*#\s*([^#]+)\s*#\s*([^#]+)\s*#\s*(Success|Failure|Failed|Successful)/i);
  if (huaweiOperationLogMatch) {
    const severity = huaweiOperationLogMatch[1].trim();
    operatorUsername = huaweiOperationLogMatch[2].trim();
    const application = huaweiOperationLogMatch[3].trim();
    operation = huaweiOperationLogMatch[4].trim();
    operationObject = huaweiOperationLogMatch[5].trim();
    const resultStr = huaweiOperationLogMatch[6].trim().toLowerCase();
    result = (resultStr === "failure" || resultStr === "failed") ? "Failed" : "Successful";
    logFormat = "huawei_nms";
    
    // Extract IP from start of message if present
    const ipAtStart = message.match(/^(\d+\.\d+\.\d+\.\d+)/);
    if (ipAtStart) {
      terminalIp = ipAtStart[1];
    }
  }

  // Alternative Huawei format with User= keyword
  if (logFormat === "generic") {
    const huaweiMatch = message.match(/User\s*[:=]\s*(\S+).*?(?:Operation|Action)\s*[:=]\s*([^;,]+).*?Result\s*[:=]\s*(Successful|Failed|Success|Failure)/i);
    if (huaweiMatch) {
      operatorUsername = huaweiMatch[1];
      operation = huaweiMatch[2].trim();
      result = huaweiMatch[3].toLowerCase().includes("fail") ? "Failed" : "Successful";
      logFormat = "huawei_nms";
    }
  }

  // Cisco format
  if (logFormat === "generic") {
    const ciscoMatch = message.match(/(?:%\w+-\d+-\w+):\s*(.+)/);
    if (ciscoMatch) {
      operation = ciscoMatch[1].substring(0, 100);
      logFormat = "cisco";
      
      const userMatch = message.match(/user\s+['"]?(\w+)['"]?/i);
      if (userMatch) operatorUsername = userMatch[1];
    }
  }

  // Linux format
  if (logFormat === "generic") {
    const linuxMatch = message.match(/(\w+)\[(\d+)\]:\s*(.+)/);
    if (linuxMatch) {
      operation = `${linuxMatch[1]}: ${linuxMatch[3].substring(0, 80)}`;
      logFormat = "linux";
    }
  }

  // Windows format
  if (logFormat === "generic") {
    const windowsMatch = message.match(/EventID[:=]\s*(\d+).*?(?:User|Account)[:=]\s*(\S+)/i);
    if (windowsMatch) {
      operation = `Event ${windowsMatch[1]}`;
      operatorUsername = windowsMatch[2];
      logFormat = "windows";
    }
  }

  // Network interface format
  if (logFormat === "generic") {
    const networkMatch = message.match(/interface\s+(\S+)\s+(?:is\s+)?(up|down|changed)/i);
    if (networkMatch) {
      operationObject = networkMatch[1];
      operation = `Interface ${networkMatch[2]}`;
      logFormat = "network";
    }
  }

  // Generic fallback parsing
  if (logFormat === "generic") {
    const usernameMatch = message.match(/(?:User|username|operator|account)[=:\s]+['"]?(\S+?)['"]?(?:\s|,|;|$)/i);
    const operationMatch = message.match(/(?:Operation|action|command|event)[=:\s]+['"]?([^;,'"]+)['"]?/i);
    const resultMatch = message.match(/(?:Result|status|outcome)[=:\s]+(Successful|Failed|Success|Failure|OK|ERROR|DENIED|ACCEPTED)/i);
    const ipMatch = message.match(/(?:TerminalIP|IP|terminal|source|from|src)[=:\s]+(\d+\.\d+\.\d+\.\d+)/i);
    const objectMatch = message.match(/(?:Object|target|resource|dest|to)[=:\s]+['"]?([^;,'"]+)['"]?/i);

    if (usernameMatch) operatorUsername = usernameMatch[1];
    if (operationMatch) operation = operationMatch[1].trim();
    if (objectMatch) operationObject = objectMatch[1].trim();
    if (ipMatch) terminalIp = ipMatch[1];
    
    if (resultMatch) {
      const r = resultMatch[1].toLowerCase();
      if (r === "failed" || r === "failure" || r === "error" || r === "denied") {
        result = "Failed";
      }
    }
  }

  // Global IP extraction fallback
  if (!terminalIp) {
    const globalIpMatch = message.match(/(\d+\.\d+\.\d+\.\d+)/);
    if (globalIpMatch) {
      terminalIp = globalIpMatch[1];
    }
  }

  // Validate operator username - don't use invalid values
  if (isTimezoneOffset(operatorUsername) || operatorUsername === "system" || operatorUsername === "unknown" || operatorUsername === "-") {
    operatorUsername = "system";
  }

  return {
    operatorUsername,
    operation: operation.substring(0, 255),
    operationObject: operationObject.substring(0, 255),
    result,
    terminalIp,
    logFormat
  };
}

async function getOrCreateNmsSystemForIp(ipAddress: string): Promise<NmsSystem | null> {
  if (ipLocks.has(ipAddress)) {
    await ipLocks.get(ipAddress);
    const cached = await storage.getNmsSystemByIp(ipAddress);
    return cached || null;
  }

  const lock = (async () => {
    try {
      const now = Date.now();
      const cacheTime = cacheTimestamps.get(ipAddress);

      if (cacheTime && now - cacheTime < CACHE_TTL) {
        return ipToNmsSystemCache.get(ipAddress) ?? null;
      }

      let system = await storage.getNmsSystemByIp(ipAddress);

      if (!system) {
        system = await storage.createNmsSystem({
          name: `Syslog-${ipAddress}`,
          description: `Auto-created syslog receiver for ${ipAddress}`,
          ipAddress,
          port: 514,
          systemType: "syslog-receiver",
          connectionType: "syslog",
          status: "active",
          retentionDays: 30
        });

        console.log(`[syslog] New NMS created for ${ipAddress}`);
      }

      ipToNmsSystemCache.set(ipAddress, system);
      cacheTimestamps.set(ipAddress, now);

      return system;

    } finally {
      ipLocks.delete(ipAddress);
    }
  })();

  ipLocks.set(ipAddress, lock);

  return lock;
}

const employeeCache = new Map<string, string>();

async function getOrCreateEmployeeId(hostname: string): Promise<string> {
  if (employeeCache.has(hostname)) {
    return employeeCache.get(hostname)!;
  }

  let employees = await storage.getEmployees({ search: hostname });
  let employee = employees.find(e => e.name === hostname);

  if (!employee) {
    employee = await storage.createEmployee({
      name: hostname,
      email: `${hostname}@syslog.local`,
      role: "System",
      department: "Network",
      status: "active"
    });
  }

  employeeCache.set(hostname, employee.id);
  return employee.id;
}

async function flushBuffers() {
  if (nmsLogBuffer.length === 0 && legacyLogBuffer.length === 0) {
    return;
  }

  const nmsLogsToInsert = [...nmsLogBuffer];
  const legacyLogsToInsert = [...legacyLogBuffer];
  
  nmsLogBuffer = [];
  legacyLogBuffer = [];

  try {
    if (nmsLogsToInsert.length > 0) {
      const createdNmsLogs = await storage.createNmsLogs(nmsLogsToInsert);
      stats.totalProcessed += createdNmsLogs.length;
      
      for (const log of createdNmsLogs) {
        broadcastLog({ type: "nms_log", data: log, nmsSystemId: log.nmsSystemId });
      }
      
      console.log(`[syslog] Batch inserted ${createdNmsLogs.length} NMS logs`);
    }

    if (legacyLogsToInsert.length > 0) {
      const createdLegacyLogs = await storage.createLogs(legacyLogsToInsert);
      
      for (const log of createdLegacyLogs) {
        broadcastLog({ type: "legacy_log", data: log });
      }
      
      console.log(`[syslog] Batch inserted ${createdLegacyLogs.length} legacy logs`);
    }
  } catch (error) {
    console.error("[syslog] Batch insert error:", error);
    stats.totalErrors += nmsLogsToInsert.length + legacyLogsToInsert.length;
  }
}

function scheduleBatchFlush() {
  if (batchTimer) return;
  
  batchTimer = setTimeout(async () => {
    batchTimer = null;
    await flushBuffers();
  }, BATCH_INTERVAL_MS);
}

async function processLog(msg: Buffer, rinfo: dgram.RemoteInfo) {
  try {
    stats.totalReceived++;
    stats.lastMinuteCount++;
    
    const sourceIp = rinfo.address;
    stats.sourcesCount.set(sourceIp, (stats.sourcesCount.get(sourceIp) || 0) + 1);

    const parsed = parseSyslogMessage(msg.toString());
    const logDetails = parseNmsLogFromMessage(parsed.message, parsed.hostname);

    // Filter logs from 10.119.20.* with user 'kazema'
    if (sourceIp.startsWith("10.119.20.") && logDetails.operatorUsername === "kazema") {
      return;
    }

    const sourceConfig = getSourceConfigByIp(sourceIp);
    if (sourceConfig && isOperatorBlockedForSource(sourceIp, logDetails.operatorUsername)) {
      const key = `${sourceConfig.name}:${logDetails.operatorUsername}`;
      blockedStats.set(key, (blockedStats.get(key) || 0) + 1);
      return;
    }

    const effectiveSourceIp = sourceIp;

    const nmsSystem = await getOrCreateNmsSystemForIp(effectiveSourceIp);
    if (!nmsSystem) return;

    const timestamp = normalizeTimestamp(parsed.timestamp);
    const severityName = severityNames[parsed.severity] || "Unknown";
    const level = severityLevels[severityName] || "Minor";

    const nmsLogData: InsertNmsLog = {
      nmsSystemId: nmsSystem.id,
      operatorUsername: logDetails.operatorUsername,
      timestamp,
      operation: logDetails.operation,
      level,
      source: `syslog-${facilityNames[parsed.facility] || "unknown"}`,
      terminalIp: logDetails.terminalIp || effectiveSourceIp,
      operationObject: logDetails.operationObject,
      result: logDetails.result,
      details: parsed.message,
      isViolation: level === "Critical" || level === "Major",
      violationType: level === "Critical" ? "Security Alert" : (level === "Major" ? "Error" : null)
    };

    nmsLogBuffer.push(nmsLogData);

    const employeeId = await getOrCreateEmployeeId(parsed.hostname);

    const legacyLogData: InsertLog = {
      employeeId,
      timestamp,
      source: `syslog-${facilityNames[parsed.facility] || "unknown"}`,
      action: severityName,
      details: parsed.message
    };

    legacyLogBuffer.push(legacyLogData);

    if (nmsLogBuffer.length >= BATCH_SIZE) {
      await flushBuffers();
    } else {
      scheduleBatchFlush();
    }

  } catch (err) {
    stats.totalErrors++;
    console.error("[syslog] Error processing log:", err);
  }
}

export function startSyslogServer() {
  const server = dgram.createSocket("udp4");

  server.on("message", (msg, rinfo) => {
    processLog(msg, rinfo).catch(err => {
      console.error("[syslog] Unhandled error:", err);
    });
  });

  server.on("error", (err) => {
    console.error("[syslog] Server error:", err);
  });

  server.on("listening", () => {
    const address = server.address();
    console.log(`[syslog] UDP server listening on ${address.address}:${address.port}`);
    console.log(`[syslog] Batch size: ${BATCH_SIZE}, Interval: ${BATCH_INTERVAL_MS}ms`);
  });

  server.bind(SYSLOG_PORT, "0.0.0.0");

  process.on("beforeExit", async () => {
    await flushBuffers();
  });

  return server;
}

export function clearNmsSystemCache() {
  ipToNmsSystemCache.clear();
  cacheTimestamps.clear();
  employeeCache.clear();
}

export async function simulateSyslogMessages(count: number, sources: string[] = ["192.168.1.10", "192.168.1.20", "10.0.0.50"]) {
  const operations = [
    "User Login", "User Logout", "Config Change", "Interface Up", "Interface Down",
    "Backup Started", "Backup Completed", "Firmware Update", "Password Change",
    "Access Denied", "Connection Established", "Connection Closed", "Alert Triggered"
  ];
  
  const users = ["admin", "operator1", "operator2", "system", "monitor", "netadmin", "security"];
  const results = ["Successful", "Successful", "Successful", "Failed"];
  const severities = [0, 1, 2, 3, 4, 5, 6, 7];

  console.log(`[syslog-sim] Starting simulation: ${count} logs from ${sources.length} sources`);

  const startTime = Date.now();
  let simulated = 0;

  for (let i = 0; i < count; i++) {
    const source = sources[i % sources.length];
    const user = users[Math.floor(Math.random() * users.length)];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    const result = results[Math.floor(Math.random() * results.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const facility = Math.floor(Math.random() * 24);
    const pri = facility * 8 + severity;

    const timestamp = new Date().toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).replace(",", "");

    const message = `<${pri}>${timestamp} ${source} User=${user} Operation=${operation} Result=${result} TerminalIP=${source} Object=System-${i}`;

    const mockRinfo: dgram.RemoteInfo = {
      address: source,
      family: "IPv4",
      port: 514,
      size: message.length
    };

    await processLog(Buffer.from(message), mockRinfo);
    simulated++;

    if (simulated % 100 === 0) {
      console.log(`[syslog-sim] Progress: ${simulated}/${count}`);
    }
  }

  await flushBuffers();

  const duration = Date.now() - startTime;
  console.log(`[syslog-sim] Completed: ${simulated} logs in ${duration}ms (${Math.round(simulated / (duration / 1000))} logs/sec)`);

  return {
    simulated,
    duration,
    logsPerSecond: Math.round(simulated / (duration / 1000)),
    sources: sources.length
  };
}

import { generateRealisticTelecomLog, TELECOM_SOURCES, TelecomLogEntry } from "./telecom-log-parser";

export async function simulateTelecomLogs(count: number, sourcesCount: number = 20): Promise<{
  simulated: number;
  duration: number;
  logsPerSecond: number;
  sources: number;
  violations: number;
  failed: number;
}> {
  const sources = TELECOM_SOURCES.slice(0, sourcesCount);
  
  console.log(`[telecom-sim] Starting telecom simulation: ${count} logs from ${sources.length} sources`);

  const startTime = Date.now();
  let simulated = 0;
  let violations = 0;
  let failed = 0;

  for (let i = 0; i < count; i++) {
    const sourceIndex = i % sources.length;
    const source = sources[sourceIndex];
    const entry = generateRealisticTelecomLog(sourceIndex);

    if (entry.isViolation) violations++;
    if (entry.result === 'Failed') failed++;

    const nmsSystem = await getOrCreateNmsSystemForIp(source.ip);
    if (!nmsSystem) continue;

    const level = entry.level === 'Critical' ? 'Critical' : 
                  entry.level === 'Major' ? 'Major' : 
                  entry.level === 'Warning' ? 'Warning' : 'Minor';

    const nmsLogData: InsertNmsLog = {
      nmsSystemId: nmsSystem.id,
      operatorUsername: entry.operator,
      timestamp: entry.timestamp,
      operation: entry.operation,
      level,
      source: entry.source,
      terminalIp: entry.terminalIp,
      operationObject: entry.operationObject,
      result: entry.result,
      details: entry.details,
      isViolation: entry.isViolation,
      violationType: entry.violationType
    };

    nmsLogBuffer.push(nmsLogData);

    simulated++;

    if (nmsLogBuffer.length >= BATCH_SIZE) {
      await flushBuffers();
    }

    if (simulated % 500 === 0) {
      console.log(`[telecom-sim] Progress: ${simulated}/${count} (${violations} violations, ${failed} failed)`);
    }
  }

  await flushBuffers();

  const duration = Date.now() - startTime;
  console.log(`[telecom-sim] Completed: ${simulated} logs in ${duration}ms (${Math.round(simulated / (duration / 1000))} logs/sec)`);
  console.log(`[telecom-sim] Stats: ${violations} violations, ${failed} failed operations`);

  return {
    simulated,
    duration,
    logsPerSecond: Math.round(simulated / (duration / 1000)),
    sources: sources.length,
    violations,
    failed
  };
}
