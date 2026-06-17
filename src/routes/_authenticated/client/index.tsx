import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, SERVICES } from "@/lib/services";
import { ArrowRight, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/")({
  component: ClientHome,
});

interface Project {
  id: string; title: string; service: string; status: string;
  location: string | null; created_at: string;
}

function ClientHome() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("projects").select("id,title,service,status,location,created_at")
        .eq("client_id", u.user.id).order("created_at", { ascending: false });
      setProjects((data ?? []) as Project[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">My projects</h1>
          <p className="text-muted-foreground mt-1">Track requests, view inspections and approve quotations.</p>
        </div>
        <Button asChild><Link to="/client/new"><Plus className="h-4 w-4 mr-1" />New request</Link></Button>
      </div>

      <div className="mt-8">
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> :
         projects.length === 0 ? (
          <div className="rounded-xl border bg-card p-10 text-center">
            <p className="text-muted-foreground">No projects yet.</p>
            <Button asChild className="mt-4"><Link to="/client/new"><Plus className="h-4 w-4 mr-1" />Submit your first request</Link></Button>
          </div>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {projects.map((p) => {
              const svc = SERVICES.find((s) => s.key === p.service);
              return (
                <li key={p.id}>
                  <Link to="/client/$projectId" params={{ projectId: p.id }} className="flex items-center justify-between gap-4 p-5 hover:bg-accent/50 transition">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">{svc?.label ?? p.service}</span>
                        <span className="text-xs rounded-full bg-foreground/5 px-2 py-0.5">{STATUS_LABEL[p.status] ?? p.status}</span>
                      </div>
                      <div className="mt-1 font-medium truncate">{p.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.location ?? "—"}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
