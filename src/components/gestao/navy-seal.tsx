import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useColaboradores } from "./use-colaboradores";

type Tag = "a_player" | "b_player" | "c_player";
type Row = { id: string; colaborador_id: string; tag: Tag; observacoes: string };

const TAG_META: Record<Tag, { label: string; className: string }> = {
  a_player: { label: "A-Player", className: "bg-success text-success-foreground" },
  b_player: { label: "B-Player", className: "bg-secondary text-secondary-foreground" },
  c_player: { label: "C-Player", className: "bg-destructive text-destructive-foreground" },
};

const emptyForm = { colaborador_id: "", tag: "b_player" as Tag, observacoes: "" };

export function NavySeal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeTable("navy_seal", ["navy_seal"]);
  const { data: colabs = [] } = useColaboradores();

  const { data: rows = [] } = useQuery({
    queryKey: ["navy_seal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("navy_seal")
        .select("id, colaborador_id, tag, observacoes")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const handleClose = (v: boolean) => {
    if (!v) { setEditId(null); setForm(emptyForm); }
    setOpen(v);
  };

  const startEdit = (r: Row) => {
    setForm({ colaborador_id: r.colaborador_id, tag: r.tag, observacoes: r.observacoes ?? "" });
    setEditId(r.id);
    setOpen(true);
  };

  const add = useMutation({
    mutationFn: async () => {
      if (!user || !form.colaborador_id) throw new Error("Selecione um colaborador");
      const { error } = await supabase.from("navy_seal").insert({ user_id: user.id, ...form });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Classificação salva");
      qc.invalidateQueries({ queryKey: ["navy_seal"] });
      setOpen(false); setForm(emptyForm);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editId || !form.colaborador_id) throw new Error("Selecione um colaborador");
      const { error } = await supabase.from("navy_seal").update(form).eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Classificação atualizada");
      qc.invalidateQueries({ queryKey: ["navy_seal"] });
      setOpen(false); setEditId(null); setForm(emptyForm);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("navy_seal").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["navy_seal"] }),
  });

  const nome = (id: string) => colabs.find((c) => c.id === id)?.nome ?? "—";
  const grouped = (tag: Tag) => rows.filter((r) => r.tag === tag);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>NavySeal — Classificação de Talentos</CardTitle>
        <Button size="sm" onClick={() => { setForm(emptyForm); setEditId(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />Classificar
        </Button>
      </CardHeader>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar classificação" : "Classificar talento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Colaborador</Label>
              <Select value={form.colaborador_id} onValueChange={(v) => setForm({ ...form, colaborador_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{colabs.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Classificação</Label>
              <Select value={form.tag} onValueChange={(v) => setForm({ ...form, tag: v as Tag })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(TAG_META) as Tag[]).map((t) => <SelectItem key={t} value={t}>{TAG_META[t].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            <Button onClick={() => editId ? update.mutate() : add.mutate()} disabled={add.isPending || update.isPending} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.keys(TAG_META) as Tag[]).map((t) => (
            <div key={t} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className={TAG_META[t].className}>{TAG_META[t].label}</Badge>
                <span className="text-xs text-muted-foreground">({grouped(t).length})</span>
              </div>
              <div className="space-y-2">
                {grouped(t).length === 0 && <p className="text-sm text-muted-foreground">—</p>}
                {grouped(t).map((r) => (
                  <div key={r.id} className="p-3 rounded-md border bg-card">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{nome(r.colaborador_id)}</span>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    {r.observacoes && <p className="text-xs text-muted-foreground mt-1">{r.observacoes}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
