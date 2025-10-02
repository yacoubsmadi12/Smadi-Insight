import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiCall } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Code2, Zap, Terminal } from "lucide-react";
import type { Log } from "@shared/schema";

export default function IntegrationPage() {
  const [realtimeLogs, setRealtimeLogs] = useState<Log[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const { data: initialLogs } = useQuery({
    queryKey: ["/api/logs"],
    queryFn: async () => {
      const res = await apiCall("/api/logs");
      return res.json();
    },
  });

  useEffect(() => {
    if (initialLogs) {
      setRealtimeLogs(initialLogs.slice(0, 20));
    }
  }, [initialLogs]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('WebSocket connected');
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'new_log') {
          setRealtimeLogs((prev) => [message.data, ...prev].slice(0, 20));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, []);

  const apiEndpoint = `${window.location.protocol}//${window.location.host}/api/logs`;

  const exampleJson = {
    employeeId: "123",
    timestamp: new Date().toISOString(),
    source: "firewall01",
    action: "login_failed",
    details: "Invalid password from 192.168.1.5"
  };

  const pythonCode = `import requests
import json
from datetime import datetime

url = "${apiEndpoint}"

log = {
    "employeeId": "123",
    "timestamp": datetime.utcnow().isoformat() + "Z",
    "source": "server01",
    "action": "cpu_high",
    "details": "CPU usage exceeded 90%"
}

response = requests.post(url, json=log)
print(response.json())`;

  const nodeCode = `const axios = require('axios');

const url = '${apiEndpoint}';

const log = {
  employeeId: '123',
  timestamp: new Date().toISOString(),
  source: 'server01',
  action: 'cpu_high',
  details: 'CPU usage exceeded 90%'
};

axios.post(url, log)
  .then(response => console.log(response.data))
  .catch(error => console.error(error));`;

  const curlCode = `curl -X POST ${apiEndpoint} \\
  -H "Content-Type: application/json" \\
  -d '{
    "employeeId": "123",
    "timestamp": "${new Date().toISOString()}",
    "source": "firewall01",
    "action": "login_failed",
    "details": "Invalid password from 192.168.1.5"
  }'`;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Integration</h1>
              <p className="text-muted-foreground mt-1">
                Send logs in real-time from your devices and servers
              </p>
            </div>
            <Badge variant="secondary" className="flex items-center gap-2" data-testid="badge-ws-status">
              <div className={`w-2 h-2 rounded-full ${ws?.readyState === WebSocket.OPEN ? 'bg-green-500' : 'bg-red-500'}`}></div>
              {ws?.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>

          <Tabs defaultValue="documentation" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="documentation" data-testid="tab-documentation">
                <Code2 className="w-4 h-4 mr-2" />
                API Documentation
              </TabsTrigger>
              <TabsTrigger value="realtime" data-testid="tab-realtime">
                <Zap className="w-4 h-4 mr-2" />
                Real-time Logs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documentation" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>API Endpoint</CardTitle>
                  <CardDescription>Send logs directly to this endpoint</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-4 rounded-lg font-mono text-sm" data-testid="text-api-endpoint">
                    POST {apiEndpoint}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Request Body</CardTitle>
                  <CardDescription>JSON format with the following fields</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="text-example-json">
                    <code>{JSON.stringify(exampleJson, null, 2)}</code>
                  </pre>
                  <div className="mt-4 space-y-2 text-sm">
                    <div><strong>employeeId:</strong> Employee identifier (required)</div>
                    <div><strong>timestamp:</strong> ISO 8601 datetime (required)</div>
                    <div><strong>source:</strong> Source system name (required)</div>
                    <div><strong>action:</strong> Action type (required)</div>
                    <div><strong>details:</strong> Additional details (optional)</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    <Terminal className="w-5 h-5 inline mr-2" />
                    Code Examples
                  </CardTitle>
                  <CardDescription>Sample code for different programming languages</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="python" className="w-full">
                    <TabsList>
                      <TabsTrigger value="python" data-testid="tab-python">Python</TabsTrigger>
                      <TabsTrigger value="nodejs" data-testid="tab-nodejs">Node.js</TabsTrigger>
                      <TabsTrigger value="curl" data-testid="tab-curl">cURL</TabsTrigger>
                    </TabsList>
                    <TabsContent value="python">
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-python">
                        <code>{pythonCode}</code>
                      </pre>
                    </TabsContent>
                    <TabsContent value="nodejs">
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-nodejs">
                        <code>{nodeCode}</code>
                      </pre>
                    </TabsContent>
                    <TabsContent value="curl">
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-curl">
                        <code>{curlCode}</code>
                      </pre>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="realtime" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Real-time Logs Stream</CardTitle>
                  <CardDescription>
                    Logs automatically update when new data is received via the API
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr className="text-left">
                          <th className="pb-3 font-medium">Timestamp</th>
                          <th className="pb-3 font-medium">Employee ID</th>
                          <th className="pb-3 font-medium">Source</th>
                          <th className="pb-3 font-medium">Action</th>
                          <th className="pb-3 font-medium">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {realtimeLogs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-muted-foreground" data-testid="text-no-logs">
                              No logs yet. Send logs via the API to see them here in real-time.
                            </td>
                          </tr>
                        ) : (
                          realtimeLogs.map((log, index) => (
                            <tr key={log.id} className="border-b last:border-0" data-testid={`row-log-${index}`}>
                              <td className="py-3" data-testid={`text-timestamp-${index}`}>
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td className="py-3" data-testid={`text-employeeId-${index}`}>
                                {log.employeeId}
                              </td>
                              <td className="py-3" data-testid={`text-source-${index}`}>
                                <Badge variant="outline">{log.source}</Badge>
                              </td>
                              <td className="py-3" data-testid={`text-action-${index}`}>
                                <Badge>{log.action}</Badge>
                              </td>
                              <td className="py-3 text-muted-foreground" data-testid={`text-details-${index}`}>
                                {log.details || '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
