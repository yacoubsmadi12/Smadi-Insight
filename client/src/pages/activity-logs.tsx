import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiCall } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";

export default function ActivityLogsPage() {
  const [search, setSearch] = useState("");

  const { data: logs } = useQuery({
    queryKey: ["/api/logs", search],
    queryFn: async () => {
      const res = await apiCall("/api/logs");
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Activity Logs</h2>
            <p className="text-sm text-muted-foreground">
              View and search through all system activities
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <Input
              type="search"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-sm">
                {logs?.map((log: any) => (
                  <tr key={log.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-foreground">{log.source}</td>
                    <td className="px-6 py-4 text-foreground">{log.action}</td>
                    <td className="px-6 py-4 text-muted-foreground">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
