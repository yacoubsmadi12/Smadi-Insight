import * as dgram from "dgram";
import { storage } from "./storage";
import { broadcastLog } from "./routes";
import type { NmsSystem } from "@shared/schema";

const SYSLOG_PORT = parseInt(process.env.SYSLOG_PORT || "514");

// =======================================
//   Normalize timestamp → MySQL DATETIME
// =======================================
function normalizeTimestamp(ts: Date | string): string {
  try {
    const d = ts instanceof Date ? ts : new Date(ts);
    if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 19).replace("T", " ");
    return d.toISOString().slice(0, 19).replace("T", " ");
  } catch {
    return new Date().toISOString().slice(0, 19).replace("T", " ");
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

// =======================================
//  Cache for NMS Systems by IP
// =======================================
const ipToNmsSystemCache = new Map<string, NmsSystem | null>();
const cacheTimestamps = new Map<string, number>();
const CACHE_TTL = 60000;

// NEW → Prevent duplicate creation
const ipLocks = new Map<string, Promise<any>>();

// =======================================
//  Syslog Parser
// =======================================
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

  const rfc3164Match = message.match(/^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.*)/i);
  if (rfc3164Match) {
    const dateStr = rfc3164Match[1];
    hostname = rfc3164Match[2];
    message = rfc3164Match[3];
    const now = new Date();
    const parsedDate = new Date(`${dateStr} ${now.getFullYear()}`);
    if (!isNaN(parsedDate.getTime())) timestamp = parsedDate;
  }

  const rfc5424Match = message.match(/^(\d)\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)/);
  if (rfc5424Match) {
    timestamp = new Date(rfc5424Match[2]);
    hostname = rfc5424Match[3];
    message = rfc5424Match[7];
  }

  return { facility, severity, timestamp, hostname, message, rawMessage };
}

function parseNmsLogFromMessage(message: string, hostname: string) {
  const usernameMatch = message.match(/(?:User|username|operator)[=:\s]+(\S+)/i);
  const operationMatch = message.match(/(?:Operation|action|command)[=:\s]+([^;,]+)/i);
  const resultMatch = message.match(/(?:Result|status)[=:\s]+(Successful|Failed|Success|Failure|OK|ERROR)/i);
  const ipMatch = message.match(/(?:TerminalIP|IP|terminal|source)[=:\s]+(\d+\.\d+\.\d+\.\d+)/i);
  const objectMatch = message.match(/(?:Object|target|resource)[=:\s]+([^;,\n]+)/i);

  let result = "Successful";
  if (resultMatch) {
    const r = resultMatch[1].toLowerCase();
    if (r === "failed" || r === "failure" || r === "error") result = "Failed";
  }

  return {
    operatorUsername: usernameMatch ? usernameMatch[1] : hostname,
    operation: operationMatch ? operationMatch[1].trim() : "System Event",
    operationObject: objectMatch ? objectMatch[1].trim() : "",
    result,
    terminalIp: ipMatch ? ipMatch[1] : ""
  };
}

// =======================================
//   FIXED VERSION — No Duplicate NMS Creation
// =======================================
async function getOrCreateNmsSystemForIp(ipAddress: string): Promise<NmsSystem | null> {

  // If IP is currently being processed → wait
  if (ipLocks.has(ipAddress)) {
    await ipLocks.get(ipAddress);
    return await storage.getNmsSystemByIp(ipAddress);
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

// =======================================
//   Start Syslog Server
// =======================================
export function startSyslogServer() {
  const server = dgram.createSocket("udp4");

  server.on("message", async (msg, rinfo) => {
    try {
      const parsed = parseSyslogMessage(msg.toString());
      const udpSourceIp = rinfo.address;

      const logDetails = parseNmsLogFromMessage(parsed.message, parsed.hostname);

      // ----------------------------------------------------
      // التعديل: إجبار effectiveSourceIp على استخدام مُرسِل حزمة UDP
      // هذا سيضمن أن جميع السجلات من 10.119.19.90 يتم تجميعها تحت NMS واحد.
      // ----------------------------------------------------
      const effectiveSourceIp = udpSourceIp;

      console.log(`[syslog] From ${udpSourceIp} → ${parsed.message.substring(0, 60)}...`);

      const nmsSystem = await getOrCreateNmsSystemForIp(effectiveSourceIp);
      if (!nmsSystem) return;

      const mysqlTimestamp = normalizeTimestamp(parsed.timestamp);
      const severityName = severityNames[parsed.severity] || "Unknown";
      const level = severityLevels[severityName] || "Minor";

      const nmsLogData = {
        nmsSystemId: nmsSystem.id,
        operatorUsername: logDetails.operatorUsername,
        timestamp: mysqlTimestamp,
        operation: logDetails.operation,
        level,
        source: `syslog-${facilityNames[parsed.facility] || "unknown"}`,
        terminalIp: effectiveSourceIp,
        operationObject: logDetails.operationObject,
        result: logDetails.result,
        details: parsed.message,
        isViolation: level === "Critical" || level === "Major",
        violationType: level === "Critical" ? "Security Alert" : (level === "Major" ? "Error" : null)
      };

      const createdNmsLog = await storage.createNmsLog(nmsLogData);
      broadcastLog({ type: "nms_log", data: createdNmsLog, nmsSystemId: nmsSystem.id });

      // Legacy logs
      const legacyLogData = {
        employeeId: parsed.hostname,
        timestamp: mysqlTimestamp,
        source: `syslog-${facilityNames[parsed.facility] || "unknown"}`,
        action: severityName,
        details: parsed.message
      };

      let employees = await storage.getEmployees({ search: legacyLogData.employeeId });
      let employee = employees.find(e => e.name === legacyLogData.employeeId);

      if (!employee) {
        await storage.createEmployee({
          name: legacyLogData.employeeId,
          email: `${legacyLogData.employeeId}@syslog.local`,
          role: "System",
          department: "Network",
          status: "active"
        });

        employees = await storage.getEmployees({ search: legacyLogData.employeeId });
        employee = employees.find(e => e.name === legacyLogData.employeeId);
      }

      legacyLogData.employeeId = employee?.id || "unknown";

      const createdLegacy = await storage.createLog(legacyLogData);
      broadcastLog({ type: "legacy_log", data: createdLegacy });

    } catch (err) {
      console.error("[syslog] Error:", err);
    }
  });

  server.bind(SYSLOG_PORT, "0.0.0.0");
}

export function clearNmsSystemCache() {
  ipToNmsSystemCache.clear();
  cacheTimestamps.clear();
}
