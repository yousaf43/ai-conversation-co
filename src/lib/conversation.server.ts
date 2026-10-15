import {
  buildInstructions, generateAgentReply, memoryBlock, updateCustomerMemory,
  type AgentTurn, type CustomerMemory,
} from "./agent.server";
import { humanTypingMs, markChatRead, sendWhatsAppText, splitBubbles } from "./greenapi.server";
import { upsertLeadRow } from "./leads-sheet.server";
import { loadRatesSheet } from "./rates-sheet.server";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export async function loadAgentContext(db: Admin) {
  const [{ data: settings }, { data: products, error }, sheetText] = await Promise.all([
    db.from("agent_settings").select("*").eq("id", 1).maybeSingle(),
    db.from("products").select("name, category, price, unit, details").eq("active", true).order("category"),
    loadRatesSheet(),
  ]);
  if (error) throw error;
  return {
    enabled: settings?.agent_enabled ?? true,
    instructions: buildInstructions(
      settings?.business_name ?? "K&S Solar Energy",
      settings?.instructions ?? "",
      products ?? [],
      sheetText,
    ),
  };
}

/** Handle one incoming WhatsApp text: save it, and let the agent reply if allowed. */
export async function handleIncomingText(
  db: Admin,
  input: { chatId: string; senderName: string; text: string; externalId?: string | undefined },
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

  const turns = (history ?? []).reverse() as AgentTurn[];
  const prevMemory: CustomerMemory = {
    stage: contact.stage,
    summary: contact.summary,
    lead: (contact.lead ?? {}) as CustomerMemory["lead"],
  };
  const reply = await generateAgentReply(ctx.instructions + memoryBlock(prevMemory), turns);

  // Human feel: open chat (blue ticks), then each bubble arrives with "typing..." first.
  await markChatRead(input.chatId);
  for (const bubble of splitBubbles(reply)) {
    const sent = await sendWhatsAppText(input.chatId, bubble, humanTypingMs(bubble));
    const { error: rErr } = await db.from("messages").insert({
      contact_id: contact.id,
      role: "agent",
      content: bubble,
      external_id: sent.idMessage ?? null,
    });
    if (rErr) throw rErr;
  }
  await db.from("contacts").update({ last_message_at: new Date().toISOString() }).eq("id", contact.id);

  // Update customer memory + Leads sheet. Failures here never block the reply.
  try {
    const mem = await updateCustomerMemory(prevMemory, [...turns, { role: "agent", content: reply }]);
    let leadRow = contact.lead_row;
    try {
      leadRow = await upsertLeadRow({
        row: contact.lead_row, phone: input.chatId.replace(/@c\.us$/, ""), stage: mem.stage,
        summary: mem.summary, lead: mem.lead, fallbackName: contact.name,
      });
    } catch (e) {
      console.error("Leads sheet update failed:", e);
    }
    await db.from("contacts").update({ stage: mem.stage, summary: mem.summary, lead: mem.lead, lead_row: leadRow }).eq("id", contact.id);
  } catch (e) {
    console.error("Customer memory update failed:", e);
  }
  return { replied: true };
}
