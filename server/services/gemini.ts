import { GoogleGenerativeAI } from "@google/generative-ai";
import { Log, Employee } from "@shared/schema";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface ReportResult {
  summary: string;
  actions: string[];
  risks: string[];
  violations: string[];
  nextSteps: string[];
  metrics: {
    totalActions: number;
    riskCount: number;
    violationCount: number;
    complianceScore?: number;
  };
}

export async function generateEmployeeReport(
  employee: Employee,
  logs: Log[],
  dateRange: string
): Promise<ReportResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You are an expert HR analyst and compliance officer. Analyze employee activity logs and generate a comprehensive report.

Employee Information:
- Name: ${employee.name}
- Role: ${employee.role}
- Department: ${employee.department}

Job Description:
${employee.jobDescription || "No job description provided"}

Company Rules & Policies:
${employee.rules || "Standard company policies apply"}

Activity Logs (${dateRange}):
${logs.slice(0, 100).map((log, i) => `${i + 1}. [${log.timestamp}] ${log.source} - ${log.action}: ${log.details || "N/A"}`).join("\n")}

Respond in JSON format:
{
  "summary": "Brief summary of performance and compliance",
  "actions": ["List of key actions"],
  "risks": ["Identified risks"],
  "violations": ["Policy violations if any"],
  "nextSteps": ["Recommended next steps"],
  "complianceScore": 85
}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in response");
  }
  
  const data = JSON.parse(jsonMatch[0]);

  return {
    summary: data.summary || "No summary available",
    actions: data.actions || [],
    risks: data.risks || [],
    violations: data.violations || [],
    nextSteps: data.nextSteps || [],
    metrics: {
      totalActions: logs.length,
      riskCount: data.risks?.length || 0,
      violationCount: data.violations?.length || 0,
      complianceScore: data.complianceScore,
    },
  };
}
