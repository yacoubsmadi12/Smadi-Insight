import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiCall } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function EmployeesPage() {
  const [search, setSearch] = useState("");

  const { data: employees } = useQuery({
    queryKey: ["/api/employees", search],
    queryFn: async () => {
      const res = await apiCall(`/api/employees?search=${search}`);
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
              <h2 className="text-2xl font-bold text-foreground">Employees</h2>
              <p className="text-sm text-muted-foreground">Manage your team members</p>
            </div>
            <Button>
              <i className="fas fa-plus mr-2"></i>
              Add Employee
            </Button>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <Input
              type="search"
              placeholder="Search employees..."
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
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employees?.map((employee: any) => (
                  <tr key={employee.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground">
                          {employee.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{employee.name}</p>
                          <p className="text-xs text-muted-foreground">{employee.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">{employee.role}</td>
                    <td className="px-6 py-4 text-sm text-foreground">{employee.department}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/employees/${employee.id}`}>
                        <a className="text-primary hover:underline text-sm">View</a>
                      </Link>
                    </td>
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
