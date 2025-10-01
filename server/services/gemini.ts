import { GoogleGenAI } from "@google/genai";
import { Log, Employee } from "@shared/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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
  const systemPrompt = `You are an expert HR analyst and compliance officer for Smadi Insight. 
Analyze employee activity logs and generate a comprehensive report that includes:
1. A brief summary of overall performance and compliance
2. A list of key actions taken by the employee
3. Identified risks or concerns
4. Policy violations (if any)
5. Recommended next steps

Consider the employee's job description and company rules when analyzing the logs.`;

  const prompt = `
Employee Information:
- Name: ${employee.name}
- Role: ${employee.role}
- Department: ${employee.department}

Job Description:
${employee.jobDescription || "No job description provided"}

Company Rules & Policies:
${employee.rules || "Standard company policies apply"}

Activity Logs (${dateRange}):
${logs.map((log, i) => `${i + 1}. [${log.timestamp}] ${log.source} - ${log.action}: ${log.details || "N/A"}`).join("\n")}

Based on the above information, analyze the employee's activities and provide insights.
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          actions: {
            type: "array",
            items: { type: "string" },
          },
          risks: {
            type: "array",
            items: { type: "string" },
          },
          violations: {
            type: "array",
            items: { type: "string" },
          },
          nextSteps: {
            type: "array",
            items: { type: "string" },
          },
          complianceScore: { type: "number" },
        },
        required: ["summary", "actions", "risks", "violations", "nextSteps"],
      },
    },
    contents: prompt,
  });

  const rawJson = response.text;
  if (!rawJson) {
    throw new Error("Empty response from Gemini");
  }

  const data = JSON.parse(rawJson);

  return {
    summary: data.summary,
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
