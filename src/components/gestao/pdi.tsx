import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type Status = "nao_iniciado" | "em_andamento" | "concluido" | "atrasado";
type Row = {
  id: string;
  colaborador_id: string;
  meta: string;
  prazo: string | null;
  status: Status;
};

const STATUS_META: Record<
  Status,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  nao_iniciado: { label: "Não iniciado", variant: "outline" },
  em_andamento: { label: "Em andamento", variant: "default" },
  concluido: { label: "Concluído", variant: "secondary" },
  atrasado: { label: "Atrasado", variant: "destructive" },
};

const fmt = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

export function PDI() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeTable("pdi", ["pdi"]);
  const { data: colabs = [] } = useColaboradores();

  const { data: rows = [] } = useQuery({
    queryKey: ["pdi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdi")
        .select("id, colaborador_id, meta, prazo, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    colaborador_id: string;
    meta: string;
    prazo: string;
    status: Status;
  }>({
    colaborador_id: "",
    meta: "",
    prazo: "",
    status: "nao_iniciado",
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!user || !form.colaborador_id || !form.meta)
        throw new Error("Preencha colaborador e meta");
      const { error } = await supabase.from("pdi").insert({
        user_id: user.id,
        colaborador_id: form.colaborador_id,
        meta: form.meta,
        prazo: form.prazo || null,
        status: form.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meta adicionada");
      qc.invalidateQueries({ queryKey: ["pdi"] });
      setOpen(false);
      setForm({ colaborador_id: "", meta: "", prazo: "", status: "nao_iniciado" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pdi").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pdi"] }),
  });

  const nome = (id: string) => colabs.find((c) => c.id === id)?.nome ?? "—";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>PDI — Plano de Desenvolvimento Individual</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Nova meta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova meta</DialogTitle>
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
                <Label>Meta</Label>
                <Textarea
                  value={form.meta}
                  onChange={(e) => setForm({ ...form, meta: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prazo</Label>
                  <Input
                    type="date"
                    value={form.prazo}
                    onChange={(e) => setForm({ ...form, prazo: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v as Status })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_META) as Status[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_META[s].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => add.mutate()} disabled={add.isPending} className="w-full">
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Meta</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  Nenhuma meta cadastrada
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{nome(r.colaborador_id)}</TableCell>
                <TableCell className="max-w-md">{r.meta}</TableCell>
                <TableCell>{fmt(r.prazo)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_META[r.status].variant}>
                    {STATUS_META[r.status].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
