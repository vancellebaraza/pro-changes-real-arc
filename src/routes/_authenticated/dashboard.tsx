import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMyRoles } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardRedirect,
});

function DashboardRedirect() {
  const { primaryRole, loading } = useMyRoles();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (primaryRole === "admin") navigate({ to: "/admin", replace: true });
    else if (primaryRole === "engineer") navigate({ to: "/engineer", replace: true });
    else navigate({ to: "/client", replace: true });
  }, [primaryRole, loading, navigate]);
  return <div className="p-8 text-sm text-muted-foreground">Redirecting…</div>;
}
