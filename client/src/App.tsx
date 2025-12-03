import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import EmployeesPage from "@/pages/employees";
import EmployeeDetailPage from "@/pages/employee-detail";
import ActivityLogsPage from "@/pages/activity-logs";
import IntegrationPage from "@/pages/integration";
import SettingsPage from "@/pages/settings";
import NmsSystemsPage from "@/pages/nms-systems";
import NmsSystemDetailPage from "@/pages/nms-system-detail";
import NmsLogsPage from "@/pages/nms-logs";
import NmsAnalysisPage from "@/pages/nms-analysis";
import AnalysisReportsPage from "@/pages/analysis-reports";
import EmailSettingsPage from "@/pages/email-settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      </Route>
      <Route path="/employees" component={() => (
        <ProtectedRoute>
          <EmployeesPage />
        </ProtectedRoute>
      )} />
      <Route path="/employees/:id" component={() => (
        <ProtectedRoute>
          <EmployeeDetailPage />
        </ProtectedRoute>
      )} />
      <Route path="/activity">
        <ProtectedRoute>
          <ActivityLogsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/integration">
        <ProtectedRoute>
          <IntegrationPage />
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/nms-systems">
        <ProtectedRoute>
          <NmsSystemsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/nms/:id">
        <ProtectedRoute>
          <NmsSystemDetailPage />
        </ProtectedRoute>
      </Route>
      <Route path="/nms/:id/analysis">
        <ProtectedRoute>
          <NmsAnalysisPage />
        </ProtectedRoute>
      </Route>
      <Route path="/nms-logs">
        <ProtectedRoute>
          <NmsLogsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/analysis-reports">
        <ProtectedRoute>
          <AnalysisReportsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/email-settings">
        <ProtectedRoute>
          <EmailSettingsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/">
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
