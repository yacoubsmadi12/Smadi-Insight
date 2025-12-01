import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Clock,
  Users,
  Activity,
  TrendingUp,
  BarChart3,
  FileText
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { NmsSystem } from "@shared/schema";

interface AnalysisOverview {
  totalLogs: number;
  dateRange: { start: string; end: string };
  uniqueOperators: number;
  uniqueOperations: number;
  successRate: number;
  failureRate: number;
  totalViolations: number;
}

interface OperatorStats {
  operatorId: string;
  username: string;
  fullName: string | null;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  successRate: number;
  violations: number;
  mostUsedOperations: Array<{ operation: string; count: number }>;
  lastActivity: string | null;
}

interface HourlyActivity {
  hour: number;
  count: number;
  successCount: number;
  failCount: number;
}

interface DailyActivity {
  date: string;
  count: number;
  successCount: number;
  failCount: number;
  uniqueOperators: number;
}

interface Anomaly {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  operatorUsername: string;
  timestamp: string;
  details: Record<string, any>;
}

interface TopError {
  error: string;
  count: number;
  operations: string[];
}

interface PerformanceMetrics {
  peakHour: number;
  peakDay: string;
  avgOperationsPerDay: number;
  avgOperationsPerOperator: number;
  operatorEfficiency: number;
}

interface ComprehensiveAnalysis {
  overview: AnalysisOverview;
  operatorStats: OperatorStats[];
  operationStats: Array<{ operation: string; count: number; successRate: number }>;
  hourlyActivity: HourlyActivity[];
  dailyActivity: DailyActivity[];
  anomalies: Anomaly[];
  topErrors: TopError[];
  sourceStats: Array<{ source: string; count: number }>;
  ipStats: Array<{ ip: string; count: number; operators: string[] }>;
  performanceMetrics: PerformanceMetrics;
  recommendations: string[];
  executiveSummary: string;
}

