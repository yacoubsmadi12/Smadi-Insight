import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Search, Filter, Download, AlertTriangle, CheckCircle, XCircle, ChevronLeft, ChevronRight, Eye, Upload, RefreshCw, FileText } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { NmsLog, NmsSystem, Operator } from "@shared/schema";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

interface LogFilters {
  nmsSystemId?: string;
  operatorUsername?: string;
  level?: string;
  result?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

interface PaginatedLogs {
  logs: NmsLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function NmsLogsPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<LogFilters>({});
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<NmsLog | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedSystemForUpload, setSelectedSystemForUpload] = useState<string>("");

  const { data: systems = [] } = useQuery<NmsSystem[]>({
    queryKey: ["/api/nms-systems"],
  });

  const { data: logsData, isLoading, refetch } = useQuery<PaginatedLogs>({
    queryKey: ["/api/nms-logs", page, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "50");
      if (filters.nmsSystemId) params.set("nmsSystemId", filters.nmsSystemId);
      if (filters.operatorUsername) params.set("operatorUsername", filters.operatorUsername);
      if (filters.level) params.set("level", filters.level);
      if (filters.result) params.set("result", filters.result);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (filters.search) params.set("search", filters.search);

      const res = await fetch(`/api/nms-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      });
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/nms-logs/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload Successful",
        description: `Uploaded ${data.count} logs from ${data.uniqueOperators} operators`,
      });
      setUploadDialogOpen(false);
      setUploadFile(null);
      setSelectedSystemForUpload("");
      queryClient.invalidateQueries({ queryKey: ["/api/nms-logs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleUpload = () => {
    if (!uploadFile || !selectedSystemForUpload) return;
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("nmsSystemId", selectedSystemForUpload);
    uploadMutation.mutate(formData);
  };

  const getLevelBadge = (level: string) => {
    switch (level?.toLowerCase()) {
      case "critical":
        return <Badge variant="destructive" data-testid={`badge-level-${level}`}>{level}</Badge>;
      case "major":
        return <Badge className="bg-orange-500 text-white" data-testid={`badge-level-${level}`}>{level}</Badge>;
      case "warning":
        return <Badge className="bg-yellow-500 text-black dark:text-black" data-testid={`badge-level-${level}`}>{level}</Badge>;
      default:
        return <Badge variant="secondary" data-testid={`badge-level-${level}`}>{level || "Minor"}</Badge>;
    }
  };

  const getResultBadge = (result: string) => {
    const isSuccess = result?.toLowerCase().includes("success") || result?.toLowerCase().includes("successful");
    return isSuccess ? (
      <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400" data-testid={`badge-result-success`}>
        <CheckCircle className="w-3 h-3 mr-1" />
        {result}
      </Badge>
    ) : (
      <Badge variant="outline" className="border-red-500 text-red-600 dark:text-red-400" data-testid={`badge-result-failed`}>
        <XCircle className="w-3 h-3 mr-1" />
        {result}
      </Badge>
    );
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Header />
        <main className="p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold" data-testid="text-page-title">NMS Operation Logs</h1>
              <p className="text-muted-foreground">View and analyze Huawei NMS operation logs</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => setUploadDialogOpen(true)} data-testid="button-upload">
                <Upload className="w-4 h-4 mr-2" />
                Upload Logs
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">NMS System</label>
                  <Select
                    value={filters.nmsSystemId || "all"}
                    onValueChange={(v) => setFilters({ ...filters, nmsSystemId: v === "all" ? undefined : v })}
                  >
                    <SelectTrigger data-testid="select-system">
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
                  <label className="text-sm font-medium mb-1 block">Operator</label>
                  <Input
                    placeholder="Username..."
                    value={filters.operatorUsername || ""}
                    onChange={(e) => setFilters({ ...filters, operatorUsername: e.target.value })}
                    data-testid="input-operator"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Level</label>
                  <Select
                    value={filters.level || "all"}
                    onValueChange={(v) => setFilters({ ...filters, level: v === "all" ? undefined : v })}
                  >
                    <SelectTrigger data-testid="select-level">
                      <SelectValue placeholder="All Levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                      <SelectItem value="Major">Major</SelectItem>
                      <SelectItem value="Warning">Warning</SelectItem>
                      <SelectItem value="Minor">Minor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Result</label>
                  <Select
                    value={filters.result || "all"}
                    onValueChange={(v) => setFilters({ ...filters, result: v === "all" ? undefined : v })}
                  >
                    <SelectTrigger data-testid="select-result">
                      <SelectValue placeholder="All Results" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Results</SelectItem>
                      <SelectItem value="Successful">Successful</SelectItem>
                      <SelectItem value="Failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Start Date</label>
                  <Input
                    type="date"
                    value={filters.startDate || ""}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    data-testid="input-start-date"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">End Date</label>
                  <Input
                    type="date"
                    value={filters.endDate || ""}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    data-testid="input-end-date"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search operation, object..."
                      className="pl-8"
                      value={filters.search || ""}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      data-testid="input-search"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <Button variant="outline" onClick={clearFilters} className="w-full" data-testid="button-clear-filters">
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Logs
                {logsData && (
                  <Badge variant="secondary">{logsData.total.toLocaleString()} total</Badge>
                )}
              </CardTitle>
              {logsData && logsData.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {logsData.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage(Math.min(logsData.totalPages, page + 1))}
                    disabled={page === logsData.totalPages}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !logsData?.logs?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No logs found</p>
                  <p className="text-sm mt-1">Upload logs or adjust your filters</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-2">
                    {logsData.logs.map((log) => (
                      <div
                        key={log.id}
                        className="p-4 rounded-md border hover-elevate cursor-pointer transition-colors"
                        onClick={() => setSelectedLog(log)}
                        data-testid={`log-entry-${log.id}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              {getLevelBadge(log.level)}
                              <span className="font-medium truncate">{log.operation}</span>
                              {log.isViolation && (
                                <Badge variant="destructive">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Violation
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                              <span>Operator: <span className="text-foreground">{log.operatorUsername}</span></span>
                              <span>Object: <span className="text-foreground">{log.operationObject || "N/A"}</span></span>
                              <span>IP: <span className="text-foreground">{log.terminalIp || "N/A"}</span></span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {getResultBadge(log.result)}
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedLog && getLevelBadge(selectedLog.level)}
                  Log Details
                </DialogTitle>
              </DialogHeader>
              {selectedLog && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Operation</label>
                      <p className="font-medium">{selectedLog.operation}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Result</label>
                      <p>{getResultBadge(selectedLog.result)}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Operator</label>
                      <p className="font-medium">{selectedLog.operatorUsername}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Timestamp</label>
                      <p className="font-medium">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Source</label>
                      <p className="font-medium">{selectedLog.source || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Terminal IP</label>
                      <p className="font-medium">{selectedLog.terminalIp || "N/A"}</p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm text-muted-foreground">Operation Object</label>
                      <p className="font-medium">{selectedLog.operationObject || "N/A"}</p>
                    </div>
                    {selectedLog.details && (
                      <div className="col-span-2">
                        <label className="text-sm text-muted-foreground">Details</label>
                        <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-x-auto whitespace-pre-wrap">
                          {selectedLog.details}
                        </pre>
                      </div>
                    )}
                    {selectedLog.isViolation && (
                      <div className="col-span-2">
                        <Badge variant="destructive" className="mb-2">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Policy Violation Detected
                        </Badge>
                        {selectedLog.violationType && (
                          <p className="text-sm text-muted-foreground">Type: {selectedLog.violationType}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedLog(null)} data-testid="button-close-details">
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Huawei NMS Logs</DialogTitle>
                <DialogDescription>
                  Upload a CSV file containing operation logs from your Huawei NMS system
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">NMS System</label>
                  <Select value={selectedSystemForUpload} onValueChange={setSelectedSystemForUpload}>
                    <SelectTrigger data-testid="select-upload-system">
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
                  <label className="text-sm font-medium mb-1 block">CSV File</label>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    data-testid="input-upload-file"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Expected columns: Operation, Level, Operator, Time, Source, Terminal IP, Operation Object, Result, Details
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadDialogOpen(false)} data-testid="button-cancel-upload">
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!uploadFile || !selectedSystemForUpload || uploadMutation.isPending}
                  data-testid="button-confirm-upload"
                >
                  {uploadMutation.isPending ? "Uploading..." : "Upload"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
