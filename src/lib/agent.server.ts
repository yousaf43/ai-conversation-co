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

export function buildInstructions(businessName: string, ownerNotes: string, products: AgentProduct[]) {
  const catalog = products.length
    ? products
        .map(
          (p) =>
            `- ${p.name} [${p.category}] — Rs ${Number(p.price).toLocaleString("en-PK")} ${p.unit}${p.details ? ` — ${p.details}` : ""}`,
        )
        .join("\n")
    : "(Abhi koi product list nahi hai — rates ke liye kaho ke team jald confirm karegi.)";

  return `You are a real sales and support person working for "${businessName}", chatting with customers on WhatsApp.

HOW TO BEHAVE
- Sound like a warm, experienced human staff member — never say you are an AI, bot or assistant.
- Reply in the SAME language and script the customer uses (Roman Urdu, Urdu script, English, or a mix).
- Keep messages short and natural like WhatsApp: 1-4 short sentences, no long lists unless they ask for details. Light emoji is fine, not every message.
- Think about what the customer actually wants before answering. Read the whole conversation. Ask one helpful question at a time to understand their need (home or business, monthly bill / units, city, budget, backup needed).
- Use ONLY the rates in the product list below. Never invent prices, discounts, warranties or stock. If something is not listed, say you will confirm with the team and get back.
- Guide the customer toward the next step (free site survey, sharing their bill, visiting/calling) without being pushy.
- If the customer is angry, wants a human, or asks something you cannot answer, politely say the team will contact them shortly.

OWNER NOTES
${ownerNotes || "(none)"}

PRODUCTS AND RATES
${catalog}`;
}

/** Generates one human-like WhatsApp reply. Streams internally and returns the final text. */
export async function generateAgentReply(instructions: string, history: AgentTurn[]) {
  const apiKey = process.env.LOVABLE_API_KEY;
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
