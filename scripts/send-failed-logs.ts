import dgram from 'dgram';

const SYSLOG_PORT = 514;
const TARGET_HOST = '127.0.0.1';

const client = dgram.createSocket('udp4');

interface FailedLog {
  hostname: string;
  severity: number;
  facility: number;
  message: string;
}

const failedLogs: FailedLog[] = [
  {
    hostname: "huawei-core-01",
    facility: 23,
    severity: 4,
    message: "User: admin_zain Operation: Configure BGP Neighbor Result: Failed - ENDESC=Invalid AS number specified; Target: Router-Core-01"
  },
  {
    hostname: "cisco-fw-01",
    facility: 4,
    severity: 4,
    message: "%CONFIG-4-FAILED: User 'netops' command 'access-list 101' failed - ENDESC=Syntax error in ACL definition"
  },
  {
    hostname: "db-server-01",
    facility: 1,
    severity: 4,
    message: "mysql[8080]: User root@192.168.1.50 Operation: ALTER TABLE users Result: Failed - ENDESC=Table is locked by another process"
  },
  {
    hostname: "paloalto-fw-01",
    facility: 4,
    severity: 4,
    message: "CONFIG COMMIT: User admin Operation: Apply Security Policy Result: Failed - ENDESC=Policy conflict with existing rule #145"
  },
  {
    hostname: "u2000-nms",
    facility: 23,
    severity: 4,
    message: "User: netadmin Operation: Synchronize NE Configuration Result: Failed - ENDESC=Connection timeout to NE-CORE-02 after 30 seconds"
  },
  {
    hostname: "epc-core-01",
    facility: 16,
    severity: 4,
    message: "User: noc_operator Operation: Update APN Settings Result: Failed - ENDESC=Invalid QoS profile specified for enterprise APN"
  },
  {
    hostname: "fortigate-edge",
    facility: 4,
    severity: 4,
    message: "VPN CONFIG: User vpn_admin Operation: Create IPSec Tunnel Result: Failed - ENDESC=Pre-shared key mismatch with remote gateway"
  },
  {
    hostname: "juniper-sw-core",
    facility: 23,
    severity: 4,
    message: "User operator_net Operation: Enable Port ge-0/0/48 Result: Failed - ENDESC=Port is administratively disabled by policy"
  },
  {
    hostname: "f5-ltm-01",
    facility: 16,
    severity: 4,
    message: "AUDIT: User lb_admin Operation: Add Pool Member 192.168.10.105:443 Result: Failed - ENDESC=Health monitor check failed for member"
  },
  {
    hostname: "nokia-oss-01",
    facility: 23,
    severity: 4,
    message: "CM: User oss_engineer Operation: Update BTS-045 Parameters Result: Failed - ENDESC=Parameter value out of allowed range"
  },
  {
    hostname: "arista-spine-01",
    facility: 23,
    severity: 4,
    message: "User admin Operation: Configure VXLAN Tunnel Result: Failed - ENDESC=VTEP IP address conflict detected"
  },
  {
    hostname: "checkpoint-gw-01",
    facility: 4,
    severity: 4,
    message: "Policy Install: User fwadmin Operation: Push Policy to Gateway Result: Failed - ENDESC=Policy verification failed - overlapping rules"
  },
  {
    hostname: "enm-server-01",
    facility: 23,
    severity: 4,
    message: "OSS-RC: User ericsson_op Operation: Node Synchronization Result: Failed - ENDESC=Node eNodeB-123 unreachable"
  },
  {
    hostname: "radius-auth-01",
    facility: 10,
    severity: 4,
    message: "CONFIG: User radius_admin Operation: Add NAS Client Result: Failed - ENDESC=Shared secret exceeds maximum length"
  },
  {
    hostname: "dns-primary-01",
    facility: 3,
    severity: 4,
    message: "named[1234]: User dns_admin Operation: Zone Transfer to Secondary Result: Failed - ENDESC=TSIG key mismatch"
  },
  {
    hostname: "esxi-host-01",
    facility: 23,
    severity: 4,
    message: "VM Operation: User vcadmin Operation: vMotion VM database-prod Result: Failed - ENDESC=Insufficient resources on target host"
  },
  {
    hostname: "haproxy-lb-01",
    facility: 1,
    severity: 4,
    message: "haproxy[2000]: User lb_ops Operation: Add Backend Server Result: Failed - ENDESC=Maximum backend servers limit reached"
  },
  {
    hostname: "DC-MAIN-01",
    facility: 10,
    severity: 4,
    message: "EventID: 4771 User: svc_backup Operation: Kerberos Pre-Auth Result: Failed - ENDESC=Clock skew too great"
  },
  {
    hostname: "siem-collector-01",
    facility: 16,
    severity: 4,
    message: "User: soc_analyst Operation: Create Correlation Rule Result: Failed - ENDESC=Invalid regex pattern in filter condition"
  },
  {
    hostname: "web-server-01",
    facility: 1,
    severity: 4,
    message: "nginx[5678]: User: devops Operation: Reload Configuration Result: Failed - ENDESC=Invalid upstream server address"
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
  console.log('Sending FAILED OPERATION logs...\n');
  console.log('═'.repeat(70));
  
  for (const log of failedLogs) {
    const syslogMsg = buildSyslogMessage(log.facility, log.severity, log.hostname, log.message);
    await sendLog(syslogMsg);
    console.log(`[${log.hostname}] ${log.message.substring(0, 80)}...`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log(`Sent ${failedLogs.length} FAILED operation logs with detailed error descriptions`);
  console.log('═'.repeat(70));
  
  client.close();
  process.exit(0);
}

main().catch(console.error);
