import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Only the business owner can do this");
}

/** Try the agent without WhatsApp. Nothing is saved or sent. */
export const testAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { history: { role: "client" | "agent"; content: string }[] }) => {
    if (!Array.isArray(input?.history) || input.history.length === 0) throw new Error("Message required");
    return { history: input.history.slice(-30).map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) })) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadAgentContext } = await import("./conversation.server");
    const { generateAgentReply } = await import("./agent.server");
    const ctx = await loadAgentContext(supabaseAdmin);
    try {
      return { reply: await generateAgentReply(ctx.instructions, data.history) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Agent failed" };
    }
  });

/** Owner types a manual reply from the inbox; it goes out on WhatsApp. */
export const sendOwnerReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contactId: string; text: string }) => {
    const text = String(input?.text ?? "").trim();
    if (!input?.contactId || !text) throw new Error("Message required");
    return { contactId: input.contactId, text: text.slice(0, 4000) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { data: contact, error } = await context.supabase
      .from("contacts").select("id, chat_id").eq("id", data.contactId).single();
    if (error || !contact) throw new Error("Client not found");
    const { sendWhatsAppText } = await import("./greenapi.server");
    try {
      const sent = await sendWhatsAppText(contact.chat_id, data.text);
      const { error: insErr } = await context.supabase.from("messages").insert({
        contact_id: contact.id, role: "owner", content: data.text, external_id: sent.idMessage ?? null,
      });
      if (insErr) throw insErr;
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
    }
  });

export const getConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { greenApiConfigured } = await import("./greenapi.server");
    return { whatsapp: greenApiConfigured(), webhookToken: Boolean(process.env["GREEN_WEBHOOK_TOKEN"]) };
  });
