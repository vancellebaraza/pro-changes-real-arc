import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STATUS_LABEL, SERVICES } from "@/lib/services";
import { downloadCsv } from "@/lib/pdf";
import { toast } from "sonner";
import { FileDown, Check, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

interface Row {
  id: string; title: string; service: string; status: string; location: string|null;
  client_id: string; engineer_id: string|null; scheduled_date: string|null; created_at: string;
}

function AdminHome() {
  const [rows, setRows] = useState<Row[]>([]);
  const [pendingQuotes, setPendingQuotes] = useState<Array<{id:string;project_id:string;grand_total:number;status:string;project:{title:string}}>>([]);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("projects").select("*").order("created_at",{ascending:false});
    setRows((data ?? []) as Row[]);
    const { data: q } = await supabase.from("quotations").select("id,project_id,grand_total,status, project:projects(title)").eq("status","sent");
    setPendingQuotes((q ?? []) as Array<{id:string;project_id:string;grand_total:number;status:string;project:{title:string}}>);
  }, []);
  useEffect(()=>{ load(); }, [load]);

  async function approveQuote(qid: string, pid: string) {
    await supabase.from("quotations").update({ status: "approved" }).eq("id", qid);
    await supabase.from("projects").update({ status: "approved" }).eq("id", pid);
    toast.success("Quotation approved");
    load();
  }

  async function schedule(p: Row) {
    const date = prompt("Schedule date (YYYY-MM-DD)", p.scheduled_date ?? "");
    if (!date) return;
    await supabase.from("projects").update({ scheduled_date: date, status: "scheduled" }).eq("id", p.id);
    toast.success("Scheduled");
    load();
  }

  function exportSheet() {
    const data = rows.map((r)=>({
      id: r.id.slice(0,8), title: r.title, service: r.service, status: r.status,
      location: r.location ?? "", scheduled_date: r.scheduled_date ?? "", created_at: r.created_at,
    }));
    downloadCsv(`fusionpro-work-data-sheet-${Date.now()}.csv`, data);
  }

  const filtered = rows.filter((r)=>!filter || r.title.toLowerCase().includes(filter.toLowerCase()) || r.service.includes(filter.toLowerCase()));

  return (
    <div className="p-4 md:p-8 fade-in">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Admin overview</h1>
          <p className="text-muted-foreground mt-1">Approve quotations, schedule work, export reports.</p>
        </div>
        <Button variant="outline" onClick={exportSheet}><FileDown className="h-4 w-4 mr-1"/>Export Work Data Sheet (CSV)</Button>
      </div>

      <div className="mt-6 grid md:grid-cols-3 gap-4">
        {[
          { label: "Total projects", value: rows.length },
          { label: "In progress", value: rows.filter(r=>r.status==="in_progress" || r.status==="scheduled").length },
          { label: "Pending quotes", value: pendingQuotes.length },
        ].map(s=>(
          <div key={s.label} className="rounded-xl border bg-card p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-3xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      {pendingQuotes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">Quotations pending approval</h2>
          <ul className="mt-3 rounded-xl border bg-card divide-y">
            {pendingQuotes.map(q=>(
              <li key={q.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">{q.project?.title ?? "—"}</div>
                  <div className="text-sm text-muted-foreground">Total: {Number(q.grand_total).toFixed(2)}</div>
                </div>
                <Button size="sm" onClick={()=>approveQuote(q.id, q.project_id)}><Check className="h-4 w-4 mr-1"/>Approve</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-lg font-semibold tracking-tight">Work Data Sheet</h2>
          <Input placeholder="Filter…" value={filter} onChange={(e)=>setFilter(e.target.value)} className="max-w-xs" />
        </div>
        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left">
              <tr><th className="p-3">Title</th><th className="p-3">Service</th><th className="p-3">Status</th><th className="p-3">Location</th><th className="p-3">Scheduled</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(r=>(
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">{r.title}</td>
                  <td className="p-3">{SERVICES.find(s=>s.key===r.service)?.label ?? r.service}</td>
                  <td className="p-3">{STATUS_LABEL[r.status] ?? r.status}</td>
                  <td className="p-3 text-muted-foreground">{r.location ?? "—"}</td>
                  <td className="p-3">{r.scheduled_date ?? "—"}</td>
                  <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={()=>schedule(r)}><Calendar className="h-4 w-4 mr-1"/>Schedule</Button></td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">No projects.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
