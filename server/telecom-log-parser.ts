export interface TelecomLogEntry {
  operation: string;
  level: string;
  operator: string;
  timestamp: Date;
  source: string;
  terminalIp: string;
  operationObject: string;
  result: string;
  details: string;
  isViolation: boolean;
  violationType: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  deviceType: string | null;
  deviceName: string | null;
  commandType: string | null;
  callChainId: string | null;
  processId: string | null;
  parsedDetails: Record<string, any>;
}

const HUAWEI_OPERATIONS: Record<string, { category: string; risk: string; description: string }> = {
  'LST-GPONONTAUTOFIND': { category: 'Query', risk: 'low', description: 'List GPON ONT Auto Find' },
  'ACT-SERVICEPORT': { category: 'Activation', risk: 'medium', description: 'Activate Service Port' },
  'DEL-SERVICEPORT': { category: 'Deletion', risk: 'high', description: 'Delete Service Port' },
  'MOD-SERVICEPORT': { category: 'Modification', risk: 'medium', description: 'Modify Service Port' },
  'ADD-ONTPORT': { category: 'Addition', risk: 'medium', description: 'Add ONT Port' },
  'DEL-ONTPORT': { category: 'Deletion', risk: 'high', description: 'Delete ONT Port' },
  'MOD-ONTPORT': { category: 'Modification', risk: 'medium', description: 'Modify ONT Port' },
  'LST-ONTINFO': { category: 'Query', risk: 'low', description: 'List ONT Information' },
  'LST-ONTVERSION': { category: 'Query', risk: 'low', description: 'List ONT Version' },
  'ADD-ONT': { category: 'Addition', risk: 'medium', description: 'Add ONT' },
  'DEL-ONT': { category: 'Deletion', risk: 'high', description: 'Delete ONT' },
  'MOD-ONT': { category: 'Modification', risk: 'medium', description: 'Modify ONT' },
  'RST-ONT': { category: 'Reset', risk: 'high', description: 'Reset ONT' },
  'DEACT-ONT': { category: 'Deactivation', risk: 'high', description: 'Deactivate ONT' },
  'ACT-ONT': { category: 'Activation', risk: 'medium', description: 'Activate ONT' },
  'LST-PORT': { category: 'Query', risk: 'low', description: 'List Port' },
  'MOD-PORT': { category: 'Modification', risk: 'medium', description: 'Modify Port' },
  'LST-BOARD': { category: 'Query', risk: 'low', description: 'List Board' },
  'ADD-BOARD': { category: 'Addition', risk: 'medium', description: 'Add Board' },
  'DEL-BOARD': { category: 'Deletion', risk: 'high', description: 'Delete Board' },
  'RST-BOARD': { category: 'Reset', risk: 'high', description: 'Reset Board' },
  'LST-VLAN': { category: 'Query', risk: 'low', description: 'List VLAN' },
  'ADD-VLAN': { category: 'Addition', risk: 'medium', description: 'Add VLAN' },
  'DEL-VLAN': { category: 'Deletion', risk: 'high', description: 'Delete VLAN' },
  'MOD-VLAN': { category: 'Modification', risk: 'medium', description: 'Modify VLAN' },
  'LST-TRAFFIC': { category: 'Query', risk: 'low', description: 'List Traffic' },
  'LST-ALARM': { category: 'Query', risk: 'low', description: 'List Alarm' },
  'ACK-ALARM': { category: 'Acknowledgement', risk: 'low', description: 'Acknowledge Alarm' },
  'CLR-ALARM': { category: 'Clear', risk: 'medium', description: 'Clear Alarm' },
  'LST-USER': { category: 'Query', risk: 'low', description: 'List User' },
  'ADD-USER': { category: 'Addition', risk: 'high', description: 'Add User' },
  'DEL-USER': { category: 'Deletion', risk: 'critical', description: 'Delete User' },
  'MOD-USER': { category: 'Modification', risk: 'high', description: 'Modify User' },
  'CHG-PASSWORD': { category: 'Security', risk: 'high', description: 'Change Password' },
  'LOGIN': { category: 'Authentication', risk: 'medium', description: 'User Login' },
  'LOGOUT': { category: 'Authentication', risk: 'low', description: 'User Logout' },
  'LST-ONTUSERWLAN': { category: 'Query', risk: 'low', description: 'List ONT User WLAN' },
  'MOD-ONTUSERWLAN': { category: 'Modification', risk: 'medium', description: 'Modify ONT User WLAN' },
  'CFG-BACKUP': { category: 'Backup', risk: 'medium', description: 'Configuration Backup' },
  'CFG-RESTORE': { category: 'Restore', risk: 'critical', description: 'Configuration Restore' },
  'SYS-REBOOT': { category: 'System', risk: 'critical', description: 'System Reboot' },
  'SYS-UPGRADE': { category: 'System', risk: 'critical', description: 'System Upgrade' },
};

