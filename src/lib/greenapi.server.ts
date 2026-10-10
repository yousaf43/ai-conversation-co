function config() {
  const instance = process.env.GREEN_API_INSTANCE_ID;
  const token = process.env.GREEN_API_TOKEN;
  const base = (process.env.GREEN_API_URL || "https://api.green-api.com").replace(/\/+$/, "");
  if (!instance || !token) throw new Error("WhatsApp (Green API) is not connected yet");
  return { instance, token, base };
}

export function greenApiConfigured() {
  return Boolean(process.env.GREEN_API_INSTANCE_ID && process.env.GREEN_API_TOKEN);
}

export async function sendWhatsAppText(chatId: string, message: string) {
  const { instance, token, base } = config();
  const res = await fetch(`${base}/waInstance${instance}/sendMessage/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
  });
  if (!res.ok) {
    throw new Error(`WhatsApp send failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as { idMessage?: string };
}
