import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SERVICES } from "@/lib/services";
import { toast } from "sonner";
import { Loader2, UploadCloud, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/new")({
  component: NewRequest,
});

function NewRequest() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  function onFiles(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list).slice(0, 2 - files.length);
    setFiles((f) => [...f, ...arr].slice(0, 2));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const urls: string[] = [];
      for (const file of files) {
        const path = `${u.user.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("project-images").upload(path, file);
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("project-images").createSignedUrl(path, 60 * 60 * 24 * 30);
        if (signed?.signedUrl) urls.push(signed.signedUrl);
      }
      const { error } = await supabase.from("projects").insert({
        client_id: u.user.id,
        service: String(fd.get("service")) as "electrical",
        title: String(fd.get("title")),
        description: String(fd.get("description") || ""),
        location: String(fd.get("location") || ""),
        image_urls: urls,
      });
      if (error) throw error;
      toast.success("Request submitted");
      navigate({ to: "/client" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto fade-in">
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">New service request</h1>
      <p className="text-muted-foreground mt-1">Tell us what you need. An engineer will follow up shortly.</p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <div>
          <Label htmlFor="service">Service</Label>
          <select id="service" name="service" required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {SERVICES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div><Label htmlFor="title">Title</Label><Input id="title" name="title" required maxLength={120} placeholder="e.g. Kitchen sink leaking" /></div>
        <div><Label htmlFor="location">Location</Label><Input id="location" name="location" maxLength={200} placeholder="Building, unit, address" /></div>
        <div><Label htmlFor="description">Description</Label><Textarea id="description" name="description" rows={5} maxLength={2000} placeholder="Describe the issue or scope" /></div>
        <div>
          <Label>Images (max 2)</Label>
          <label className="mt-1 flex items-center justify-center rounded-md border border-dashed bg-surface px-4 py-6 text-sm text-muted-foreground cursor-pointer hover:bg-accent transition">
            <UploadCloud className="h-4 w-4 mr-2" /> Click to upload
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
          </label>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between rounded border px-3 py-2">
                  <span className="truncate">{f.name}</span>
                  <button type="button" onClick={() => setFiles((arr) => arr.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Submit request
        </Button>
      </form>
    </div>
  );
}
