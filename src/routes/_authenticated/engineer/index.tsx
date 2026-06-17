import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SERVICES, STATUS_LABEL } from "@/lib/services";
import { toast } from "sonner";
import { Plus, Trash2, FileDown, MessageCircle, Save } from "lucide-react";
import { generateQuotationPdf, generateInspectionPdf } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/engineer/")({
  component: EngineerHome,
});

interface Project { id: string; title: string; service: string; status: string; description: string | null; location: string | null; client_id: string; engineer_id: string | null; created_at: string; image_urls: string[]; }
interface QItem { description: string; qty: number; unit_cost: number; amount: number; actual_cost?: number | null; id?: string }

function EngineerHome() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    setProjects((data ?? []) as Project[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function claim(p: Project) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("projects").update({ engineer_id: u.user.id }).eq("id", p.id);
    toast.success("Project assigned to you");
    load();
  }

  return (
    <div className="p-4 md:p-8 fade-in">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Engineer dashboard</h1>
          <p className="text-muted-foreground mt-1">Quote, inspect, schedule and communicate.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-[320px_1fr] gap-6">
        <aside className="rounded-xl border bg-card overflow-hidden max-h-[80vh] flex flex-col">
          <div className="px-4 py-3 border-b text-xs uppercase tracking-wider text-muted-foreground">Projects</div>
          {loading ? <div className="p-4 text-sm text-muted-foreground">Loading…</div> :
           projects.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No projects.</div> : (
            <ul className="overflow-y-auto divide-y">
              {projects.map((p) => (
                <li key={p.id}>
                  <button onClick={() => setSelected(p)} className={`w-full text-left p-4 hover:bg-accent transition ${selected?.id===p.id?"bg-accent":""}`}>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">{SERVICES.find((s)=>s.key===p.service)?.label} · {STATUS_LABEL[p.status]}</div>
                    <div className="mt-0.5 font-medium truncate">{p.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.location}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="min-w-0">
          {!selected ? <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">Select a project to begin.</div> :
            <ProjectWorkspace project={selected} onChange={() => { load(); }} onClaim={() => claim(selected)} />}
        </section>
      </div>
    </div>
  );
}

function ProjectWorkspace({ project, onChange, onClaim }: { project: Project; onChange: () => void; onClaim: () => void }) {
  const svc = SERVICES.find((s)=>s.key===project.service);
  const waMsg = encodeURIComponent(`FusionPro engineer here regarding "${project.title}" (Ref ${project.id.slice(0,8)}). `);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{svc?.label} · {STATUS_LABEL[project.status]}</div>
          <h2 className="text-xl font-semibold tracking-tight mt-1 truncate">{project.title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{project.location}</p>
        </div>
        <div className="flex gap-2">
          {!project.engineer_id && <Button size="sm" onClick={onClaim}>Assign to me</Button>}
          <a href={`https://wa.me/?text=${waMsg}`} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><MessageCircle className="h-4 w-4 mr-1" />WhatsApp</Button></a>
        </div>
      </div>

      {project.description && <p className="mt-4 text-sm">{project.description}</p>}
      {project.image_urls.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {project.image_urls.map((u,i)=>(<a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} className="rounded border h-32 w-full object-cover" alt={`img ${i}`}/></a>))}
        </div>
      )}

      <Tabs defaultValue="quote" className="mt-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="quote">Quotation</TabsTrigger>
          <TabsTrigger value="inspect">Inspection</TabsTrigger>
          <TabsTrigger value="compare">Quoted vs Actual</TabsTrigger>
          <TabsTrigger value="work">Work program</TabsTrigger>
          <TabsTrigger value="msg">Communication</TabsTrigger>
        </TabsList>
        <TabsContent value="quote"><QuotationEditor project={project} onSaved={onChange} /></TabsContent>
        <TabsContent value="inspect"><InspectionEditor project={project} onSaved={onChange} /></TabsContent>
        <TabsContent value="compare"><CompareView project={project} /></TabsContent>
        <TabsContent value="work"><WorkProgram project={project} /></TabsContent>
        <TabsContent value="msg"><MessagesPanel project={project} /></TabsContent>
      </Tabs>
    </div>
  );
}

function QuotationEditor({ project, onSaved }: { project: Project; onSaved: () => void }) {
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [items, setItems] = useState<QItem[]>([]);
  const [vatRate, setVatRate] = useState(5);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string>("draft");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: q } = await supabase.from("quotations").select("*").eq("project_id", project.id).order("created_at",{ascending:false}).maybeSingle();
      if (q) {
        setQuoteId(q.id); setVatRate(Number(q.vat_rate)); setNotes(q.notes ?? ""); setStatus(q.status);
        const { data: it } = await supabase.from("quotation_items").select("*").eq("quotation_id", q.id).order("sort_order");
        setItems(((it ?? []) as Array<{ id: string; description: string; qty: number; unit_cost: number; amount: number; actual_cost: number | null }>).map((i) => ({ id: i.id, description: i.description, qty: Number(i.qty), unit_cost: Number(i.unit_cost), amount: Number(i.amount), actual_cost: i.actual_cost == null ? null : Number(i.actual_cost) })));
      } else {
        setItems([{ description: "", qty: 1, unit_cost: 0, amount: 0 }]);
      }
    })();
  }, [project.id]);

  const subtotal = items.reduce((s,i)=>s + (Number(i.qty)*Number(i.unit_cost) || 0), 0);
  const vatAmount = subtotal * (vatRate/100);
  const grand = subtotal + vatAmount;

  function update(idx: number, patch: Partial<QItem>) {
    setItems((arr) => arr.map((it, i) => {
      if (i!==idx) return it;
      const next = { ...it, ...patch };
      next.amount = Number(next.qty) * Number(next.unit_cost) || 0;
      return next;
    }));
  }

  async function save(newStatus?: "draft"|"sent") {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const payload = { project_id: project.id, engineer_id: u.user.id, vat_rate: vatRate, notes, subtotal, vat_amount: vatAmount, grand_total: grand, status: (newStatus ?? status) as "draft" };
      let qid = quoteId;
      if (qid) {
        const { error } = await supabase.from("quotations").update(payload).eq("id", qid);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("quotations").insert(payload).select("id").single();
        if (error) throw error;
        qid = data.id;
        setQuoteId(qid);
      }
      await supabase.from("quotation_items").delete().eq("quotation_id", qid);
      if (items.length) {
        const rows = items.map((it, idx) => ({ quotation_id: qid!, description: it.description, qty: it.qty, unit_cost: it.unit_cost, amount: it.amount, actual_cost: it.actual_cost ?? null, sort_order: idx }));
        const { error } = await supabase.from("quotation_items").insert(rows);
        if (error) throw error;
      }
      if (newStatus) setStatus(newStatus);
      const newProjStatus = (newStatus === "sent" ? "quoted" : project.status === "requested" ? "inspected" : project.status) as "quoted";
      await supabase.from("projects").update({ status: newProjStatus }).eq("id", project.id);
      toast.success(newStatus === "sent" ? "Quotation sent to client" : "Saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  function exportPdf() {
    generateQuotationPdf({
      projectTitle: project.title,
      service: SERVICES.find((s)=>s.key===project.service)?.label ?? project.service,
      location: project.location,
      quoteId: quoteId ?? "DRAFT",
      date: new Date().toLocaleDateString(),
      items, vatRate, subtotal, vatAmount, grandTotal: grand, notes,
    });
  }

  return (
    <div className="mt-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-surface">
            <tr className="text-left">
              <th className="p-2">Description</th><th className="p-2 w-20 text-right">Qty</th><th className="p-2 w-28 text-right">Unit cost</th><th className="p-2 w-28 text-right">Amount</th><th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-t">
                <td className="p-1"><Input value={it.description} onChange={(e)=>update(i,{description:e.target.value})} placeholder="Item" /></td>
                <td className="p-1"><Input type="number" value={it.qty} onChange={(e)=>update(i,{qty:Number(e.target.value)})} className="text-right"/></td>
                <td className="p-1"><Input type="number" step="0.01" value={it.unit_cost} onChange={(e)=>update(i,{unit_cost:Number(e.target.value)})} className="text-right"/></td>
                <td className="p-2 text-right tabular-nums">{it.amount.toFixed(2)}</td>
                <td className="p-1 text-right"><Button type="button" variant="ghost" size="icon" onClick={()=>setItems(arr=>arr.filter((_,j)=>j!==i))}><Trash2 className="h-4 w-4"/></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={()=>setItems(a=>[...a,{description:"",qty:1,unit_cost:0,amount:0}])}><Plus className="h-4 w-4 mr-1"/>Add row</Button>

      <div className="mt-5 grid sm:grid-cols-2 gap-4">
        <div>
          <Label>VAT rate (%)</Label>
          <Input type="number" step="0.1" value={vatRate} onChange={(e)=>setVatRate(Number(e.target.value))}/>
          <Label className="mt-3 block">Notes</Label>
          <Textarea rows={3} value={notes} onChange={(e)=>setNotes(e.target.value)} />
        </div>
        <div className="rounded-lg border bg-surface p-4 text-sm self-start">
          <div className="flex justify-between"><span>Subtotal</span><strong className="tabular-nums">{subtotal.toFixed(2)}</strong></div>
          <div className="flex justify-between mt-1"><span>VAT</span><strong className="tabular-nums">{vatAmount.toFixed(2)}</strong></div>
          <div className="flex justify-between mt-2 text-base"><span>Grand total</span><strong className="tabular-nums">{grand.toFixed(2)}</strong></div>
          <div className="mt-2 text-xs text-muted-foreground">Status: <span className="capitalize">{status}</span></div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 justify-end">
        <Button variant="outline" onClick={exportPdf}><FileDown className="h-4 w-4 mr-1"/>Export PDF</Button>
        <Button variant="outline" disabled={saving} onClick={()=>save()}><Save className="h-4 w-4 mr-1"/>Save draft</Button>
        <Button disabled={saving} onClick={()=>save("sent")}>Send to client</Button>
      </div>
    </div>
  );
}

