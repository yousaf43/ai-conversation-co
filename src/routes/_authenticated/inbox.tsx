import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, Send, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendOwnerReply } from "@/lib/agent.functions";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Chats — K&S Solar Agent" },
      { name: "description", content: "WhatsApp client conversations handled by the agent." },
      { property: "og:title", content: "Chats — K&S Solar Agent" },
      { property: "og:description", content: "WhatsApp client conversations." },
    ],
  }),
  component: Inbox,
});

function useLive(table: "messages" | "contacts", onChange: () => void) {
  useEffect(() => {
    const ch = supabase.channel(`live-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, onChange)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [table, onChange]);
}

function phone(chatId: string) {
  return "+" + chatId.replace(/@.*/, "");
}

function Inbox() {
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const contacts = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").order("last_message_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const refreshContacts = useRef(() => qc.invalidateQueries({ queryKey: ["contacts"] })).current;
  const refreshMessages = useRef(() => qc.invalidateQueries({ queryKey: ["messages"] })).current;
  useLive("contacts", refreshContacts);
  useLive("messages", refreshMessages);

  const list = contacts.data ?? [];
  const current = list.find((c) => c.id === active) ?? null;

  return (
    <div className="flex h-full">
      <section className={cn("w-full border-r bg-card md:w-80", current && "hidden md:block")}>
        <div className="border-b p-4"><h1 className="text-lg font-bold">Chats</h1></div>
        {list.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">
            Abhi koi WhatsApp chat nahi aayi. Agent Settings mein WhatsApp connect karein, ya wahan agent ko test karein.
          </p>
        )}
        {list.map((c) => (
          <button key={c.id} onClick={() => setActive(c.id)}
            className={cn("flex w-full items-center gap-3 border-b px-4 py-3 text-left hover:bg-muted", active === c.id && "bg-secondary")}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground">
              {(c.name || "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.name || phone(c.chat_id)}</p>
              <p className="truncate text-xs text-muted-foreground">{phone(c.chat_id)}</p>
            </div>
            {c.ai_paused && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">Manual</span>}
          </button>
        ))}
      </section>
      {current ? <Thread key={current.id} contact={current} onBack={() => setActive(null)} /> : (
        <div className="hidden flex-1 items-center justify-center bg-chat-bg text-muted-foreground md:flex">Koi chat select karein</div>
      )}
    </div>
  );
}

type Contact = { id: string; chat_id: string; name: string; ai_paused: boolean; stage?: string; summary?: string };

function Thread({ contact, onBack }: { contact: Contact; onBack: () => void }) {
  const qc = useQueryClient();
  const send = useServerFn(sendOwnerReply);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const msgs = useQuery({
    queryKey: ["messages", contact.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("*").eq("contact_id", contact.id).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => { bottom.current?.scrollIntoView(); }, [msgs.data]);

  async function togglePause(v: boolean) {
    const { error } = await supabase.from("contacts").update({ ai_paused: !v }).eq("id", contact.id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["contacts"] });
  }

  async function submit() {
    if (!text.trim()) return;
    setSending(true);
    const r = await send({ data: { contactId: contact.id, text } });
    setSending(false);
    if (!r.ok) return void toast.error(r.error ?? "Send failed");
    setText("");
    qc.invalidateQueries({ queryKey: ["messages", contact.id] });
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-chat-bg">
      <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
        <button className="text-sm text-primary md:hidden" onClick={onBack}>← Back</button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{contact.name || phone(contact.chat_id)}</p>
          <p className="text-xs text-muted-foreground">
            {phone(contact.chat_id)}
            {contact.stage && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">{contact.stage.replace("_", " ")}</span>}
          </p>
          {contact.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{contact.summary}</p>}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Bot className="h-4 w-4 text-primary" /> Agent
          <Switch checked={!contact.ai_paused} onCheckedChange={togglePause} />
        </label>
      </header>
      <div className="flex-1 space-y-2 overflow-auto p-4">
        {(msgs.data ?? []).map((m) => (
          <div key={m.id} className={cn("flex", m.role === "client" ? "justify-start" : "justify-end")}>
            <div className={cn("max-w-[78%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm shadow-sm",
              m.role === "client" && "rounded-bl-sm bg-bubble-in",
              m.role === "agent" && "rounded-br-sm bg-bubble-out text-bubble-out-foreground",
              m.role === "owner" && "rounded-br-sm bg-bubble-owner")}>
              {m.role !== "client" && (
                <span className="mb-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-70">
                  {m.role === "agent" ? <><Bot className="h-3 w-3" /> Agent</> : <><User className="h-3 w-3" /> Aap</>}
                </span>
              )}
              {m.content}
              <span className="mt-1 block text-right text-[10px] opacity-60">
                {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <div className="flex gap-2 border-t bg-card p-3">
        <Textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Khud jawab likhein…"
          className="min-h-10 resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} />
        <Button size="icon" onClick={submit} disabled={sending || !text.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </div>
    </section>
  );
}
