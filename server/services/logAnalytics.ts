import type { NmsLog, Operator, OperatorGroup, Manager } from "@shared/schema";

// Safe timestamp helper - handles Date objects, strings, and invalid values
function safeTimestamp(ts: any): Date {
  if (ts instanceof Date && !isNaN(ts.getTime())) {
    return ts;
  }
  if (typeof ts === 'string') {
    const parsed = new Date(ts);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date(); // fallback to current time
}

function safeTimestampString(ts: any): string {
  try {
    return safeTimestamp(ts).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export interface OperatorStats {
  operatorId: string;
  username: string;
  fullName: string | null;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  successRate: number;
  violations: number;
  mostUsedOperations: Array<{ operation: string; count: number }>;
  activeHours: number[];
  lastActivity: Date | null;
}

export interface OperationStats {
  operation: string;
  count: number;
  successCount: number;
  failCount: number;
  successRate: number;
  avgPerDay: number;
  operators: string[];
}

export interface HourlyActivity {
  hour: number;
  count: number;
  successCount: number;
  failCount: number;
}

export interface DailyActivity {
  date: string;
  count: number;
  successCount: number;
  failCount: number;
  uniqueOperators: number;
}

export interface AnomalyDetection {
  type: 'HIGH_FAILURE_RATE' | 'UNUSUAL_HOURS' | 'RAPID_OPERATIONS' | 'REPEATED_FAILURES' | 'SUSPICIOUS_PATTERN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  operatorUsername: string;
  timestamp: Date;
  details: Record<string, any>;
}

export interface ComprehensiveAnalysis {
  overview: {
    totalLogs: number;
    dateRange: { start: Date; end: Date };
    uniqueOperators: number;
    uniqueOperations: number;
    successRate: number;
    failureRate: number;
    totalViolations: number;
  };
  operatorStats: OperatorStats[];
  operationStats: OperationStats[];
  hourlyActivity: HourlyActivity[];
  dailyActivity: DailyActivity[];
  anomalies: AnomalyDetection[];
  topErrors: Array<{ error: string; count: number; operations: string[] }>;
  sourceStats: Array<{ source: string; count: number }>;
  ipStats: Array<{ ip: string; count: number; operators: string[] }>;
  performanceMetrics: {
    peakHour: number;
    peakDay: string;
    avgOperationsPerDay: number;
    avgOperationsPerOperator: number;
    operatorEfficiency: number;
  };
  recommendations: string[];
  executiveSummary: string;
}

export function analyzeNmsLogs(
  logs: NmsLog[],
  operators: Operator[],
  groups: OperatorGroup[],
  managers: Manager[]
): ComprehensiveAnalysis {
  if (logs.length === 0) {
    return createEmptyAnalysis();
  }

  const sortedLogs = [...logs].sort((a, b) => 
    safeTimestamp(a.timestamp).getTime() - safeTimestamp(b.timestamp).getTime()
  );

  const startDate = safeTimestamp(sortedLogs[0].timestamp);
  const endDate = safeTimestamp(sortedLogs[sortedLogs.length - 1].timestamp);

  const successLogs = logs.filter(l => l.result === 'Successful');
  const failedLogs = logs.filter(l => l.result === 'Failed');
  const violationLogs = logs.filter(l => l.isViolation);

  const operatorMap = new Map(operators.map(o => [o.username, o]));
  const uniqueOperators = new Set(logs.map(l => l.operatorUsername));
  const uniqueOperations = new Set(logs.map(l => l.operation));

  const operatorStats = calculateOperatorStats(logs, operatorMap);
  const operationStats = calculateOperationStats(logs, startDate, endDate);
  const hourlyActivity = calculateHourlyActivity(logs);
  const dailyActivity = calculateDailyActivity(logs);
  const anomalies = detectAnomalies(logs, operators);
  const topErrors = calculateTopErrors(failedLogs);
  const sourceStats = calculateSourceStats(logs);
  const ipStats = calculateIpStats(logs);
  const performanceMetrics = calculatePerformanceMetrics(logs, hourlyActivity, dailyActivity, uniqueOperators.size);

  const recommendations = generateRecommendations(
    logs.length,
    successLogs.length,
    failedLogs.length,
    violationLogs.length,
    anomalies,
    operatorStats
  );

  const executiveSummary = generateExecutiveSummary(
    logs.length,
    successLogs.length,
    failedLogs.length,
    violationLogs.length,
    uniqueOperators.size,
    startDate,
    endDate,
    anomalies
  );

  return {
    overview: {
      totalLogs: logs.length,
      dateRange: { start: startDate, end: endDate },
      uniqueOperators: uniqueOperators.size,
      uniqueOperations: uniqueOperations.size,
      successRate: logs.length > 0 ? (successLogs.length / logs.length) * 100 : 0,
      failureRate: logs.length > 0 ? (failedLogs.length / logs.length) * 100 : 0,
      totalViolations: violationLogs.length,
    },
    operatorStats,
    operationStats,
    hourlyActivity,
    dailyActivity,
    anomalies,
    topErrors,
    sourceStats,
    ipStats,
    performanceMetrics,
    recommendations,
    executiveSummary,
  };
}

function createEmptyAnalysis(): ComprehensiveAnalysis {
  return {
    overview: {
      totalLogs: 0,
      dateRange: { start: new Date(), end: new Date() },
      uniqueOperators: 0,
      uniqueOperations: 0,
      successRate: 0,
      failureRate: 0,
      totalViolations: 0,
    },
    operatorStats: [],
    operationStats: [],
    hourlyActivity: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: 0,
      successCount: 0,
      failCount: 0,
    })),
    dailyActivity: [],
    anomalies: [],
    topErrors: [],
    sourceStats: [],
    ipStats: [],
    performanceMetrics: {
      peakHour: 0,
      peakDay: '',
      avgOperationsPerDay: 0,
      avgOperationsPerOperator: 0,
      operatorEfficiency: 0,
    },
    recommendations: ['Upload logs to generate analysis'],
    executiveSummary: 'No data available for analysis.',
  };
}

