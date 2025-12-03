import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiCall } from "@/lib/api";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Mail, 
  Server, 
  Clock, 
  Calendar, 
  Plus, 
  Save, 
  Trash2, 
  Send, 
  Shield,
  Bell,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Edit
} from "lucide-react";

interface EmailSettings {
  id: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  enableSsl: boolean;
  isConfigured: boolean;
}

interface ScheduledReport {
  id: string;
  name: string;
  frequency: string;
  recipientEmails: string;
  reportType: string;
  isActive: boolean;
  lastSentAt: string | null;
  nextScheduledAt: string | null;
  createdAt: string;
}

const emailSettingsSchema = z.object({
  smtpHost: z.string().min(1, "SMTP host is required"),
  smtpPort: z.number().min(1).max(65535),
  smtpUser: z.string().optional().default(""),
  smtpPassword: z.string().optional().default(""),
  fromEmail: z.string().email("Valid email is required"),
  fromName: z.string().min(1, "From name is required"),
  enableSsl: z.boolean(),
});

const scheduledReportSchema = z.object({
  name: z.string().min(1, "Report name is required"),
  frequency: z.enum(["weekly", "monthly", "quarterly"]),
  recipients: z.string().min(1, "At least one recipient is required"),
  reportType: z.enum(["violations", "operations", "summary", "full"]),
  isActive: z.boolean(),
});

type EmailSettingsFormData = z.infer<typeof emailSettingsSchema>;
type ScheduledReportFormData = z.infer<typeof scheduledReportSchema>;

