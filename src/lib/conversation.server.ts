import { buildInstructions, generateAgentReply, type AgentTurn } from "./agent.server";
import { sendWhatsAppText } from "./greenapi.server";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export async function loadAgentContext(db: Admin) {
  const [{ data: settings }, { data: products, error }] = await Promise.all([
    db.from("agent_settings").select("*").eq("id", 1).maybeSingle(),
    db.from("products").select("name, category, price, unit, details").eq("active", true).order("category"),
  ]);
  if (error) throw error;
  return {
    enabled: settings?.agent_enabled ?? true,
    instructions: buildInstructions(
      settings?.business_name ?? "K&S Solar Energy",
      settings?.instructions ?? "",
      products ?? [],
    ),
  };
}

/** Handle one incoming WhatsApp text: save it, and let the agent reply if allowed. */
export async function handleIncomingText(
  db: Admin,
  input: { chatId: string; senderName: string; text: string; externalId?: string },
) {
  const { data: contact, error: cErr } = await db
    .from("contacts")
    .upsert(
      { chat_id: input.chatId, name: input.senderName, last_message_at: new Date().toISOString() },
      { onConflict: "chat_id" },
    )
    .select()
    .single();
  if (cErr) throw cErr;

  const { error: mErr } = await db.from("messages").insert({
    contact_id: contact.id,
    role: "client",
    content: input.text,
    external_id: input.externalId ?? null,
  });
  if (mErr) {
    if (mErr.code === "23505") return { skipped: "duplicate" }; // already processed
    throw mErr;
  }

  const ctx = await loadAgentContext(db);
  if (!ctx.enabled || contact.ai_paused) return { skipped: "agent off" };

  const { data: history, error: hErr } = await db
    .from("messages")
    .select("role, content")
    .eq("contact_id", contact.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (hErr) throw hErr;

  const reply = await generateAgentReply(ctx.instructions, (history ?? []).reverse() as AgentTurn[]);
  const sent = await sendWhatsAppText(input.chatId, reply);

  const { error: rErr } = await db.from("messages").insert({
    contact_id: contact.id,
    role: "agent",
    content: reply,
    external_id: sent.idMessage ?? null,
  });
  if (rErr) throw rErr;
  await db.from("contacts").update({ last_message_at: new Date().toISOString() }).eq("id", contact.id);
  return { replied: true };
}