const VIOLATION_PATTERNS = [
  { pattern: /DEL-|DELETE|REMOVE/i, type: 'Deletion Operation', severity: 'Major' },
  { pattern: /RST-|RESET|REBOOT/i, type: 'Reset Operation', severity: 'Major' },
  { pattern: /CFG-RESTORE|RESTORE/i, type: 'Configuration Restore', severity: 'Critical' },
  { pattern: /SYS-REBOOT|SYS-UPGRADE/i, type: 'System Critical Operation', severity: 'Critical' },
  { pattern: /ADD-USER|DEL-USER|MOD-USER/i, type: 'User Management', severity: 'Major' },
  { pattern: /CHG-PASSWORD/i, type: 'Password Change', severity: 'Major' },
  { pattern: /unauthorized|denied|forbidden/i, type: 'Access Denied', severity: 'Critical' },
  { pattern: /failed.*login|login.*failed/i, type: 'Failed Login', severity: 'Major' },
  { pattern: /Resource does not exist/i, type: 'Resource Error', severity: 'Warning' },
  { pattern: /device does not exist/i, type: 'Device Error', severity: 'Warning' },
  { pattern: /Service Port does not exist/i, type: 'Service Port Error', severity: 'Warning' },
];

const ERROR_CODES: Record<string, { description: string; severity: string }> = {
  '2686058552': { description: 'Resource does not exist', severity: 'Warning' },
  '2686058531': { description: 'The device does not exist', severity: 'Warning' },
  '2686058576': { description: 'Service Port does not exist', severity: 'Warning' },
  '2686058500': { description: 'Parameter error', severity: 'Major' },
  '2686058501': { description: 'Command execution failed', severity: 'Major' },
  '2686058502': { description: 'Operation timeout', severity: 'Major' },
  '2686058503': { description: 'Connection failed', severity: 'Critical' },
  '2686058504': { description: 'Authentication failed', severity: 'Critical' },
  '2686058505': { description: 'Permission denied', severity: 'Critical' },
};

const DEVICE_PATTERNS = [
  { pattern: /MA5800-X17/i, type: 'Huawei MA5800-X17', category: 'OLT' },
  { pattern: /MA5800-X7/i, type: 'Huawei MA5800-X7', category: 'OLT' },
  { pattern: /MA5800/i, type: 'Huawei MA5800', category: 'OLT' },
  { pattern: /MA5600T/i, type: 'Huawei MA5600T', category: 'OLT' },
  { pattern: /MA5608T/i, type: 'Huawei MA5608T', category: 'OLT' },
  { pattern: /MA5683T/i, type: 'Huawei MA5683T', category: 'OLT' },
  { pattern: /MA5616/i, type: 'Huawei MA5616', category: 'DSLAM' },
  { pattern: /ATN\d+/i, type: 'Huawei ATN Router', category: 'Router' },
  { pattern: /NE\d+/i, type: 'Huawei NE Router', category: 'Router' },
  { pattern: /S\d{4}/i, type: 'Huawei Switch', category: 'Switch' },
];

