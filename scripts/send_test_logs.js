import dgram from 'dgram';

const SYSLOG_HOST = '127.0.0.1';
const SYSLOG_PORT = 514;

const client = dgram.createSocket('udp4');

function sendLog(priority, message) {
  return new Promise((resolve) => {
    const timestamp = new Date().toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(',', '');
    
    const fullMessage = `<${priority}>${timestamp} nms-server ${message}`;
    const buffer = Buffer.from(fullMessage);
    
    client.send(buffer, 0, buffer.length, SYSLOG_PORT, SYSLOG_HOST, (err) => {
      if (err) {
        console.error('Error sending:', err);
      } else {
        console.log(`Sent: ${fullMessage}`);
      }
      resolve();
    });
  });
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Starting Test Log Generation...');
  console.log('================================\n');

  // Source 1: NMS-Core (Normal Operations) - Priority 14 = Info level
  console.log('=== Source 1: NMS-Core (Normal Operations) ===');
  await sendLog(14, 'User=operator1 Operation=View Device Result=Successful TerminalIP=192.168.1.100');
  await delay(300);
  await sendLog(14, 'User=operator1 Operation=Check Status Result=Successful TerminalIP=192.168.1.100');
  await delay(300);
  await sendLog(14, 'User=operator2 Operation=List Users Result=Successful TerminalIP=192.168.1.101');
  await delay(300);

  // Source 2: Security Violations - Priority 10 = Critical, 11 = Error
  console.log('\n=== Source 2: NMS-Security (VIOLATIONS - Critical) ===');
  await sendLog(10, 'User=hacker_attempt Operation=Delete All Users Result=Failed TerminalIP=10.0.0.99');
  await delay(300);
  await sendLog(10, 'User=unauthorized_user Operation=Access Admin Panel Result=Failed TerminalIP=10.0.0.99');
  await delay(300);
  await sendLog(11, 'User=operator3 Operation=Modify System Config Result=Failed TerminalIP=192.168.1.102');
  await delay(300);

  // Source 3: Network Operations - Mixed
  console.log('\n=== Source 3: NMS-Network (Mixed Operations) ===');
  await sendLog(14, 'User=network_admin Operation=Configure Router Result=Successful TerminalIP=192.168.2.50');
  await delay(300);
  await sendLog(11, 'User=network_admin Operation=Delete Firewall Rule Result=Failed TerminalIP=192.168.2.50');
  await delay(300);
  await sendLog(10, 'User=external_user Operation=Access Restricted Zone Result=Failed TerminalIP=192.168.99.99');
  await delay(300);

  // Source 4: Database Operations - Failed
  console.log('\n=== Source 4: NMS-Database (Failed Operations) ===');
  await sendLog(11, 'User=db_admin Operation=Backup Database Result=Failed TerminalIP=192.168.3.10');
  await delay(300);
  await sendLog(11, 'User=db_admin Operation=Restore Table Result=Failed TerminalIP=192.168.3.10');
  await delay(300);
  await sendLog(14, 'User=db_admin Operation=Query Records Result=Successful TerminalIP=192.168.3.10');
  await delay(300);

  // Additional Violation Scenarios
  console.log('\n=== Source 5: Additional Violation Scenarios ===');
  await sendLog(9, 'User=suspicious_user Operation=Brute Force Login Attempt Result=Failed TerminalIP=10.99.99.99');
  await delay(300);
  await sendLog(10, 'User=terminated_employee Operation=Access HR Records Result=Failed TerminalIP=192.168.5.99');
  await delay(300);

  console.log('\n================================');
  console.log('Test Log Generation Complete!');
  console.log('Total logs sent: 14');
  console.log('Expected Violations: 6 (Critical/Error level logs)');
  console.log('Expected Failed Operations: 8');
  console.log('\nWait 2 seconds for batch processing...');
  
  await delay(2000);
  
  client.close();
  console.log('\nDone! Now go to Analysis Reports page to generate a report.');
}

main().catch(console.error);
