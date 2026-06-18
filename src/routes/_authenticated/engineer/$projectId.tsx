import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SERVICES, STATUS_LABEL } from "@/lib/services";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ClipboardCheck,
  FileText,
  ClipboardList,
  GitCompare,
  MessageSquare,
  MessageCircle,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import WhatsAppButton from "@/components/WhatsAppButton";

export const Route = createFileRoute("/_authenticated/engineer/$projectId")({
  component: EngineerProjectHub,
});

interface Project {
  id: string;
  title: string;
  service: string;
  status: string;
  description: string | null;
  location: string | null;
  engineer_id: string | null;
  client_id: string;
  scheduled_date: string | null;
  image_urls: string[];
}

function EngineerProjectHub() {
  const { projectId } = Route.useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
    setProject(data as Project | null);
    setLoading(false);
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  async function claim() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user || !project) return;
    await supabase.from("projects").update({ engineer_id: u.user.id }).eq("id", project.id);
    toast.success("Assigned to you");
    load();
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!project) return <div className="p-8 text-sm">Project not found.</div>;

  const svc = SERVICES.find((s) => s.key === project.service);
  const waText = `FusionPro engineer here regarding "${project.title}" (Ref ${project.id.slice(0, 8)}). `;

  async function logWa() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("whatsapp_logs").insert({
      sender_id: u.user.id,
      project_id: project!.id,
      body: waText,
    });
  }

  const tools: Array<{
    to: "/engineer/$projectId/inspection" | "/engineer/$projectId/quotation" | "/engineer/$projectId/worksheet" | "/engineer/$projectId/compare" | "/engineer/$projectId/messages";
    title: string;
    desc: string;
    icon: typeof FileText;
  }> = [
    { to: "/engineer/$projectId/inspection", title: "Inspection report", desc: "Checklist, photos, sign-off.", icon: ClipboardCheck },
    { to: "/engineer/$projectId/quotation", title: "Quotation", desc: "Bill-to, line items, totals & bank details.", icon: FileText },
    { to: "/engineer/$projectId/worksheet", title: "Job worksheet", desc: "Document 2 — site observations & sign-off.", icon: ClipboardList },
    { to: "/engineer/$projectId/compare", title: "Quoted vs Actual", desc: "Compare estimated vs actual costs.", icon: GitCompare },
    { to: "/engineer/$projectId/messages", title: "Communication", desc: "Internal messages & WhatsApp log.", icon: MessageSquare },
  ];

  return (
    <div className="p-4 md:p-8 fade-in max-w-5xl mx-auto">
      <Link to="/engineer" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" />Back to projects
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {svc?.label} · {STATUS_LABEL[project.status] ?? project.status}
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-1 truncate">{project.title}</h1>
          <p className="text-muted-foreground mt-1">{project.location ?? "—"}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!project.engineer_id && <Button size="sm" onClick={claim}>Assign to me</Button>}
          <WhatsAppButton
            projectId={project.id}
            recipientRole="client"
            messageType="custom"
            customMessage={waText}
            className=""
          />
        </div>
      </div>

      {project.description && <p className="mt-5 text-sm leading-relaxed">{project.description}</p>}

      {project.image_urls?.length > 0 && (
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2">
          {project.image_urls.map((u, i) => (
            <a key={i} href={u} target="_blank" rel="noreferrer">
              <img src={u} className="rounded border h-28 w-full object-cover" alt={`Attachment ${i + 1}`} />
            </a>
          ))}
        </div>
      )}

      <h2 className="mt-10 text-lg font-semibold tracking-tight">Forms & tools</h2>
      <p className="text-sm text-muted-foreground">Each form opens in its own page so you have room to work.</p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {tools.map((t) => (
          <li key={t.to}>
            <Link
              to={t.to}
              params={{ projectId: project.id }}
              className="flex items-start gap-3 rounded-xl border bg-card p-5 hover:border-foreground/40 hover:shadow-sm transition"
            >
              <div className="grid h-10 w-10 place-items-center rounded-md bg-foreground/5 shrink-0">
                <t.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{t.title}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{t.desc}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground mt-1" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Outlet />
      </div>
    </div>
  );
}