export default function EmailSettingsPage() {
  const { toast } = useToast();
  const [showAddReportDialog, setShowAddReportDialog] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null);

  const { data: emailSettings, isLoading: isLoadingSettings } = useQuery<EmailSettings | null>({
    queryKey: ["/api/email-settings"],
    queryFn: async () => {
      const res = await apiCall("/api/email-settings");
      return res.json();
    },
  });

  const { data: scheduledReports, isLoading: isLoadingReports } = useQuery<ScheduledReport[]>({
    queryKey: ["/api/scheduled-reports"],
    queryFn: async () => {
      const res = await apiCall("/api/scheduled-reports");
      return res.json();
    },
  });

  const emailForm = useForm<EmailSettingsFormData>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      smtpHost: emailSettings?.smtpHost || "",
      smtpPort: emailSettings?.smtpPort || 587,
      smtpUser: emailSettings?.smtpUser || "",
      smtpPassword: "",
      fromEmail: emailSettings?.fromEmail || "",
      fromName: emailSettings?.fromName || "NMS Log Analyzer",
      enableSsl: emailSettings?.enableSsl ?? true,
    },
  });

  const reportForm = useForm<ScheduledReportFormData>({
    resolver: zodResolver(scheduledReportSchema),
    defaultValues: {
      name: "",
      frequency: "weekly",
      recipients: "",
      reportType: "summary",
      isActive: true,
    },
  });

  const saveEmailSettingsMutation = useMutation({
    mutationFn: async (data: EmailSettingsFormData) => {
      const res = await apiRequest("POST", "/api/email-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-settings"] });
      toast({
        title: "Settings Saved",
        description: "Email settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save email settings",
        variant: "destructive",
      });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async (testData: EmailSettingsFormData) => {
      const res = await apiRequest("POST", "/api/email-settings/test", testData);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Test Successful" : "Test Failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test email connection",
        variant: "destructive",
      });
    },
  });

  const createReportMutation = useMutation({
    mutationFn: async (data: ScheduledReportFormData) => {
      const res = await apiRequest("POST", "/api/scheduled-reports", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-reports"] });
      setShowAddReportDialog(false);
      reportForm.reset();
      toast({
        title: "Report Created",
        description: "Scheduled report has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create scheduled report",
        variant: "destructive",
      });
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ScheduledReportFormData> }) => {
      const res = await apiRequest("PATCH", `/api/scheduled-reports/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-reports"] });
      setEditingReport(null);
      toast({
        title: "Report Updated",
        description: "Scheduled report has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update scheduled report",
        variant: "destructive",
      });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/scheduled-reports/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-reports"] });
      setDeleteReportId(null);
      toast({
        title: "Report Deleted",
        description: "Scheduled report has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete scheduled report",
        variant: "destructive",
      });
    },
  });

  const onSubmitEmailSettings = (data: EmailSettingsFormData) => {
    saveEmailSettingsMutation.mutate(data);
  };

  const onSubmitReport = (data: ScheduledReportFormData) => {
    if (editingReport) {
      updateReportMutation.mutate({ id: editingReport.id, data });
    } else {
      createReportMutation.mutate(data);
    }
  };

  const toggleReportActive = (report: ScheduledReport) => {
    updateReportMutation.mutate({ 
      id: report.id, 
      data: { isActive: !report.isActive } 
    });
  };

  const frequencyLabels: Record<string, string> = {
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
  };

  const reportTypeLabels: Record<string, string> = {
    violations: "Violations Report",
    operations: "Operations Summary",
    summary: "Executive Summary",
    full: "Full Analysis Report",
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Mail className="w-6 h-6 text-primary" />
                Email Settings & Scheduled Reports
              </h1>
              <p className="text-muted-foreground">Configure email server and automated reporting</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  SMTP Configuration
                </CardTitle>
                <CardDescription>Configure your email server settings for sending reports</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...emailForm}>
                  <form onSubmit={emailForm.handleSubmit(onSubmitEmailSettings)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={emailForm.control}
                        name="smtpHost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Host</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="smtp.example.com" 
                                {...field} 
                                data-testid="input-smtp-host"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={emailForm.control}
                        name="smtpPort"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Port</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="587" 
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 587)}
                                data-testid="input-smtp-port"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={emailForm.control}
                        name="smtpUser"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="user@example.com" 
                                {...field} 
                                data-testid="input-smtp-user"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={emailForm.control}
                        name="smtpPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input 
                                type="password" 
                                placeholder="********" 
                                {...field} 
                                data-testid="input-smtp-password"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={emailForm.control}
                        name="fromEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>From Email</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="noreply@example.com" 
                                {...field} 
                                data-testid="input-from-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={emailForm.control}
                        name="fromName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>From Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="NMS Log Analyzer" 
                                {...field} 
                                data-testid="input-from-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={emailForm.control}
                      name="enableSsl"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Enable SSL/TLS</FormLabel>
                            <FormDescription className="text-xs">
                              Use secure connection for email
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-enable-ssl"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center gap-2 pt-4">
                      <Button 
                        type="submit" 
                        disabled={saveEmailSettingsMutation.isPending}
                        data-testid="button-save-email-settings"
                      >
                        {saveEmailSettingsMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Save Settings
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => {
                          const formValues = emailForm.getValues();
                          if (!formValues.smtpHost || !formValues.fromEmail) {
                            toast({
                              title: "Missing Required Fields",
                              description: "Please fill in SMTP Host and From Email before testing",
                              variant: "destructive",
                            });
                            return;
                          }
                          testEmailMutation.mutate(formValues);
                        }}
                        disabled={testEmailMutation.isPending}
                        data-testid="button-test-email"
                      >
                        {testEmailMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Test Connection
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {emailSettings?.isConfigured ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Email server is configured
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Email server not configured
                    </>
                  )}
                </div>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      Scheduled Reports
                    </CardTitle>
                    <CardDescription>Configure automated email reports</CardDescription>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      reportForm.reset();
                      setShowAddReportDialog(true);
                    }}
                    data-testid="button-add-scheduled-report"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Report
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {isLoadingReports ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : scheduledReports && scheduledReports.length > 0 ? (
                      scheduledReports.map((report) => (
                        <div 
                          key={report.id}
                          className="p-4 rounded-lg bg-muted/50 border"
                          data-testid={`scheduled-report-${report.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-medium">{report.name}</h4>
                                <Badge variant={report.isActive ? "default" : "secondary"}>
                                  {report.isActive ? "Active" : "Inactive"}
                                </Badge>
                                <Badge variant="outline">
                                  {frequencyLabels[report.frequency] || report.frequency}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {reportTypeLabels[report.reportType] || report.reportType}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {(report.recipientEmails || '').split(',').filter(e => e.trim()).length} recipient(s)
                                </span>
                                {report.lastSentAt && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Last: {new Date(report.lastSentAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => toggleReportActive(report)}
                                data-testid={`button-toggle-report-${report.id}`}
                              >
                                {report.isActive ? (
                                  <Bell className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Bell className="w-4 h-4 text-muted-foreground" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditingReport(report);
                                  reportForm.reset({
                                    name: report.name,
                                    frequency: report.frequency as any,
                                    recipients: report.recipientEmails,
                                    reportType: report.reportType as any,
                                    isActive: report.isActive,
                                  });
                                  setShowAddReportDialog(true);
                                }}
                                data-testid={`button-edit-report-${report.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeleteReportId(report.id)}
                                data-testid={`button-delete-report-${report.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No scheduled reports</p>
                        <p className="text-sm">Create a report to receive automated emails</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Report Frequency Guide
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    Weekly Reports
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Sent every Monday at 8:00 AM. Includes weekly summary of operations, violations, and operator performance.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-purple-500" />
                    Monthly Reports
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Sent on the 1st of each month. Comprehensive analysis of monthly trends, top issues, and recommendations.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-amber-500" />
                    Quarterly Reports
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Sent at the start of each quarter. Executive summary with long-term trends and strategic insights.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showAddReportDialog} onOpenChange={(open) => {
        setShowAddReportDialog(open);
        if (!open) {
          setEditingReport(null);
          reportForm.reset();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingReport ? "Edit Scheduled Report" : "Create Scheduled Report"}
            </DialogTitle>
            <DialogDescription>
              {editingReport 
                ? "Update the settings for this scheduled report" 
                : "Configure a new automated email report"
              }
            </DialogDescription>
          </DialogHeader>
          <Form {...reportForm}>
            <form onSubmit={reportForm.handleSubmit(onSubmitReport)} className="space-y-4">
              <FormField
                control={reportForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Weekly Violations Summary" 
                        {...field} 
                        data-testid="input-report-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={reportForm.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-frequency">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={reportForm.control}
                  name="reportType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Report Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-report-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="violations">Violations Report</SelectItem>
                          <SelectItem value="operations">Operations Summary</SelectItem>
                          <SelectItem value="summary">Executive Summary</SelectItem>
                          <SelectItem value="full">Full Analysis</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={reportForm.control}
                name="recipients"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipients</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="admin@example.com, manager@example.com" 
                        {...field} 
                        data-testid="input-recipients"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Separate multiple email addresses with commas
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={reportForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription className="text-xs">
                        Enable this report schedule
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-report-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowAddReportDialog(false);
                    setEditingReport(null);
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createReportMutation.isPending || updateReportMutation.isPending}
                  data-testid="button-submit-report"
                >
                  {(createReportMutation.isPending || updateReportMutation.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingReport ? "Update Report" : "Create Report"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteReportId} onOpenChange={() => setDeleteReportId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scheduled Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this scheduled report? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteReportId && deleteReportMutation.mutate(deleteReportId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
