import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useColaboradores } from "./use-colaboradores";

type Tag = "alta_performance" | "zona_desenvolvimento" | "zona_risco" | "zona_desalinhamento";
type Row = { id: string; colaborador_id: string; tag: Tag; observacoes: string };

const TAG_META: Record<Tag, { label: string; className: string }> = {
  alta_performance: { label: "Alta Performance", className: "bg-success text-success-foreground" },
  zona_desenvolvimento: {
    label: "Zona de Desenvolvimento",
    className: "bg-primary text-primary-foreground",
  },
  zona_risco: { label: "Zona de Risco", className: "bg-warning text-warning-foreground" },
  zona_desalinhamento: {
    label: "Zona de Desalinhamento",
    className: "bg-destructive text-destructive-foreground",
  },
};

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

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ colaborador_id: string; tag: Tag; observacoes: string }>({
    colaborador_id: "",
    tag: "zona_desenvolvimento",
    observacoes: "",
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!user || !form.colaborador_id) throw new Error("Selecione um colaborador");
      const { error } = await supabase
        .from("matriz_lideranca")
        .insert({ user_id: user.id, ...form });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Classificação salva");
      qc.invalidateQueries({ queryKey: ["matriz_lideranca"] });
      setOpen(false);
      setForm({ colaborador_id: "", tag: "zona_desenvolvimento", observacoes: "" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("matriz_lideranca").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matriz_lideranca"] }),
  });

  const nome = (id: string) => colabs.find((c) => c.id === id)?.nome ?? "—";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Matriz de Liderança</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Classificar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Classificar colaborador</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Colaborador</Label>
                <Select
                  value={form.colaborador_id}
                  onValueChange={(v) => setForm({ ...form, colaborador_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {colabs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Classificação</Label>
                <Select value={form.tag} onValueChange={(v) => setForm({ ...form, tag: v as Tag })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TAG_META) as Tag[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {TAG_META[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>
              <Button onClick={() => add.mutate()} disabled={add.isPending} className="w-full">
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.length === 0 && (
            <p className="text-muted-foreground text-sm col-span-2 text-center py-6">
              Nenhuma classificação cadastrada
            </p>
          )}
          {rows.map((r) => (
            <div key={r.id} className="p-4 rounded-lg border bg-card flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{nome(r.colaborador_id)}</h4>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Badge className={TAG_META[r.tag].className + " w-fit"}>
                {TAG_META[r.tag].label}
              </Badge>
              {r.observacoes && <p className="text-sm text-muted-foreground">{r.observacoes}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
