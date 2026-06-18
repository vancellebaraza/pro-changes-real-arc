// src/lib/whatsapp.templates.ts
export type TemplateKey =
  | "request_correction"
  | "quotation_approved"
  | "work_completed"
  | "inspection_failed"
  | "custom";

export const templates: Record<Exclude<TemplateKey, "custom">, { title: string; body: string }> = {
  request_correction: {
    title: "Request correction",
    body:
      "Hi {{clientName}}, this is {{engineerName}}. Please correct the following for {{projectTitle}} (status: {{status}}): {{errorMessage}}",
  },
  quotation_approved: {
    title: "Quotation approved",
    body:
      "Hi {{clientName}}, the quotation for {{projectTitle}} has been approved by {{engineerName}}. Status: {{status}}.",
  },
  work_completed: {
    title: "Work completed",
    body:
      "Hi {{clientName}}, work for {{projectTitle}} has been completed by {{engineerName}}. Status: {{status}}. Please confirm receipt.",
  },
  inspection_failed: {
    title: "Inspection failed",
    body:
      "Hi {{clientName}}, inspection for {{projectTitle}} returned issues: {{errorMessage}}. Contact {{engineerName}} for details. Status: {{status}}.",
  },
};

export function renderTemplate(
  templateStr: string,
  ctx: Record<string, string | undefined | null>
): string {
  return templateStr.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
    const k = key.trim();
    const v = ctx[k];
    return v == null ? "" : String(v);
  });
}

export function buildMessageForKey(
  key: TemplateKey,
  ctx: Record<string, string | undefined | null>,
  customMessage?: string
): string {
  if (key === "custom") {
    return customMessage ? String(customMessage) : "";
  }
  const tpl = templates[key];
  return renderTemplate(tpl.body, ctx);
}