export default function NmsAnalysisPage() {
  const [, params] = useRoute("/nms/:id/analysis");
  const systemId = params?.id;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: system, isLoading: systemLoading } = useQuery<NmsSystem>({
    queryKey: ["/api/nms-systems", systemId],
    enabled: !!systemId,
  });

  const { data: analysis, isLoading: analysisLoading, refetch } = useQuery<ComprehensiveAnalysis>({
    queryKey: ["/api/nms-systems", systemId, "analysis"],
    queryFn: async () => {
      const res = await fetch(`/api/nms-systems/${systemId}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    enabled: !!systemId,
    retry: false,
  });

  const downloadHtmlMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/nms-systems/${systemId}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({ format: "html" }),
      });
      if (!res.ok) throw new Error("Failed to download report");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analysis-report-${systemId}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({ title: "Report Downloaded", description: "HTML report has been downloaded" });
    },
    onError: (error: any) => {
      toast({ title: "Download Failed", description: error.message, variant: "destructive" });
    },
  });

  if (systemLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-spinner">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!system) {
    return (
      <div className="p-6" data-testid="system-not-found">
        <p>System not found</p>
        <Button asChild className="mt-4">
          <Link href="/nms">Back to NMS Systems</Link>
        </Button>
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "bg-red-500 text-white";
      case "HIGH": return "bg-orange-500 text-white";
      case "MEDIUM": return "bg-yellow-500 text-black";
      case "LOW": return "bg-green-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild data-testid="button-back">
            <Link href={`/nms/${systemId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Log Analysis - {system.name}</h1>
            <p className="text-muted-foreground">Comprehensive analysis of NMS operation logs</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={() => refetch()} 
            disabled={analysisLoading}
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${analysisLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button 
            onClick={() => downloadHtmlMutation.mutate()} 
            disabled={!analysis || downloadHtmlMutation.isPending}
            data-testid="button-download-html"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Report
          </Button>
        </div>
      </div>

      {analysisLoading ? (
        <div className="flex items-center justify-center min-h-[400px]" data-testid="analysis-loading">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Analyzing logs... This may take a moment for large datasets.</p>
          </div>
        </div>
      ) : !analysis ? (
        <Card data-testid="no-data-card">
          <CardContent className="py-10 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Logs Available</h3>
            <p className="text-muted-foreground mb-4">Upload logs to this system to generate analysis</p>
            <Button asChild>
              <Link href={`/nms/${systemId}`}>Upload Logs</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 flex-wrap" data-testid="tabs-list">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="operators" data-testid="tab-operators">Operators</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
            <TabsTrigger value="anomalies" data-testid="tab-anomalies">
              Anomalies
              {analysis.anomalies.length > 0 && (
                <Badge variant="destructive" className="ml-2">{analysis.anomalies.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="errors" data-testid="tab-errors">Errors</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="card-total-operations">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Operations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analysis.overview.totalLogs.toLocaleString()}</div>
                </CardContent>
              </Card>

              <Card data-testid="card-success-rate">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-2xl font-bold">{analysis.overview.successRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={analysis.overview.successRate} className="mt-2" />
                </CardContent>
              </Card>

              <Card data-testid="card-failure-rate">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Failure Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="text-2xl font-bold">{analysis.overview.failureRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={analysis.overview.failureRate} className="mt-2 [&>div]:bg-red-500" />
                </CardContent>
              </Card>

              <Card data-testid="card-violations">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Violations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <span className="text-2xl font-bold">{analysis.overview.totalViolations}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="card-performance-metrics">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Peak Hour</p>
                      <p className="text-lg font-semibold">{analysis.performanceMetrics.peakHour}:00</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Peak Day</p>
                      <p className="text-lg font-semibold">{analysis.performanceMetrics.peakDay || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Ops/Day</p>
                      <p className="text-lg font-semibold">{analysis.performanceMetrics.avgOperationsPerDay.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Operator Efficiency</p>
                      <p className="text-lg font-semibold">{analysis.performanceMetrics.operatorEfficiency}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-recommendations">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-executive-summary">
              <CardHeader>
                <CardTitle>Executive Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md">
                  {analysis.executiveSummary}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="operators" className="space-y-6">
            <Card data-testid="card-operator-stats">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Operator Statistics
                </CardTitle>
                <CardDescription>
                  {analysis.overview.uniqueOperators} active operators analyzed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Operator</th>
                        <th className="text-right p-2">Total Ops</th>
                        <th className="text-right p-2">Success Rate</th>
                        <th className="text-right p-2">Violations</th>
                        <th className="text-left p-2">Top Operation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.operatorStats.slice(0, 20).map((op, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50" data-testid={`row-operator-${idx}`}>
                          <td className="p-2">
                            <div className="font-medium">{op.fullName || op.username}</div>
                            {op.fullName && <div className="text-xs text-muted-foreground">{op.username}</div>}
                          </td>
                          <td className="text-right p-2">{op.totalOperations.toLocaleString()}</td>
                          <td className="text-right p-2">
                            <Badge variant={op.successRate >= 90 ? "default" : op.successRate >= 70 ? "secondary" : "destructive"}>
                              {op.successRate.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="text-right p-2">
                            {op.violations > 0 ? (
                              <Badge variant="destructive">{op.violations}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="p-2 max-w-[200px] truncate">
                            {op.mostUsedOperations[0]?.operation || "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card data-testid="card-hourly-activity">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Hourly Activity Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-12 gap-1 h-40">
                  {analysis.hourlyActivity.map((h) => {
                    const maxCount = Math.max(...analysis.hourlyActivity.map(x => x.count));
                    const height = maxCount > 0 ? (h.count / maxCount) * 100 : 0;
                    return (
                      <div key={h.hour} className="flex flex-col items-center justify-end">
                        <div 
                          className="w-full bg-primary rounded-t transition-all"
                          style={{ height: `${height}%`, minHeight: h.count > 0 ? '4px' : '0' }}
                          title={`${h.hour}:00 - ${h.count} operations`}
                        />
                        <span className="text-xs text-muted-foreground mt-1">{h.hour}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">Hours (24h format)</p>
              </CardContent>
            </Card>

            <Card data-testid="card-daily-activity">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Daily Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Date</th>
                        <th className="text-right p-2">Total</th>
                        <th className="text-right p-2">Successful</th>
                        <th className="text-right p-2">Failed</th>
                        <th className="text-right p-2">Operators</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.dailyActivity.slice(-14).reverse().map((day, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="p-2">{day.date}</td>
                          <td className="text-right p-2">{day.count.toLocaleString()}</td>
                          <td className="text-right p-2 text-green-600">{day.successCount.toLocaleString()}</td>
                          <td className="text-right p-2 text-red-600">{day.failCount.toLocaleString()}</td>
                          <td className="text-right p-2">{day.uniqueOperators}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="anomalies" className="space-y-6">
            <Card data-testid="card-anomalies">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Detected Anomalies
                </CardTitle>
                <CardDescription>
                  {analysis.anomalies.length} anomalies detected in the analyzed period
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.anomalies.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                    <p>No anomalies detected. All operations are within normal parameters.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {analysis.anomalies.map((anomaly, idx) => (
                      <div 
                        key={idx} 
                        className="border rounded-lg p-4"
                        data-testid={`anomaly-${idx}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={getSeverityColor(anomaly.severity)}>
                                {anomaly.severity}
                              </Badge>
                              <Badge variant="outline">{anomaly.type.replace(/_/g, ' ')}</Badge>
                            </div>
                            <p className="text-sm">{anomaly.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Operator: {anomaly.operatorUsername} | 
                              Time: {new Date(anomaly.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errors" className="space-y-6">
            <Card data-testid="card-top-errors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="w-5 h-5" />
                  Top Errors
                </CardTitle>
                <CardDescription>
                  Most frequent errors encountered during operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.topErrors.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                    <p>No errors recorded in the analyzed period.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {analysis.topErrors.map((error, idx) => (
                      <div 
                        key={idx} 
                        className="border rounded-lg p-4"
                        data-testid={`error-${idx}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="destructive">{error.count} occurrences</Badge>
                            </div>
                            <p className="font-medium">{error.error}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Affected operations: {error.operations.join(', ')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-source-stats">
              <CardHeader>
                <CardTitle>Operations by Source</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Source</th>
                        <th className="text-right p-2">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.sourceStats.slice(0, 10).map((source, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="p-2">{source.source}</td>
                          <td className="text-right p-2">{source.count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
