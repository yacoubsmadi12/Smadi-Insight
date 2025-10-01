import { Redirect } from "wouter";
import { isAuthenticated } from "@/lib/auth";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}
