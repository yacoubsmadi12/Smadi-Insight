import type { NmsLog, Operator, OperatorGroup, InsertAnalysisReport } from "@shared/schema";
import { GoogleGenAI } from "@google/genai";

interface AnalysisResult {
  summary: string;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  violations: Array<{ type: string; count: number; details: string[] }>;
  risks: Array<{ level: string; description: string }>;
  recommendations: string[];
  complianceScore: number;
}

export async function analyzeOperatorLogs(
  logs: NmsLog[],
  operator: Operator | null,
  group: OperatorGroup | null,
  dateRange: string
): Promise<AnalysisResult> {
  const totalOperations = logs.length;
  const successfulOperations = logs.filter(l => l.result === 'Successful').length;
  const failedOperations = logs.filter(l => l.result === 'Failed').length;

  const violationLogs = logs.filter(l => l.isViolation);
  const violationsByType = new Map<string, { count: number; details: string[] }>();

  violationLogs.forEach(log => {
    if (log.violationType) {
      const types = log.violationType.split(',');
      types.forEach(type => {
        const existing = violationsByType.get(type) || { count: 0, details: [] };
        existing.count++;
        if (existing.details.length < 5) {
          existing.details.push(`${log.operation} at ${new Date(log.timestamp).toLocaleString()}`);
        }
        violationsByType.set(type, existing);
      });
    }
  });

  const violations = Array.from(violationsByType.entries()).map(([type, data]) => ({
    type,
    count: data.count,
    details: data.details,
  }));

  const risks: Array<{ level: string; description: string }> = [];
  const recommendations: string[] = [];

  const failureRate = totalOperations > 0 ? (failedOperations / totalOperations) * 100 : 0;
  if (failureRate > 20) {
    risks.push({ level: 'HIGH', description: `High failure rate: ${failureRate.toFixed(1)}% of operations failed` });
    recommendations.push('Investigate recurring failure patterns and provide additional training');
  } else if (failureRate > 10) {
    risks.push({ level: 'MEDIUM', description: `Elevated failure rate: ${failureRate.toFixed(1)}% of operations failed` });
  }

  if (violations.length > 0) {
    const totalViolations = violations.reduce((sum, v) => sum + v.count, 0);
    const violationRate = (totalViolations / totalOperations) * 100;
    
    if (violationRate > 5) {
      risks.push({ level: 'HIGH', description: `High violation rate: ${violationRate.toFixed(1)}% of operations are violations` });
      recommendations.push('Review and reinforce compliance policies with the operator');
    }

    violations.forEach(v => {
      if (v.type === 'RESTRICTED_OPERATION') {
        risks.push({ level: 'CRITICAL', description: `${v.count} restricted operations were attempted` });
        recommendations.push('Escalate to management: Restricted operations detected');
      }
      if (v.type === 'OUTSIDE_WORKING_HOURS') {
        risks.push({ level: 'MEDIUM', description: `${v.count} operations performed outside working hours` });
        recommendations.push('Verify authorization for after-hours access');
      }
    });
  }

  let complianceScore = 100;
  complianceScore -= Math.min(20, failureRate);
  violations.forEach(v => {
    if (v.type === 'RESTRICTED_OPERATION') complianceScore -= 30;
    else if (v.type === 'UNAUTHORIZED_OPERATION') complianceScore -= 20;
    else complianceScore -= 10;
  });
  complianceScore = Math.max(0, Math.min(100, complianceScore));

  let summary = `Analysis for ${dateRange}:\n`;
  summary += `Total Operations: ${totalOperations}\n`;
  summary += `Success Rate: ${totalOperations > 0 ? ((successfulOperations / totalOperations) * 100).toFixed(1) : 0}%\n`;
  summary += `Violations Detected: ${violations.reduce((sum, v) => sum + v.count, 0)}\n`;
  summary += `Compliance Score: ${complianceScore.toFixed(0)}%\n`;

  if (operator) {
    summary += `Operator: ${operator.fullName || operator.username}\n`;
  }
  if (group) {
    summary += `Group: ${group.name}\n`;
    if (group.jobDescription) {
      summary += `Job Description: ${group.jobDescription}\n`;
    }
  }

  if (process.env.GEMINI_API_KEY && logs.length > 0) {
    try {
      const aiSummary = await generateAISummary(logs, operator, group, {
        totalOperations,
        successfulOperations,
        failedOperations,
        violations,
        risks,
      });
      summary = aiSummary || summary;
    } catch (error) {
      console.error('AI summary generation failed:', error);
    }
  }

  return {
    summary,
    totalOperations,
    successfulOperations,
    failedOperations,
    violations,
    risks,
    recommendations,
    complianceScore: Math.round(complianceScore),
  };
}

async function generateAISummary(
  logs: NmsLog[],
  operator: Operator | null,
  group: OperatorGroup | null,
  stats: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    violations: Array<{ type: string; count: number; details: string[] }>;
    risks: Array<{ level: string; description: string }>;
  }
): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const operationSummary = logs.slice(0, 50).map(l => {
    let timeStr = '';
    try {
      const ts = l.timestamp;
      if (ts instanceof Date) {
        timeStr = ts.toISOString();
      } else if (typeof ts === 'string') {
        timeStr = ts;
      } else if (ts) {
        timeStr = new Date(ts).toISOString();
      }
    } catch {
      timeStr = String(l.timestamp || '');
    }
    return {
      operation: l.operation,
      result: l.result,
      time: timeStr,
      isViolation: l.isViolation,
    };
  });

  const prompt = `You are an expert network operations analyst. Analyze the following operator activity report and provide a professional summary suitable for management review.

Operator: ${operator?.fullName || operator?.username || 'Unknown'}
Group: ${group?.name || 'Unassigned'}
Job Description: ${group?.jobDescription || 'Not specified'}
Rules: ${group?.rules || 'Not specified'}

Statistics:
- Total Operations: ${stats.totalOperations}
- Successful: ${stats.successfulOperations} (${((stats.successfulOperations / stats.totalOperations) * 100).toFixed(1)}%)
- Failed: ${stats.failedOperations} (${((stats.failedOperations / stats.totalOperations) * 100).toFixed(1)}%)

Violations: ${JSON.stringify(stats.violations)}
Risks: ${JSON.stringify(stats.risks)}

Sample of recent operations:
${JSON.stringify(operationSummary, null, 2)}

Provide a concise, professional summary (3-4 paragraphs) that:
1. Summarizes overall operator performance
2. Highlights any concerning patterns or violations
3. Compares activity against job description and rules
4. Provides actionable recommendations

Write in a formal, objective tone suitable for a management report.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-001",
      contents: prompt,
    });

    return response.text || null;
  } catch (error) {
    console.error('Gemini API error:', error);
    return null;
  }
}

export function createAnalysisReport(
  nmsSystemId: string,
  operatorId: string | null,
  groupId: string | null,
  managerId: string | null,
  analysis: AnalysisResult,
  dateRange: string
): InsertAnalysisReport {
  return {
    nmsSystemId,
    operatorId,
    groupId,
    managerId,
    reportType: 'daily',
    dateRange,
    summary: analysis.summary,
    totalOperations: analysis.totalOperations,
    successfulOperations: analysis.successfulOperations,
    failedOperations: analysis.failedOperations,
    violations: analysis.violations,
    risks: analysis.risks,
    recommendations: analysis.recommendations,
    complianceScore: analysis.complianceScore,
    sentToEmail: false,
    sentAt: null,
  };
}
