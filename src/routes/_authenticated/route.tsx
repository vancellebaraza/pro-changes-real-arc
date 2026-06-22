import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles, signOutClean } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, ClipboardPlus, Wrench, ShieldCheck, Menu } from "lucide-react";
import { useState } from "react";
import { AIAssistant } from "@/components/AIAssistant";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { primaryRole, loading } = useMyRoles();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const links =
    primaryRole === "admin"
      ? [{ to: "/admin", label: "Admin", icon: ShieldCheck }, { to: "/engineer", label: "Engineer view", icon: Wrench }, { to: "/client", label: "Client view", icon: ClipboardPlus }]
      : primaryRole === "engineer"
        ? [{ to: "/engineer", label: "Engineer", icon: Wrench }]
        : [{ to: "/client", label: "My projects", icon: LayoutDashboard }, { to: "/client/new", label: "New request", icon: ClipboardPlus }];

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* ── Sidebar ── */}
      <aside
        className="hidden md:flex w-60 shrink-0 flex-col border-r"
        style={{ background: "var(--color-sidebar)" }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b">
          <Link to="/">
            <Logo className="h-7 w-auto" />
          </Link>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-0.5">
          {links.map((l) => {
            const active = pathname === l.to || pathname.startsWith(l.to + "/");
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all ${
                  active
                    ? "bg-primary text-primary-foreground font-medium shadow-sm shadow-primary/30"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <l.icon className="h-4 w-4 shrink-0" />
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-destructive transition-colors"
            onClick={() => signOutClean(navigate)}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden h-14 border-b flex items-center justify-between px-4 bg-sidebar">
          <Logo className="h-6 w-auto" />
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => setMobileNavOpen((v) => !v)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            {mobileNavOpen && (
              <div className="absolute right-0 top-12 z-40 w-56 rounded-md border bg-popover shadow-lg p-2">
                {links.map((l) => {
                  const active = pathname === l.to || pathname.startsWith(l.to + "/");
                  return (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={() => setMobileNavOpen(false)}
                      className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition ${
                        active ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground"
                      }`}
                    >
                      <l.icon className="h-4 w-4" />
                      {l.label}
                    </Link>
                  );
                })}
                <button
                  onClick={() => { setMobileNavOpen(false); signOutClean(navigate); }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent text-muted-foreground hover:text-destructive transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 min-w-0">
          {loading ? (
            <div className="p-8 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      <AIAssistant />
    </div>
  );
}
