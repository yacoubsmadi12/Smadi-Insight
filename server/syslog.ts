import * as dgram from "dgram";
import { storage } from "./storage";
import { broadcastLog } from "./routes";
import type { NmsSystem } from "@shared/schema";

const SYSLOG_PORT = parseInt(process.env.SYSLOG_PORT || "514");

interface ParsedSyslog {
  facility: number;
  severity: number;
  timestamp: Date;
  hostname: string;
  message: string;
  rawMessage: string;
}

const severityNames = [
  "Emergency",
  "Alert", 
  "Critical",
  "Error",
  "Warning",
  "Notice",
  "Informational",
  "Debug"
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
  "kern", "user", "mail", "daemon", "auth", "syslog", "lpr", "news",
  "uucp", "cron", "authpriv", "ftp", "ntp", "audit", "alert", "clock",
  "local0", "local1", "local2", "local3", "local4", "local5", "local6", "local7"
];

const ipToNmsSystemCache = new Map<string, NmsSystem | null>();
const CACHE_TTL = 60000;
const cacheTimestamps = new Map<string, number>();

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
    if (!isNaN(parsedDate.getTime())) {
      timestamp = parsedDate;
    }
  }

  const rfc5424Match = message.match(/^(\d)\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)/);
  if (rfc5424Match) {
    timestamp = new Date(rfc5424Match[2]);
    hostname = rfc5424Match[3];
    const appName = rfc5424Match[4];
    const procId = rfc5424Match[5];
    const msgId = rfc5424Match[6];
    message = rfc5424Match[7];
    
    if (appName !== "-") {
      message = `[${appName}] ${message}`;
    }
  }

  return {
    facility,
    severity,
    timestamp,
    hostname,
    message,
    rawMessage
  };
}

function parseNmsLogFromMessage(message: string, hostname: string): {
  operatorUsername: string;
  operation: string;
  operationObject: string;
  result: string;
  terminalIp: string;
} {
  const usernameMatch = message.match(/(?:User|username|operator)[:\s]+(\S+)/i);
  const operationMatch = message.match(/(?:Operation|action|command)[:\s]+([^;,]+)/i);
  const resultMatch = message.match(/(?:Result|status)[:\s]+(Successful|Failed|Success|Failure|OK|ERROR)/i);
  const ipMatch = message.match(/(?:IP|terminal|source)[:\s]+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i);
  const objectMatch = message.match(/(?:Object|target|resource)[:\s]+([^;,\n]+)/i);

  let result = "Successful";
  if (resultMatch) {
    const r = resultMatch[1].toLowerCase();
    if (r === "failed" || r === "failure" || r === "error") {
      result = "Failed";
    }
  }

  return {
    operatorUsername: usernameMatch ? usernameMatch[1] : hostname,
    operation: operationMatch ? operationMatch[1].trim() : "System Event",
    operationObject: objectMatch ? objectMatch[1].trim() : "",
    result: result,
    terminalIp: ipMatch ? ipMatch[1] : ""
  };
}

async function getOrCreateNmsSystemForIp(ipAddress: string): Promise<NmsSystem | null> {
  const now = Date.now();
  const cacheTime = cacheTimestamps.get(ipAddress);
  
  if (cacheTime && now - cacheTime < CACHE_TTL) {
    const cached = ipToNmsSystemCache.get(ipAddress);
    if (cached !== undefined) {
      return cached;
    }
  }

  try {
    let system = await storage.getNmsSystemByIp(ipAddress);
    
    if (!system) {
      const systemName = `Syslog-${ipAddress}`;
      const existingByName = await storage.getNmsSystemByName(systemName);
      
      if (existingByName) {
        system = existingByName;
      } else {
        system = await storage.createNmsSystem({
          name: systemName,
          description: `Auto-created syslog receiver for ${ipAddress}`,
          ipAddress: ipAddress,
          port: 514,
          systemType: "syslog-receiver",
          connectionType: "syslog",
          status: "active",
          retentionDays: 30
        });
        console.log(`[syslog] Created new NMS System for IP: ${ipAddress}`);
      }
    }
    
    ipToNmsSystemCache.set(ipAddress, system);
    cacheTimestamps.set(ipAddress, now);
    return system;
  } catch (error) {
    console.error(`[syslog] Error getting/creating NMS system for IP ${ipAddress}:`, error);
    ipToNmsSystemCache.set(ipAddress, null);
    cacheTimestamps.set(ipAddress, now);
    return null;
  }
}

