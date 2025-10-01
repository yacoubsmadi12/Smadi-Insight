import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiCall } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EmployeeDetailPage() {
  const params = useParams();
  const employeeId = params.id;

  const { data: employee } = useQuery({
    queryKey: ["/api/employees", employeeId],
    queryFn: async () => {
      const res = await apiCall(`/api/employees/${employeeId}`);
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <div className="p-6 space-y-6">
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
