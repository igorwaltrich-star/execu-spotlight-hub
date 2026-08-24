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
import { GripVertical, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useColaboradores } from "./use-colaboradores";

type Tag = "alta_performance" | "zona_desenvolvimento" | "zona_risco" | "zona_desalinhamento";
type Row = { id: string; colaborador_id: string; tag: Tag; observacoes: string };

const DEFAULT_TAG: Tag = "zona_desenvolvimento";

const TAG_META: Record<Tag, { label: string; className: string }> = {
  alta_performance: { label: "Alta Performance", className: "bg-success text-success-foreground" },
  zona_desenvolvimento: { label: "Zona de Desenvolvimento", className: "bg-primary text-primary-foreground" },
  zona_risco: { label: "Zona de Risco", className: "bg-warning text-warning-foreground" },
  zona_desalinhamento: { label: "Zona de Desalinhamento", className: "bg-destructive text-destructive-foreground" },
};

const TAGS = Object.keys(TAG_META) as Tag[];

export function MatrizLideranca() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeTable("matriz_lideranca", ["matriz_lideranca"]);
  const { data: colabs = [] } = useColaboradores();

  const { data: rows = [] } = useQuery({
    queryKey: ["matriz_lideranca"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriz_lideranca")
        .select("id, colaborador_id, tag, observacoes")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const byColab = new Map(rows.map((r) => [r.colaborador_id, r]));
  const cards = colabs.map((c) => {
    const r = byColab.get(c.id);
    return {
      colaborador_id: c.id,
      nome: c.nome,
      cargo: c.cargo,
      tag: r?.tag ?? DEFAULT_TAG,
      observacoes: r?.observacoes ?? "",
      rowId: r?.id ?? null,
    };
  });

  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Tag | null>(null);
  const [editColab, setEditColab] = useState<string | null>(null);
  const [form, setForm] = useState({ tag: DEFAULT_TAG, observacoes: "" });

  const classify = useMutation({
    mutationFn: async (p: { colaborador_id: string; tag: Tag; observacoes?: string }) => {
      if (!user) throw new Error("Sessão expirada");
      const existing = byColab.get(p.colaborador_id);
      if (existing) {
        const patch: Partial<Row> = { tag: p.tag };
        if (p.observacoes !== undefined) patch.observacoes = p.observacoes;
        const { error } = await supabase.from("matriz_lideranca").update(patch).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("matriz_lideranca").insert({
          user_id: user.id,
          colaborador_id: p.colaborador_id,
          tag: p.tag,
          observacoes: p.observacoes ?? "",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Classificação salva");
      qc.invalidateQueries({ queryKey: ["matriz_lideranca"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("matriz_lideranca").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Classificação removida");
      qc.invalidateQueries({ queryKey: ["matriz_lideranca"] });
    },
  });

  const drop = (tag: Tag) => {
    setDragOver(null);
    const id = dragging;
    setDragging(null);
    if (!id) return;
    const current = byColab.get(id);
    if ((current?.tag ?? DEFAULT_TAG) === tag && current) return;
    classify.mutate({ colaborador_id: id, tag });
  };

  const editing = cards.find((c) => c.colaborador_id === editColab);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Matriz de Liderança</CardTitle>
        <p className="text-sm text-muted-foreground">
          Arraste cada colaborador para o quadro desejado. Não classificados iniciam em “{TAG_META[DEFAULT_TAG].label}”.
        </p>
      </CardHeader>

      <Dialog open={!!editColab} onOpenChange={(v) => !v && setEditColab(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Classificação</Label>
              <Select value={form.tag} onValueChange={(v) => setForm({ ...form, tag: v as Tag })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TAGS.map((t) => <SelectItem key={t} value={t}>{TAG_META[t].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            <Button
              className="w-full"
              disabled={classify.isPending}
              onClick={() => {
                if (!editColab) return;
                classify.mutate(
                  { colaborador_id: editColab, tag: form.tag, observacoes: form.observacoes },
                  { onSuccess: () => setEditColab(null) },
                );
              }}
            >
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CardContent>
        {colabs.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-6">Cadastre colaboradores para classificá-los</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {TAGS.map((t) => {
            const list = cards.filter((c) => c.tag === t);
            return (
              <div
                key={t}
                onDragOver={(e) => { e.preventDefault(); setDragOver(t); }}
                onDragLeave={() => setDragOver((p) => (p === t ? null : p))}
                onDrop={(e) => { e.preventDefault(); drop(t); }}
                className={cn(
                  "rounded-lg border bg-muted/30 p-3 space-y-2 min-h-40 transition-colors",
                  dragOver === t && "border-primary bg-primary/10",
                )}
              >
                <div className="flex items-center gap-2">
                  <Badge className={TAG_META[t].className}>{TAG_META[t].label}</Badge>
                  <span className="text-xs text-muted-foreground">({list.length})</span>
                </div>
                <div className="space-y-2">
                  {list.length === 0 && <p className="text-xs text-muted-foreground">Solte aqui</p>}
                  {list.map((c) => (
                    <div
                      key={c.colaborador_id}
                      draggable
                      onDragStart={() => setDragging(c.colaborador_id)}
                      onDragEnd={() => { setDragging(null); setDragOver(null); }}
                      onClick={() => { setForm({ tag: c.tag, observacoes: c.observacoes }); setEditColab(c.colaborador_id); }}
                      className={cn(
                        "p-3 rounded-md border bg-card cursor-grab active:cursor-grabbing",
                        dragging === c.colaborador_id && "opacity-50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{c.nome}</p>
                            {c.cargo && <p className="text-xs text-muted-foreground truncate">{c.cargo}</p>}
                          </div>
                        </div>
                        {c.rowId && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Remover classificação"
                            onClick={(e) => { e.stopPropagation(); del.mutate(c.rowId!); }}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {c.observacoes && <p className="text-xs text-muted-foreground mt-1">{c.observacoes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
