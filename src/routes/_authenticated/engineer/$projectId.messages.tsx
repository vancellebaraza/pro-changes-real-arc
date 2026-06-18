import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/engineer/$projectId/messages")({
  component: MessagesPage,
});

interface Msg { id: string; body: string; sender_id: string; created_at: string; channel: string }

function MessagesPage() {
  const { projectId } = Route.useParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [projectTitle, setProjectTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const { data: p } = await supabase.from("projects").select("title").eq("id", projectId).maybeSingle();
    if (p) setProjectTitle(p.title);
    const { data } = await supabase.from("messages").select("*").eq("project_id", projectId).order("created_at");
    setMessages((data ?? []) as Msg[]);
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  async function send() {
    if (!body.trim() || sending) return;
    setSending(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("messages").insert({ project_id: projectId, sender_id: u.user.id, body: body.trim(), channel: "internal" });
    setSending(false);
    if (error) return toast.error(error.message);
    setBody("");
    load();
  }

  const waMsg = encodeURIComponent(`FusionPro — Project: ${projectTitle}. `);

  async function logWa() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("whatsapp_logs").insert({ sender_id: u.user.id, project_id: projectId, recipient: null, body: decodeURIComponent(waMsg) });
  }

  return (
    <div className="p-4 md:p-8 fade-in max-w-3xl mx-auto pb-24">
      <Link to="/engineer/$projectId" params={{ projectId }} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" />Back to project
      </Link>
      <div className="mt-3 flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Communication</h1>
          <p className="text-muted-foreground mt-1">Internal messages and WhatsApp launcher (logged).</p>
        </div>
        <a href={`https://wa.me/?text=${waMsg}`} target="_blank" rel="noreferrer" onClick={logWa}>
          <Button variant="outline"><MessageCircle className="h-4 w-4 mr-1" />Open WhatsApp</Button>
        </a>
      </div>

      <div className="mt-6 space-y-2">
        {messages.length === 0 ? <p className="text-sm text-muted-foreground">No messages yet.</p> :
          messages.map((m) => (
            <div key={m.id} className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</div>
              <div className="mt-1 text-sm whitespace-pre-wrap">{m.body}</div>
            </div>
          ))}
      </div>

      <div className="mt-6 rounded-lg border bg-card p-3">
        <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…" />
        <div className="mt-2 flex justify-end">
          <Button onClick={send} disabled={sending || !body.trim()}><Send className="h-4 w-4 mr-1" />Send</Button>
        </div>
      </div>
    </div>
  );
}
