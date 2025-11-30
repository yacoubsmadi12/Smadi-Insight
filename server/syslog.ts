import * as dgram from "dgram";
import { storage } from "./storage";
import { broadcastLog } from "./routes";

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

const facilityNames = [
  "kern", "user", "mail", "daemon", "auth", "syslog", "lpr", "news",
  "uucp", "cron", "authpriv", "ftp", "ntp", "audit", "alert", "clock",
  "local0", "local1", "local2", "local3", "local4", "local5", "local6", "local7"
];

function parseSyslogMessage(msg: string): ParsedSyslog {
  const rawMessage = msg.trim();
  
  // RFC 3164 format: <PRI>TIMESTAMP HOSTNAME MESSAGE
  // RFC 5424 format: <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG
  
  let facility = 1;
  let severity = 6;
  let hostname = "unknown";
  let message = rawMessage;
  let timestamp = new Date();

  // Parse priority value <PRI>
  const priMatch = rawMessage.match(/^<(\d{1,3})>/);
  if (priMatch) {
    const pri = parseInt(priMatch[1]);
    facility = Math.floor(pri / 8);
    severity = pri % 8;
    message = rawMessage.substring(priMatch[0].length);
  }

  // Try to parse RFC 3164 timestamp (e.g., "Nov 30 15:30:00")
  const rfc3164Match = message.match(/^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.*)/i);
  if (rfc3164Match) {
    const dateStr = rfc3164Match[1];
    hostname = rfc3164Match[2];
    message = rfc3164Match[3];
    
    // Parse the timestamp
    const now = new Date();
    const parsedDate = new Date(`${dateStr} ${now.getFullYear()}`);
    if (!isNaN(parsedDate.getTime())) {
      timestamp = parsedDate;
    }
  }

  // Try to parse RFC 5424 format
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
      
      console.log(`[syslog] Received from ${rinfo.address}:${rinfo.port} - ${parsed.hostname}: ${parsed.message.substring(0, 100)}...`);

      // Create log entry
      const logData = {
        employeeId: parsed.hostname,
        timestamp: parsed.timestamp,
        source: `syslog-${facilityNames[parsed.facility] || "unknown"}`,
        action: severityNames[parsed.severity] || "Unknown",
        details: parsed.message
      };

      // Check if employee exists, create if not
      const existingEmployees = await storage.getEmployees({ search: logData.employeeId });
      const employeeExists = existingEmployees.some(e => e.id === logData.employeeId || e.name === logData.employeeId);
      
      if (!employeeExists) {
        try {
          await storage.createEmployee({
            name: logData.employeeId,
            email: `${logData.employeeId}@syslog.local`,
            role: "System",
            department: "Network",
            status: "active"
          });
        } catch (e) {
          // Employee might already exist from concurrent request
        }
      }
      
      // Get the employee to use their ID
      const allEmployees = await storage.getEmployees({ search: logData.employeeId });
      const employee = allEmployees.find(e => e.name === logData.employeeId);
      if (employee) {
        logData.employeeId = employee.id;
      }

      // Store the log
      const createdLog = await storage.createLog(logData);
      
      // Broadcast to WebSocket clients
      broadcastLog(createdLog);

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
