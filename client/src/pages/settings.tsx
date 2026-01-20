import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiCall } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useTheme } from "@/contexts/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings, 
  Sun, 
  Moon, 
  Globe, 
  Database,
  Trash2,
  Server,
  FileText,
  Users,
  Activity,
  AlertTriangle,
  Shield,
  RefreshCw,
  HardDrive,
  Cpu,
  MemoryStick,
  Loader2,
  Calendar,
  Layers
} from "lucide-react";
import { format } from "date-fns";

interface DbStats {
  nms: {
    systems: number;
    logs: number;
    analysisReports: number;
    operators: number;
    operatorGroups: number;
    managers: number;
  };
  legacy: {
    employees: number;
    logs: number;
    reports: number;
  };
  scheduledReports: number;
}

interface SystemInfo {
  cpu: {
    loadAverage: string;
    cores: number;
  };
  memory: {
    total: string;
    used: string;
    free: string;
    usagePercent: string;
  };
  uptime: number;
  platform: string;
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  
  const [deleteType, setDeleteType] = useState<string>("nmsLogs");
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: dbStats, isLoading: dbStatsLoading, refetch: refetchDbStats } = useQuery<DbStats>({
    queryKey: ["/api/admin/db-stats"],
    queryFn: async () => {
      const res = await apiCall("/api/admin/db-stats");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: systemInfo, isLoading: systemInfoLoading } = useQuery<SystemInfo>({
    queryKey: ["/api/system/info"],
    queryFn: async () => {
      const res = await apiCall("/api/system/info");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const deleteLogsByDateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiCall("/api/admin/delete-logs-by-date", {
        method: "DELETE",
        body: JSON.stringify({
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate + "T23:59:59").toISOString(),
          tableName: deleteType
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete logs");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Logs Deleted",
        description: `${data.count} logs deleted for the selected period.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/db-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  });

  const clearTableMutation = useMutation({
    mutationFn: async (tableName: string) => {
      const res = await apiCall(`/api/admin/clear-table/${tableName}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to clear ${tableName}`);
      return res.json();
    },
    onSuccess: (_, tableName) => {
      toast({
        title: "Table Cleared",
        description: `All records from ${tableName} have been deleted.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/db-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nms-systems"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const clearNmsDataMutation = useMutation({
    mutationFn: async () => {
      const res = await apiCall("/api/admin/clear-nms-data", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear NMS data");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "NMS Data Cleared",
        description: `Deleted total records across all NMS tables.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/db-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nms-systems"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nms-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to clear NMS data",
        variant: "destructive",
      });
    },
  });

  const clearLegacyDataMutation = useMutation({
    mutationFn: async () => {
      const res = await apiCall("/api/admin/clear-legacy-data", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear legacy data");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Legacy Data Cleared",
        description: `Deleted total records across all legacy tables.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/db-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to clear legacy data",
        variant: "destructive",
      });
    },
  });

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  const totalNmsRecords = dbStats ? 
    dbStats.nms.systems + dbStats.nms.logs + dbStats.nms.analysisReports + dbStats.nms.operators + dbStats.nms.operatorGroups + dbStats.nms.managers : 0;
  
  const totalLegacyRecords = dbStats ?
    dbStats.legacy.employees + dbStats.legacy.logs + dbStats.legacy.reports : 0;

  const TableControl = ({ label, count, tableName, icon: Icon, color }: { label: string, count: number, tableName: string, icon: any, color: string }) => (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg group hover:bg-muted transition-colors">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-md bg-${color}/10 text-${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{count.toLocaleString()} records</p>
        </div>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
            <Trash2 className="w-4 h-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {count.toLocaleString()} records from the {label} table. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground"
              onClick={() => clearTableMutation.mutate(tableName)}
            >
              Clear Table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Settings className="w-6 h-6 text-primary" />
                Settings
              </h2>
              <p className="text-sm text-muted-foreground">Configure your application and manage system resources</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  Preferences
                </CardTitle>
                <CardDescription>Customize your application experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">Theme</p>
                    <p className="text-sm text-muted-foreground">Choose light or dark mode</p>
                  </div>
                  <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
                    <Button
                      variant={theme === "light" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTheme("light")}
                    >
                      <Sun className="w-4 h-4 mr-1" />
                      Light
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTheme("dark")}
                    >
                      <Moon className="w-4 h-4 mr-1" />
                      Dark
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-primary" />
                  System Information
                </CardTitle>
                <CardDescription>Server resource monitoring</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {systemInfoLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : systemInfo ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-cyan-500" />
                        <span className="text-sm">CPU Load</span>
                      </div>
                      <Badge variant="outline">{systemInfo.cpu.loadAverage} ({systemInfo.cpu.cores} cores)</Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MemoryStick className="w-4 h-4 text-purple-500" />
                          <span className="text-sm">Memory</span>
                        </div>
                        <Badge variant="outline">{systemInfo.memory.usagePercent}</Badge>
                      </div>
                      <Progress value={parseFloat(systemInfo.memory.usagePercent)} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Used: {systemInfo.memory.used}</span>
                        <span>Free: {systemInfo.memory.free}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-green-500" />
                        <span className="text-sm">Uptime</span>
                      </div>
                      <Badge variant="outline">{formatUptime(systemInfo.uptime)}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-amber-500" />
                        <span className="text-sm">Platform</span>
                      </div>
                      <Badge variant="outline">{systemInfo.platform}</Badge>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-4">Unable to load system info</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Database className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Database Control Center</CardTitle>
                    <CardDescription>Full management of all database tables and records</CardDescription>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchDbStats()}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh Stats
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Log Cleanup Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-destructive" />
                  Partial Log Cleanup
                </h3>
                <div className="bg-muted/30 p-4 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 bg-muted p-1 rounded-lg w-fit overflow-x-auto max-w-full">
                    <Button
                      variant={deleteType === "nmsLogs" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setDeleteType("nmsLogs")}
                    >
                      NMS Logs
                    </Button>
                    <Button
                      variant={deleteType === "logs" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setDeleteType("logs")}
                    >
                      Activity Logs
                    </Button>
                    <Button
                      variant={deleteType === "analysisReports" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setDeleteType("analysisReports")}
                    >
                      Analysis Reports
                    </Button>
                    <Button
                      variant={deleteType === "reports" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setDeleteType("reports")}
                    >
                      Employee Reports
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-xs">Start Date</Label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-background" />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-xs">End Date</Label>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-background" />
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full" disabled={deleteLogsByDateMutation.isPending}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete by Date
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete range?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Permanently delete {deleteType} logs from {startDate} to {endDate}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive" onClick={() => deleteLogsByDateMutation.mutate()}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>

              {/* Individual Table Management */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* NMS Tables */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Server className="w-5 h-5 text-cyan-500" />
                      NMS Infrastructure
                    </h3>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive/10">
                          Clear All NMS
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Clear ALL NMS Data?</AlertDialogTitle></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive" onClick={() => clearNmsDataMutation.mutate()}>Confirm Wipe</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {dbStats && (
                    <div className="space-y-2">
                      <TableControl label="NMS Systems" count={dbStats.nms.systems} tableName="nmsSystems" icon={Server} color="cyan" />
                      <TableControl label="NMS Logs" count={dbStats.nms.logs} tableName="nmsLogs" icon={Activity} color="cyan" />
                      <TableControl label="Operators" count={dbStats.nms.operators} tableName="operators" icon={Users} color="cyan" />
                      <TableControl label="Analysis Reports" count={dbStats.nms.analysisReports} tableName="analysisReports" icon={FileText} color="cyan" />
                      <TableControl label="Managers" count={dbStats.nms.managers} tableName="managers" icon={Shield} color="cyan" />
                      <TableControl label="Operator Groups" count={dbStats.nms.operatorGroups} tableName="operatorGroups" icon={Layers} color="cyan" />
                    </div>
                  )}
                </div>

                {/* Legacy Tables */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Users className="w-5 h-5 text-amber-500" />
                      Legacy & Other
                    </h3>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive/10">
                          Clear All Legacy
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Clear ALL Legacy Data?</AlertDialogTitle></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive" onClick={() => clearLegacyDataMutation.mutate()}>Confirm Wipe</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {dbStats && (
                    <div className="space-y-2">
                      <TableControl label="Employees" count={dbStats.legacy.employees} tableName="employees" icon={Users} color="amber" />
                      <TableControl label="Activity Logs" count={dbStats.legacy.logs} tableName="logs" icon={Activity} color="amber" />
                      <TableControl label="Employee Reports" count={dbStats.legacy.reports} tableName="reports" icon={FileText} color="amber" />
                      <TableControl label="Scheduled Reports" count={dbStats.scheduledReports || 0} tableName="scheduledReports" icon={Calendar} color="purple" />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Application Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Application</p>
                  <p className="font-medium">Tracer Logs Zain</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Version</p>
                  <p className="font-medium">1.0.0</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Syslog Server</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-500/10 text-green-500">
                      <Activity className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                    <span className="text-sm text-muted-foreground">Port 514</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
