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

export interface ViolationDetail {
  type: string;
  operation: string;
  details: string;
  timestamp: Date;
  level: string;
}

export interface FailedOperationDetail {
  operation: string;
  details: string;
  timestamp: Date;
  source: string;
  terminalIp: string;
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
  violationDetails: ViolationDetail[];
  failedOperationDetails: FailedOperationDetail[];
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

    const violationDetails: ViolationDetail[] = violationLogs
      .sort((a, b) => safeTimestamp(b.timestamp).getTime() - safeTimestamp(a.timestamp).getTime())
      .slice(0, 10)
      .map(log => ({
        type: log.violationType || 'Security Alert',
        operation: truncateOperation(log.operation),
        details: log.details || log.operation,
        timestamp: safeTimestamp(log.timestamp),
        level: log.level || 'Major',
      }));

    const failedOperationDetails: FailedOperationDetail[] = failedLogs
      .sort((a, b) => safeTimestamp(b.timestamp).getTime() - safeTimestamp(a.timestamp).getTime())
      .slice(0, 10)
      .map(log => ({
        operation: truncateOperation(log.operation),
        details: log.details || log.operation,
        timestamp: safeTimestamp(log.timestamp),
        source: log.source || 'Unknown',
        terminalIp: log.terminalIp || 'Unknown',
      }));

