import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, CheckCircle2, CircleDashed, Copy, RotateCcw, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getConnectionStatus, testAgent } from "@/lib/agent.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Agent Settings — K&S Solar Agent" },
      { name: "description", content: "Configure the WhatsApp agent and connect Green API." },
      { property: "og:title", content: "Agent Settings — K&S Solar Agent" },
      { property: "og:description", content: "Configure and test the WhatsApp agent." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const statusFn = useServerFn(getConnectionStatus);
  const status = useQuery({ queryKey: ["status"], queryFn: () => statusFn() });
  const [form, setForm] = useState<{ business_name: string; instructions: string; agent_enabled: boolean } | null>(null);

  useEffect(() => {
    supabase.from("agent_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      setForm({ business_name: data?.business_name ?? "K&S Solar Energy", instructions: data?.instructions ?? "", agent_enabled: data?.agent_enabled ?? true });
    });
  }, []);

  async function save() {
    if (!form) return;
    const { error } = await supabase.from("agent_settings").upsert({ id: 1, ...form, updated_at: new Date().toISOString() });
    if (error) return void toast.error(error.message);
    toast.success("Save ho gaya");
  }

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/greenapi-webhook` : "";

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-2">
      <div className="space-y-6">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-bold">Agent</h2>
          {form && (
            <div className="mt-4 space-y-4">
              <label className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
                <span>Agent WhatsApp par khud jawab de</span>
                <Switch checked={form.agent_enabled} onCheckedChange={(v) => setForm({ ...form, agent_enabled: v })} />
              </label>
              <div className="space-y-1.5"><Label>Business ka naam</Label>
                <Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Agent ke liye hidayat (policies, timing, location, offers)</Label>
                <Textarea rows={8} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
              <Button onClick={save}>Save</Button>
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-bold">WhatsApp (Green API)</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <Status ok={status.data?.whatsapp} label="Green API instance aur token" />
            <Status ok={status.data?.webhookToken} label="Webhook security token" />
          </ul>
          <div className="mt-4 space-y-1.5">
            <Label>Webhook URL (Green API console mein lagayein)</Label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} />
              <Button variant="outline" size="icon" aria-label="Copy" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copied"); }}><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">Green API mein "Receive webhooks on incoming messages" ON karein. Asli WhatsApp ke liye app publish karke published link wala URL use karein.</p>
          </div>
        </section>
      </div>
      <TestChat />
    </div>
  );
}

function Status({ ok, label }: { ok?: boolean | undefined; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <CircleDashed className="h-4 w-4 text-muted-foreground" />}
      {label} <span className="text-muted-foreground">— {ok ? "connected" : "baqi hai"}</span>
    </li>
  );
}

type Turn = { role: "client" | "agent"; content: string };

function TestChat() {
  const run = useServerFn(testAgent);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, thinking]);

  async function submit() {
    const t = text.trim();
    if (!t || thinking) return;
    const next = [...turns, { role: "client" as const, content: t }];
    setTurns(next); setText(""); setThinking(true);
    try {
      const r = await run({ data: { history: next } });
      if ("error" in r && r.error) toast.error(r.error);
      else if ("reply" in r && r.reply) setTurns([...next, { role: "agent", content: r.reply }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Agent failed");
    } finally {
      setThinking(false);
      input.current?.focus();
    }
  }

  return (
    <section className="flex h-[640px] flex-col overflow-hidden rounded-xl border bg-chat-bg">
      <header className="flex items-center gap-2 bg-sidebar px-4 py-3 text-sidebar-foreground">
        <Bot className="h-5 w-5 text-sun" />
        <div className="flex-1"><p className="font-semibold">Agent test karein</p><p className="text-xs opacity-70">Aap client ban kar likhein — WhatsApp par kuch nahi jayega</p></div>
        <Button variant="ghost" size="icon" onClick={() => setTurns([])} aria-label="Reset"><RotateCcw className="h-4 w-4" /></Button>
      </header>
      <div className="flex-1 space-y-2 overflow-auto p-4">
        {turns.length === 0 && <p className="pt-10 text-center text-sm text-muted-foreground">Misal: "AoA, mera bill 25 hazar aata hai, kaunsa system lagega?"</p>}
        {turns.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "client" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm shadow-sm",
              m.role === "client" ? "rounded-br-sm bg-bubble-out text-bubble-out-foreground" : "rounded-bl-sm bg-bubble-in")}>{m.content}</div>
          </div>
        ))}
        {thinking && <div className="w-fit rounded-2xl rounded-bl-sm bg-bubble-in px-3.5 py-2 text-sm text-muted-foreground">typing…</div>}
        <div ref={bottom} />
      </div>
      <div className="flex gap-2 border-t bg-card p-3">
        <Textarea ref={input} autoFocus rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Client ki tarah likhein…" className="min-h-10 resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} />
        <Button size="icon" onClick={submit} disabled={thinking || !text.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </div>
    </section>
  );
}
