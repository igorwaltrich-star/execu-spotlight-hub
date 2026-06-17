import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtMes, META_SLA } from "@/lib/constants";
import { PageHeader } from "./cadastro-operacional-view";

export type SlaField = { key: string; label: string };
export type UnidadeOption = { key: string; label: string };

type AnyRow = Record<string, unknown> & { id: string; mes: string; unidade?: string | null };

export function SlaView({
  table,
  title,
  description,
  fields,
  unidadeOptions,
}: {
  table: "sla_midea" | "sla_bosch";
  title: string;
  description: string;
  fields: SlaField[];
  unidadeOptions?: UnidadeOption[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = [table];
  useRealtimeTable(table, queryKey);

  const { data: rows = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("mes", { ascending: true });
      if (error) throw error;
      return data as AnyRow[];
    },
  });

  const empty = Object.fromEntries(fields.map((f) => [f.key, ""])) as Record<string, string>;
  const [mes, setMes] = useState("");
  const [unidade, setUnidade] = useState<string>("");
  const [vals, setVals] = useState<Record<string, string>>(empty);

  const upsert = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!mes) throw new Error("Informe o mês");
      if (unidadeOptions && !unidade) throw new Error("Selecione a operação");
      const numeric: Record<string, number> = {};
      for (const f of fields) numeric[f.key] = Number(vals[f.key] || 0);
      const payload: Record<string, unknown> = {
        user_id: user.id,
        mes: `${mes}-01`,
        ...numeric,
      };
      if (unidadeOptions) payload.unidade = unidade;
      const { error } = await supabase
        .from(table)
        .upsert(payload, {
          onConflict: unidadeOptions ? "user_id,mes,unidade" : "user_id,mes",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro salvo");
      setMes("");
      setUnidade("");
      setVals(empty);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const unidadeLabel = (key: string | null | undefined) =>
    unidadeOptions?.find((u) => u.key === key)?.label ?? "—";

  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="p-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Novo registro</CardTitle>
            <CardDescription>Valores em % (0–100). Meta: {META_SLA}%.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-2 md:grid-cols-6 gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                upsert.mutate();
              }}
            >
              <div className="space-y-2 col-span-2 md:col-span-1">
                <Label>Mês</Label>
                <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} required />
              </div>
              {unidadeOptions && (
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label>Operação</Label>
                  <Select value={unidade} onValueChange={setUnidade}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {unidadeOptions.map((u) => (
                        <SelectItem key={u.key} value={u.key}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {fields.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label>{f.label}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={vals[f.key]}
                    onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
                  />
                </div>
              ))}
              <div className="flex items-end col-span-2 md:col-span-1">
                <Button type="submit" className="w-full" disabled={upsert.isPending}>
                  Salvar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  {unidadeOptions && <TableHead>Operação</TableHead>}
                  {fields.map((f) => (
                    <TableHead key={f.key} className="text-right">
                      {f.label}
                    </TableHead>
                  ))}
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={fields.length + (unidadeOptions ? 3 : 2)}
                      className="text-center text-muted-foreground py-8"
                    >
                      Sem registros.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{fmtMes(r.mes)}</TableCell>
                    {unidadeOptions && (
                      <TableCell>{unidadeLabel(r.unidade as string | null)}</TableCell>
                    )}
                    {fields.map((f) => {
                      const v = Number(r[f.key] ?? 0);
                      const ok = v >= META_SLA;
                      return (
                        <TableCell
                          key={f.key}
                          className={`text-right font-medium ${ok ? "text-success" : "text-destructive"}`}
                        >
                          {v.toFixed(1)}%
                        </TableCell>
                      );
                    })}
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
      </div>
    </>
  );
}
