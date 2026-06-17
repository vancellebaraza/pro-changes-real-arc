import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, SERVICES } from "@/lib/services";
import { toast } from "sonner";
import { ArrowLeft, FileDown, MessageCircle, Check, X } from "lucide-react";
import { generateQuotationPdf } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/client/$projectId")({
  component: ProjectDetail,
});

interface Project { id: string; title: string; service: string; status: string; description: string | null; location: string | null; image_urls: string[]; client_id: string; engineer_id: string | null; }
interface Quotation { id: string; vat_rate: number; subtotal: number; vat_amount: number; grand_total: number; status: string; notes: string | null; created_at: string; }
interface Item { id: string; description: string; qty: number; unit_cost: number; amount: number; sort_order: number; }
interface Inspection { id: string; stage: string; checklist: Array<{ item: string; pass: boolean; remark?: string }>; remarks: string | null; created_at: string; }

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: p } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
    setProject(p as Project | null);
    const { data: q } = await supabase.from("quotations").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).maybeSingle();
    setQuote(q as Quotation | null);
    if (q) {
      const { data: it } = await supabase.from("quotation_items").select("*").eq("quotation_id", q.id).order("sort_order");
      setItems((it ?? []) as Item[]);
    }
    const { data: ins } = await supabase.from("inspections").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
    setInspections((ins ?? []) as unknown as Inspection[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function decide(status: "approved" | "rejected") {
    if (!quote) return;
    const { error } = await supabase.from("quotations").update({ status }).eq("id", quote.id);
    if (error) return toast.error(error.message);
    if (project) {
      await supabase.from("projects").update({ status: status === "approved" ? "approved" : "rejected" }).eq("id", project.id);
    }
    toast.success(`Quotation ${status}`);
    load();
  }

  function downloadPdf() {
    if (!quote || !project) return;
    generateQuotationPdf({
      projectTitle: project.title,
      service: SERVICES.find((s) => s.key === project.service)?.label ?? project.service,
      location: project.location,
      quoteId: quote.id,
      date: new Date(quote.created_at).toLocaleDateString(),
      items, vatRate: quote.vat_rate, subtotal: quote.subtotal, vatAmount: quote.vat_amount, grandTotal: quote.grand_total, notes: quote.notes,
    });
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!project) return <div className="p-8 text-sm">Project not found.</div>;
  const svc = SERVICES.find((s) => s.key === project.service);
  const waMsg = encodeURIComponent(`FusionPro — Project: ${project.title} (${STATUS_LABEL[project.status] ?? project.status}). Reference: ${project.id.slice(0,8)}`);

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto fade-in">
      <Link to="/client" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
      <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <span>{svc?.label}</span>·<span>{STATUS_LABEL[project.status] ?? project.status}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-1">{project.title}</h1>
          <p className="text-muted-foreground mt-1">{project.location}</p>
        </div>
        <a href={`https://wa.me/?text=${waMsg}`} target="_blank" rel="noreferrer">
          <Button variant="outline"><MessageCircle className="h-4 w-4 mr-1" />WhatsApp</Button>
        </a>
      </div>

      {project.description && <p className="mt-6 text-sm leading-relaxed">{project.description}</p>}

      {project.image_urls.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {project.image_urls.map((u, i) => (
            <a key={i} href={u} target="_blank" rel="noreferrer" className="block rounded-md overflow-hidden border bg-card">
              <img src={u} alt={`attachment ${i+1}`} className="w-full h-40 object-cover" />
            </a>
          ))}
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Inspection reports</h2>
        {inspections.length === 0 ? <p className="text-sm text-muted-foreground mt-2">No inspections yet.</p> : (
          <ul className="mt-3 space-y-3">
            {inspections.map((ins) => (
              <li key={ins.id} className="rounded-lg border bg-card p-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium capitalize">{ins.stage} inspection</span>
                  <span className="text-muted-foreground">{new Date(ins.created_at).toLocaleDateString()}</span>
                </div>
                {Array.isArray(ins.checklist) && ins.checklist.length > 0 && (
                  <ul className="mt-3 text-sm space-y-1">
                    {ins.checklist.map((c, i) => (
                      <li key={i} className="flex items-center gap-2"><span className={c.pass ? "text-green-700" : "text-destructive"}>{c.pass ? "✓" : "✕"}</span>{c.item}{c.remark && <span className="text-muted-foreground"> — {c.remark}</span>}</li>
                    ))}
                  </ul>
                )}
                {ins.remarks && <p className="mt-2 text-sm text-muted-foreground">{ins.remarks}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Quotation</h2>
          {quote && <Button variant="outline" size="sm" onClick={downloadPdf}><FileDown className="h-4 w-4 mr-1" />Download PDF</Button>}
        </div>
        {!quote ? <p className="text-sm text-muted-foreground mt-2">No quotation yet.</p> : (
          <div className="mt-3 rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left">
                <tr><th className="p-3">Description</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Unit</th><th className="p-3 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t"><td className="p-3">{it.description}</td><td className="p-3 text-right">{it.qty}</td><td className="p-3 text-right">{Number(it.unit_cost).toFixed(2)}</td><td className="p-3 text-right">{Number(it.amount).toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="border-t p-4 text-sm space-y-1 flex flex-col items-end">
              <div>Subtotal: <strong>{Number(quote.subtotal).toFixed(2)}</strong></div>
              <div>VAT ({quote.vat_rate}%): <strong>{Number(quote.vat_amount).toFixed(2)}</strong></div>
              <div className="text-base">Grand total: <strong>{Number(quote.grand_total).toFixed(2)}</strong></div>
            </div>
            {quote.status === "sent" && (
              <div className="border-t p-4 flex gap-2 justify-end">
                <Button variant="outline" onClick={() => decide("rejected")}><X className="h-4 w-4 mr-1" />Reject</Button>
                <Button onClick={() => decide("approved")}><Check className="h-4 w-4 mr-1" />Approve</Button>
              </div>
            )}
            {quote.status !== "sent" && <div className="border-t p-3 text-xs text-muted-foreground text-right capitalize">Status: {quote.status}</div>}
          </div>
        )}
      </section>
    </div>
  );
}
