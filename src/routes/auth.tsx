import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — K&S Solar Agent" },
      { name: "description", content: "Business owner sign in for the WhatsApp agent dashboard." },
      { property: "og:title", content: "Sign in — K&S Solar Agent" },
      { property: "og:description", content: "Owner sign in for the WhatsApp agent dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { session } = useSession();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) nav({ to: "/inbox", replace: true });
  }, [session, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: `${window.location.origin}/inbox` },
        });
        if (error) throw error;
        if (!data.session) toast.success("Email check karein — confirmation link bheja gaya hai.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(r.error.message ?? "Google sign in failed");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-sunrise px-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-7 shadow-2xl">
        <div className="mb-5 flex items-center gap-2 text-primary">
          <Sun className="h-5 w-5 text-sun" />
          <span className="font-display font-semibold">K&S Solar Agent</span>
        </div>
        <h1 className="text-2xl font-bold">{mode === "in" ? "Sign in" : "Account banayein"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pehla account business owner ban jata hai.</p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{mode === "in" ? "Sign in" : "Sign up"}</Button>
        </form>
        <Button variant="outline" className="mt-3 w-full" onClick={google}>Continue with Google</Button>
        <button className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Naya account banayein" : "Pehle se account hai? Sign in"}
        </button>
      </div>
    </main>
  );
}
