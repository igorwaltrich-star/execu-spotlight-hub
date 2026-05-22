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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, BarChart3 } from "lucide-react";
import { toast } from "sonner";

type Row = { id: string; titulo: string; causa: string; frequencia: number };

export function Pareto() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeTable("pareto", ["pareto"]);

  const { data: rows = [] } = useQuery({
    queryKey: ["pareto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pareto")
        .select("id, titulo, causa, frequencia")
        .order("frequencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [titulo, setTitulo] = useState("Análise atual");
  const [causa, setCausa] = useState("");
  const [frequencia, setFrequencia] = useState<number | "">("");

  const add = useMutation({
    mutationFn: async () => {
      if (!user || !causa) throw new Error("Informe causa");
      const { error } = await supabase
        .from("pareto")
        .insert({ user_id: user.id, titulo, causa, frequencia: Number(frequencia || 0) });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Causa adicionada");
      qc.invalidateQueries({ queryKey: ["pareto"] });
      setCausa("");
      setFrequencia("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pareto").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pareto"] }),
  });

  const total = rows.reduce((s, r) => s + Number(r.frequencia), 0);
  let acc = 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Diagrama de Pareto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Análise</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div>
              <Label>Causa</Label>
              <Input value={causa} onChange={(e) => setCausa(e.target.value)} />
            </div>
            <div>
              <Label>Frequência</Label>
              <Input
                type="number"
                value={frequencia}
                onChange={(e) => setFrequencia(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
          </div>
          <Button onClick={() => add.mutate()} disabled={add.isPending}>
            Adicionar causa
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Causas (ordenadas)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Causa</TableHead>
                <TableHead className="text-right">Frequência</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">% Acumulado</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Sem dados
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => {
                const pct = total ? (Number(r.frequencia) / total) * 100 : 0;
                acc += pct;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.causa}</TableCell>
                    <TableCell className="text-right">{r.frequencia}</TableCell>
                    <TableCell className="text-right">{pct.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{acc.toFixed(1)}%</TableCell>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Gráfico 80/20
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 rounded-md border-2 border-dashed border-border grid place-items-center text-muted-foreground text-sm">
            Visualização do gráfico será adicionada em breve
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
