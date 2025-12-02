import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Server, Settings, FileText, Users, AlertTriangle, Activity, Trash2, Edit, ArrowLeft, BarChart3, Network } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { NmsSystem } from "@shared/schema";

const nmsSystemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  systemType: z.string().min(1, "System type is required"),
  connectionType: z.enum(["upload", "syslog", "api"]),
  retentionDays: z.number().min(1).max(365).default(30),
  status: z.enum(["active", "inactive"]).default("active"),
});

type NmsSystemFormData = z.infer<typeof nmsSystemSchema>;

export default function NmsSystems() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState<NmsSystem | null>(null);

  const { data: systems = [], isLoading } = useQuery<NmsSystem[]>({
    queryKey: ["/api/nms-systems"],
  });

  const form = useForm<NmsSystemFormData>({
    resolver: zodResolver(nmsSystemSchema),
    defaultValues: {
      name: "",
      description: "",
      systemType: "huawei-nce",
      connectionType: "upload",
      retentionDays: 30,
      status: "active",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: NmsSystemFormData) => apiRequest("POST", "/api/nms-systems", data),
    onSuccess: () => {
      toast({ title: "Success", description: "NMS System created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/nms-systems"] });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: NmsSystemFormData & { id: string }) => 
      apiRequest("PATCH", `/api/nms-systems/${data.id}`, data),
    onSuccess: () => {
      toast({ title: "Success", description: "NMS System updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/nms-systems"] });
      setEditingSystem(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/nms-systems/${id}`),
    onSuccess: () => {
      toast({ title: "Success", description: "NMS System deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/nms-systems"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: NmsSystemFormData) => {
    if (editingSystem) {
      updateMutation.mutate({ ...data, id: editingSystem.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (system: NmsSystem) => {
    setEditingSystem(system);
    form.reset({
      name: system.name,
      description: system.description || "",
      systemType: system.systemType,
      connectionType: system.connectionType as "upload" | "syslog" | "api",
      retentionDays: system.retentionDays,
      status: system.status as "active" | "inactive",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/dashboard")}
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">NMS Systems</h1>
            <p className="text-muted-foreground">Manage your Network Management Systems</p>
          </div>
        </div>
        <Dialog open={isCreateOpen || !!editingSystem} onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingSystem(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-add-system">
              <Plus className="w-4 h-4 mr-2" />
              Add NMS System
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingSystem ? "Edit NMS System" : "Add NMS System"}</DialogTitle>
              <DialogDescription>
                {editingSystem ? "Update the NMS system configuration" : "Configure a new Network Management System"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., NCE FAN HQ" {...field} data-testid="input-system-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="systemType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-system-type">
                            <SelectValue placeholder="Select system type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="huawei-nce">Huawei NCE</SelectItem>
                          <SelectItem value="huawei-ums">Huawei U2000/UMS</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="connectionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Connection Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-connection-type">
                            <SelectValue placeholder="Select connection type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="upload">Manual Upload</SelectItem>
                          <SelectItem value="syslog">Syslog Forwarding</SelectItem>
                          <SelectItem value="api">API Integration</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Optional description" {...field} data-testid="input-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="retentionDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Retention (days)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          max={365} 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                          data-testid="input-retention-days" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-system">
                    {createMutation.isPending || updateMutation.isPending ? "Saving..." : (editingSystem ? "Update" : "Create")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {systems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No NMS Systems</h3>
            <p className="text-muted-foreground text-center mb-4">
              Get started by adding your first Network Management System
            </p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-add-first-system">
              <Plus className="w-4 h-4 mr-2" />
              Add NMS System
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systems.map((system) => (
            <SystemCard 
              key={system.id} 
              system={system} 
              onEdit={handleEdit}
              onDelete={() => deleteMutation.mutate(system.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SystemCard({ 
  system, 
  onEdit, 
  onDelete 
}: { 
  system: NmsSystem; 
  onEdit: (system: NmsSystem) => void;
  onDelete: () => void;
}) {
  const { data: stats } = useQuery({
    queryKey: ["/api/nms-systems", system.id, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/nms-systems/${system.id}/stats`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      });
      return res.json();
    },
  });

  const getConnectionTypeLabel = (type: string) => {
    switch (type) {
      case "upload": return "Manual Upload";
      case "syslog": return "Syslog Forwarding";
      case "api": return "API Integration";
      default: return type;
    }
  };

  const getConnectionTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "syslog": return "default";
      case "api": return "secondary";
      default: return "outline";
    }
  };

  return (
    <Card className="hover-elevate" data-testid={`card-system-${system.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Server className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{system.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={getConnectionTypeBadgeVariant(system.connectionType) as any} className="text-xs">
                  <Network className="w-3 h-3 mr-1" />
                  {getConnectionTypeLabel(system.connectionType)}
                </Badge>
              </div>
            </div>
          </div>
          <Badge variant={system.status === "active" ? "default" : "secondary"}>
            {system.status}
          </Badge>
        </div>
        <CardDescription className="line-clamp-2 mt-2">
          {system.description || `${system.systemType}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
            <FileText className="w-4 h-4 text-primary" />
            <div>
              <span className="font-medium">{stats?.total || 0}</span>
              <span className="text-muted-foreground ml-1">logs</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
            <Users className="w-4 h-4 text-cyan-500" />
            <div>
              <span className="font-medium">{stats?.operatorCount || 0}</span>
              <span className="text-muted-foreground ml-1">operators</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
            <Activity className="w-4 h-4 text-green-500" />
            <div>
              <span className="font-medium">{stats?.successful || 0}</span>
              <span className="text-muted-foreground ml-1">success</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <div>
              <span className="font-medium">{stats?.failed || 0}</span>
              <span className="text-muted-foreground ml-1">failed</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-3 border-t">
          <Button variant="ghost" size="sm" asChild data-testid={`button-view-${system.id}`}>
            <Link href={`/nms/${system.id}`}>
              <Settings className="w-4 h-4 mr-1" />
              Manage
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild data-testid={`button-logs-${system.id}`}>
            <Link href={`/nms/${system.id}/logs`}>
              <FileText className="w-4 h-4 mr-1" />
              Logs
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild data-testid={`button-analysis-${system.id}`}>
            <Link href={`/nms/${system.id}/analysis`}>
              <BarChart3 className="w-4 h-4 mr-1" />
              Analysis
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(system)} data-testid={`button-edit-${system.id}`}>
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} data-testid={`button-delete-${system.id}`}>
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
