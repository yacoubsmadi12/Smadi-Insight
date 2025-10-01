import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiCall } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";
import { useState } from "react";

export default function EmployeeDetailPage() {
  const params = useParams();
  const employeeId = params.id;
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState("last-30-days");

  const { data: employee } = useQuery({
    queryKey: ["/api/employees", employeeId],
    queryFn: async () => {
      const res = await apiCall(`/api/employees/${employeeId}`);
      return res.json();
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiCall("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          dateRange,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Report Generated",
        description: "AI-powered report has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
    },
    onError: (error: any) => {
      toast({
        title: "Report Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Employee Details</h2>
            <Button
              onClick={() => generateReportMutation.mutate()}
              disabled={generateReportMutation.isPending}
              data-testid="button-generate-report"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {generateReportMutation.isPending ? "Generating..." : "Generate AI Report"}
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start space-x-6">
                <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-3xl font-bold">
                  {employee?.name?.charAt(0)}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-foreground">{employee?.name}</h2>
                  <p className="text-muted-foreground">{employee?.email}</p>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Role</p>
                      <p className="text-sm font-medium text-foreground">{employee?.role}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Department</p>
                      <p className="text-sm font-medium text-foreground">{employee?.department}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Status</p>
                      <p className="text-sm font-medium text-foreground">{employee?.status}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {employee?.jobDescription && (
            <Card>
              <CardHeader>
                <CardTitle>Job Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {employee.jobDescription}
                </p>
              </CardContent>
            </Card>
          )}

          {employee?.rules && (
            <Card>
              <CardHeader>
                <CardTitle>Rules & Policies</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {employee.rules}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