function calculateOperatorStats(logs: NmsLog[], operatorMap: Map<string, Operator>): OperatorStats[] {
  const statsMap = new Map<string, {
    logs: NmsLog[];
    operator: Operator | undefined;
  }>();

  logs.forEach(log => {
    const existing = statsMap.get(log.operatorUsername) || {
      logs: [],
      operator: operatorMap.get(log.operatorUsername),
    };
    existing.logs.push(log);
    statsMap.set(log.operatorUsername, existing);
  });

  return Array.from(statsMap.entries()).map(([username, data]) => {
    const operatorLogs = data.logs;
    const successLogs = operatorLogs.filter(l => l.result === 'Successful');
    const failedLogs = operatorLogs.filter(l => l.result === 'Failed');
    const violationLogs = operatorLogs.filter(l => l.isViolation);

    const operationCounts = new Map<string, number>();
    const activeHoursSet = new Set<number>();

    operatorLogs.forEach(log => {
      operationCounts.set(log.operation, (operationCounts.get(log.operation) || 0) + 1);
      activeHoursSet.add(safeTimestamp(log.timestamp).getHours());
    });

    const mostUsedOperations = Array.from(operationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([operation, count]) => ({ operation: truncateOperation(operation), count }));

    const lastLog = operatorLogs.sort((a, b) => 
      safeTimestamp(b.timestamp).getTime() - safeTimestamp(a.timestamp).getTime()
    )[0];

    return {
      operatorId: data.operator?.id || username,
      username,
      fullName: data.operator?.fullName || null,
      totalOperations: operatorLogs.length,
      successfulOperations: successLogs.length,
      failedOperations: failedLogs.length,
      successRate: operatorLogs.length > 0 ? (successLogs.length / operatorLogs.length) * 100 : 0,
      violations: violationLogs.length,
      mostUsedOperations,
      activeHours: Array.from(activeHoursSet).sort((a, b) => a - b),
      lastActivity: lastLog ? safeTimestamp(lastLog.timestamp) : null,
    };
  }).sort((a, b) => b.totalOperations - a.totalOperations);
}

