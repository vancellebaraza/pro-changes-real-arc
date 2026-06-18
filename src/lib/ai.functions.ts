 import { createServerFn } from "@tanstack/react-start";
 import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
 import { z } from "zod";
 import { GoogleGenerativeAI } from "@google/generative-ai";

const ChatInput = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(20)
    .default([]),
});

export const chatWithAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChatInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    const role: "admin" | "engineer" | "client" = roles.includes("admin")
      ? "admin"
      : roles.includes("engineer")
        ? "engineer"
        : "client";

    let dbContext = "";
    if (role === "client") {
      const { data: projects } = await supabase
        .from("projects")
        .select("id,title,service,status,location,scheduled_date,created_at")
        .eq("client_id", userId)
        .order("created_at", { ascending: false })
        .limit(25);
      const ids = (projects ?? []).map((p: { id: string }) => p.id);
      const { data: quotes } = ids.length
        ? await supabase
            .from("quotations")
            .select("id,project_id,subtotal,vat_amount,grand_total,status")
            .in("project_id", ids)
        : { data: [] };
      dbContext = `Client's projects:\n${JSON.stringify(projects ?? [])}\nQuotations:\n${JSON.stringify(quotes ?? [])}`;
    } else if (role === "engineer") {
      const { data: projects } = await supabase
        .from("projects")
        .select("id,title,service,status,location,scheduled_date,engineer_id,created_at")
        .order("created_at", { ascending: false })
        .limit(40);
      const { data: quotes } = await supabase
        .from("quotations")
        .select("id,project_id,grand_total,status")
        .order("created_at", { ascending: false })
        .limit(40);
      const { data: insp } = await supabase
        .from("inspections")
        .select("id,project_id,stage,flagged,remarks,created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      dbContext = `Projects:\n${JSON.stringify(projects ?? [])}\nQuotations:\n${JSON.stringify(quotes ?? [])}\nInspections:\n${JSON.stringify(insp ?? [])}`;
    } else {
      const { data: projects } = await supabase
        .from("projects")
        .select("id,title,service,status,location,scheduled_date,engineer_id,client_id,created_at")
        .order("created_at", { ascending: false })
        .limit(80);
      const { data: quotes } = await supabase
        .from("quotations")
        .select("id,project_id,subtotal,vat_amount,grand_total,labour,status")
        .limit(80);
      const { data: items } = await supabase
        .from("quotation_items")
        .select("quotation_id,description,amount,actual_cost")
        .limit(300);
      dbContext = `All projects:\n${JSON.stringify(projects ?? [])}\nQuotations:\n${JSON.stringify(quotes ?? [])}\nLine items (for quoted vs actual analysis):\n${JSON.stringify(items ?? [])}`;
    }

    const system = `You are FusionPro AI, the assistant for RealArc Estates property operations.
Role of the user: ${role}.
RULES (strict):
- Answer ONLY based on the SYSTEM DATA below.
- If the answer is not in the data, reply: "I don't see that in the system records yet."
- Never invent project names, IDs, dates, statuses, or amounts.
- Use Kenyan Shilling (KES) for currency. Be concise.

=== SYSTEM DATA ===
${dbContext}
=== END DATA ===`;

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("AI is not configured. Please set GOOGLE_GEMINI_API_KEY environment variable.");

    try {
      const genAI = new GoogleGenerativeAI(apiKey);

      const messages = [
        { role: "system", content: system },
        ...data.history,
        { role: "user", content: data.message },
      ];

      const geminiMessages = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

      if (geminiMessages.length > 0 && geminiMessages[0].role === "user") {
        geminiMessages[0].parts[0].text = system + "\n\n" + geminiMessages[0].parts[0].text;
      }

      const candidates = [
        "models/gemini-3.5-flash",
        "models/gemini-3.1-flash-lite",
        "models/gemini-2.5-flash",
        "models/gemini-2.0-flash",
      ];

      let lastError: unknown = null;
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      for (const candidate of candidates) {
        let attempt = 0;
        const maxAttempts = 3;
        while (attempt < maxAttempts) {
          try {
            const model = genAI.getGenerativeModel({ model: candidate });
            const chat = model.startChat({ history: geminiMessages.slice(0, -1) });
            const result = await chat.sendMessage(
              geminiMessages[geminiMessages.length - 1]?.parts[0]?.text || data.message
            );
            const reply = result.response.text();
            return { reply, role };
          } catch (err) {
            lastError = err;
            const msg = err instanceof Error ? err.message : String(err);
            // Transient server errors: retry with exponential backoff
            if (
              msg.includes("503") ||
              msg.toLowerCase().includes("high demand") ||
              msg.toLowerCase().includes("service unavailable")
            ) {
              attempt++;
              if (attempt < maxAttempts) {
                const backoff = 1000 * Math.pow(2, attempt - 1);
                await sleep(backoff);
                continue; // retry same model
              }
              break; // move to next candidate after retries
            }

            // Model not found for this API/version: try next candidate
            if (msg.includes("not found") || msg.includes("404") || msg.includes("is not found")) {
              break;
            }

            // Other errors: surface immediately
            throw err;
          }
        }
        // try next candidate
      }

      const le = lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(
        `AI model not available or busy. Tried models: ${candidates.join(", ")}. Last error: ${le}`
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("429")) throw new Error("AI rate limit reached. Try again in a moment.");
        if (error.message.includes("402")) throw new Error("AI usage limit reached. Please add credits.");
        throw new Error(`AI error: ${error.message}`);
      }
      throw new Error("Failed to get AI response");
    }
  });
