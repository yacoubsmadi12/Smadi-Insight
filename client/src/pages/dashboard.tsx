import { useQuery } from "@tanstack/react-query";
import { apiCall } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Server, 
  Users, 
  FileText, 
  AlertTriangle, 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp,
  TrendingDown,
  BarChart3,
  Network,
  Shield,
  Zap,
  Eye
} from "lucide-react";
import { Link } from "wouter";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

interface NmsSystemStats {
  id: string;
  name: string;
  connectionType: string;
  status: string;
  totalLogs: number;
  successfulLogs: number;
  failedLogs: number;
  operatorCount: number;
  lastActivity: string | null;
}

interface DashboardStats {
  totalEmployees: number;
  logsProcessed: number;
  reportsGenerated: number;
  activeEmployees: number;
  totalNmsSystems: number;
  activeNmsSystems: number;
  totalNmsLogs: number;
  successfulOperations: number;
  failedOperations: number;
  totalViolations: number;
  operatorCount: number;
  nmsSystems: NmsSystemStats[];
  hourlyActivity: { hour: number; count: number; successful: number; failed: number }[];
  dailyActivity: { date: string; count: number; successful: number; failed: number }[];
  topOperations: { operation: string; count: number; successRate: number }[];
  recentLogs: any[];
}

const COLORS = ['#f59e0b', '#06b6d4', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const res = await apiCall("/api/dashboard/stats");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const successRate = stats?.totalNmsLogs 
    ? ((stats.successfulOperations / stats.totalNmsLogs) * 100).toFixed(1) 
    : "0";

  const failureRate = stats?.totalNmsLogs 
    ? ((stats.failedOperations / stats.totalNmsLogs) * 100).toFixed(1) 
    : "0";

  const pieData = [
    { name: 'Successful', value: stats?.successfulOperations || 0, color: '#10b981' },
    { name: 'Failed', value: stats?.failedOperations || 0, color: '#ef4444' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Eye className="w-6 h-6 text-primary" />
                NMS Analytics Dashboard
              </h1>
              <p className="text-muted-foreground">Real-time monitoring and analysis of network operations</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="px-3 py-1">
                <Activity className="w-3 h-3 mr-1 text-green-500 animate-pulse" />
                Live
              </Badge>
              <Button variant="outline" size="sm" asChild>
                <Link href="/nms-systems">
                  <Server className="w-4 h-4 mr-1" />
                  NMS Systems
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  NMS Systems
                </CardTitle>
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Server className="w-4 h-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {stats?.activeNmsSystems || 0}
                  <span className="text-lg text-muted-foreground ml-1">/ {stats?.totalNmsSystems || 0}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Active systems</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Operations
                </CardTitle>
                <div className="p-2 bg-cyan-500/20 rounded-lg">
                  <Zap className="w-4 h-4 text-cyan-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {(stats?.totalNmsLogs || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Network operations logged</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Success Rate
                </CardTitle>
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">
                  {successRate}%
                </div>
                <Progress value={parseFloat(successRate)} className="h-2 mt-2" />
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Failed Operations
                </CardTitle>
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <XCircle className="w-4 h-4 text-red-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-500">
                  {(stats?.failedOperations || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{failureRate}% failure rate</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Violations
                </CardTitle>
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Shield className="w-4 h-4 text-amber-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-500">
                  {stats?.totalViolations || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Security alerts</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Operations Activity (24 Hours)
                </CardTitle>
                <CardDescription>Real-time monitoring of network operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {stats?.hourlyActivity && stats.hourlyActivity.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.hourlyActivity}>
                        <defs>
                          <linearGradient id="colorSuccessful" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis 
                          dataKey="hour" 
                          stroke="#888" 
                          tickFormatter={(h) => `${h}:00`}
                        />
                        <YAxis stroke="#888" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1a1a2e', 
                            border: '1px solid #333',
                            borderRadius: '8px'
                          }}
                          labelFormatter={(h) => `Hour: ${h}:00`}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="successful" 
                          stroke="#10b981" 
                          fillOpacity={1} 
                          fill="url(#colorSuccessful)"
                          name="Successful"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="failed" 
                          stroke="#ef4444" 
                          fillOpacity={1} 
                          fill="url(#colorFailed)"
                          name="Failed"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No activity data available</p>
                        <p className="text-sm">Start receiving logs to see analytics</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Operation Results
                </CardTitle>
                <CardDescription>Success vs failure distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {stats?.totalNmsLogs && stats.totalNmsLogs > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1a1a2e', 
                            border: '1px solid #333',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No operations recorded</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  NMS Systems Status
                </CardTitle>
                <CardDescription>Overview of all network management systems</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.nmsSystems && stats.nmsSystems.length > 0 ? (
                    stats.nmsSystems.slice(0, 5).map((system) => (
                      <div 
                        key={system.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${system.status === 'active' ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                            <Server className={`w-4 h-4 ${system.status === 'active' ? 'text-green-500' : 'text-gray-500'}`} />
                          </div>
                          <div>
                            <p className="font-medium">{system.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                <Network className="w-3 h-3 mr-1" />
                                {system.connectionType}
                              </Badge>
                              <span>{system.totalLogs.toLocaleString()} logs</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-green-500">{system.successfulLogs}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-red-500">{system.failedLogs}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {system.totalLogs > 0 
                              ? `${((system.successfulLogs / system.totalLogs) * 100).toFixed(0)}% success`
                              : 'No activity'
                            }
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Server className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No NMS Systems configured</p>
                      <Button variant="outline" size="sm" className="mt-2" asChild>
                        <Link href="/nms-systems">Add NMS System</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Top Operations
                </CardTitle>
                <CardDescription>Most frequently performed operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.topOperations && stats.topOperations.length > 0 ? (
                    stats.topOperations.slice(0, 5).map((op, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate max-w-[200px]" title={op.operation}>
                            {op.operation}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {op.count.toLocaleString()}
                            </Badge>
                            <span className={`text-xs ${op.successRate >= 80 ? 'text-green-500' : op.successRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                              {op.successRate.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <Progress 
                          value={op.successRate} 
                          className="h-1.5"
                        />
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No operations recorded</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest network operations across all systems</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats?.recentLogs && stats.recentLogs.length > 0 ? (
                  stats.recentLogs.slice(0, 10).map((log: any, index: number) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover-elevate"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          log.result === 'Successful' ? 'bg-green-500/20' : 'bg-red-500/20'
                        }`}>
                          {log.result === 'Successful' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{log.operatorUsername}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {log.operation}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={log.level === 'Critical' ? 'destructive' : log.level === 'Major' ? 'default' : 'secondary'} className="text-xs">
                          {log.level}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No recent activity</p>
                    <p className="text-sm">Logs will appear here as they arrive</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/20 rounded-lg">
                    <Users className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.operatorCount || 0}</p>
                    <p className="text-sm text-muted-foreground">Active Operators</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-500/20 rounded-lg">
                    <FileText className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.reportsGenerated || 0}</p>
                    <p className="text-sm text-muted-foreground">Reports Generated</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-500/20 rounded-lg">
                    <Activity className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.logsProcessed || 0}</p>
                    <p className="text-sm text-muted-foreground">Legacy Logs</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-500/20 rounded-lg">
                    <Users className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.totalEmployees || 0}</p>
                    <p className="text-sm text-muted-foreground">Total Employees</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
