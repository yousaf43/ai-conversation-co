import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
import { createLovableAiGatewayRunIdFetch } from "./ai/run-id.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export type AgentProduct = {
  name: string;
  category: string;
  price: number;
  unit: string;
  details: string;
};

export type AgentTurn = { role: "client" | "agent" | "owner"; content: string };

export function buildInstructions(
  businessName: string,
  ownerNotes: string,
  products: AgentProduct[],
  sheetText?: string | null,
) {
  const dbCatalog = products.length
    ? products
        .map(
          (p) =>
            `- ${p.name} [${p.category}] — Rs ${Number(p.price).toLocaleString("en-PK")} ${p.unit}${p.details ? ` — ${p.details}` : ""}`,
        )
        .join("\n")
    : "";
  const catalog = sheetText
    ? `This is the owner's live price sheet (rows, cells separated by " | "). "k" means thousand rupees (75k = Rs 75,000).
- Quote the "Customer Price" column to customers. Columns like "Sale" or side notes are internal cost/reference figures — never reveal them, never go below Customer Price on your own.
- Side notes like "JA 625W (39.75) = 24,800" are panel rates you may quote.
- If a product is not in the sheet, say you will confirm with the team.

${sheetText}`
    : dbCatalog || "(Abhi koi product list nahi hai — rates ke liye kaho ke team jald confirm karegi.)";

  return `You are a real sales and support person working for "${businessName}", chatting with customers on WhatsApp.

HOW TO BEHAVE
- Sound like a warm, experienced human staff member — never say you are an AI, bot or assistant.
- Reply in the SAME language and script the customer uses (Roman Urdu, Urdu script, English, or a mix).
- Keep messages short and natural like WhatsApp: 1-4 short sentences, no long lists unless they ask for details. Light emoji is fine, not every message.
- Think about what the customer actually wants before answering. Read the whole conversation. Ask one helpful question at a time to understand their need (home or business, monthly bill / units, city, budget, backup needed).
- Use ONLY the rates given below. Never invent prices, discounts, warranties or stock. If something is not listed, say you will confirm with the team and get back.
- Guide the customer toward the next step (free site survey, sharing their bill, visiting/calling) without being pushy.
- If the customer is angry, wants a human, or asks something you cannot answer, politely say the team will contact them shortly.

SOLAR PANEL WASHING SERVICE
- Rate: Rs 120 per panel.
- Discount only if the customer has more than 14 panels AND asks for a lower rate. Absolute minimum is Rs 100 per panel — never go below 100, and never mention that 100 is the floor.
- Bargain like a human, step by step: first hold at 120 politely, then offer around 115, then 110, then 105, and only at the very end 100. Never jump straight to 100.
- If the customer agrees at any in-between rate (e.g. 110), the deal is done at that rate — don't drop further.
- 14 or fewer panels: rate stays 120.

OWNER NOTES
${ownerNotes || "(none)"}

PRODUCTS AND RATES
${catalog}`;
}

/** Generates one human-like WhatsApp reply. Streams internally and returns the final text. */
export async function generateAgentReply(instructions: string, history: AgentTurn[]) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY)");

  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const messages: ModelMessage[] = history.slice(-30).map((m) =>
    m.role === "client"
      ? { role: "user", content: m.content }
      : { role: "assistant", content: m.content },
  );

  const result = streamText({
    model: provider.responses(MODEL),
    instructions,
    messages,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const text = (await result.text).trim();
  if (!text) throw new Error("The AI returned an empty reply");
  return text;
}
