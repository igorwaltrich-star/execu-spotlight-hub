import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useColaboradores } from "./use-colaboradores";

type Row = {
  id: string;
  colaborador_id: string;
  referencia: string;
  nota_zmm: number | null;
  sla_po: number | null;
  sla_sotd: number | null;
  sla_pre_alert: number | null;
  sla_otd: number | null;
  comportamental: number | null;
  meta_individual: number | null;
  observacoes: string | null;
};

const CAMPOS: { key: keyof Row; label: string }[] = [
  { key: "nota_zmm", label: "Nota ZMM" },
  { key: "sla_po", label: "SLA PO" },
  { key: "sla_sotd", label: "SLA SOTD" },
  { key: "sla_pre_alert", label: "SLA Pré-Alert" },
  { key: "sla_otd", label: "SLA OTD" },
  { key: "comportamental", label: "Comportamental" },
  { key: "meta_individual", label: "Meta Individual" },
];

function media(r: Row): number | null {
  const vals = CAMPOS.map((c) => r[c.key]).filter(
    (v): v is number => typeof v === "number" && !Number.isNaN(v),
  );
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function notaBadge(n: number | null): "default" | "secondary" | "destructive" | "outline" {
  if (n === null) return "outline";
  if (n >= 8) return "default";
  if (n >= 6) return "secondary";
  return "destructive";
}

const empty = {
  colaborador_id: "",
  referencia: new Date().toISOString().slice(0, 7),
  nota_zmm: "",
  sla_po: "",
  sla_sotd: "",
  sla_pre_alert: "",
  sla_otd: "",
  comportamental: "",
  meta_individual: "",
  observacoes: "",
};

export function IndicadoresPerformance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeTable("indicadores_performance", ["indicadores_performance"]);
  const { data: colabs = [] } = useColaboradores();

  const { data: rows = [] } = useQuery({
    queryKey: ["indicadores_performance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicadores_performance")
        .select(
          "id, colaborador_id, referencia, nota_zmm, sla_po, sla_sotd, sla_pre_alert, sla_otd, comportamental, meta_individual, observacoes",
        )
        .order("referencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const nome = (id: string) => colabs.find((c) => c.id === id)?.nome ?? "—";

  const ranking = useMemo(() => {
    const byColab = new Map<string, number[]>();
    rows.forEach((r) => {
      const m = media(r);
      if (m === null) return;
      const arr = byColab.get(r.colaborador_id) ?? [];
      arr.push(m);
      byColab.set(r.colaborador_id, arr);
    });
    return Array.from(byColab.entries())
      .map(([id, arr]) => ({
        colaborador_id: id,
        nota: arr.reduce((a, b) => a + b, 0) / arr.length,
        avaliacoes: arr.length,
      }))
      .sort((a, b) => b.nota - a.nota);
  }, [rows]);

  const add = useMutation({
    mutationFn: async () => {
      if (!user || !form.colaborador_id || !form.referencia)
        throw new Error("Selecione colaborador e referência");
      const num = (v: string) => (v === "" ? null : Number(v));
      const { error } = await supabase.from("indicadores_performance").insert({
        user_id: user.id,
        colaborador_id: form.colaborador_id,
        referencia: form.referencia,
        nota_zmm: num(form.nota_zmm),
        sla_po: num(form.sla_po),
        sla_sotd: num(form.sla_sotd),
        sla_pre_alert: num(form.sla_pre_alert),
        sla_otd: num(form.sla_otd),
        comportamental: num(form.comportamental),
        meta_individual: num(form.meta_individual),
        observacoes: form.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Indicadores salvos");
      qc.invalidateQueries({ queryKey: ["indicadores_performance"] });
      setOpen(false);
      setForm(empty);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("indicadores_performance").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["indicadores_performance"] }),
  });

  const fmt = (n: number | null) => (n === null ? "—" : n.toFixed(2));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Ranking de Analistas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Analista</TableHead>
                <TableHead className="text-right">Avaliações</TableHead>
                <TableHead className="text-right">Nota Geral</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Sem dados para gerar ranking
                  </TableCell>
                </TableRow>
              )}
              {ranking.map((r, i) => (
                <TableRow key={r.colaborador_id}>
                  <TableCell className="font-bold">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </TableCell>
                  <TableCell className="font-medium">{nome(r.colaborador_id)}</TableCell>
                  <TableCell className="text-right">{r.avaliacoes}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={notaBadge(r.nota)}>{r.nota.toFixed(2)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Indicadores cadastrados</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> Novo indicador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Novo indicador de performance</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Analista</Label>
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
                    <Label>Referência (AAAA-MM)</Label>
                    <Input
                      type="month"
                      value={form.referencia}
                      onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {CAMPOS.map((c) => (
                    <div key={c.key as string}>
                      <Label>{c.label}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="10"
                        placeholder="0 - 10"
                        value={form[c.key as keyof typeof form] as string}
                        onChange={(e) =>
                          setForm({ ...form, [c.key]: e.target.value } as typeof form)
                        }
                      />
                    </div>
                  ))}
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Analista</TableHead>
                <TableHead>Ref.</TableHead>
                {CAMPOS.map((c) => (
                  <TableHead key={c.key as string} className="text-right">
                    {c.label}
                  </TableHead>
                ))}
                <TableHead className="text-right">Média</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={CAMPOS.length + 4}
                    className="text-center text-muted-foreground py-6"
                  >
                    Nenhum indicador cadastrado
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => {
                const m = media(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{nome(r.colaborador_id)}</TableCell>
                    <TableCell>{r.referencia}</TableCell>
                    {CAMPOS.map((c) => (
                      <TableCell key={c.key as string} className="text-right">
                        {fmt(r[c.key] as number | null)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <Badge variant={notaBadge(m)}>{fmt(m)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
