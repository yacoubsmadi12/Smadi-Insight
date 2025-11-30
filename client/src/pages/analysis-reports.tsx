import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Send, AlertTriangle, CheckCircle, BarChart3, RefreshCw, Calendar, User, Users, Building2, TrendingUp, TrendingDown, Clock, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AnalysisReport, NmsSystem, OperatorGroup, Manager, Operator } from "@shared/schema";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

interface ReportFilters {
  nmsSystemId?: string;
  operatorId?: string;
  groupId?: string;
  managerId?: string;
  reportType?: string;
}

export default function AnalysisReportsPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ReportFilters>({});
  const [selectedReport, setSelectedReport] = useState<AnalysisReport | null>(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateConfig, setGenerateConfig] = useState({
    nmsSystemId: "",
    reportType: "daily",
    groupId: "",
  });

  const { data: systems = [] } = useQuery<NmsSystem[]>({
    queryKey: ["/api/nms-systems"],
  });

  const { data: groups = [] } = useQuery<OperatorGroup[]>({
    queryKey: ["/api/operator-groups"],
  });

  const { data: managers = [] } = useQuery<Manager[]>({
    queryKey: ["/api/managers"],
  });

  const { data: reports = [], isLoading, refetch } = useQuery<AnalysisReport[]>({
    queryKey: ["/api/analysis-reports", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.nmsSystemId) params.set("nmsSystemId", filters.nmsSystemId);
      if (filters.operatorId) params.set("operatorId", filters.operatorId);
      if (filters.groupId) params.set("groupId", filters.groupId);
      if (filters.managerId) params.set("managerId", filters.managerId);

      const res = await fetch(`/api/analysis-reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      });
      return res.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (config: { nmsSystemId: string; reportType: string; groupId?: string }) => {
      return apiRequest("POST", "/api/analysis-reports/generate", config);
    },
    onSuccess: () => {
      toast({ title: "Report Generated", description: "Analysis report has been generated successfully" });
      setGenerateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/analysis-reports"] });
    },
    onError: (error: Error) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (reportId: string) => {
      return apiRequest("POST", `/api/analysis-reports/${reportId}/send-email`);
    },
    onSuccess: () => {
      toast({ title: "Email Sent", description: "Report has been sent to the manager" });
      queryClient.invalidateQueries({ queryKey: ["/api/analysis-reports"] });
    },
    onError: (error: Error) => {
      toast({ title: "Send Failed", description: error.message, variant: "destructive" });
    },
  });

  const getComplianceColor = (score: number | null | undefined) => {
    if (score === null || score === undefined) return "text-muted-foreground";
    if (score >= 90) return "text-green-600 dark:text-green-400";
    if (score >= 70) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getComplianceBadge = (score: number | null | undefined) => {
    if (score === null || score === undefined) return <Badge variant="secondary">N/A</Badge>;
    if (score >= 90) return <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400">Excellent</Badge>;
    if (score >= 70) return <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-400">Good</Badge>;
    return <Badge variant="destructive">Needs Attention</Badge>;
  };

  const getReportTypeBadge = (type: string) => {
    switch (type) {
      case "daily":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Daily</Badge>;
      case "weekly":
        return <Badge variant="secondary"><Calendar className="w-3 h-3 mr-1" />Weekly</Badge>;
      case "monthly":
        return <Badge variant="outline"><BarChart3 className="w-3 h-3 mr-1" />Monthly</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Header />
        <main className="p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold" data-testid="text-page-title">Analysis Reports</h1>
              <p className="text-muted-foreground">View and generate NMS operation analysis reports</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => setGenerateDialogOpen(true)} data-testid="button-generate">
                <FileText className="w-4 h-4 mr-2" />
                Generate Report
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">NMS System</label>
                  <Select
                    value={filters.nmsSystemId || "all"}
                    onValueChange={(v) => setFilters({ ...filters, nmsSystemId: v === "all" ? undefined : v })}
                  >
                    <SelectTrigger data-testid="select-system-filter">
                      <SelectValue placeholder="All Systems" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Systems</SelectItem>
                      {systems.map((sys) => (
                        <SelectItem key={sys.id} value={sys.id}>{sys.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Group</label>
                  <Select
                    value={filters.groupId || "all"}
                    onValueChange={(v) => setFilters({ ...filters, groupId: v === "all" ? undefined : v })}
                  >
                    <SelectTrigger data-testid="select-group-filter">
                      <SelectValue placeholder="All Groups" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Groups</SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Manager</label>
                  <Select
                    value={filters.managerId || "all"}
                    onValueChange={(v) => setFilters({ ...filters, managerId: v === "all" ? undefined : v })}
                  >
                    <SelectTrigger data-testid="select-manager-filter">
                      <SelectValue placeholder="All Managers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Managers</SelectItem>
                      {managers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button variant="outline" onClick={() => setFilters({})} className="w-full" data-testid="button-clear-filters">
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : reports.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-1">No Reports Found</h3>
                <p className="text-muted-foreground">Generate a new report to analyze NMS operations</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {reports.map((report) => (
                <Card
                  key={report.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => setSelectedReport(report)}
                  data-testid={`report-card-${report.id}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                          {getReportTypeBadge(report.reportType)}
                          <span>{report.dateRange}</span>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {new Date(report.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      {getComplianceBadge(report.complianceScore)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>{report.successfulOperations} successful</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          <span>{report.failedOperations} failed</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <BarChart3 className="w-4 h-4 text-muted-foreground" />
                          <span>{report.totalOperations} total</span>
                        </div>
                      </div>

                      {report.complianceScore !== null && report.complianceScore !== undefined && (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Compliance Score</span>
                            <span className={getComplianceColor(report.complianceScore)}>
                              {report.complianceScore}%
                            </span>
                          </div>
                          <Progress value={report.complianceScore} className="h-2" />
                        </div>
                      )}

                      {report.violations && (report.violations as any[]).length > 0 && (
                        <div className="flex items-center gap-1 text-sm text-destructive">
                          <AlertTriangle className="w-4 h-4" />
                          <span>{(report.violations as any[]).length} violation types detected</span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-2">
                        {report.sentToEmail && (
                          <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400">
                            <Send className="w-3 h-3 mr-1" />
                            Sent
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  Analysis Report
                  {selectedReport && getReportTypeBadge(selectedReport.reportType)}
                </DialogTitle>
                <DialogDescription>
                  {selectedReport?.dateRange}
                </DialogDescription>
              </DialogHeader>
              {selectedReport && (
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold">{selectedReport.totalOperations}</div>
                          <div className="text-sm text-muted-foreground">Total Operations</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold text-green-600">{selectedReport.successfulOperations}</div>
                          <div className="text-sm text-muted-foreground">Successful</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold text-red-600">{selectedReport.failedOperations}</div>
                          <div className="text-sm text-muted-foreground">Failed</div>
                        </CardContent>
                      </Card>
                    </div>

                    {selectedReport.complianceScore !== null && selectedReport.complianceScore !== undefined && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Compliance Score</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-4">
                            <Progress value={selectedReport.complianceScore} className="flex-1 h-4" />
                            <span className={`text-2xl font-bold ${getComplianceColor(selectedReport.complianceScore)}`}>
                              {selectedReport.complianceScore}%
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{selectedReport.summary}</p>
                      </CardContent>
                    </Card>

                    {selectedReport.violations && (selectedReport.violations as any[]).length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-destructive" />
                            Violations
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {(selectedReport.violations as any[]).map((violation: any, index: number) => (
                              <div key={index} className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                                <div className="flex justify-between items-start">
                                  <span className="font-medium">{violation.type}</span>
                                  <Badge variant="destructive">{violation.count} occurrences</Badge>
                                </div>
                                {violation.details && violation.details.length > 0 && (
                                  <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside">
                                    {violation.details.slice(0, 3).map((detail: string, i: number) => (
                                      <li key={i}>{detail}</li>
                                    ))}
                                    {violation.details.length > 3 && (
                                      <li>...and {violation.details.length - 3} more</li>
                                    )}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {selectedReport.risks && (selectedReport.risks as any[]).length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                            Identified Risks
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {(selectedReport.risks as any[]).map((risk: any, index: number) => (
                              <div key={index} className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                                <div className="flex items-start gap-2">
                                  <Badge 
                                    variant="outline" 
                                    className={`shrink-0 ${risk.level === 'high' ? 'border-red-500 text-red-600' : risk.level === 'medium' ? 'border-yellow-500 text-yellow-600' : 'border-green-500 text-green-600'}`}
                                  >
                                    {risk.level}
                                  </Badge>
                                  <span className="text-sm">{risk.description}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {selectedReport.recommendations && (selectedReport.recommendations as any[]).length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            Recommendations
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm">
                            {(selectedReport.recommendations as any[]).map((rec: string, index: number) => (
                              <li key={index} className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </ScrollArea>
              )}
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedReport) {
                      sendEmailMutation.mutate(selectedReport.id);
                    }
                  }}
                  disabled={sendEmailMutation.isPending || !!selectedReport?.sentToEmail}
                  data-testid="button-send-email"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {selectedReport?.sentToEmail ? "Already Sent" : "Send to Manager"}
                </Button>
                <Button variant="outline" onClick={() => setSelectedReport(null)} data-testid="button-close-report">
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Analysis Report</DialogTitle>
                <DialogDescription>
                  Create a new analysis report for NMS operations
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">NMS System</label>
                  <Select
                    value={generateConfig.nmsSystemId}
                    onValueChange={(v) => setGenerateConfig({ ...generateConfig, nmsSystemId: v })}
                  >
                    <SelectTrigger data-testid="select-generate-system">
                      <SelectValue placeholder="Select a system" />
                    </SelectTrigger>
                    <SelectContent>
                      {systems.map((sys) => (
                        <SelectItem key={sys.id} value={sys.id}>{sys.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Report Type</label>
                  <Select
                    value={generateConfig.reportType}
                    onValueChange={(v) => setGenerateConfig({ ...generateConfig, reportType: v })}
                  >
                    <SelectTrigger data-testid="select-generate-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily Report</SelectItem>
                      <SelectItem value="weekly">Weekly Report</SelectItem>
                      <SelectItem value="monthly">Monthly Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">User Group (Optional)</label>
                  <Select
                    value={generateConfig.groupId || "all"}
                    onValueChange={(v) => setGenerateConfig({ ...generateConfig, groupId: v === "all" ? "" : v })}
                  >
                    <SelectTrigger data-testid="select-generate-group">
                      <SelectValue placeholder="All Groups" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Groups</SelectItem>
                      {groups
                        .filter((g) => !generateConfig.nmsSystemId || g.nmsSystemId === generateConfig.nmsSystemId)
                        .map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setGenerateDialogOpen(false)} data-testid="button-cancel-generate">
                  Cancel
                </Button>
                <Button
                  onClick={() => generateMutation.mutate(generateConfig)}
                  disabled={!generateConfig.nmsSystemId || generateMutation.isPending}
                  data-testid="button-confirm-generate"
                >
                  {generateMutation.isPending ? "Generating..." : "Generate Report"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