function InspectionEditor({ project, onSaved }: { project: Project; onSaved: () => void }) {
  const defaultItems = [
    "Site safety verified","Scope matches request","Materials available","Access confirmed","Permits required","Risks documented",
  ];
  const [stage, setStage] = useState("initial");
  const [checklist, setChecklist] = useState(defaultItems.map((item)=>({ item, pass: true, remark: "" })));
  const [remarks, setRemarks] = useState("");
  const [flagged, setFlagged] = useState(false);

  async function save() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("inspections").insert({ project_id: project.id, engineer_id: u.user.id, stage, checklist, remarks, flagged });
    if (error) return toast.error(error.message);
    await supabase.from("projects").update({ status: (project.status === "requested" ? "inspected" : project.status) as "inspected" }).eq("id", project.id);
    toast.success("Inspection saved");
    onSaved();
  }

  function exportPdf() {
    generateInspectionPdf({ projectTitle: project.title, date: new Date().toLocaleDateString(), stage, checklist, remarks });
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Label>Stage</Label>
          <select value={stage} onChange={(e)=>setStage(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="initial">Initial</option><option value="during">During work</option><option value="final">Final</option>
          </select>
        </div>
        <label className="flex items-end gap-2"><input type="checkbox" checked={flagged} onChange={(e)=>setFlagged(e.target.checked)} />Flag issue</label>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left"><tr><th className="p-2">Item</th><th className="p-2 w-32 text-center">Pass/Fail</th><th className="p-2">Remark</th></tr></thead>
          <tbody>
            {checklist.map((c,i)=>(
              <tr key={i} className="border-t">
                <td className="p-1"><Input value={c.item} onChange={(e)=>setChecklist(arr=>arr.map((x,j)=>j===i?{...x,item:e.target.value}:x))}/></td>
                <td className="p-2 text-center"><button type="button" onClick={()=>setChecklist(arr=>arr.map((x,j)=>j===i?{...x,pass:!x.pass}:x))} className={`rounded px-3 py-1 text-xs font-medium ${c.pass?"bg-green-100 text-green-800":"bg-red-100 text-red-800"}`}>{c.pass?"PASS":"FAIL"}</button></td>
                <td className="p-1"><Input value={c.remark} onChange={(e)=>setChecklist(arr=>arr.map((x,j)=>j===i?{...x,remark:e.target.value}:x))}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="sm" onClick={()=>setChecklist(a=>[...a,{item:"",pass:true,remark:""}])}><Plus className="h-4 w-4 mr-1"/>Add item</Button>
      <div><Label>General remarks</Label><Textarea rows={3} value={remarks} onChange={(e)=>setRemarks(e.target.value)}/></div>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={exportPdf}><FileDown className="h-4 w-4 mr-1"/>Export PDF</Button><Button onClick={save}><Save className="h-4 w-4 mr-1"/>Save inspection</Button></div>
    </div>
  );
}

function CompareView({ project }: { project: Project }) {
  const [rows, setRows] = useState<Array<{id:string; description:string; qty:number; unit_cost:number; amount:number; actual_cost:number|null}>>([]);
  useEffect(()=>{
    (async()=>{
      const { data: q } = await supabase.from("quotations").select("id").eq("project_id", project.id).order("created_at",{ascending:false}).maybeSingle();
      if (!q) return;
      const { data } = await supabase.from("quotation_items").select("*").eq("quotation_id", q.id).order("sort_order");
      setRows((data ?? []) as Array<{id:string; description:string; qty:number; unit_cost:number; amount:number; actual_cost:number|null}>);
    })();
  },[project.id]);

  async function updateActual(id: string, v: number) {
    await supabase.from("quotation_items").update({ actual_cost: v }).eq("id", id);
    setRows(arr=>arr.map(r=>r.id===id?{...r,actual_cost:v}:r));
  }

  const totalQ = rows.reduce((s,r)=>s+Number(r.amount),0);
  const totalA = rows.reduce((s,r)=>s+Number(r.actual_cost ?? 0),0);
  const diff = totalA - totalQ;

  return (
    <div className="mt-4">
      {rows.length===0 ? <p className="text-sm text-muted-foreground">No quotation yet.</p> :
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left"><tr><th className="p-2">Item</th><th className="p-2 text-right">Quoted</th><th className="p-2 text-right">Actual</th><th className="p-2 text-right">Diff</th></tr></thead>
          <tbody>
            {rows.map(r=>{
              const a = Number(r.actual_cost ?? 0); const d = a - Number(r.amount);
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.description}</td>
                  <td className="p-2 text-right tabular-nums">{Number(r.amount).toFixed(2)}</td>
                  <td className="p-1 w-32"><Input type="number" step="0.01" value={r.actual_cost ?? ""} onChange={(e)=>updateActual(r.id, Number(e.target.value))} className="text-right"/></td>
                  <td className={`p-2 text-right tabular-nums ${d>0?"text-destructive":d<0?"text-green-700":""}`}>{d.toFixed(2)}</td>
                </tr>
              );
            })}
            <tr className="border-t bg-surface font-medium"><td className="p-2">Total</td><td className="p-2 text-right tabular-nums">{totalQ.toFixed(2)}</td><td className="p-2 text-right tabular-nums">{totalA.toFixed(2)}</td><td className={`p-2 text-right tabular-nums ${diff>0?"text-destructive":diff<0?"text-green-700":""}`}>{diff.toFixed(2)}</td></tr>
          </tbody>
        </table>
      </div>}
    </div>
  );
}

function WorkProgram({ project }: { project: Project }) {
  const [tasks, setTasks] = useState<Array<{id:string;title:string;start_date:string|null;end_date:string|null;status:string}>>([]);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(""); const [end, setEnd] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("work_tasks").select("*").eq("project_id", project.id).order("start_date");
    setTasks((data ?? []) as Array<{id:string;title:string;start_date:string|null;end_date:string|null;status:string}>);
  }, [project.id]);
  useEffect(()=>{ load(); },[load]);

  async function add() {
    if (!title) return;
    const { error } = await supabase.from("work_tasks").insert({ project_id: project.id, title, start_date: start || null, end_date: end || null });
    if (error) return toast.error(error.message);
    setTitle(""); setStart(""); setEnd(""); load();
  }
  async function setStatus(id: string, status: string) {
    await supabase.from("work_tasks").update({ status: status as "pending" }).eq("id", id);
    load();
  }
  async function del(id: string) { await supabase.from("work_tasks").delete().eq("id", id); load(); }

  return (
    <div className="mt-4">
      <div className="grid sm:grid-cols-[1fr_140px_140px_auto] gap-2">
        <Input placeholder="Task" value={title} onChange={(e)=>setTitle(e.target.value)} />
        <Input type="date" value={start} onChange={(e)=>setStart(e.target.value)} />
        <Input type="date" value={end} onChange={(e)=>setEnd(e.target.value)} />
        <Button onClick={add}><Plus className="h-4 w-4 mr-1"/>Add</Button>
      </div>
      <div className="mt-4 rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left"><tr><th className="p-2">Task</th><th className="p-2">Start</th><th className="p-2">End</th><th className="p-2">Status</th><th></th></tr></thead>
          <tbody>
            {tasks.map(t=>(
              <tr key={t.id} className="border-t">
                <td className="p-2">{t.title}</td><td className="p-2">{t.start_date ?? "—"}</td><td className="p-2">{t.end_date ?? "—"}</td>
                <td className="p-1"><select value={t.status} onChange={(e)=>setStatus(t.id,e.target.value)} className="rounded border bg-background px-2 py-1 text-xs">
                  <option value="pending">Pending</option><option value="in_progress">In progress</option><option value="done">Done</option><option value="blocked">Blocked</option>
                </select></td>
                <td className="p-2 text-right"><Button size="icon" variant="ghost" onClick={()=>del(t.id)}><Trash2 className="h-4 w-4"/></Button></td>
              </tr>
            ))}
            {tasks.length===0 && <tr><td colSpan={5} className="p-4 text-sm text-muted-foreground text-center">No tasks yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MessagesPanel({ project }: { project: Project }) {
  const [msgs, setMsgs] = useState<Array<{id:string;body:string;channel:string;sender_id:string;created_at:string}>>([]);
  const [body, setBody] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("messages").select("*").eq("project_id", project.id).order("created_at");
    setMsgs((data ?? []) as Array<{id:string;body:string;channel:string;sender_id:string;created_at:string}>);
  }, [project.id]);
  useEffect(()=>{ load(); }, [load]);

  async function send(channel: "internal"|"whatsapp") {
    if (!body.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("messages").insert({ project_id: project.id, sender_id: u.user.id, channel, body });
    if (channel === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(`FusionPro — ${project.title}: ${body}`)}`, "_blank");
    }
    setBody(""); load();
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-lg border bg-surface max-h-80 overflow-y-auto p-3 space-y-2">
        {msgs.length===0 ? <p className="text-sm text-muted-foreground">No messages yet.</p> :
        msgs.map(m=>(
          <div key={m.id} className="rounded border bg-card p-2 text-sm">
            <div className="text-xs text-muted-foreground flex justify-between"><span className="capitalize">{m.channel}</span><span>{new Date(m.created_at).toLocaleString()}</span></div>
            <div className="mt-1">{m.body}</div>
          </div>
        ))}
      </div>
      <Textarea rows={3} placeholder="Type a message…" value={body} onChange={(e)=>setBody(e.target.value)} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={()=>send("internal")}>Log internal note</Button>
        <Button onClick={()=>send("whatsapp")}><MessageCircle className="h-4 w-4 mr-1"/>Send via WhatsApp</Button>
      </div>
    </div>
  );
}
