import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Package, Settings, Sun, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: data.session.user.id, _role: "admin" });
    return { isAdmin: Boolean(isAdmin), email: data.session.user.email ?? "" };
  },
  component: Layout,
});

const nav = [
  { to: "/inbox", label: "Chats", icon: MessageCircle },
  { to: "/products", label: "Products & Rates", icon: Package },
  { to: "/settings", label: "Agent Settings", icon: Settings },
] as const;

function Layout() {
  const { isAdmin, email } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-row items-center gap-1 bg-sidebar p-2 text-sidebar-foreground md:w-60 md:flex-col md:items-stretch md:p-4">
        <div className="mr-2 flex items-center gap-2 px-2 md:mb-6 md:mr-0">
          <Sun className="h-5 w-5 text-sun" />
          <span className="hidden font-display font-semibold md:inline">K&S Solar Agent</span>
        </div>
        {nav.map(({ to, label, icon: I }) => (
          <Link key={to} to={to} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm opacity-80 hover:bg-sidebar-accent hover:opacity-100"
            activeProps={{ className: "bg-sidebar-accent !opacity-100 text-sun" }}>
            <I className="h-4 w-4" /><span className="hidden sm:inline">{label}</span>
          </Link>
        ))}
        <div className="ml-auto md:ml-0 md:mt-auto">
          <p className="hidden truncate px-3 pb-2 text-xs opacity-60 md:block">{email}</p>
          <button onClick={signOut} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm opacity-80 hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </aside>
      <main className="min-h-0 flex-1 overflow-auto">
        {isAdmin ? <Outlet /> : (
          <div className="p-10 text-center text-muted-foreground">Yeh account business owner nahi hai. Owner account se sign in karein.</div>
        )}
      </main>
    </div>
  );
}
