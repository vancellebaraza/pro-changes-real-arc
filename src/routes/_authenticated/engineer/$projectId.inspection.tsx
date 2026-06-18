import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SERVICES } from "@/lib/services";
import { generateInspectionPdf } from "@/lib/pdf";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, FileDown, UploadCloud } from "lucide-react";

export const Route = createFileRoute("/_authenticated/engineer/$projectId/inspection")({
  component: InspectionPage,
});

interface ChecklistRow { item: string; remark: string; pass: boolean }
interface PhotoRow { before: string; during: string; after: string }

function InspectionPage() {
  const { projectId } = Route.useParams();
  const [projectTitle, setProjectTitle] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [projectService, setProjectService] = useState("");

  const [workCategory, setWorkCategory] = useState<string>("electrical");
  const [clientName, setClientName] = useState("");
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [inspectorName, setInspectorName] = useState("");
  const [technician, setTechnician] = useState("");
  const [checklist, setChecklist] = useState<ChecklistRow[]>([
    { item: "Site safety verified", remark: "", pass: true },
    { item: "Scope matches request", remark: "", pass: true },
    { item: "Materials available", remark: "", pass: true },
    { item: "Access confirmed", remark: "", pass: true },
  ]);
  const [photos, setPhotos] = useState<PhotoRow[]>([{ before: "", during: "", after: "" }]);
  const [sigClient, setSigClient] = useState("");
  const [sigInspector, setSigInspector] = useState("");
  const [sigTechnician, setSigTechnician] = useState("");
  const [remarks, setRemarks] = useState("");
  const [stage, setStage] = useState("initial");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data: p } = await supabase.from("projects").select("title,location,service").eq("id", projectId).maybeSingle();
    if (p) {
      setProjectTitle(p.title);
      setProjectLocation(p.location ?? "");
      setProjectService(p.service);
      setWorkCategory(p.service);
    }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  async function uploadImage(file: File): Promise<string> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not signed in");
    const path = `${u.user.id}/insp/${projectId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("project-images").upload(path, file);
    if (error) throw error;
    const { data: signed } = await supabase.storage.from("project-images").createSignedUrl(path, 60 * 60 * 24 * 365);
    return signed?.signedUrl ?? "";
  }

  async function pickFile(field: keyof PhotoRow, idx: number) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const url = await uploadImage(f);
        setPhotos((arr) => arr.map((p, i) => (i === idx ? { ...p, [field]: url } : p)));
        toast.success("Image uploaded");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
    };
    input.click();
  }

  async function save() {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const checklistJson = checklist.map((c) => ({ item: c.item, pass: c.pass, remark: c.remark }));
      const meta = { work_category: workCategory, client_name: clientName, inspection_date: inspectionDate, inspector_name: inspectorName, technician };
      const signatures = { client_name: sigClient, inspector_name: sigInspector, technician_name: sigTechnician };
      const { error } = await supabase.from("inspections").insert({
        project_id: projectId,
        engineer_id: u.user.id,
        stage,
        checklist: checklistJson as unknown as Json,
        remarks,
        meta: meta as unknown as Json,
        photo_evidence: photos as unknown as Json,
        signatures: signatures as unknown as Json,
        image_urls: photos.flatMap((p) => [p.before, p.during, p.after].filter(Boolean)),
      });
      if (error) throw error;
      await supabase.from("projects").update({ status: "inspected" as const }).eq("id", projectId);
      toast.success("Inspection saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function exportPdf() {
    generateInspectionPdf({
      workCategory: SERVICES.find((s) => s.key === workCategory)?.label ?? workCategory,
      projectName: projectTitle,
      clientName,
      siteLocation: projectLocation,
      inspectionDate,
      inspectorName,
      technician,
      checklist: checklist.map((c) => ({ item: c.item, remark: c.remark, pass: c.pass })),
      photoEvidence: photos,
      signatures: { client_name: sigClient, inspector_name: sigInspector, technician_name: sigTechnician },
    });
  }

  return (
    <div className="p-4 md:p-8 fade-in max-w-5xl mx-auto pb-24">
      <Link to="/engineer/$projectId" params={{ projectId }} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" />Back to project
      </Link>
      <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight">Inspection Report</h1>
      <p className="text-muted-foreground mt-1">Complete the checklist, photo evidence and sign-off.</p>

      <section className="mt-8 grid md:grid-cols-2 gap-4">
        <div>
          <Label>Work Category</Label>
          <select value={workCategory} onChange={(e) => setWorkCategory(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {SERVICES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div><Label>Project Name</Label><Input value={projectTitle} readOnly /></div>
        <div><Label>Client Name</Label><Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client full name" /></div>
        <div><Label>Site Location</Label><Input value={projectLocation} onChange={(e) => setProjectLocation(e.target.value)} /></div>
        <div><Label>Inspection Date</Label><Input type="date" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} /></div>
        <div><Label>Inspector Name</Label><Input value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} /></div>
        <div><Label>Technician</Label><Input value={technician} onChange={(e) => setTechnician(e.target.value)} /></div>
        <div>
          <Label>Stage</Label>
          <select value={stage} onChange={(e) => setStage(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="initial">Initial</option><option value="during">During work</option><option value="final">Final</option>
          </select>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Inspection Checklist</h2>
          <Button variant="outline" size="sm" onClick={() => setChecklist((a) => [...a, { item: "", remark: "", pass: true }])}><Plus className="h-4 w-4 mr-1" />Add row</Button>
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left">
              <tr><th className="p-2 w-1/3">Work Item</th><th className="p-2">Remarks</th><th className="p-2 w-32 text-center">Status</th><th className="w-10"></th></tr>
            </thead>
            <tbody>
              {checklist.map((c, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="p-1"><Input value={c.item} onChange={(e) => setChecklist((a) => a.map((x, j) => j === i ? { ...x, item: e.target.value } : x))} /></td>
                  <td className="p-1"><Input value={c.remark} onChange={(e) => setChecklist((a) => a.map((x, j) => j === i ? { ...x, remark: e.target.value } : x))} /></td>
                  <td className="p-1 text-center">
                    <button type="button" onClick={() => setChecklist((a) => a.map((x, j) => j === i ? { ...x, pass: !x.pass } : x))} className={`rounded px-3 py-1 text-xs font-medium ${c.pass ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {c.pass ? "PASS" : "FAIL"}
                    </button>
                  </td>
                  <td className="p-1"><Button type="button" variant="ghost" size="icon" onClick={() => setChecklist((a) => a.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Photo Evidence</h2>
          <Button variant="outline" size="sm" onClick={() => setPhotos((a) => [...a, { before: "", during: "", after: "" }])}><Plus className="h-4 w-4 mr-1" />Add row</Button>
        </div>
        <div className="mt-3 space-y-2">
          {photos.map((p, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-lg border p-2 bg-card">
              {(["before", "during", "after"] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">{field}</Label>
                  {p[field] ? (
                    <a href={p[field]} target="_blank" rel="noreferrer">
                      <img src={p[field]} alt={field} className="rounded border h-24 w-full object-cover" />
                    </a>
                  ) : (
                    <button type="button" onClick={() => pickFile(field, i)} className="w-full h-24 rounded border border-dashed grid place-items-center text-xs text-muted-foreground hover:bg-accent">
                      <span className="flex items-center gap-1"><UploadCloud className="h-3 w-3" />Upload</span>
                    </button>
                  )}
                </div>
              ))}
              <Button type="button" variant="ghost" size="icon" className="self-center" onClick={() => setPhotos((a) => a.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Sign-off</h2>
        <div className="mt-3 grid md:grid-cols-3 gap-4">
          <div className="rounded-lg border p-4 bg-card">
            <Label>Client Name</Label><Input value={sigClient} onChange={(e) => setSigClient(e.target.value)} />
            <div className="mt-3 text-xs text-muted-foreground">Client signature collected on site.</div>
          </div>
          <div className="rounded-lg border p-4 bg-card">
            <Label>Inspector Name</Label><Input value={sigInspector} onChange={(e) => setSigInspector(e.target.value)} />
            <div className="mt-3 text-xs text-muted-foreground">Inspector signature collected on site.</div>
          </div>
          <div className="rounded-lg border p-4 bg-card">
            <Label>Technician Name</Label><Input value={sigTechnician} onChange={(e) => setSigTechnician(e.target.value)} />
            <div className="mt-3 text-xs text-muted-foreground">Technician signature collected on site.</div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <Label>General remarks</Label>
        <Textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </section>

      <div className="mt-8 flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={exportPdf}><FileDown className="h-4 w-4 mr-1" />Export PDF</Button>
        <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" />Save inspection</Button>
      </div>
    </div>
  );
}