export function parseTimestamp(timeStr: string): Date {
  if (!timeStr || timeStr.trim() === '') {
    return new Date();
  }

  const cleanTime = timeStr.replace(/\t/g, '').trim();
  
  const ddmmyyyyMatch = cleanTime.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (ddmmyyyyMatch) {
    const [, day, month, year, hour, minute, second] = ddmmyyyyMatch;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
  }

  const isoMatch = cleanTime.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (isoMatch) {
    const [, year, month, day, hour, minute, second] = isoMatch;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
  }

  try {
    const parsed = new Date(cleanTime);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch {}

  return new Date();
}

export function parseHuaweiNmsDetails(details: string): Record<string, any> {
  const parsed: Record<string, any> = {};

  const callChainMatch = details.match(/Call Chain ID:(\d+)/);
  if (callChainMatch) {
    parsed.callChainId = callChainMatch[1];
  }

  const processIdMatch = details.match(/ProcessID:(\S+)/);
  if (processIdMatch) {
    parsed.processId = processIdMatch[1];
  }

  const enMatch = details.match(/EN=(\d+)/);
  if (enMatch) {
    parsed.errorNumber = enMatch[1];
    const errorInfo = ERROR_CODES[enMatch[1]];
    if (errorInfo) {
      parsed.errorDescription = errorInfo.description;
      parsed.errorSeverity = errorInfo.severity;
    }
  }

  const endescMatch = details.match(/ENDESC=([^\n;]+)/);
  if (endescMatch) {
    parsed.errorDescription = endescMatch[1].trim();
  }

  const devMatch = details.match(/DEV=([^,:\s]+)/);
  if (devMatch) {
    parsed.device = devMatch[1];
  }

  const fnMatch = details.match(/FN=(\d+)/);
  if (fnMatch) parsed.frameNumber = parseInt(fnMatch[1]);

  const snMatch = details.match(/SN=(\d+)/);
  if (snMatch) parsed.slotNumber = parseInt(snMatch[1]);

  const pnMatch = details.match(/PN=(\d+)/);
  if (pnMatch) parsed.portNumber = parseInt(pnMatch[1]);

  const ontidMatch = details.match(/ONTID=(\d+)/);
  if (ontidMatch) parsed.ontId = parseInt(ontidMatch[1]);

  const vlanMatch = details.match(/VLANID=(\d+)/);
  if (vlanMatch) parsed.vlanId = parseInt(vlanMatch[1]);

  const gemportMatch = details.match(/GEMPORTID=(\d+)/);
  if (gemportMatch) parsed.gemportId = parseInt(gemportMatch[1]);

  const blkcountMatch = details.match(/blkcount=(\d+)/);
  if (blkcountMatch) parsed.blockCount = parseInt(blkcountMatch[1]);

  const blktotalMatch = details.match(/blktotal=(\d+)/);
  if (blktotalMatch) parsed.blockTotal = parseInt(blktotalMatch[1]);

  return parsed;
}

export function detectDeviceType(operationObject: string): { type: string; category: string } | null {
  for (const devicePattern of DEVICE_PATTERNS) {
    if (devicePattern.pattern.test(operationObject)) {
      return { type: devicePattern.type, category: devicePattern.category };
    }
  }
  return null;
}

export function detectViolation(entry: Partial<TelecomLogEntry>): { isViolation: boolean; violationType: string | null; severity: string } {
  if (entry.result === 'Failed') {
    const errorSeverity = entry.errorCode ? (ERROR_CODES[entry.errorCode]?.severity || 'Warning') : 'Warning';
    return {
      isViolation: errorSeverity === 'Critical' || errorSeverity === 'Major',
      violationType: entry.result === 'Failed' ? 'Failed Operation' : null,
      severity: errorSeverity
    };
  }

  const fullText = `${entry.operation || ''} ${entry.details || ''}`;
  
  for (const pattern of VIOLATION_PATTERNS) {
    if (pattern.pattern.test(fullText)) {
      return {
        isViolation: pattern.severity === 'Critical' || pattern.severity === 'Major',
        violationType: pattern.type,
        severity: pattern.severity
      };
    }
  }

  const opInfo = HUAWEI_OPERATIONS[entry.operation || ''];
  if (opInfo && (opInfo.risk === 'critical' || opInfo.risk === 'high')) {
    return {
      isViolation: true,
      violationType: `High Risk: ${opInfo.description}`,
      severity: opInfo.risk === 'critical' ? 'Critical' : 'Major'
    };
  }

  return { isViolation: false, violationType: null, severity: 'Minor' };
}

export function parseCSVLine(line: string): string[] {
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
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

export function parseTelecomLog(csvLine: string, headers?: string[]): TelecomLogEntry | null {
  try {
    const fields = parseCSVLine(csvLine);
    
    if (fields.length < 9) {
      return null;
    }

    const defaultHeaders = ['Operation', 'Level', 'Operator', 'Time', 'Source', 'Terminal IP Address', 'Operation Object', 'Result', 'Details'];
    const useHeaders = headers || defaultHeaders;

    const getField = (name: string): string => {
      const index = useHeaders.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
      return index >= 0 && index < fields.length ? fields[index] : '';
    };

    const operation = getField('operation') || fields[0];
    const level = getField('level') || fields[1];
    const operator = getField('operator') || fields[2];
    const timeStr = getField('time') || fields[3];
    const source = getField('source') || fields[4];
    const terminalIp = getField('terminal') || getField('ip') || fields[5];
    const operationObject = getField('object') || fields[6];
    const result = getField('result') || fields[7];
    const details = getField('details') || fields[8];

    const timestamp = parseTimestamp(timeStr);
    const parsedDetails = parseHuaweiNmsDetails(details);
    const deviceInfo = detectDeviceType(operationObject);
    
    const entry: Partial<TelecomLogEntry> = {
      operation,
      level,
      operator,
      timestamp,
      source,
      terminalIp,
      operationObject,
      result,
      details,
      errorCode: parsedDetails.errorNumber || null,
      errorDescription: parsedDetails.errorDescription || null,
      deviceType: deviceInfo?.type || null,
      deviceName: operationObject,
      commandType: HUAWEI_OPERATIONS[operation]?.category || 'Unknown',
      callChainId: parsedDetails.callChainId || null,
      processId: parsedDetails.processId || null,
      parsedDetails,
    };

    const violationInfo = detectViolation(entry);
    entry.isViolation = violationInfo.isViolation;
    entry.violationType = violationInfo.violationType;
    
    if (violationInfo.severity !== 'Minor' && level === 'Minor') {
      entry.level = violationInfo.severity;
    }

    return entry as TelecomLogEntry;
  } catch (error) {
    console.error('Error parsing telecom log:', error);
    return null;
  }
}

export function parseTelecomLogBatch(csvContent: string): TelecomLogEntry[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return [];
  }

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  const isHeader = headers.some(h => 
    h.toLowerCase().includes('operation') || 
    h.toLowerCase().includes('operator') ||
    h.toLowerCase().includes('result')
  );

  const dataLines = isHeader ? lines.slice(1) : lines;
  const useHeaders = isHeader ? headers : undefined;

  const entries: TelecomLogEntry[] = [];
  
  for (const line of dataLines) {
    if (line.trim()) {
      const entry = parseTelecomLog(line, useHeaders);
      if (entry) {
        entries.push(entry);
      }
    }
  }

  return entries;
}

export function generateTelecomLogStats(entries: TelecomLogEntry[]): {
  total: number;
  successful: number;
  failed: number;
  violations: number;
  byOperator: Record<string, { total: number; successful: number; failed: number; violations: number }>;
  byOperation: Record<string, { total: number; successful: number; failed: number }>;
  byDevice: Record<string, number>;
  byLevel: Record<string, number>;
  errorCodes: Record<string, number>;
} {
  const stats = {
    total: entries.length,
    successful: 0,
    failed: 0,
    violations: 0,
    byOperator: {} as Record<string, { total: number; successful: number; failed: number; violations: number }>,
    byOperation: {} as Record<string, { total: number; successful: number; failed: number }>,
    byDevice: {} as Record<string, number>,
    byLevel: {} as Record<string, number>,
    errorCodes: {} as Record<string, number>,
  };

  for (const entry of entries) {
    if (entry.result === 'Successful') {
      stats.successful++;
    } else {
      stats.failed++;
    }

    if (entry.isViolation) {
      stats.violations++;
    }

    if (!stats.byOperator[entry.operator]) {
      stats.byOperator[entry.operator] = { total: 0, successful: 0, failed: 0, violations: 0 };
    }
    stats.byOperator[entry.operator].total++;
    if (entry.result === 'Successful') {
      stats.byOperator[entry.operator].successful++;
    } else {
      stats.byOperator[entry.operator].failed++;
    }
    if (entry.isViolation) {
      stats.byOperator[entry.operator].violations++;
    }

    if (!stats.byOperation[entry.operation]) {
      stats.byOperation[entry.operation] = { total: 0, successful: 0, failed: 0 };
    }
    stats.byOperation[entry.operation].total++;
    if (entry.result === 'Successful') {
      stats.byOperation[entry.operation].successful++;
    } else {
      stats.byOperation[entry.operation].failed++;
    }

    if (entry.deviceType) {
      stats.byDevice[entry.deviceType] = (stats.byDevice[entry.deviceType] || 0) + 1;
    }

    stats.byLevel[entry.level] = (stats.byLevel[entry.level] || 0) + 1;

    if (entry.errorCode) {
      stats.errorCodes[entry.errorCode] = (stats.errorCodes[entry.errorCode] || 0) + 1;
    }
  }

  return stats;
}

export const TELECOM_SOURCES = [
  { ip: '192.168.236.10', name: 'NMS-Primary-Jordan', location: 'Amman HQ' },
  { ip: '192.168.236.11', name: 'NMS-Secondary-Jordan', location: 'Amman DC' },
  { ip: '192.168.210.94', name: 'Integration-Server', location: 'Integration Lab' },
  { ip: '10.10.1.100', name: 'OLT-Management-1', location: 'North Region' },
  { ip: '10.10.1.101', name: 'OLT-Management-2', location: 'South Region' },
  { ip: '10.10.2.100', name: 'DSLAM-Controller-1', location: 'East Zone' },
  { ip: '10.10.2.101', name: 'DSLAM-Controller-2', location: 'West Zone' },
  { ip: '172.16.1.50', name: 'Core-Router-Mgmt', location: 'Core Network' },
  { ip: '172.16.1.51', name: 'Edge-Router-Mgmt', location: 'Edge Network' },
  { ip: '192.168.100.10', name: 'Provisioning-Server', location: 'Operations Center' },
  { ip: '192.168.100.11', name: 'Billing-Interface', location: 'Billing Center' },
  { ip: '10.20.30.40', name: 'NOC-Monitoring-1', location: 'NOC Primary' },
  { ip: '10.20.30.41', name: 'NOC-Monitoring-2', location: 'NOC Backup' },
  { ip: '192.168.50.100', name: 'Field-Tech-Gateway', location: 'Field Operations' },
  { ip: '192.168.50.101', name: 'Contractor-Access', location: 'External Access' },
  { ip: '10.100.1.1', name: 'Irbid-Regional-NMS', location: 'Irbid' },
  { ip: '10.100.2.1', name: 'Zarqa-Regional-NMS', location: 'Zarqa' },
  { ip: '10.100.3.1', name: 'Aqaba-Regional-NMS', location: 'Aqaba' },
  { ip: '10.100.4.1', name: 'Mafraq-Regional-NMS', location: 'Mafraq' },
  { ip: '10.100.5.1', name: 'Karak-Regional-NMS', location: 'Karak' },
];

export const TELECOM_OPERATORS = [
  'kazema', 'IntegTeamAPIUser', 'admin', 'noc_operator1', 'noc_operator2',
  'field_tech1', 'field_tech2', 'supervisor1', 'supervisor2', 'system_auto',
  'provisioning_bot', 'billing_sync', 'maintenance_user', 'audit_user', 'backup_service'
];

export const DEVICE_NAMES = [
  '4660-Sareeh_East-MA5800-X17_01', '3005-Dallah_Circle_FN_MA5800_02', '2211-NISC_MA5800_01',
  '1801-BSC_Nazzal_MA5800_01', '3909-Wadi_Seer_PA_MA5800_01', '4046-Omarieh_Sch_1_PE-MA5800-X17_01',
  '4675-Ketem_North_PE-MA5800-X17_01', '2026_Banafsag_Hall_MA5800_01', '3002_Marj_Al_Hamam_center_MA5800_01',
  '1923-Zarqa_Jadedah_1_PA_MA5800_01', '635-Sahab_City_2_MA5800_02', '4795-Mafraq_2-MA5800-X7-02',
  '4615-Edoon_City_1_PC-MA5800-X17', '4006-Rabieh_MA5800_01', '852-Karak_Marj_HSG_PC-MA5800-X17',
  '5970-Youbil_MA5800_01', '3669-Mugabalein_PA_Fiber-5800-X2', '3861-Zaytoonah_Uni_PA_MA5800_01',
  '3236-New-English-Cricle_MA5800_01', '2012-Reef_Center_MA5800_01', 'AMW-121-Future_Home_MA5600T_02_01',
];

export function generateRealisticTelecomLog(sourceIndex: number): TelecomLogEntry {
  const operations = Object.keys(HUAWEI_OPERATIONS);
  const operation = operations[Math.floor(Math.random() * operations.length)];
  const opInfo = HUAWEI_OPERATIONS[operation];
  
  const source = TELECOM_SOURCES[sourceIndex % TELECOM_SOURCES.length];
  const operator = TELECOM_OPERATORS[Math.floor(Math.random() * TELECOM_OPERATORS.length)];
  const device = DEVICE_NAMES[Math.floor(Math.random() * DEVICE_NAMES.length)];
  
  const successRate = opInfo.risk === 'low' ? 0.95 : opInfo.risk === 'medium' ? 0.85 : 0.75;
  const isSuccessful = Math.random() < successRate;
  const result = isSuccessful ? 'Successful' : 'Failed';
  
  const level = opInfo.risk === 'critical' ? 'Critical' : 
                opInfo.risk === 'high' ? 'Major' : 
                opInfo.risk === 'medium' ? 'Minor' : 'Minor';

  const errorCode = !isSuccessful ? 
    Object.keys(ERROR_CODES)[Math.floor(Math.random() * Object.keys(ERROR_CODES).length)] : 
    null;

  const timestamp = new Date();
  timestamp.setMinutes(timestamp.getMinutes() - Math.floor(Math.random() * 60));

  const callChainId = Math.floor(Math.random() * 9999999999999999).toString();
  const processId = `inTL1NBiDm_${Math.floor(Math.random() * 10)}`;

  let details = `XML2TL1: ${operation}::DEV=${device}:${Date.now()}::;\n\n`;
  if (isSuccessful) {
    details += `   ${Math.floor(Math.random() * 999999999)} ${timestamp.toISOString().replace('T', ' ').substring(0, 19)}\n`;
    details += `M  ${Date.now()} COMPLD\n`;
    details += `   EN=0   ENDESC=Succeeded.\n`;
    details += `   blktag=1\n`;
    details += `   blkcount=${Math.floor(Math.random() * 20) + 1}\n`;
    details += `   blktotal=${Math.floor(Math.random() * 20) + 1}\n`;
  } else {
    details += `   0 ${timestamp.toISOString().replace('T', ' ').substring(0, 19)}\n`;
    details += `M  ${Date.now()} ${Math.random() > 0.5 ? 'COMPLD' : 'DENY'}\n`;
    details += `   EN=${errorCode}   ENDESC=${ERROR_CODES[errorCode!]?.description || 'Unknown error'}\n`;
    details += `;\n`;
  }
  details += `Call Chain ID:${callChainId}\n`;
  details += `ProcessID:${processId}`;

  const entry: TelecomLogEntry = {
    operation,
    level,
    operator,
    timestamp,
    source: `NM Application(${source.name})`,
    terminalIp: source.ip,
    operationObject: device,
    result,
    details,
    isViolation: false,
    violationType: null,
    errorCode,
    errorDescription: errorCode ? ERROR_CODES[errorCode]?.description || null : null,
    deviceType: detectDeviceType(device)?.type || null,
    deviceName: device,
    commandType: opInfo.category,
    callChainId,
    processId,
    parsedDetails: parseHuaweiNmsDetails(details),
  };

  const violationInfo = detectViolation(entry);
  entry.isViolation = violationInfo.isViolation;
  entry.violationType = violationInfo.violationType;
  if (violationInfo.severity !== 'Minor') {
    entry.level = violationInfo.severity;
  }

  return entry;
}
