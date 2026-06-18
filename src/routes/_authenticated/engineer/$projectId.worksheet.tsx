import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateWorksheetPdf } from "@/lib/pdf";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, FileDown, UploadCloud } from "lucide-react";

export const Route = createFileRoute("/_authenticated/engineer/$projectId/worksheet")({
  component: WorksheetPage,
});

interface Observation { observation: string; action: string }

function WorksheetPage() {
  const { projectId } = Route.useParams();
  const [worksheetId, setWorksheetId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [jobNo, setJobNo] = useState("");
  const [jobLocation, setJobLocation] = useState("");
  const [jobDate, setJobDate] = useState(new Date().toISOString().slice(0, 10));
  const [jobType, setJobType] = useState("");
  const [technician, setTechnician] = useState("");
  const [personInCharge, setPersonInCharge] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [observations, setObservations] = useState<Observation[]>([{ observation: "", action: "" }]);
  const [imagesBefore, setImagesBefore] = useState<string[]>([]);
  const [sigTech, setSigTech] = useState("");
  const [sigSup, setSigSup] = useState("");
  const [sigClient, setSigClient] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data: p } = await supabase.from("projects").select("title,location,service").eq("id", projectId).maybeSingle();
    if (p) {
      setJobLocation(p.location ?? "");
      setJobType(p.service);
      if (!jobNo) setJobNo(`JOB-${projectId.slice(0, 6).toUpperCase()}`);
    }
    const { data: ws } = await supabase.from("worksheets").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).maybeSingle();
    if (ws) {
      setWorksheetId(ws.id);
      setClientName(ws.client_name ?? "");
      setJobNo(ws.job_no ?? "");
      setJobLocation(ws.job_location ?? "");
      setJobDate(ws.job_date ?? new Date().toISOString().slice(0, 10));
      setJobType(ws.job_type ?? "");
      setTechnician(ws.technician ?? "");
      setPersonInCharge(ws.person_in_charge ?? "");
      setJobDescription(ws.job_description ?? "");
      setObservations(((ws.observations as unknown) as Observation[]) ?? [{ observation: "", action: "" }]);
      setImagesBefore((ws.images_before as string[]) ?? []);
      const s = (ws.signatures ?? {}) as { technician_name?: string; supervisor_name?: string; client_name?: string };
      setSigTech(s.technician_name ?? "");
      setSigSup(s.supervisor_name ?? "");
      setSigClient(s.client_name ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  async function uploadImages(files: FileList | null) {
    if (!files) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    for (const file of Array.from(files)) {
      const path = `${u.user.id}/ws/${projectId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("project-images").upload(path, file);
      if (error) { toast.error(error.message); continue; }
      const { data: signed } = await supabase.storage.from("project-images").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) setImagesBefore((a) => [...a, signed.signedUrl]);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const payload = {
        project_id: projectId,
        engineer_id: u.user.id,
        client_name: clientName,
        job_no: jobNo,
        job_location: jobLocation,
        job_date: jobDate,
        job_type: jobType,
        technician,
        person_in_charge: personInCharge,
        job_description: jobDescription,
        observations: observations as unknown as Json,
        images_before: imagesBefore as unknown as Json,
        signatures: { technician_name: sigTech, supervisor_name: sigSup, client_name: sigClient } as unknown as Json,
      };
      if (worksheetId) {
        const { error } = await supabase.from("worksheets").update(payload).eq("id", worksheetId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("worksheets").insert(payload).select("id").single();
        if (error) throw error;
        setWorksheetId(data.id);
      }
      toast.success("Worksheet saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function exportPdf() {
    generateWorksheetPdf({
      clientName, jobNo, jobLocation, jobDate, jobType, technician, personInCharge, jobDescription,
      observations, imagesBefore,
      signatures: { technician_name: sigTech, supervisor_name: sigSup, client_name: sigClient },
    });
  }

  return (
    <div className="p-4 md:p-8 fade-in max-w-5xl mx-auto pb-24">
      <Link to="/engineer/$projectId" params={{ projectId }} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" />Back to project
      </Link>
      <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight">Fusionpro Limited Worksheet</h1>
      <p className="text-muted-foreground mt-1">Document 2 — site assessment & sign-off.</p>

      <section className="mt-6 grid md:grid-cols-2 gap-4">
        <div><Label>Client Name</Label><Input value={clientName} onChange={(e) => setClientName(e.target.value)} /></div>
        <div><Label>Job No.</Label><Input value={jobNo} onChange={(e) => setJobNo(e.target.value)} /></div>
        <div><Label>Job Location</Label><Input value={jobLocation} onChange={(e) => setJobLocation(e.target.value)} /></div>
        <div><Label>Job Date</Label><Input type="date" value={jobDate} onChange={(e) => setJobDate(e.target.value)} /></div>
        <div><Label>Job Type</Label><Input value={jobType} onChange={(e) => setJobType(e.target.value)} /></div>
        <div><Label>Technician</Label><Input value={technician} onChange={(e) => setTechnician(e.target.value)} /></div>
        <div><Label>Person in Charge</Label><Input value={personInCharge} onChange={(e) => setPersonInCharge(e.target.value)} /></div>
      </section>

      <section className="mt-6">
        <Label>Job Description</Label>
        <Textarea rows={4} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Site Visit & Scope Assessment</h2>
          <Button variant="outline" size="sm" onClick={() => setObservations((a) => [...a, { observation: "", action: "" }])}><Plus className="h-4 w-4 mr-1" />Add row</Button>
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left">
              <tr><th className="p-2 w-1/2">Technician&apos;s Observation</th><th className="p-2">Action to Be Taken</th><th className="w-10"></th></tr>
            </thead>
            <tbody>
              {observations.map((o, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1"><Textarea rows={2} value={o.observation} onChange={(e) => setObservations((a) => a.map((x, j) => j === i ? { ...x, observation: e.target.value } : x))} /></td>
                  <td className="p-1"><Textarea rows={2} value={o.action} onChange={(e) => setObservations((a) => a.map((x, j) => j === i ? { ...x, action: e.target.value } : x))} /></td>
                  <td className="p-1 align-top"><Button type="button" variant="ghost" size="icon" onClick={() => setObservations((a) => a.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Images Before</h2>
        <label className="mt-3 flex items-center justify-center rounded-md border border-dashed bg-surface px-4 py-6 text-sm text-muted-foreground cursor-pointer hover:bg-accent transition">
          <UploadCloud className="h-4 w-4 mr-2" /> Click to upload before-images
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadImages(e.target.files)} />
        </label>
        {imagesBefore.length > 0 && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            {imagesBefore.map((u, i) => (
              <div key={i} className="relative">
                <img src={u} alt={`Before ${i + 1}`} className="rounded border h-28 w-full object-cover" />
                <button type="button" onClick={() => setImagesBefore((a) => a.filter((_, j) => j !== i))} className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Signatures</h2>
        <div className="mt-3 grid md:grid-cols-3 gap-4">
          <div className="rounded-lg border p-4 bg-card"><Label>Technician Signature (Name)</Label><Input value={sigTech} onChange={(e) => setSigTech(e.target.value)} /></div>
          <div className="rounded-lg border p-4 bg-card"><Label>Supervisor Signature (Name)</Label><Input value={sigSup} onChange={(e) => setSigSup(e.target.value)} /></div>
          <div className="rounded-lg border p-4 bg-card"><Label>Client Approval (Name)</Label><Input value={sigClient} onChange={(e) => setSigClient(e.target.value)} /></div>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={exportPdf}><FileDown className="h-4 w-4 mr-1" />Export PDF</Button>
        <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" />Save worksheet</Button>
      </div>
    </div>
  );
}
