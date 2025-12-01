import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus, User, Users, UserCog, Upload, FileText, Activity, Settings, Trash2, Edit, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { NmsSystem, Manager, OperatorGroup, Operator } from "@shared/schema";

const managerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
});

const groupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  managerId: z.string().optional(),
  jobDescription: z.string().optional(),
  rules: z.string().optional(),
  allowedOperations: z.string().optional(),
  restrictedOperations: z.string().optional(),
});

const operatorSchema = z.object({
  username: z.string().min(1, "Username is required"),
  fullName: z.string().optional(),
  groupId: z.string().optional(),
});

export default function NmsSystemDetail() {
  const [, params] = useRoute("/nms/:id");
  const systemId = params?.id;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingLogs, setIsDeletingLogs] = useState(false);

  const { data: system, isLoading: systemLoading } = useQuery<NmsSystem>({
    queryKey: ["/api/nms-systems", systemId],
    enabled: !!systemId,
  });

  const { data: managers = [] } = useQuery<Manager[]>({
    queryKey: ["/api/managers", { nmsSystemId: systemId }],
    queryFn: async () => {
      const res = await fetch(`/api/managers?nmsSystemId=${systemId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      });
      return res.json();
    },
    enabled: !!systemId,
  });

  const { data: groups = [] } = useQuery<OperatorGroup[]>({
    queryKey: ["/api/operator-groups", { nmsSystemId: systemId }],
    queryFn: async () => {
      const res = await fetch(`/api/operator-groups?nmsSystemId=${systemId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      });
      return res.json();
    },
    enabled: !!systemId,
  });

  const { data: operators = [] } = useQuery<Operator[]>({
    queryKey: ["/api/operators", { nmsSystemId: systemId }],
    queryFn: async () => {
      const res = await fetch(`/api/operators?nmsSystemId=${systemId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      });
      return res.json();
    },
    enabled: !!systemId,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/nms-systems", systemId, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/nms-systems/${systemId}/stats`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      });
      return res.json();
    },
    enabled: !!systemId,
  });

  const handleFileUpload = async () => {
    if (!uploadFile || !systemId) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("nmsSystemId", systemId);

      const res = await fetch("/api/nms-logs/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast({
        title: "Upload Successful",
        description: `Uploaded ${data.count} logs from ${data.uniqueOperators} operators`,
      });
      setUploadFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/nms-systems", systemId, "stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operators"] });
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAllLogs = async () => {
    if (!systemId) return;
    
    setIsDeletingLogs(true);
    try {
      const res = await fetch(`/api/nms-systems/${systemId}/logs`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast({
        title: "Logs Deleted",
        description: `Successfully deleted ${data.deletedCount} logs`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/nms-systems", systemId, "stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nms-logs"] });
    } catch (error: any) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsDeletingLogs(false);
    }
  };

  if (systemLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!system) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">System not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="icon" asChild data-testid="button-back">
          <Link href="/nms-systems">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold" data-testid="text-system-name">{system.name}</h1>
          <p className="text-muted-foreground">{system.systemType} - {system.connectionType}</p>
        </div>
        <Badge variant={system.status === "active" ? "default" : "secondary"}>
          {system.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Logs" value={stats?.total || 0} icon={FileText} />
        <StatCard title="Operators" value={stats?.operatorCount || 0} icon={User} />
        <StatCard title="Groups" value={stats?.groupCount || 0} icon={Users} />
        <StatCard title="Managers" value={stats?.managerCount || 0} icon={UserCog} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="managers" data-testid="tab-managers">Managers</TabsTrigger>
          <TabsTrigger value="groups" data-testid="tab-groups">User Groups</TabsTrigger>
          <TabsTrigger value="operators" data-testid="tab-operators">Operators</TabsTrigger>
          <TabsTrigger value="upload" data-testid="tab-upload">Upload Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">System Type</p>
                  <p className="font-medium">{system.systemType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Connection Type</p>
                  <p className="font-medium">{system.connectionType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data Retention</p>
                  <p className="font-medium">{system.retentionDays} days</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium">{system.status}</p>
                </div>
              </div>
              {system.description && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p>{system.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button asChild data-testid="button-view-logs">
              <Link href={`/nms/${systemId}/logs`}>
                <FileText className="w-4 h-4 mr-2" />
                View Logs
              </Link>
            </Button>
            <Button variant="outline" asChild data-testid="button-analysis">
              <Link href={`/nms/${systemId}/analysis`}>
                <Activity className="w-4 h-4 mr-2" />
                Analysis Reports
              </Link>
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeletingLogs || !stats?.total} data-testid="button-delete-all-logs">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All Logs ({stats?.total || 0})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Delete All Logs
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete all {stats?.total || 0} logs for this system? 
                    This action cannot be undone and will permanently remove all log data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteAllLogs}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeletingLogs ? "Deleting..." : "Delete All Logs"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </TabsContent>

        <TabsContent value="managers">
          <ManagersTab systemId={systemId!} managers={managers} />
        </TabsContent>

        <TabsContent value="groups">
          <GroupsTab systemId={systemId!} groups={groups} managers={managers} />
        </TabsContent>

        <TabsContent value="operators">
          <OperatorsTab systemId={systemId!} operators={operators} groups={groups} />
        </TabsContent>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload NMS Logs</CardTitle>
              <CardDescription>Upload Huawei NMS operation logs in CSV format</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-md p-6 text-center">
                <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="max-w-xs mx-auto"
                  data-testid="input-file-upload"
                />
                {uploadFile && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Selected: {uploadFile.name}
                  </p>
                )}
              </div>
              <Button 
                onClick={handleFileUpload} 
                disabled={!uploadFile || isUploading}
                className="w-full"
                data-testid="button-upload"
              >
                {isUploading ? "Uploading..." : "Upload Logs"}
              </Button>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Expected CSV Format:</p>
                <p>Operation, Level, Operator, Time, Source, Terminal IP Address, Operation Object, Result, Details</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ title, value, icon: Icon }: { title: string; value: number; icon: any }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-primary/10 rounded-md">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ManagersTab({ systemId, managers }: { systemId: string; managers: Manager[] }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const form = useForm({ resolver: zodResolver(managerSchema), defaultValues: { name: "", email: "" } });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/managers", { ...data, nmsSystemId: systemId }),
    onSuccess: () => {
      toast({ title: "Success", description: "Manager added" });
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      setIsOpen(false);
      form.reset();
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/managers/${id}`),
    onSuccess: () => {
      toast({ title: "Success", description: "Manager removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
        <CardTitle>Managers</CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-manager">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Manager</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input {...field} data-testid="input-manager-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" {...field} data-testid="input-manager-email" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-manager">
                    {createMutation.isPending ? "Adding..." : "Add Manager"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          {managers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No managers added yet</p>
          ) : (
            <div className="space-y-2">
              {managers.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 border rounded-md" data-testid={`manager-${m.id}`}>
                  <div>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-sm text-muted-foreground">{m.email}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(m.id)} data-testid={`button-delete-manager-${m.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function GroupsTab({ systemId, groups, managers }: { systemId: string; groups: OperatorGroup[]; managers: Manager[] }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const form = useForm({ 
    resolver: zodResolver(groupSchema), 
    defaultValues: { name: "", managerId: "", jobDescription: "", rules: "", allowedOperations: "", restrictedOperations: "" } 
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/operator-groups", { 
        ...data, 
        nmsSystemId: systemId,
        managerId: data.managerId || null,
        allowedOperations: data.allowedOperations ? data.allowedOperations.split(",").map((s: string) => s.trim()) : [],
        restrictedOperations: data.restrictedOperations ? data.restrictedOperations.split(",").map((s: string) => s.trim()) : [],
    }),
    onSuccess: () => {
      toast({ title: "Success", description: "Group added" });
      queryClient.invalidateQueries({ queryKey: ["/api/operator-groups"] });
      setIsOpen(false);
      form.reset();
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/operator-groups/${id}`),
    onSuccess: () => {
      toast({ title: "Success", description: "Group removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/operator-groups"] });
    },
  });

  const getManagerName = (managerId: string | null) => {
    if (!managerId) return "Unassigned";
    const manager = managers.find(m => m.id === managerId);
    return manager?.name || "Unknown";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
        <CardTitle>User Groups</CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-group">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add User Group</DialogTitle>
              <DialogDescription>Define group rules and job description for analysis</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Name</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., NOC Tier 1" data-testid="input-group-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="managerId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign Manager</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-group-manager">
                          <SelectValue placeholder="Select manager" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {managers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="jobDescription" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Describe what this group is responsible for" data-testid="input-job-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="allowedOperations" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allowed Operations (comma-separated)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Query, Monitor, View" data-testid="input-allowed-ops" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="restrictedOperations" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Restricted Operations (comma-separated)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Delete, Modify Config" data-testid="input-restricted-ops" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="rules" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Rules</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Any additional rules for this group" data-testid="input-rules" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-group">
                    {createMutation.isPending ? "Adding..." : "Add Group"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {groups.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No groups added yet</p>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g.id} className="p-4 border rounded-md space-y-2" data-testid={`group-${g.id}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{g.name}</p>
                      <p className="text-sm text-muted-foreground">Manager: {getManagerName(g.managerId)}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(g.id)} data-testid={`button-delete-group-${g.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {g.jobDescription && (
                    <p className="text-sm">{g.jobDescription}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {g.allowedOperations?.map((op, i) => (
                      <Badge key={i} variant="secondary">{op}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function OperatorsTab({ systemId, operators, groups }: { systemId: string; operators: Operator[]; groups: OperatorGroup[] }) {
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: ({ id, groupId }: { id: string; groupId: string | null }) => 
      apiRequest("PATCH", `/api/operators/${id}`, { groupId }),
    onSuccess: () => {
      toast({ title: "Success", description: "Operator updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/operators"] });
    },
  });

  const getGroupName = (groupId: string | null) => {
    if (!groupId) return "Unassigned";
    const group = groups.find(g => g.id === groupId);
    return group?.name || "Unknown";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operators</CardTitle>
        <CardDescription>Operators are automatically discovered from uploaded logs</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {operators.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No operators discovered yet. Upload logs to discover operators.</p>
          ) : (
            <div className="space-y-2">
              {operators.map((op) => (
                <div key={op.id} className="flex items-center justify-between p-3 border rounded-md" data-testid={`operator-${op.id}`}>
                  <div>
                    <p className="font-medium">{op.fullName || op.username}</p>
                    <p className="text-sm text-muted-foreground">@{op.username}</p>
                  </div>
                  <Select 
                    value={op.groupId || "unassigned"} 
                    onValueChange={(v) => updateMutation.mutate({ id: op.id, groupId: v === "unassigned" ? null : v })}
                  >
                    <SelectTrigger className="w-[180px]" data-testid={`select-operator-group-${op.id}`}>
                      <SelectValue placeholder="Assign to group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