    return {
      operatorId: data.operator?.id || username,
      username,
      fullName: data.operator?.fullName || null,
      totalOperations: operatorLogs.length,
      successfulOperations: successLogs.length,
      failedOperations: failedLogs.length,
      successRate: operatorLogs.length > 0 ? (successLogs.length / operatorLogs.length) * 100 : 0,
      violations: violationLogs.length,
      violationDetails,
      failedOperationDetails,
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
  const violationRate = totalLogs > 0 ? (violationLogs / totalLogs) * 100 : 0;
  const criticalAnomalies = anomalies.filter(a => a.severity === 'CRITICAL');
  const highAnomalies = anomalies.filter(a => a.severity === 'HIGH');
  const unusualHoursAnomalies = anomalies.filter(a => a.type === 'UNUSUAL_HOURS');
  const rapidOperationsAnomalies = anomalies.filter(a => a.type === 'RAPID_OPERATIONS');
  const repeatedFailuresAnomalies = anomalies.filter(a => a.type === 'REPEATED_FAILURES');
  const lowPerformers = operatorStats.filter(o => o.successRate < 70 && o.totalOperations >= 10);
  const highViolationOperators = operatorStats.filter(o => o.violations > 3);

  // Critical recommendations
  if (criticalAnomalies.length > 0) {
    recommendations.push(`[CRITICAL] ${criticalAnomalies.length} critical anomalies detected requiring immediate investigation. Operators involved: ${Array.from(new Set(criticalAnomalies.map(a => a.operatorUsername))).join(', ')}`);
  }

  // High severity recommendations
  if (highAnomalies.length > 0) {
    recommendations.push(`[HIGH] ${highAnomalies.length} high severity alerts detected. Review security logs and operator activities.`);
  }

  // Failure rate recommendations
  if (failureRate > 30) {
    recommendations.push(`[CRITICAL] Extremely high failure rate (${failureRate.toFixed(1)}%). Immediate system review required. Check network connectivity, system resources, and operator credentials.`);
  } else if (failureRate > 20) {
    recommendations.push(`[HIGH] Very high failure rate (${failureRate.toFixed(1)}%). Review system configuration and operator training urgently.`);
  } else if (failureRate > 10) {
    recommendations.push(`[MEDIUM] Elevated failure rate (${failureRate.toFixed(1)}%). Monitor closely and consider targeted operator training.`);
  } else if (failureRate > 5) {
    recommendations.push(`[LOW] Slightly elevated failure rate (${failureRate.toFixed(1)}%). Continue monitoring for trends.`);
  }

  // Violation recommendations
  if (violationLogs > 10) {
    recommendations.push(`[HIGH] ${violationLogs} security violations detected. Immediate security audit recommended. Review access controls and permission policies.`);
  } else if (violationLogs > 5) {
    recommendations.push(`[MEDIUM] ${violationLogs} security violations detected. Review operator access permissions and enforce stricter policies.`);
  } else if (violationLogs > 0) {
    recommendations.push(`[LOW] ${violationLogs} security violation(s) detected. Document incidents and review with operators.`);
  }

  // Low performer recommendations
  if (lowPerformers.length > 0) {
    const lowPerformerNames = lowPerformers.slice(0, 3).map(o => o.fullName || o.username).join(', ');
    recommendations.push(`[MEDIUM] ${lowPerformers.length} operator(s) with success rate below 70%: ${lowPerformerNames}${lowPerformers.length > 3 ? ` and ${lowPerformers.length - 3} more` : ''}. Schedule performance review and additional training.`);
  }

  // High violation operators
  if (highViolationOperators.length > 0) {
    const violatorNames = highViolationOperators.slice(0, 3).map(o => `${o.fullName || o.username} (${o.violations} violations)`).join(', ');
    recommendations.push(`[HIGH] Operators with multiple violations: ${violatorNames}. Conduct security review with supervisors.`);
  }

  // Unusual hours activity
  if (unusualHoursAnomalies.length > 0) {
    const afterHoursOperators = Array.from(new Set(unusualHoursAnomalies.map(a => a.operatorUsername)));
    recommendations.push(`[MEDIUM] After-hours activity (midnight-6AM) detected for ${afterHoursOperators.length} operator(s): ${afterHoursOperators.slice(0, 3).join(', ')}. Verify shift schedules and authorization.`);
  }

  // Rapid operations
  if (rapidOperationsAnomalies.length > 0) {
    recommendations.push(`[MEDIUM] Unusually rapid operations detected (10+ ops/minute). May indicate automated scripts or potential security concern. Review with operators.`);
  }

  // Repeated failures
  if (repeatedFailuresAnomalies.length > 0) {
    recommendations.push(`[LOW] Repeated failures on same operations detected. Review operator training on specific procedures or check system issues.`);
  }

  // Success recommendations
  if (recommendations.length === 0) {
    recommendations.push(`[INFO] System operating within normal parameters. All metrics are within acceptable thresholds.`);
    recommendations.push(`[INFO] Continue regular monitoring and maintain current operational practices.`);
    if (operatorStats.length > 0) {
      const topPerformer = operatorStats.reduce((prev, curr) => 
        (curr.successRate > prev.successRate && curr.totalOperations >= 10) ? curr : prev, operatorStats[0]);
      if (topPerformer.successRate >= 95 && topPerformer.totalOperations >= 10) {
        recommendations.push(`[INFO] Top performer: ${topPerformer.fullName || topPerformer.username} with ${topPerformer.successRate.toFixed(1)}% success rate.`);
      }
    }
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
  const mediumCount = anomalies.filter(a => a.severity === 'MEDIUM').length;

  let summary = `=== EXECUTIVE SUMMARY ===\n\n`;
  summary += `Analysis Period: ${dateRange}\n`;
  summary += `Report Generated: ${new Date().toLocaleString()}\n\n`;
  
  summary += `--- KEY METRICS ---\n`;
  summary += `Total Operations: ${totalLogs.toLocaleString()}\n`;
  summary += `Active Operators: ${uniqueOperators}\n`;
  summary += `Successful Operations: ${successLogs.toLocaleString()} (${successRate}%)\n`;
  summary += `Failed Operations: ${failedLogs.toLocaleString()} (${failureRate}%)\n`;
  summary += `Security Violations: ${violationLogs}\n\n`;

  summary += `--- ANOMALY SUMMARY ---\n`;
  summary += `Critical Alerts: ${criticalCount}\n`;
  summary += `High Severity Alerts: ${highCount}\n`;
  summary += `Medium Severity Alerts: ${mediumCount}\n`;
  summary += `Total Anomalies: ${anomalies.length}\n\n`;

  if (criticalCount > 0) {
    summary += `!!! CRITICAL ALERTS DETECTED !!!\n`;
    const criticalAnomalies = anomalies.filter(a => a.severity === 'CRITICAL');
    criticalAnomalies.forEach((a, i) => {
      summary += `  ${i + 1}. ${a.type.replace(/_/g, ' ')}: ${a.description}\n`;
      summary += `     Operator: ${a.operatorUsername} | Time: ${new Date(a.timestamp).toLocaleString()}\n`;
    });
    summary += '\n';
  }

  if (highCount > 0) {
    summary += `!! HIGH SEVERITY ALERTS !!\n`;
    const highAnomalies = anomalies.filter(a => a.severity === 'HIGH');
    highAnomalies.slice(0, 5).forEach((a, i) => {
      summary += `  ${i + 1}. ${a.type.replace(/_/g, ' ')}: ${a.description}\n`;
    });
    if (highAnomalies.length > 5) {
      summary += `  ... and ${highAnomalies.length - 5} more high severity alerts\n`;
    }
    summary += '\n';
  }

  if (violationLogs > 0) {
    summary += `--- VIOLATION SUMMARY ---\n`;
    summary += `${violationLogs} security violation(s) detected during the analysis period.\n`;
    summary += `Immediate review and action recommended.\n\n`;
  }

  summary += `--- OVERALL STATUS ---\n`;
  if (criticalCount > 0) {
    summary += `Status: CRITICAL - Immediate investigation required!\n`;
  } else if (highCount > 0 || violationLogs > 3) {
    summary += `Status: WARNING - Review recommended\n`;
  } else if (parseFloat(failureRate) > 10) {
    summary += `Status: ATTENTION - High failure rate detected\n`;
  } else {
    summary += `Status: NORMAL - Operations within acceptable parameters\n`;
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
  const { overview, performanceMetrics, recommendations, executiveSummary, operatorStats, operationStats, hourlyActivity, dailyActivity, anomalies, topErrors, sourceStats, ipStats } = analysis;
  const escapedSystemName = systemName ? escapeHtml(systemName) : null;
  const reportTitle = escapedSystemName ? `${escapedSystemName} - Log Analysis Report` : 'NMS Log Analysis Report';
  const dateRange = `${new Date(overview.dateRange.start).toLocaleDateString()} - ${new Date(overview.dateRange.end).toLocaleDateString()}`;

  const maxHourlyCount = Math.max(...hourlyActivity.map(h => h.count), 1);

  return `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #0f172a; color: #e2e8f0; }
    .container { max-width: 1400px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 12px; padding: 30px; margin-bottom: 25px; border: 1px solid #334155; }
    .header h1 { color: #f8fafc; margin: 0 0 10px 0; font-size: 2em; }
    .header p { color: #94a3b8; margin: 5px 0; }
    .card { background: #1e293b; border-radius: 12px; padding: 25px; margin-bottom: 25px; border: 1px solid #334155; }
    h2 { color: #f8fafc; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-top: 0; font-size: 1.4em; }
    h3 { color: #cbd5e1; margin: 20px 0 15px 0; font-size: 1.1em; }
    .summary { white-space: pre-line; background: #0f172a; padding: 20px; border-radius: 8px; border: 1px solid #334155; color: #cbd5e1; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat-card { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; }
    .stat-value { font-size: 2.2em; font-weight: bold; }
    .stat-label { opacity: 0.9; margin-top: 8px; font-size: 0.9em; }
    .success { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
    .danger { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
    .warning { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
    .info { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); }
    .recommendation { padding: 12px 15px; margin: 8px 0; background: #172554; border-left: 4px solid #3b82f6; border-radius: 0 8px 8px 0; color: #bfdbfe; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9em; }
    th, td { padding: 14px 12px; text-align: left; border-bottom: 1px solid #334155; }
    th { background: #0f172a; font-weight: 600; color: #94a3b8; text-transform: uppercase; font-size: 0.8em; letter-spacing: 0.5px; }
    tr:hover { background: #334155; }
    td { color: #e2e8f0; }
    .badge { padding: 4px 10px; border-radius: 6px; font-size: 0.8em; font-weight: 600; display: inline-block; }
    .badge-critical { background: #7f1d1d; color: #fecaca; }
    .badge-high { background: #7c2d12; color: #fed7aa; }
    .badge-medium { background: #78350f; color: #fef3c7; }
    .badge-low { background: #064e3b; color: #a7f3d0; }
    .badge-success { background: #064e3b; color: #a7f3d0; }
    .badge-failed { background: #7f1d1d; color: #fecaca; }
    .badge-violation { background: #581c87; color: #e9d5ff; }
    .badge-source { background: #1e3a5f; color: #93c5fd; }
    .detail-box { background: #0f172a; padding: 10px; border-radius: 6px; margin-top: 8px; font-size: 0.85em; border: 1px solid #334155; }
    .detail-item { margin: 5px 0; color: #94a3b8; }
    .section-divider { border: 0; border-top: 1px solid #334155; margin: 30px 0; }
    .chart-container { display: flex; align-items: flex-end; gap: 4px; height: 120px; padding: 10px 0; }
    .chart-bar { flex: 1; background: linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 4px 4px 0 0; min-width: 20px; transition: all 0.3s; }
    .chart-bar:hover { background: linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%); }
    .chart-labels { display: flex; gap: 4px; }
    .chart-label { flex: 1; text-align: center; font-size: 0.7em; color: #64748b; min-width: 20px; }
    .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
    @media (max-width: 768px) { .two-column { grid-template-columns: 1fr; } }
    .page-break { page-break-before: always; }
    @media print {
      body { background: white; color: black; }
      .card { border: 1px solid #ddd; box-shadow: none; }
      .stat-card, .badge { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- HEADER -->
    <div class="header">
      <h1>${reportTitle}</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
      <p>Analysis Period: ${dateRange}</p>
    </div>

    <!-- SECTION 1: OVERVIEW -->
    <div class="card">
      <h2>1. Overview - Executive Summary</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${overview.totalLogs.toLocaleString()}</div>
          <div class="stat-label">Total Operations</div>
        </div>
        <div class="stat-card info">
          <div class="stat-value">${overview.uniqueOperators}</div>
          <div class="stat-label">Active Operators</div>
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
        <div class="stat-card">
          <div class="stat-value">${overview.uniqueOperations}</div>
          <div class="stat-label">Unique Operations</div>
        </div>
      </div>

      <h3>Executive Summary</h3>
      <div class="summary">${executiveSummary}</div>

      <h3>Performance Metrics</h3>
      <div class="stats-grid">
        <div><strong>Peak Hour:</strong> ${performanceMetrics.peakHour}:00</div>
        <div><strong>Peak Day:</strong> ${performanceMetrics.peakDay}</div>
        <div><strong>Avg Operations/Day:</strong> ${performanceMetrics.avgOperationsPerDay}</div>
        <div><strong>Avg Operations/Operator:</strong> ${performanceMetrics.avgOperationsPerOperator}</div>
        <div><strong>Operator Efficiency:</strong> ${performanceMetrics.operatorEfficiency}%</div>
      </div>

      <h3>Recommendations</h3>
      ${recommendations.map(r => `<div class="recommendation">${escapeHtml(r)}</div>`).join('')}
    </div>

    <!-- SECTION 2: OPERATORS -->
    <div class="card page-break">
      <h2>2. Operators - Detailed Statistics</h2>
      <p style="color: #94a3b8; margin-bottom: 20px;">${operatorStats.length} operators analyzed</p>
      
      ${operatorStats.slice(0, 30).map((op, idx) => `
        <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;">
            <div>
              <h3 style="margin: 0 0 5px 0; color: #f8fafc;">${escapeHtml(op.fullName || op.username)}</h3>
              ${op.fullName ? `<span style="color:#64748b;font-size:0.9em;">Username: ${escapeHtml(op.username)}</span>` : ''}
            </div>
            <div style="text-align: right;">
              <span style="color:#64748b;font-size:0.85em;">Last Activity: </span>
              <span style="color:#e2e8f0;">${op.lastActivity ? new Date(op.lastActivity).toLocaleString() : 'N/A'}</span>
            </div>
          </div>
          
          <!-- Stats Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 15px;">
            <div style="background: #1e293b; padding: 12px; border-radius: 6px; text-align: center;">
              <div style="font-size: 1.5em; font-weight: bold; color: #3b82f6;">${op.totalOperations.toLocaleString()}</div>
              <div style="font-size: 0.8em; color: #94a3b8;">Total Operations</div>
            </div>
            <div style="background: #1e293b; padding: 12px; border-radius: 6px; text-align: center;">
              <div style="font-size: 1.5em; font-weight: bold; color: #10b981;">${op.successfulOperations.toLocaleString()}</div>
              <div style="font-size: 0.8em; color: #94a3b8;">Successful</div>
            </div>
            <div style="background: #1e293b; padding: 12px; border-radius: 6px; text-align: center;">
              <div style="font-size: 1.5em; font-weight: bold; color: #ef4444;">${op.failedOperations}</div>
              <div style="font-size: 0.8em; color: #94a3b8;">Failed</div>
            </div>
            <div style="background: #1e293b; padding: 12px; border-radius: 6px; text-align: center;">
              <div style="font-size: 1.5em; font-weight: bold; color: ${op.successRate >= 90 ? '#10b981' : op.successRate >= 70 ? '#f59e0b' : '#ef4444'};">${op.successRate.toFixed(1)}%</div>
              <div style="font-size: 0.8em; color: #94a3b8;">Success Rate</div>
            </div>
            <div style="background: #1e293b; padding: 12px; border-radius: 6px; text-align: center;">
              <div style="font-size: 1.5em; font-weight: bold; color: #a855f7;">${op.violations}</div>
              <div style="font-size: 0.8em; color: #94a3b8;">Violations</div>
            </div>
          </div>
          
          <!-- Active Hours -->
          <div style="margin-bottom: 15px;">
            <div style="font-size: 0.9em; color: #94a3b8; margin-bottom: 8px;">Active Hours:</div>
            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
              ${op.activeHours.length > 0 ? op.activeHours.map(h => `<span class="badge badge-source">${h}:00</span>`).join('') : '<span style="color:#64748b">No activity recorded</span>'}
            </div>
          </div>
          
          <!-- Most Used Operations -->
          <div style="margin-bottom: 15px;">
            <div style="font-size: 0.9em; color: #94a3b8; margin-bottom: 8px;">Most Used Operations (Top 5):</div>
            ${op.mostUsedOperations.length > 0 ? `
              <table style="width: 100%; font-size: 0.85em;">
                <thead><tr><th style="padding: 8px; text-align: left;">Operation</th><th style="padding: 8px; text-align: right;">Count</th></tr></thead>
                <tbody>
                  ${op.mostUsedOperations.slice(0, 5).map(m => `<tr><td style="padding: 6px 8px;">${escapeHtml(m.operation)}</td><td style="padding: 6px 8px; text-align: right;">${m.count}</td></tr>`).join('')}
                </tbody>
              </table>
            ` : '<span style="color:#64748b">No operations recorded</span>'}
          </div>
          
          <!-- Violation Details -->
          ${op.violations > 0 && op.violationDetails && op.violationDetails.length > 0 ? `
            <div style="margin-bottom: 15px;">
              <div style="font-size: 0.9em; color: #ef4444; margin-bottom: 8px;">Violation Details:</div>
              <table style="width: 100%; font-size: 0.85em; background: #1e1e2e; border-radius: 6px;">
                <thead><tr>
                  <th style="padding: 10px; text-align: left;">Type</th>
                  <th style="padding: 10px; text-align: left;">Level</th>
                  <th style="padding: 10px; text-align: left;">Operation</th>
                  <th style="padding: 10px; text-align: left;">Timestamp</th>
                  <th style="padding: 10px; text-align: left;">Details</th>
                </tr></thead>
                <tbody>
                  ${op.violationDetails.map(v => `
                    <tr style="border-bottom: 1px solid #334155;">
                      <td style="padding: 8px;"><span class="badge badge-violation">${escapeHtml(v.type)}</span></td>
                      <td style="padding: 8px;"><span class="badge ${v.level === 'Critical' ? 'badge-critical' : v.level === 'Major' ? 'badge-high' : 'badge-medium'}">${escapeHtml(v.level)}</span></td>
                      <td style="padding: 8px; color: #e9d5ff; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(v.operation)}</td>
                      <td style="padding: 8px; color: #94a3b8;">${new Date(v.timestamp).toLocaleString()}</td>
                      <td style="padding: 8px; color: #cbd5e1; max-width: 250px; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(v.details)}">${escapeHtml(v.details.substring(0, 100))}${v.details.length > 100 ? '...' : ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
          
          <!-- Failed Operation Details -->
          ${op.failedOperations > 0 && op.failedOperationDetails && op.failedOperationDetails.length > 0 ? `
            <div>
              <div style="font-size: 0.9em; color: #f59e0b; margin-bottom: 8px;">Failed Operations Details:</div>
              <table style="width: 100%; font-size: 0.85em; background: #1e1e2e; border-radius: 6px;">
                <thead><tr>
                  <th style="padding: 10px; text-align: left;">Operation</th>
                  <th style="padding: 10px; text-align: left;">Source</th>
                  <th style="padding: 10px; text-align: left;">Terminal IP</th>
                  <th style="padding: 10px; text-align: left;">Timestamp</th>
                  <th style="padding: 10px; text-align: left;">Details/ENDESC</th>
                </tr></thead>
                <tbody>
                  ${op.failedOperationDetails.map(f => `
                    <tr style="border-bottom: 1px solid #334155;">
                      <td style="padding: 8px; color: #fecaca; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(f.operation)}</td>
                      <td style="padding: 8px;"><span class="badge badge-source">${escapeHtml(f.source)}</span></td>
                      <td style="padding: 8px; color: #94a3b8;">${escapeHtml(f.terminalIp)}</td>
                      <td style="padding: 8px; color: #94a3b8;">${new Date(f.timestamp).toLocaleString()}</td>
                      <td style="padding: 8px; color: #cbd5e1; max-width: 250px; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(f.details)}">${escapeHtml(f.details.substring(0, 100))}${f.details.length > 100 ? '...' : ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>

    <!-- SECTION 2.5: OPERATION STATS -->
    <div class="card page-break">
      <h2>2.5. Operations - Detailed Analysis</h2>
      <p style="color: #94a3b8; margin-bottom: 20px;">${operationStats.length} unique operations analyzed</p>
      
      <table>
        <thead>
          <tr>
            <th>Operation</th>
            <th>Total Count</th>
            <th>Successful</th>
            <th>Failed</th>
            <th>Success Rate</th>
            <th>Avg/Day</th>
            <th>Operators Used</th>
          </tr>
        </thead>
        <tbody>
          ${operationStats.slice(0, 50).map(op => `
            <tr>
              <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(op.operation)}">${escapeHtml(op.operation)}</td>
              <td>${op.count.toLocaleString()}</td>
              <td><span class="badge badge-success">${op.successCount}</span></td>
              <td>${op.failCount > 0 ? `<span class="badge badge-failed">${op.failCount}</span>` : '<span style="color:#64748b">0</span>'}</td>
              <td><span class="badge ${op.successRate >= 90 ? 'badge-success' : op.successRate >= 70 ? 'badge-medium' : 'badge-failed'}">${op.successRate.toFixed(1)}%</span></td>
              <td>${op.avgPerDay.toFixed(1)}</td>
              <td style="font-size: 0.85em; color: #94a3b8;">${op.operators.slice(0, 3).join(', ')}${op.operators.length > 3 ? ` +${op.operators.length - 3} more` : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- SECTION 3: ACTIVITY -->
    <div class="card page-break">
      <h2>3. Activity - Time Distribution</h2>
      
      <h3>Hourly Activity (24h)</h3>
      <div class="chart-container">
        ${hourlyActivity.map(h => `
          <div class="chart-bar" style="height: ${maxHourlyCount > 0 ? (h.count / maxHourlyCount) * 100 : 0}%" title="${h.hour}:00 - ${h.count} operations (${h.successCount} success, ${h.failCount} failed)"></div>
        `).join('')}
      </div>
      <div class="chart-labels">
        ${hourlyActivity.map(h => `<div class="chart-label">${h.hour}</div>`).join('')}
      </div>

      <h3>Daily Activity</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Total Operations</th>
            <th>Successful</th>
            <th>Failed</th>
            <th>Active Operators</th>
          </tr>
        </thead>
        <tbody>
          ${dailyActivity.slice(-14).map(d => `
            <tr>
              <td>${d.date}</td>
              <td>${d.count.toLocaleString()}</td>
              <td><span class="badge badge-success">${d.successCount}</span></td>
              <td>${d.failCount > 0 ? `<span class="badge badge-failed">${d.failCount}</span>` : '<span style="color:#64748b">0</span>'}</td>
              <td>${d.uniqueOperators}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="two-column" style="margin-top: 25px;">
        <div>
          <h3>Operations by Source</h3>
          <table>
            <thead><tr><th>Source</th><th>Count</th></tr></thead>
            <tbody>
              ${sourceStats.slice(0, 10).map(s => `<tr><td>${escapeHtml(s.source)}</td><td>${s.count.toLocaleString()}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div>
          <h3>Operations by IP Address</h3>
          <table>
            <thead><tr><th>IP Address</th><th>Count</th><th>Operators</th></tr></thead>
            <tbody>
              ${ipStats.slice(0, 10).map(ip => `<tr><td>${escapeHtml(ip.ip)}</td><td>${ip.count.toLocaleString()}</td><td style="font-size:0.85em;color:#94a3b8">${ip.operators.slice(0, 3).join(', ')}${ip.operators.length > 3 ? '...' : ''}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- SECTION 4: ANOMALIES -->
    <div class="card page-break">
      <h2>4. Anomalies - Security & Behavioral Alerts</h2>
      <p style="color: #94a3b8; margin-bottom: 20px;">${anomalies.length} anomalies detected</p>
      
      ${anomalies.length === 0 ? `
        <div style="text-align:center; padding: 40px; color: #10b981;">
          <div style="font-size: 3em;">&#10004;</div>
          <p style="font-size: 1.2em;">No anomalies detected. System operating normally.</p>
        </div>
      ` : `
        <table>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Type</th>
              <th>Description</th>
              <th>Operator</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${anomalies.map(a => `
              <tr>
                <td><span class="badge badge-${a.severity.toLowerCase()}">${a.severity}</span></td>
                <td>${escapeHtml(a.type.replace(/_/g, ' '))}</td>
                <td>${escapeHtml(a.description)}</td>
                <td>${escapeHtml(a.operatorUsername)}</td>
                <td style="font-size:0.85em;color:#94a3b8">${new Date(a.timestamp).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>

    <!-- SECTION 5: ERRORS -->
    <div class="card page-break">
      <h2>5. Errors - Failed Operations Analysis</h2>
      <p style="color: #94a3b8; margin-bottom: 20px;">${topErrors.length} unique error types identified</p>
      
      ${topErrors.length === 0 ? `
        <div style="text-align:center; padding: 40px; color: #10b981;">
          <div style="font-size: 3em;">&#10004;</div>
          <p style="font-size: 1.2em;">No errors recorded. All operations completed successfully.</p>
        </div>
      ` : `
        <table>
          <thead>
            <tr>
              <th>Error Description</th>
              <th>Occurrences</th>
              <th>Affected Operations</th>
            </tr>
          </thead>
          <tbody>
            ${topErrors.map(e => `
              <tr>
                <td><span class="badge badge-failed">${e.count}x</span> ${escapeHtml(e.error)}</td>
                <td>${e.count}</td>
                <td style="font-size:0.85em;color:#94a3b8">${e.operations.map(o => escapeHtml(o)).join(', ')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>

    <!-- FOOTER -->
    <div style="text-align: center; padding: 30px; color: #64748b; font-size: 0.9em;">
      <hr style="border: 0; border-top: 1px solid #334155; margin-bottom: 20px;">
      <p>Tracer Logs Zain - Eyes That Never Sleep</p>
      <p>Report generated automatically by NMS Log Analysis System</p>
      <p>${new Date().toISOString()}</p>
    </div>
  </div>
</body>
</html>
  `;
}
