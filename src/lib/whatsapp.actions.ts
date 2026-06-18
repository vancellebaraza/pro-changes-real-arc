import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  getProjectContacts as getProjectContactsHelper,
  formatPhoneForWhatsApp,
  logWhatsAppAction as logWhatsAppActionHelper,
} from "./whatsapp.server";

const GetContactsInput = z.object({ projectId: z.string().min(1) });

export const getProjectContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GetContactsInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { projectId } = data;
    const contacts = await getProjectContactsHelper(supabase, projectId);

    const clientPhoneNorm = formatPhoneForWhatsApp(contacts.clientPhone ?? null);
    const engineerPhoneNorm = formatPhoneForWhatsApp(contacts.engineerPhone ?? null);

    return {
      ...contacts,
      clientPhoneNorm,
      engineerPhoneNorm,
    };
  });

const LogInput = z.object({
  projectId: z.string().min(1).nullable(),
  recipientPhone: z.string().nullable(),
  recipientRole: z.string().nullable(),
  messageType: z.string().nullable(),
  body: z.string().nullable(),
  meta: z.record(z.any()).nullable(),
});

export const logWhatsAppAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LogInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await logWhatsAppActionHelper(supabase, {
      sender_id: userId ?? null,
      recipient_phone: data.recipientPhone ?? null,
      recipient_role: data.recipientRole ?? null,
      project_id: data.projectId ?? null,
      message_type: data.messageType ?? null,
      body: data.body ?? null,
      meta: data.meta ?? null,
    });
    return { ok: true };
  });
