import { createFileRoute, Link } from "@tanstack/react-router";
import { Sun, MessageCircle, Brain, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "K&S Solar — WhatsApp Sales Agent" },
      { name: "description", content: "AI WhatsApp agent jo K&S Solar Energy ke clients se insaan ki tarah baat karta hai." },
      { property: "og:title", content: "K&S Solar — WhatsApp Sales Agent" },
      { property: "og:description", content: "AI WhatsApp agent jo clients se insaan ki tarah baat karta hai." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-sunrise text-sidebar-foreground">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <div className="mb-6 flex items-center gap-2 text-sun">
          <Sun className="h-6 w-6" />
          <span className="font-display text-sm font-semibold uppercase tracking-widest">K&S Solar Energy</span>
        </div>
        <h1 className="max-w-3xl text-5xl font-bold leading-tight md:text-6xl">
          Aapka WhatsApp sales agent — jo soch kar jawab deta hai.
        </h1>
        <p className="mt-5 max-w-xl text-lg opacity-80">
          Clients ke sawal samjhta hai, unki zuban mein baat karta hai, aur aapke rates ke hisab se solar system suggest karta hai.
        </p>
        <div className="mt-8">
          <Button asChild size="lg" variant="secondary">
            <Link to="/inbox">Dashboard kholein</Link>
          </Button>
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            { icon: Brain, t: "Insaan jaisa", d: "Pehle zaroorat samjhta hai, phir sahi jawab." },
            { icon: Tag, t: "Aapke rates", d: "Sirf wahi qeemat batata hai jo aap likhte hain." },
            { icon: MessageCircle, t: "Aap control mein", d: "Kisi bhi chat mein khud jawab dein ya agent rokein." },
          ].map(({ icon: I, t, d }) => (
            <div key={t} className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-5">
              <I className="h-5 w-5 text-sun" />
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1 text-sm opacity-75">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
