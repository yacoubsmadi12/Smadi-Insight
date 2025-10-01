import { useQuery } from "@tanstack/react-query";
import { apiCall } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  const { data: reports } = useQuery({
    queryKey: ["/api/reports"],
    queryFn: async () => {
      const res = await apiCall("/api/reports");
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">AI-Powered Reports</h2>
              <p className="text-sm text-muted-foreground">
                View and analyze generated insights
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {reports?.map((report: any) => (
              <Card key={report.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{report.reportType}</span>
                    <span className="text-xs text-muted-foreground">{report.dateRange}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted/50 rounded-md p-4">
                    <h4 className="text-sm font-medium text-foreground mb-2">Summary</h4>
                    <p className="text-sm text-muted-foreground">{report.summary}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">
                        {report.metrics?.totalActions || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Actions</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-600">
                        {report.metrics?.riskCount || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Risks</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-destructive">
                        {report.metrics?.violationCount || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Violations</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
