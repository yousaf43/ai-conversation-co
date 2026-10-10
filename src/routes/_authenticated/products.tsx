import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products & Rates — K&S Solar Agent" },
      { name: "description", content: "Manage the products and rates the WhatsApp agent quotes." },
      { property: "og:title", content: "Products & Rates — K&S Solar Agent" },
      { property: "og:description", content: "Products and rates the agent quotes." },
    ],
  }),
  component: Products,
});

type Product = { id?: string; name: string; category: string; price: number; unit: string; details: string; active: boolean };
const blank: Product = { name: "", category: "Complete Systems", price: 0, unit: "per system", details: "", active: true };

function Products() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Product | null>(null);
  const q = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("category").order("price");
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["products"] });

  async function save() {
    if (!edit?.name.trim()) return toast.error("Naam likhein");
    const { id, ...row } = edit;
    const { error } = id
      ? await supabase.from("products").update(row).eq("id", id)
      : await supabase.from("products").insert(row);
    if (error) return toast.error(error.message);
    setEdit(null);
    refresh();
  }
  async function remove(id: string) {
    if (!confirm("Yeh product delete karein?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }
  async function toggle(p: Product) {
    const { error } = await supabase.from("products").update({ active: !p.active }).eq("id", p.id!);
    if (error) return toast.error(error.message);
    refresh();
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Products & Rates</h1>
          <p className="text-sm text-muted-foreground">Agent sirf yahi rates clients ko batayega. Abhi demo rates hain — apne asli rates daal dein.</p>
        </div>
        <Button onClick={() => setEdit({ ...blank })}><Plus className="h-4 w-4" /> Product add karein</Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        {(q.data ?? []).map((p) => (
          <div key={p.id} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{p.name} <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">{p.category}</span></p>
              <p className="truncate text-xs text-muted-foreground">{p.details}</p>
            </div>
            <p className="whitespace-nowrap font-display font-semibold">Rs {Number(p.price).toLocaleString("en-PK")}<span className="ml-1 text-xs font-normal text-muted-foreground">{p.unit}</span></p>
            <Switch checked={p.active} onCheckedChange={() => toggle(p)} aria-label="Active" />
            <Button variant="ghost" size="icon" onClick={() => setEdit(p)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => remove(p.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Product edit" : "Naya product"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Naam</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Category</Label><Input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Unit</Label><Input value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Rate (Rs)</Label><Input type="number" value={edit.price} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label>Details (warranty, brand, kis ke liye)</Label><Textarea value={edit.details} onChange={(e) => setEdit({ ...edit, details: e.target.value })} /></div>
              <Button className="w-full" onClick={save}>Save</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
