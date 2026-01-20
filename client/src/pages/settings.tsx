import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiCall } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
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
  Calendar
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
  const { language, setLanguage, t } = useLanguage();
  const { toast } = useToast();
  
  const [deleteType, setDeleteType] = useState<"nms" | "legacy">("nms");
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
          type: deleteType
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

  const clearNmsDataMutation = useMutation({
    mutationFn: async () => {
      const res = await apiCall("/api/admin/clear-nms-data", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear NMS data");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "NMS Data Cleared",
        description: `Deleted: ${data.deleted.nmsLogs} logs, ${data.deleted.nmsSystems} systems, ${data.deleted.operators} operators`,
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
        description: `Deleted: ${data.deleted.logs} logs, ${data.deleted.employees} employees, ${data.deleted.reports} reports`,
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

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Settings className="w-6 h-6 text-primary" />
                {t("settings.title")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  {t("settings.preferences")}
                </CardTitle>
                <CardDescription>Customize your application experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">{t("settings.theme")}</p>
                    <p className="text-sm text-muted-foreground">Choose light or dark mode</p>
                  </div>
                  <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
                    <Button
                      variant={theme === "light" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTheme("light")}
                      data-testid="button-theme-light"
                    >
                      <Sun className="w-4 h-4 mr-1" />
                      Light
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTheme("dark")}
                      data-testid="button-theme-dark"
                    >
                      <Moon className="w-4 h-4 mr-1" />
                      Dark
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">{t("settings.language")}</p>
                    <p className="text-sm text-muted-foreground">Select your preferred language</p>
                  </div>
                  <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
                    <Button
                      variant={language === "en" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setLanguage("en")}
                      data-testid="button-lang-en"
                    >
                      English
                    </Button>
                    <Button
                      variant={language === "ar" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setLanguage("ar")}
                      data-testid="button-lang-ar"
                    >
                      العربية
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
                    <CardTitle className="text-xl">Database Maintenance</CardTitle>
                    <CardDescription>Delete specific logs by date range</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
                    <Button
                      variant={deleteType === "nms" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setDeleteType("nms")}
                    >
                      NMS Logs
                    </Button>
                    <Button
                      variant={deleteType === "legacy" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setDeleteType("legacy")}
                    >
                      Legacy Logs
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Start Date
                  </Label>
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    End Date
                  </Label>
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-muted/50"
                  />
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      className="w-full"
                      disabled={deleteLogsByDateMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Logs by Date
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all {deleteType === "nms" ? "NMS" : "Legacy"} logs 
                        between <strong>{startDate}</strong> and <strong>{endDate}</strong>.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        className="bg-destructive text-destructive-foreground"
                        onClick={() => deleteLogsByDateMutation.mutate()}
                      >
                        Yes, Delete Logs
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    Database Statistics
                  </CardTitle>
                  <CardDescription>Overall database records overview</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchDbStats()}
                  data-testid="button-refresh-db-stats"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dbStatsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : dbStats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium flex items-center gap-2">
                        <Server className="w-4 h-4 text-cyan-500" />
                        NMS Data
                      </h3>
                      <Badge variant="secondary">{totalNmsRecords.toLocaleString()} records</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">{dbStats.nms.systems}</p>
                        <p className="text-xs text-muted-foreground">NMS Systems</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">{dbStats.nms.logs.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">NMS Logs</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">{dbStats.nms.operators}</p>
                        <p className="text-xs text-muted-foreground">Operators</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">{dbStats.nms.analysisReports}</p>
                        <p className="text-xs text-muted-foreground">Reports</p>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          className="w-full"
                          disabled={clearNmsDataMutation.isPending || totalNmsRecords === 0}
                          data-testid="button-clear-nms-data"
                        >
                          {clearNmsDataMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 mr-2" />
                          )}
                          Clear All NMS Data
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                            Clear All NMS Data?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete all NMS systems, 
                            logs, operators, operator groups, managers, and analysis reports.
                            <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                              <strong>Records to be deleted:</strong>
                              <ul className="mt-2 space-y-1">
                                <li>NMS Systems: {dbStats.nms.systems}</li>
                                <li>NMS Logs: {dbStats.nms.logs.toLocaleString()}</li>
                                <li>Operators: {dbStats.nms.operators}</li>
                                <li>Analysis Reports: {dbStats.nms.analysisReports}</li>
                              </ul>
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => clearNmsDataMutation.mutate()}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Yes, Delete All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium flex items-center gap-2">
                        <Users className="w-4 h-4 text-amber-500" />
                        Legacy Data
                      </h3>
                      <Badge variant="secondary">{totalLegacyRecords.toLocaleString()} records</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">{dbStats.legacy.employees}</p>
                        <p className="text-xs text-muted-foreground">Employees</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">{dbStats.legacy.logs.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Activity Logs</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg col-span-2">
                        <p className="text-2xl font-bold">{dbStats.legacy.reports}</p>
                        <p className="text-xs text-muted-foreground">Employee Reports</p>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          className="w-full"
                          disabled={clearLegacyDataMutation.isPending || totalLegacyRecords === 0}
                          data-testid="button-clear-legacy-data"
                        >
                          {clearLegacyDataMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 mr-2" />
                          )}
                          Clear All Legacy Data
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                            Clear All Legacy Data?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete all employees, 
                            activity logs, and employee reports.
                            <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                              <strong>Records to be deleted:</strong>
                              <ul className="mt-2 space-y-1">
                                <li>Employees: {dbStats.legacy.employees}</li>
                                <li>Activity Logs: {dbStats.legacy.logs.toLocaleString()}</li>
                                <li>Reports: {dbStats.legacy.reports}</li>
                              </ul>
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => clearLegacyDataMutation.mutate()}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Yes, Delete All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Unable to load database statistics</p>
              )}
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
