import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useColaboradores } from "./use-colaboradores";

type Row = {
  id: string;
  colaborador_id: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  previsao_saida: string | null;
  retorno: string | null;
  saldo_dias: number;
};

const fmt = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

export function ControleFerias() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeTable("controle_ferias", ["controle_ferias"]);
  const { data: colabs = [] } = useColaboradores();

  const { data: rows = [] } = useQuery({
    queryKey: ["controle_ferias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_ferias")
        .select(
          "id, colaborador_id, periodo_inicio, periodo_fim, previsao_saida, retorno, saldo_dias",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    colaborador_id: "",
    periodo_inicio: "",
    periodo_fim: "",
    previsao_saida: "",
    retorno: "",
    saldo_dias: 30,
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!user || !form.colaborador_id) throw new Error("Selecione um colaborador");
      const payload = {
        user_id: user.id,
        colaborador_id: form.colaborador_id,
        periodo_inicio: form.periodo_inicio || null,
        periodo_fim: form.periodo_fim || null,
        previsao_saida: form.previsao_saida || null,
        retorno: form.retorno || null,
        saldo_dias: Number(form.saldo_dias),
      };
      const { error } = await supabase.from("controle_ferias").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro de férias adicionado");
      qc.invalidateQueries({ queryKey: ["controle_ferias"] });
      setOpen(false);
      setForm({
        colaborador_id: "",
        periodo_inicio: "",
        periodo_fim: "",
        previsao_saida: "",
        retorno: "",
        saldo_dias: 30,
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("controle_ferias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["controle_ferias"] }),
  });

  const nome = (id: string) => colabs.find((c) => c.id === id)?.nome ?? "—";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Controle de Férias</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo registro</DialogTitle>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Período aquisitivo (início)</Label>
                  <Input
                    type="date"
                    value={form.periodo_inicio}
                    onChange={(e) => setForm({ ...form, periodo_inicio: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Período aquisitivo (fim)</Label>
                  <Input
                    type="date"
                    value={form.periodo_fim}
                    onChange={(e) => setForm({ ...form, periodo_fim: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Previsão de saída</Label>
                  <Input
                    type="date"
                    value={form.previsao_saida}
                    onChange={(e) => setForm({ ...form, previsao_saida: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Retorno</Label>
                  <Input
                    type="date"
                    value={form.retorno}
                    onChange={(e) => setForm({ ...form, retorno: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Saldo de dias</Label>
                  <Input
                    type="number"
                    value={form.saldo_dias}
                    onChange={(e) => setForm({ ...form, saldo_dias: Number(e.target.value) })}
                  />
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
              <TableHead>Período Aquisitivo</TableHead>
              <TableHead>Previsão Saída</TableHead>
              <TableHead>Retorno</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Sem registros
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{nome(r.colaborador_id)}</TableCell>
                <TableCell>
                  {fmt(r.periodo_inicio)} → {fmt(r.periodo_fim)}
                </TableCell>
                <TableCell>{fmt(r.previsao_saida)}</TableCell>
                <TableCell>{fmt(r.retorno)}</TableCell>
                <TableCell>{r.saldo_dias} dias</TableCell>
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
