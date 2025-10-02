import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiCall } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTemplateSchema, type Template } from "@shared/schema";
import { z } from "zod";
import { Plus, Edit, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const templateFormSchema = insertTemplateSchema.extend({
  employeeIds: z.array(z.string()).default([]),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;

export default function TemplatesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const { toast } = useToast();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await apiCall("/api/templates");
      return res.json();
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await apiCall("/api/employees");
      return res.json();
    },
  });

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      role: "",
      jobDescription: "",
      policies: "",
      employeeIds: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      const res = await apiCall("/api/templates", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Template created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TemplateFormValues> }) => {
      const res = await apiCall(`/api/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      form.reset();
      toast({ title: "Template updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiCall(`/api/templates/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: TemplateFormValues) => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    form.reset({
      name: template.name,
      role: template.role,
      jobDescription: template.jobDescription || "",
      policies: template.policies || "",
      employeeIds: template.employeeIds as string[],
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this template?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
    form.reset();
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Templates</h1>
              <p className="text-muted-foreground mt-1">
                Create and manage employee templates with predefined roles and policies
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleDialogClose()} data-testid="button-add-template">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingTemplate ? "Edit Template" : "Add New Template"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Senior Developer" {...field} data-testid="input-template-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Software Developer" {...field} data-testid="input-role" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="jobDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter job description..."
                              value={field.value || ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              name={field.name}
                              rows={4}
                              data-testid="textarea-job-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="policies"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Policies</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter policies and rules..."
                              value={field.value || ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              name={field.name}
                              rows={4}
                              data-testid="textarea-policies"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="employeeIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assign Employees</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value?.[0] || ""}
                              onValueChange={(value) => {
                                const currentIds = field.value || [];
                                if (value && !currentIds.includes(value)) {
                                  field.onChange([...currentIds, value]);
                                }
                              }}
                            >
                              <SelectTrigger data-testid="select-employees">
                                <SelectValue placeholder="Select employees to assign" />
                              </SelectTrigger>
                              <SelectContent>
                                {employees?.map((emp: any) => (
                                  <SelectItem key={emp.id} value={emp.id}>
                                    {emp.name} - {emp.email}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {field.value?.map((empId) => {
                              const emp = employees?.find((e: any) => e.id === empId);
                              return emp ? (
                                <Badge key={empId} variant="secondary" className="flex items-center gap-1">
                                  {emp.name}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      field.onChange(field.value.filter(id => id !== empId));
                                    }}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    ×
                                  </button>
                                </Badge>
                              ) : null;
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={handleDialogClose} data-testid="button-cancel">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit">
                        {editingTemplate ? "Update Template" : "Create Template"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="text-center py-12">Loading templates...</div>
          ) : templates?.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground" data-testid="text-no-templates">
                  No templates yet. Create your first template to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates?.map((template: Template) => (
                <Card key={template.id} data-testid={`card-template-${template.id}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{template.name}</span>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(template)}
                          data-testid={`button-edit-${template.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(template.id)}
                          data-testid={`button-delete-${template.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Role</p>
                      <p className="text-sm">{template.role}</p>
                    </div>
                    {template.jobDescription && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Job Description</p>
                        <p className="text-sm line-clamp-3">{template.jobDescription}</p>
                      </div>
                    )}
                    {template.policies && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Policies</p>
                        <p className="text-sm line-clamp-2">{template.policies}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        Assigned Employees
                      </p>
                      <p className="text-sm">
                        {(template.employeeIds as string[]).length} employee(s)
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
