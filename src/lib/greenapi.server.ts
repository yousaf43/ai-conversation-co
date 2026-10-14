function config() {
  const instance = process.env["GREEN_API_INSTANCE_ID"];
  const token = process.env["GREEN_API_TOKEN"];
  const base = (process.env["GREEN_API_URL"] || "https://api.green-api.com").replace(/\/+$/, "");
  if (!instance || !token) throw new Error("WhatsApp (Green API) is not connected yet");
  return { instance, token, base };
}

export function greenApiConfigured() {
  return Boolean(process.env["GREEN_API_INSTANCE_ID"] && process.env["GREEN_API_TOKEN"]);
}

export async function sendWhatsAppText(chatId: string, message: string, typingTime?: number) {
  const { instance, token, base } = config();
  const body: Record<string, unknown> = { chatId, message };
  if (typingTime) body["typingTime"] = Math.min(20000, Math.max(1000, Math.round(typingTime)));
  const res = await fetch(`${base}/waInstance${instance}/sendMessage/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`WhatsApp send failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as { idMessage?: string };
}

/** Marks the chat as read (blue ticks) — like a person opening the chat. */
export async function markChatRead(chatId: string) {
  const { instance, token, base } = config();
  await fetch(`${base}/waInstance${instance}/readChat/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId }),
  }).catch(() => undefined);
}

/** Typing time that feels human: ~ 25 chars/second, 2–15 s. */
export function humanTypingMs(text: string) {
  return Math.min(15000, Math.max(2000, text.length * 40));
}

/** Split a reply into WhatsApp-style bubbles on blank lines (max 3). */
export function splitBubbles(text: string) {
  const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 3) return parts;
  return [...parts.slice(0, 2), parts.slice(2).join("\n\n")];
}
