import dgram from 'dgram';

const SYSLOG_PORT = 514;
const TARGET_HOST = '127.0.0.1';

const client = dgram.createSocket('udp4');

interface LogSource {
  name: string;
  hostname: string;
  facility: number;
  logs: string[];
}

const sources: LogSource[] = [
  {
    name: "Huawei NMS Core Router",
    hostname: "huawei-core-01",
    facility: 23,
    logs: [
      "User: admin_zain Operation: Configure VLAN 100 Result: Successful TerminalIP: 192.168.1.100",
      "User: network_op Operation: Backup Configuration Result: Successful TerminalIP: 192.168.1.101",
      "User: admin_zain Operation: Interface GE0/0/1 Enable Result: Successful TerminalIP: 192.168.1.100",
      "User: supervisor Operation: Add Static Route Result: Successful TerminalIP: 192.168.1.105"
    ]
  },
  {
    name: "Cisco ASA Firewall",
    hostname: "cisco-fw-01",
    facility: 4,
    logs: [
      "%ASA-6-302013: Built inbound TCP connection for outside:192.168.100.50/443",
      "%ASA-4-106023: Deny tcp src outside:10.0.0.5/22 dst inside:192.168.1.1/22 by access-group",
      "%ASA-5-111008: User 'admin' executed command 'show running-config'",
      "%ASA-3-710003: TCP access denied by ACL from 203.0.113.5/54321 to inside:192.168.1.100/443"
    ]
  },
  {
    name: "Linux Web Server 1",
    hostname: "web-server-01",
    facility: 1,
    logs: [
      "sshd[12345]: Accepted password for admin from 192.168.1.50 port 22 ssh2",
      "nginx[5678]: 192.168.1.100 - - GET /api/users HTTP/1.1 200 1234",
      "kernel[0]: [UFW BLOCK] IN=eth0 OUT= SRC=10.0.0.5 DST=192.168.1.10 PROTO=TCP DPT=22",
      "systemd[1]: Started Apache HTTP Server"
    ]
  },
  {
    name: "Linux Database Server",
    hostname: "db-server-01",
    facility: 1,
    logs: [
      "mysql[8080]: Query: SELECT * FROM users WHERE id=1 executed by root@localhost",
      "postgresql[9000]: LOG: connection authorized: user=postgres database=production",
      "cron[1234]: (root) CMD (/usr/local/bin/backup.sh)",
      "sshd[5555]: Failed password for invalid user hacker from 185.220.101.1 port 44322 ssh2"
    ]
  },
  {
    name: "Windows Domain Controller",
    hostname: "DC-MAIN-01",
    facility: 10,
    logs: [
      "EventID: 4624 Account: admin@zain.jo Logon Type: 10 Source: 192.168.1.200",
      "EventID: 4625 Account: hacker User: Failed logon attempt from 203.0.113.100",
      "EventID: 4648 User: svc_backup Target: DC-MAIN-01 Process: backup.exe",
      "EventID: 4672 Account: administrator Special privileges assigned to new logon"
    ]
  },
  {
    name: "Juniper Switch Core",
    hostname: "juniper-sw-core",
    facility: 23,
    logs: [
      "interface ge-0/0/1 is up, line protocol is up",
      "interface ge-0/0/24 is down, line protocol is down",
      "User login: operator_net from 192.168.10.50 via console",
      "SNMP: Authentication failure from 10.0.0.100"
    ]
  },
  {
    name: "Palo Alto Firewall",
    hostname: "paloalto-fw-01",
    facility: 4,
    logs: [
      "THREAT: Spyware detected from 192.168.50.100 to 8.8.8.8",
      "TRAFFIC: Allow from zone trust to untrust Application: web-browsing",
      "CONFIG: admin committed configuration changes TerminalIP: 192.168.1.150",
      "SYSTEM: High CPU utilization alert - 95%"
    ]
  },
  {
    name: "VMware ESXi Host 1",
    hostname: "esxi-host-01",
    facility: 23,
    logs: [
      "VM guest-web-01 powered on by user vcadmin@vsphere.local",
      "Storage adapter vmhba2 link up speed 10Gbps",
      "User root logged in from 192.168.1.200",
      "vMotion: VM database-01 migrated to esxi-host-02"
    ]
  },
  {
    name: "Fortinet FortiGate",
    hostname: "fortigate-edge",
    facility: 4,
    logs: [
      "IPS alert: SQL Injection attempt from 203.0.113.50 blocked",
      "VPN: User 'remote_admin' connected from 89.100.50.25",
      "WEBFILTER: Blocked access to malware site from 192.168.10.50",
      "HA: Failover from primary to secondary unit completed"
    ]
  },
  {
    name: "Zain Core Network EPC",
    hostname: "epc-core-01",
    facility: 16,
    logs: [
      "User: noc_operator Operation: Update APN Configuration Result: Successful",
      "MME: Attach request from IMSI 416770123456789 accepted",
      "SGW: Session created for subscriber MSISDN 962791234567",
      "PGW: QoS policy applied for enterprise customer"
    ]
  },
  {
    name: "Huawei iManager U2000",
    hostname: "u2000-nms",
    facility: 23,
    logs: [
      "User: netadmin Operation: Synchronize NE Configuration Result: Successful TerminalIP: 10.10.10.50",
      "ALARM: Critical - Link down on NE-CORE-01 Port GE1/0/1",
      "User: operator1 Operation: Clear Alarm Result: Successful TerminalIP: 10.10.10.51",
      "PERFORMANCE: Threshold exceeded on interface utilization > 80%"
    ]
  },
  {
    name: "Nokia NetAct OSS",
    hostname: "nokia-oss-01",
    facility: 23,
    logs: [
      "CM: Configuration change on BTS-001 by operator nokia_admin",
      "FM: Major alarm cleared on RNC-AMMAN-01",
      "PM: Counters collected from 250 network elements",
      "User login: oss_engineer from workstation WS-NOC-01"
    ]
  },
  {
    name: "Ericsson ENM",
    hostname: "enm-server-01",
    facility: 23,
    logs: [
      "OSS-RC: User ericsson_op synchronized node eNodeB-001",
      "NETLOG: Configuration backup completed for 100 nodes",
      "SHROOT: Admin session started from 172.16.50.100",
      "AMOS: Script execution completed for network audit"
    ]
  },
  {
    name: "Linux Load Balancer",
    hostname: "haproxy-lb-01",
    facility: 1,
    logs: [
      "haproxy[2000]: Server backend_web/web1 is DOWN, reason: Layer4 connection problem",
      "haproxy[2000]: Server backend_web/web2 is UP, reason: Layer4 check passed",
      "keepalived[1500]: VRRP_Instance(VI_1) Entering MASTER STATE",
      "nginx[3000]: upstream prematurely closed connection while reading response header"
    ]
  },
  {
    name: "Checkpoint Firewall",
    hostname: "checkpoint-gw-01",
    facility: 4,
    logs: [
      "SmartDefense: IPS signature matched - Buffer Overflow attempt blocked",
      "Identity Awareness: User john.doe@company.com identified from 192.168.5.100",
      "Anti-Bot: Malicious communication blocked to C2 server 45.77.100.50",
      "Admin: Policy installation started by fwadmin from GUI client"
    ]
  },
  {
    name: "Arista Switch Spine",
    hostname: "arista-spine-01",
    facility: 23,
    logs: [
      "interface Ethernet1/1 is up, line protocol is up (connected)",
      "BGP: Neighbor 10.0.0.2 established - AS 65001",
      "EVPN: VXLAN tunnel to 10.0.1.1 established",
      "User admin logged in from 192.168.1.150 via SSH"
    ]
  },
  {
    name: "F5 BIG-IP LTM",
    hostname: "f5-ltm-01",
    facility: 16,
    logs: [
      "AUDIT: User admin modified virtual server VS_WEB_HTTPS",
      "Pool member 192.168.10.101:80 has been marked down",
      "iRule REDIRECT_HTTP executed for client 203.0.113.50",
      "SSL: Certificate for www.example.com expires in 30 days"
    ]
  },
  {
    name: "Zain Radius Server",
    hostname: "radius-auth-01",
    facility: 10,
    logs: [
      "Auth: User 962791234567 authenticated successfully via EAP-SIM",
      "Accounting: Session started for MSISDN 962777123456 NAS-IP 10.20.30.1",
      "Auth: Failed authentication for user unknown_user from NAS 10.20.30.5",
      "CoA: Disconnect request sent for session ID abc123def456"
    ]
  },
  {
    name: "DNS Server Primary",
    hostname: "dns-primary-01",
    facility: 3,
    logs: [
      "named[1234]: zone zain.jo/IN loaded serial 2024120301",
      "named[1234]: client 192.168.1.100#12345: query: api.zain.jo IN A",
      "named[1234]: zone transfer of 'zain.jo' to 10.0.0.5 started",
      "named[1234]: resolver priming query complete"
    ]
  },
  {
    name: "Zain SIEM Collector",
    hostname: "siem-collector-01",
    facility: 16,
    logs: [
      "Correlation: Multiple failed logins detected from 203.0.113.100 - Possible brute force",
      "Alert: Suspicious outbound traffic to known malicious IP blocked",
      "Compliance: PCI-DSS audit report generated for Q4 2024",
      "Threat Intelligence: IOC match found - Hash abc123 associated with ransomware"
    ]
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
  console.log('Starting to send logs from 20 different sources...\n');
  
  let totalLogs = 0;
  
  for (const source of sources) {
    console.log(`\n📡 Source: ${source.name} (${source.hostname})`);
    console.log('─'.repeat(50));
    
    for (const logMessage of source.logs) {
      const severity = Math.floor(Math.random() * 4) + 3;
      const syslogMsg = buildSyslogMessage(source.facility, severity, source.hostname, logMessage);
      
      await sendLog(syslogMsg);
      console.log(`  ✓ Sent: ${logMessage.substring(0, 60)}...`);
      totalLogs++;
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Completed! Sent ${totalLogs} logs from ${sources.length} sources`);
  console.log('═'.repeat(50));
  
  client.close();
  process.exit(0);
}

main().catch(console.error);
