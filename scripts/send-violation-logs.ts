import dgram from 'dgram';

const SYSLOG_PORT = 514;
const TARGET_HOST = '127.0.0.1';

const client = dgram.createSocket('udp4');

interface ViolationLog {
  hostname: string;
  severity: number;
  facility: number;
  message: string;
}

const violationLogs: ViolationLog[] = [
  {
    hostname: "huawei-core-01",
    facility: 0,
    severity: 2,
    message: "CRITICAL ALERT: User: admin_hacker Operation: Delete System Config Result: Failed - Unauthorized access attempt from 10.0.0.99"
  },
  {
    hostname: "cisco-fw-01", 
    facility: 4,
    severity: 2,
    message: "%SEC-2-VIOLATION: Intrusion detected - Multiple failed login attempts from IP 203.0.113.50 blocked"
  },
  {
    hostname: "db-server-01",
    facility: 1,
    severity: 3,
    message: "sshd[9999]: CRITICAL: Brute force attack detected - 50 failed attempts from 185.220.101.1 in 2 minutes"
  },
  {
    hostname: "paloalto-fw-01",
    facility: 4,
    severity: 2,
    message: "THREAT ALERT: Malware detected - Trojan.GenericKD.46789012 blocked from 192.168.50.100"
  },
  {
    hostname: "checkpoint-gw-01",
    facility: 4,
    severity: 2,
    message: "IPS CRITICAL: SQL Injection attack blocked - Pattern: UNION SELECT * FROM users - Source: 45.33.32.156"
  },
  {
    hostname: "fortigate-edge",
    facility: 4,
    severity: 3,
    message: "WEBFILTER BLOCK: User attempted access to Command & Control server 91.121.87.87 - Blocked"
  },
  {
    hostname: "u2000-nms",
    facility: 23,
    severity: 2,
    message: "User: unknown_admin Operation: Export Customer Database Result: DENIED - Unauthorized data export attempt"
  },
  {
    hostname: "radius-auth-01",
    facility: 10,
    severity: 3,
    message: "AUTH VIOLATION: 100 failed authentications from NAS 10.20.30.5 in 5 minutes - Possible credential stuffing"
  },
  {
    hostname: "epc-core-01",
    facility: 16,
    severity: 2,
    message: "SECURITY: Unauthorized subscriber profile modification attempt - IMSI 416770999888777 - Blocked"
  },
  {
    hostname: "siem-collector-01",
    facility: 16,
    severity: 2,
    message: "CORRELATION ALERT: Data exfiltration pattern detected - 500MB transferred to external IP in 10 minutes"
  },
  {
    hostname: "arista-spine-01",
    facility: 23,
    severity: 3,
    message: "SECURITY: MAC address spoofing detected on interface Ethernet1/5 - Potential ARP poisoning attack"
  },
  {
    hostname: "f5-ltm-01",
    facility: 16,
    severity: 2,
    message: "WAF BLOCK: XSS attack attempt - Script injection in form field from 198.51.100.50"
  },
  {
    hostname: "dns-primary-01",
    facility: 3,
    severity: 3,
    message: "named[1234]: SECURITY: DNS amplification attack detected - 10000 queries/sec from spoofed sources"
  },
  {
    hostname: "juniper-sw-core",
    facility: 23,
    severity: 2,
    message: "CRITICAL: Port security violation on ge-0/0/48 - Unauthorized MAC address 00:DE:AD:BE:EF:00"
  },
  {
    hostname: "esxi-host-01",
    facility: 23,
    severity: 3,
    message: "SECURITY: Unauthorized VM clone attempt - VM production-db-01 by user rogue_admin - BLOCKED"
  },
  {
    hostname: "web-server-01",
    facility: 1,
    severity: 2,
    message: "ModSecurity CRITICAL: Remote code execution attempt blocked - Path traversal attack from 203.0.113.100"
  },
  {
    hostname: "nokia-oss-01",
    facility: 23,
    severity: 3,
    message: "AUDIT ALERT: Mass configuration change on 50 BTS nodes by operator unknown_user - Reverted"
  },
  {
    hostname: "enm-server-01",
    facility: 23,
    severity: 2,
    message: "CRITICAL: Bulk delete command issued for 200 network elements by operator test_account - BLOCKED"
  },
  {
    hostname: "haproxy-lb-01",
    facility: 1,
    severity: 3,
    message: "DDOS ALERT: Connection flood detected - 50000 connections/sec from 198.51.100.0/24 - Rate limiting applied"
  },
  {
    hostname: "DC-MAIN-01",
    facility: 10,
    severity: 2,
    message: "EventID: 4625 CRITICAL: 500 failed logon attempts for account Administrator from 203.0.113.200 in 10 minutes"
  }
];

function buildSyslogMessage(facility: number, severity: number, hostname: string, message: string): string {
  const pri = facility * 8 + severity;
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const timestamp = `${months[now.getMonth()]} ${String(now.getDate()).padStart(2, ' ')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  return `<${pri}>${timestamp} ${hostname} ${message}`;
}

async function sendLog(message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const buffer = Buffer.from(message);
    client.send(buffer, 0, buffer.length, SYSLOG_PORT, TARGET_HOST, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function main() {
  console.log('Sending VIOLATION logs from multiple sources...\n');
  console.log('═'.repeat(60));
  
  for (const log of violationLogs) {
    const syslogMsg = buildSyslogMessage(log.facility, log.severity, log.hostname, log.message);
    await sendLog(syslogMsg);
    console.log(`[${log.hostname}] ${log.message.substring(0, 70)}...`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log(`Sent ${violationLogs.length} CRITICAL/MAJOR violation logs`);
  console.log('═'.repeat(60));
  
  client.close();
  process.exit(0);
}

main().catch(console.error);
