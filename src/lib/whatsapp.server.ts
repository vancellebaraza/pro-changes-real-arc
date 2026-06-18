// src/lib/whatsapp.server.ts
// Server-side helpers for WhatsApp deep-link feature.
// The functions accept a Supabase client instance so they can be used in server actions.

export interface ProjectContacts {
  projectId: string;
  projectTitle?: string;
  status?: string;
  clientId?: string;
  clientName?: string;
  clientPhone?: string | null;
  engineerId?: string;
  engineerName?: string;
  engineerPhone?: string | null;
}

import type { SupabaseClient } from "@supabase/supabase-js";
type SupabaseClientLike = SupabaseClient;

/**
 * Normalize phone for wa.me link: digits only (no +).
 * Returns null for clearly invalid numbers.
 */
export function formatPhoneForWhatsApp(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits;
}

/**
 * Retrieve project, client and engineer details.
 * This is a server-side helper; pass in your Supabase server client or adapt import.
 */
export async function getProjectContacts(
  supabase: SupabaseClientLike,
  projectId: string
): Promise<ProjectContacts> {
  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("id, title, status, client_id, engineer_id")
    .eq("id", projectId)
    .limit(1)
    .single();

  if (projectError || !projectData) {
    return { projectId };
  }

  const projectTitle = projectData.title ?? undefined;
  const status = projectData.status ?? undefined;
  const clientId = projectData.client_id ?? undefined;
  const engineerId = projectData.engineer_id ?? undefined;

  const ids: string[] = [];
  if (clientId) ids.push(clientId);
  if (engineerId) ids.push(engineerId);

  let clientName: string | undefined;
  let clientPhone: string | null | undefined;
  let engineerName: string | undefined;
  let engineerPhone: string | null | undefined;

  if (ids.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", ids);

    (profiles ?? []).forEach((p: any) => {
      if (p.id === clientId) {
        clientName = p.full_name ?? undefined;
        clientPhone = p.phone ?? null;
      } else if (p.id === engineerId) {
        engineerName = p.full_name ?? undefined;
        engineerPhone = p.phone ?? null;
      }
    });
  }

  return {
    projectId,
    projectTitle,
    status,
    clientId,
    clientName,
    clientPhone: clientPhone ?? null,
    engineerId,
    engineerName,
    engineerPhone: engineerPhone ?? null,
  };
}

/**
 * Insert a whatsapp_logs record.
 * Reuse existing `whatsapp_logs` table. Keep caller responsible for auth checks.
 */
export async function logWhatsAppAction(
  supabase: SupabaseClientLike,
  payload: {
    sender_id: string | null;
    recipient_phone: string | null;
    recipient_role?: string | null;
    project_id?: string | null;
    message_type?: string | null;
    body?: string | null;
    meta?: Record<string, any> | null;
  }
): Promise<void> {
  // The DB table `whatsapp_logs` has columns: sender_id, project_id, recipient, body, created_at
  // We'll map payload.recipient_phone -> recipient and include message_type/meta into body prefix if present
  let body = payload.body ?? null;
  if (payload.message_type) {
    body = `[${payload.message_type}] ${body ?? ""}`;
  }
  if (payload.meta) {
    try {
      const metaStr = JSON.stringify(payload.meta);
      body = `${body ?? ""}\n\n[meta] ${metaStr}`;
    } catch (e) {
      // ignore meta serialization errors
    }
  }

  const insert = {
    sender_id: payload.sender_id,
    project_id: payload.project_id ?? null,
    recipient: payload.recipient_phone ?? null,
    body: body ?? "",
  };

  try {
    await supabase.from("whatsapp_logs").insert(insert);
  } catch (e) {
    // swallow here; consider logging to observability backend if desired
  }
}