function truncateOperation(operation: string): string {
  if (operation.length <= 50) return operation;
  const parts = operation.split('/');
  return parts[parts.length - 1] || operation.substring(0, 50) + '...';
}

function calculateOperationStats(logs: NmsLog[], startDate: Date, endDate: Date): OperationStats[] {
  const statsMap = new Map<string, {
    count: number;
    successCount: number;
    failCount: number;
    operators: Set<string>;
  }>();

  logs.forEach(log => {
    const existing = statsMap.get(log.operation) || {
      count: 0,
      successCount: 0,
      failCount: 0,
      operators: new Set(),
    };
    existing.count++;
    if (log.result === 'Successful') existing.successCount++;
    if (log.result === 'Failed') existing.failCount++;
    existing.operators.add(log.operatorUsername);
    statsMap.set(log.operation, existing);
  });

  const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

  return Array.from(statsMap.entries())
    .map(([operation, data]) => ({
      operation: truncateOperation(operation),
      count: data.count,
      successCount: data.successCount,
      failCount: data.failCount,
      successRate: data.count > 0 ? (data.successCount / data.count) * 100 : 0,
      avgPerDay: data.count / daysDiff,
      operators: Array.from(data.operators),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);
}

function calculateHourlyActivity(logs: NmsLog[]): HourlyActivity[] {
  const hourlyMap = new Map<number, { count: number; successCount: number; failCount: number }>();

  for (let i = 0; i < 24; i++) {
    hourlyMap.set(i, { count: 0, successCount: 0, failCount: 0 });
  }

  logs.forEach(log => {
    const hour = safeTimestamp(log.timestamp).getHours();
    const existing = hourlyMap.get(hour)!;
    existing.count++;
    if (log.result === 'Successful') existing.successCount++;
    if (log.result === 'Failed') existing.failCount++;
  });

  return Array.from(hourlyMap.entries())
    .map(([hour, data]) => ({ hour, ...data }))
    .sort((a, b) => a.hour - b.hour);
}

function calculateDailyActivity(logs: NmsLog[]): DailyActivity[] {
  const dailyMap = new Map<string, {
    count: number;
    successCount: number;
    failCount: number;
    operators: Set<string>;
  }>();

  logs.forEach(log => {
    const date = safeTimestampString(log.timestamp).split('T')[0];
    const existing = dailyMap.get(date) || {
      count: 0,
      successCount: 0,
      failCount: 0,
      operators: new Set(),
    };
    existing.count++;
    if (log.result === 'Successful') existing.successCount++;
    if (log.result === 'Failed') existing.failCount++;
    existing.operators.add(log.operatorUsername);
    dailyMap.set(date, existing);
  });

  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      count: data.count,
      successCount: data.successCount,
      failCount: data.failCount,
      uniqueOperators: data.operators.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function detectAnomalies(logs: NmsLog[], operators: Operator[]): AnomalyDetection[] {
  const anomalies: AnomalyDetection[] = [];

  const operatorLogs = new Map<string, NmsLog[]>();
  logs.forEach(log => {
    const existing = operatorLogs.get(log.operatorUsername) || [];
    existing.push(log);
    operatorLogs.set(log.operatorUsername, existing);
  });

  operatorLogs.forEach((opLogs, username) => {
    const failedLogs = opLogs.filter(l => l.result === 'Failed');
    const failureRate = opLogs.length > 0 ? (failedLogs.length / opLogs.length) * 100 : 0;

    if (failureRate > 30 && opLogs.length >= 10) {
      anomalies.push({
        type: 'HIGH_FAILURE_RATE',
        severity: failureRate > 50 ? 'CRITICAL' : 'HIGH',
        description: `Operator ${username} has ${failureRate.toFixed(1)}% failure rate (${failedLogs.length}/${opLogs.length} operations)`,
        operatorUsername: username,
        timestamp: safeTimestamp(opLogs[opLogs.length - 1].timestamp),
        details: { failureRate, totalOperations: opLogs.length, failedOperations: failedLogs.length },
      });
    }

    const unusualHoursLogs = opLogs.filter(log => {
      const hour = safeTimestamp(log.timestamp).getHours();
      return hour >= 0 && hour < 6;
    });

    if (unusualHoursLogs.length > 5) {
      anomalies.push({
        type: 'UNUSUAL_HOURS',
        severity: 'MEDIUM',
        description: `Operator ${username} performed ${unusualHoursLogs.length} operations between midnight and 6 AM`,
        operatorUsername: username,
        timestamp: safeTimestamp(unusualHoursLogs[0].timestamp),
        details: { count: unusualHoursLogs.length },
      });
    }

    const sortedLogs = [...opLogs].sort((a, b) => 
      safeTimestamp(a.timestamp).getTime() - safeTimestamp(b.timestamp).getTime()
    );

    for (let i = 0; i < sortedLogs.length - 10; i++) {
      const windowStart = safeTimestamp(sortedLogs[i].timestamp).getTime();
      const windowEnd = safeTimestamp(sortedLogs[i + 10].timestamp).getTime();
      const windowMinutes = (windowEnd - windowStart) / (1000 * 60);

      if (windowMinutes < 1 && windowMinutes > 0) {
        anomalies.push({
          type: 'RAPID_OPERATIONS',
          severity: 'MEDIUM',
          description: `Operator ${username} performed 10+ operations in less than 1 minute`,
          operatorUsername: username,
          timestamp: safeTimestamp(sortedLogs[i].timestamp),
          details: { operationsPerMinute: Math.round(10 / windowMinutes) },
        });
        break;
      }
    }

    const operationFailures = new Map<string, number>();
    failedLogs.forEach(log => {
      operationFailures.set(log.operation, (operationFailures.get(log.operation) || 0) + 1);
    });

    operationFailures.forEach((count, operation) => {
      if (count >= 5) {
        anomalies.push({
          type: 'REPEATED_FAILURES',
          severity: count >= 10 ? 'HIGH' : 'MEDIUM',
          description: `Operator ${username} failed operation "${truncateOperation(operation)}" ${count} times`,
          operatorUsername: username,
          timestamp: safeTimestamp(failedLogs[failedLogs.length - 1].timestamp),
          details: { operation, failureCount: count },
        });
      }
    });
  });

  return anomalies.sort((a, b) => {
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

function calculateTopErrors(failedLogs: NmsLog[]): Array<{ error: string; count: number; operations: string[] }> {
  const errorMap = new Map<string, { count: number; operations: Set<string> }>();

  failedLogs.forEach(log => {
    const errorMatch = log.details?.match(/ENDESC=([^;]+)/);
    const error = errorMatch ? errorMatch[1].trim() : 'Unknown error';
    
    const existing = errorMap.get(error) || { count: 0, operations: new Set() };
    existing.count++;
    existing.operations.add(truncateOperation(log.operation));
    errorMap.set(error, existing);
  });

  return Array.from(errorMap.entries())
    .map(([error, data]) => ({
      error,
      count: data.count,
      operations: Array.from(data.operations).slice(0, 5),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

function calculateSourceStats(logs: NmsLog[]): Array<{ source: string; count: number }> {
  const sourceMap = new Map<string, number>();

  logs.forEach(log => {
    const source = log.source || 'Unknown';
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
  });

  return Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

function calculateIpStats(logs: NmsLog[]): Array<{ ip: string; count: number; operators: string[] }> {
  const ipMap = new Map<string, { count: number; operators: Set<string> }>();

  logs.forEach(log => {
    const ip = log.terminalIp || 'Unknown';
    const existing = ipMap.get(ip) || { count: 0, operators: new Set() };
    existing.count++;
    existing.operators.add(log.operatorUsername);
    ipMap.set(ip, existing);
  });

  return Array.from(ipMap.entries())
    .map(([ip, data]) => ({
      ip,
      count: data.count,
      operators: Array.from(data.operators),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

function calculatePerformanceMetrics(
  logs: NmsLog[],
  hourlyActivity: HourlyActivity[],
  dailyActivity: DailyActivity[],
  uniqueOperators: number
): ComprehensiveAnalysis['performanceMetrics'] {
  const peakHour = hourlyActivity.reduce((max, h) => 
    h.count > max.count ? h : max, hourlyActivity[0]
  );

  const peakDay = dailyActivity.reduce((max, d) => 
    d.count > max.count ? d : max, dailyActivity[0]
  );

  const totalDays = Math.max(1, dailyActivity.length);
  const avgOperationsPerDay = logs.length / totalDays;
  const avgOperationsPerOperator = uniqueOperators > 0 ? logs.length / uniqueOperators : 0;

  const successfulLogs = logs.filter(l => l.result === 'Successful');
  const operatorEfficiency = logs.length > 0 ? (successfulLogs.length / logs.length) * 100 : 0;

  return {
    peakHour: peakHour?.hour || 0,
    peakDay: peakDay?.date || '',
    avgOperationsPerDay: Math.round(avgOperationsPerDay),
    avgOperationsPerOperator: Math.round(avgOperationsPerOperator),
    operatorEfficiency: Math.round(operatorEfficiency * 100) / 100,
  };
}

function generateRecommendations(
  totalLogs: number,
  successLogs: number,
  failedLogs: number,
  violationLogs: number,
  anomalies: AnomalyDetection[],
  operatorStats: OperatorStats[]
): string[] {
  const recommendations: string[] = [];

  const failureRate = totalLogs > 0 ? (failedLogs / totalLogs) * 100 : 0;
  if (failureRate > 10) {
    recommendations.push(`High failure rate detected (${failureRate.toFixed(1)}%). Review operator training and system configuration.`);
  }

  const violationRate = totalLogs > 0 ? (violationLogs / totalLogs) * 100 : 0;
  if (violationRate > 5) {
    recommendations.push(`Violation rate is ${violationRate.toFixed(1)}%. Consider reviewing access policies and operator permissions.`);
  }

  const criticalAnomalies = anomalies.filter(a => a.severity === 'CRITICAL');
  if (criticalAnomalies.length > 0) {
    recommendations.push(`${criticalAnomalies.length} critical anomalies detected. Immediate investigation recommended.`);
  }

  const lowPerformers = operatorStats.filter(o => o.successRate < 70 && o.totalOperations >= 10);
  if (lowPerformers.length > 0) {
    recommendations.push(`${lowPerformers.length} operators have success rate below 70%. Consider additional training.`);
  }

  const unusualHours = anomalies.filter(a => a.type === 'UNUSUAL_HOURS');
  if (unusualHours.length > 0) {
    recommendations.push(`After-hours activity detected for ${unusualHours.length} operators. Verify authorization.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('System operating within normal parameters. Continue monitoring.');
  }

  return recommendations;
}

function generateExecutiveSummary(
  totalLogs: number,
  successLogs: number,
  failedLogs: number,
  violationLogs: number,
  uniqueOperators: number,
  startDate: Date,
  endDate: Date,
  anomalies: AnomalyDetection[]
): string {
  const successRate = totalLogs > 0 ? ((successLogs / totalLogs) * 100).toFixed(1) : '0';
  const failureRate = totalLogs > 0 ? ((failedLogs / totalLogs) * 100).toFixed(1) : '0';
  const dateRange = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;

  const criticalCount = anomalies.filter(a => a.severity === 'CRITICAL').length;
  const highCount = anomalies.filter(a => a.severity === 'HIGH').length;

  let summary = `Analysis Period: ${dateRange}\n\n`;
  summary += `Total Operations: ${totalLogs.toLocaleString()}\n`;
  summary += `Active Operators: ${uniqueOperators}\n`;
  summary += `Success Rate: ${successRate}%\n`;
  summary += `Failure Rate: ${failureRate}%\n`;
  summary += `Violations Detected: ${violationLogs}\n\n`;

  if (criticalCount > 0 || highCount > 0) {
    summary += `ALERTS: ${criticalCount} Critical, ${highCount} High severity anomalies detected.\n`;
  } else {
    summary += `Status: Operations within normal parameters.\n`;
  }

  return summary;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateHtmlReport(analysis: ComprehensiveAnalysis, systemName?: string): string {
  const { overview, performanceMetrics, recommendations, executiveSummary } = analysis;
  const escapedSystemName = systemName ? escapeHtml(systemName) : null;
  const reportTitle = escapedSystemName ? `${escapedSystemName} - Log Analysis Report` : 'NMS Log Analysis Report';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; }
    .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #1a1a2e; margin-bottom: 10px; }
    h2 { color: #16213e; border-bottom: 2px solid #0f3460; padding-bottom: 10px; }
    .summary { white-space: pre-line; background: #f8f9fa; padding: 15px; border-radius: 4px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 2em; font-weight: bold; }
    .stat-label { opacity: 0.9; margin-top: 5px; }
    .success { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
    .danger { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); }
    .warning { background: linear-gradient(135deg, #f7971e 0%, #ffd200 100%); }
    .recommendation { padding: 10px; margin: 5px 0; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 0 4px 4px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: 600; }
    tr:hover { background: #f5f5f5; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 500; }
    .badge-critical { background: #fee2e2; color: #991b1b; }
    .badge-high { background: #fed7aa; color: #9a3412; }
    .badge-medium { background: #fef3c7; color: #92400e; }
    .badge-low { background: #d1fae5; color: #065f46; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>${reportTitle}</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
    </div>

    <div class="card">
      <h2>Executive Summary</h2>
      <div class="summary">${executiveSummary}</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${overview.totalLogs.toLocaleString()}</div>
        <div class="stat-label">Total Operations</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">${overview.successRate.toFixed(1)}%</div>
        <div class="stat-label">Success Rate</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-value">${overview.failureRate.toFixed(1)}%</div>
        <div class="stat-label">Failure Rate</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">${overview.totalViolations}</div>
        <div class="stat-label">Violations</div>
      </div>
    </div>

    <div class="card">
      <h2>Performance Metrics</h2>
      <div class="stats-grid">
        <div><strong>Peak Hour:</strong> ${performanceMetrics.peakHour}:00</div>
        <div><strong>Peak Day:</strong> ${performanceMetrics.peakDay}</div>
        <div><strong>Avg Operations/Day:</strong> ${performanceMetrics.avgOperationsPerDay}</div>
        <div><strong>Operator Efficiency:</strong> ${performanceMetrics.operatorEfficiency}%</div>
      </div>
    </div>

    <div class="card">
      <h2>Recommendations</h2>
      ${recommendations.map(r => `<div class="recommendation">${r}</div>`).join('')}
    </div>

    <div class="card">
      <h2>Top Operators</h2>
      <table>
        <thead>
          <tr>
            <th>Operator</th>
            <th>Total Ops</th>
            <th>Success Rate</th>
            <th>Violations</th>
          </tr>
        </thead>
        <tbody>
          ${analysis.operatorStats.slice(0, 10).map(op => `
            <tr>
              <td>${op.fullName || op.username}</td>
              <td>${op.totalOperations.toLocaleString()}</td>
              <td>${op.successRate.toFixed(1)}%</td>
              <td>${op.violations}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>Anomalies Detected</h2>
      <table>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Type</th>
            <th>Description</th>
            <th>Operator</th>
          </tr>
        </thead>
        <tbody>
          ${analysis.anomalies.slice(0, 20).map(a => `
            <tr>
              <td><span class="badge badge-${a.severity.toLowerCase()}">${a.severity}</span></td>
              <td>${a.type}</td>
              <td>${a.description}</td>
              <td>${a.operatorUsername}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>Top Errors</h2>
      <table>
        <thead>
          <tr>
            <th>Error</th>
            <th>Count</th>
            <th>Affected Operations</th>
          </tr>
        </thead>
        <tbody>
          ${analysis.topErrors.slice(0, 10).map(e => `
            <tr>
              <td>${e.error}</td>
              <td>${e.count}</td>
              <td>${e.operations.join(', ')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
  `;
}
