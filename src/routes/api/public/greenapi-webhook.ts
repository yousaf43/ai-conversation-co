import { createFileRoute } from "@tanstack/react-router";

type GreenWebhook = {
  typeWebhook?: string;
  idMessage?: string;
  senderData?: { chatId?: string; senderName?: string; chatName?: string };
  messageData?: {
    typeMessage?: string;
    textMessageData?: { textMessage?: string };
    extendedTextMessageData?: { text?: string };
  };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/public/greenapi-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["GREEN_WEBHOOK_TOKEN"];
        const got = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
        if (!expected || got !== expected) return json({ error: "Unauthorized" }, 401);

        const body = (await request.json().catch(() => null)) as GreenWebhook | null;
        if (!body || body.typeWebhook !== "incomingMessageReceived") return json({ ok: true, ignored: true });

        const chatId = body.senderData?.chatId;
        // Only 1:1 chats, not groups
        if (!chatId || chatId.endsWith("@g.us")) return json({ ok: true, ignored: "group" });

        const md = body.messageData;
        const text =
          md?.textMessageData?.textMessage ??
          md?.extendedTextMessageData?.text ??
          (md?.typeMessage ? `[Client ne ${md.typeMessage.replace("Message", "")} bheja]` : "");
        if (!text) return json({ ok: true, ignored: "empty" });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { handleIncomingText } = await import("@/lib/conversation.server");
          const result = await handleIncomingText(supabaseAdmin, {
            chatId,
            senderName: body.senderData?.senderName || body.senderData?.chatName || "",
            text,
            externalId: body.idMessage,
          });
          return json({ ok: true, ...result });
        } catch (err) {
          console.error("greenapi webhook failed", err);
          // 200 so Green API doesn't hammer retries; the error is logged
          return json({ ok: false, error: err instanceof Error ? err.message : "failed" });
        }
      },
    },
  },
});