export function startSyslogServer() {
  const server = dgram.createSocket("udp4");

  server.on("error", (err) => {
    console.error(`Syslog server error: ${err.stack}`);
    server.close();
  });

  server.on("message", async (msg, rinfo) => {
    try {
      const messageStr = msg.toString("utf8");
      const parsed = parseSyslogMessage(messageStr);
      const sourceIp = rinfo.address;
      
      console.log(`[syslog] Received from ${sourceIp}:${rinfo.port} - ${parsed.hostname}: ${parsed.message.substring(0, 100)}...`);

      const nmsSystem = await getOrCreateNmsSystemForIp(sourceIp);
      
      if (!nmsSystem) {
        console.error(`[syslog] Could not get/create NMS system for IP: ${sourceIp}`);
        return;
      }

      const logDetails = parseNmsLogFromMessage(parsed.message, parsed.hostname);
      const severityName = severityNames[parsed.severity] || "Unknown";
      const level = severityLevels[severityName] || "Minor";

      const nmsLogData = {
        nmsSystemId: nmsSystem.id,
        operatorUsername: logDetails.operatorUsername,
        timestamp: parsed.timestamp,
        operation: logDetails.operation,
        level: level,
        source: `syslog-${facilityNames[parsed.facility] || "unknown"}`,
        terminalIp: logDetails.terminalIp || sourceIp,
        operationObject: logDetails.operationObject,
        result: logDetails.result,
        details: parsed.message,
        isViolation: level === "Critical" || level === "Major",
        violationType: level === "Critical" ? "Security Alert" : (level === "Major" ? "Error" : null)
      };

      const createdNmsLog = await storage.createNmsLog(nmsLogData);
      
      broadcastLog({
        type: "nms_log",
        data: createdNmsLog,
        nmsSystemId: nmsSystem.id
      });

      const legacyLogData = {
        employeeId: parsed.hostname,
        timestamp: parsed.timestamp,
        source: `syslog-${facilityNames[parsed.facility] || "unknown"}`,
        action: severityName,
        details: parsed.message
      };

      const existingEmployees = await storage.getEmployees({ search: legacyLogData.employeeId });
      const employeeExists = existingEmployees.some(e => e.id === legacyLogData.employeeId || e.name === legacyLogData.employeeId);
      
      if (!employeeExists) {
        try {
          await storage.createEmployee({
            name: legacyLogData.employeeId,
            email: `${legacyLogData.employeeId}@syslog.local`,
            role: "System",
            department: "Network",
            status: "active"
          });
        } catch (e) {
        }
      }
      
      const allEmployees = await storage.getEmployees({ search: legacyLogData.employeeId });
      const employee = allEmployees.find(e => e.name === legacyLogData.employeeId);
      if (employee) {
        legacyLogData.employeeId = employee.id;
      }

      const createdLog = await storage.createLog(legacyLogData);
      
      broadcastLog({
        type: "legacy_log",
        data: createdLog
      });

    } catch (error) {
      console.error("[syslog] Error processing message:", error);
    }
  });

  server.on("listening", () => {
    const address = server.address();
    console.log(`[syslog] UDP Syslog server listening on ${address.address}:${address.port}`);
  });

  server.bind(SYSLOG_PORT, "0.0.0.0");
  
  return server;
}

export function clearNmsSystemCache() {
  ipToNmsSystemCache.clear();
  cacheTimestamps.clear();
}
