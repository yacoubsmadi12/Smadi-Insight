#!/bin/bash

# Test Syslog Sender Script
# This script sends test syslog messages to simulate various scenarios

SYSLOG_HOST="127.0.0.1"
SYSLOG_PORT="514"

echo "Starting Test Log Generation..."
echo "================================"

# Function to send syslog message
# Format: <priority>timestamp hostname message
# Priority = facility * 8 + severity
# Facility 1 = user, Severity 3 = Error, 4 = Warning, 6 = Info

send_log() {
    local priority=$1
    local message=$2
    local timestamp=$(date '+%b %d %H:%M:%S')
    local full_message="<${priority}>${timestamp} nms-server ${message}"
    echo -n "$full_message" | nc -u -w1 $SYSLOG_HOST $SYSLOG_PORT 2>/dev/null
    echo "Sent: $full_message"
}

echo ""
echo "=== Source 1: NMS-Core (Normal Operations) ==="
# Priority 14 = facility 1 (user) * 8 + severity 6 (info)
send_log 14 "User=operator1 Operation=View Device Result=Successful TerminalIP=192.168.1.100"
sleep 0.5
send_log 14 "User=operator1 Operation=Check Status Result=Successful TerminalIP=192.168.1.100"
sleep 0.5
send_log 14 "User=operator2 Operation=List Users Result=Successful TerminalIP=192.168.1.101"
sleep 0.5

echo ""
echo "=== Source 2: NMS-Security (Violations - Critical) ==="
# Priority 10 = facility 1 (user) * 8 + severity 2 (critical)
send_log 10 "User=hacker_attempt Operation=Delete All Users Result=Failed TerminalIP=10.0.0.99"
sleep 0.5
send_log 10 "User=unauthorized Operation=Access Admin Panel Result=Failed TerminalIP=10.0.0.99"
sleep 0.5
# Priority 11 = facility 1 (user) * 8 + severity 3 (error)
send_log 11 "User=operator3 Operation=Modify System Config Result=Failed TerminalIP=192.168.1.102"
sleep 0.5

echo ""
echo "=== Source 3: NMS-Network (Mixed Operations) ==="
send_log 14 "User=network_admin Operation=Configure Router Result=Successful TerminalIP=192.168.2.50"
sleep 0.5
send_log 11 "User=network_admin Operation=Delete Firewall Rule Result=Failed TerminalIP=192.168.2.50"
sleep 0.5
send_log 10 "User=external_user Operation=Access Restricted Zone Result=Failed TerminalIP=external.ip.addr"
sleep 0.5

echo ""
echo "=== Source 4: NMS-Database (Failed Operations) ==="
send_log 11 "User=db_admin Operation=Backup Database Result=Failed TerminalIP=192.168.3.10"
sleep 0.5
send_log 11 "User=db_admin Operation=Restore Table Result=Failed TerminalIP=192.168.3.10"
sleep 0.5
send_log 14 "User=db_admin Operation=Query Records Result=Successful TerminalIP=192.168.3.10"
sleep 0.5

echo ""
echo "=== Source 5: Additional Violation Scenarios ==="
# Security Alert - Priority 9 = Alert level
send_log 9 "User=suspicious_user Operation=Brute Force Login Result=Failed TerminalIP=malicious.ip"
sleep 0.5
send_log 10 "User=terminated_employee Operation=Access HR Records Result=Failed TerminalIP=192.168.5.99"
sleep 0.5

echo ""
echo "================================"
echo "Test Log Generation Complete!"
echo "Total logs sent: 14"
echo "Expected Violations: 6 (Critical/Error level logs)"
echo "Expected Failed Operations: 8"
echo ""
echo "Now go to the Analysis Reports page and generate a report to see the results."
