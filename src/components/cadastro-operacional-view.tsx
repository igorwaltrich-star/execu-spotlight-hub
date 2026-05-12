import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtMes, META_PRODUTIVIDADE, UNIDADES, UNIDADE_LABEL, type UnidadeKey } from "@/lib/constants";

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-border bg-card">
      <div className="px-8 py-6">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
    </div>
  );
}

type Row = { id: string; mes: string; volume: number; unidade: UnidadeKey };
type Colab = { unidade: UnidadeKey; mes: string; fte: number | null };

export function CadastroOperacionalView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["operacional_mensal"];
  useRealtimeTable("operacional_mensal", queryKey);
  useRealtimeTable("colaboradores", ["colaboradores"]);

  const { data: rows = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operacional_mensal")
        .select("id, mes, volume, unidade")
        .order("mes", { ascending: true });
      if (error) throw error;
      return data as Row[];
    },
  });

  const { data: colab = [] } = useQuery({
    queryKey: ["colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("unidade, mes, fte");
      if (error) throw error;
      return data as Colab[];
    },
  });

  const fteMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of colab) {
      const k = `${c.unidade}|${c.mes}`;
      m.set(k, (m.get(k) ?? 0) + Number(c.fte ?? 0));
    }
    return m;
  }, [colab]);

  const [unidade, setUnidade] = useState<UnidadeKey | "">("");
  const [mes, setMes] = useState("");
  const [volume, setVolume] = useState<number | "">("");

  const upsert = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!unidade || !mes || volume === "") throw new Error("Preencha todos os campos");
      const { error } = await supabase
        .from("operacional_mensal")
        .upsert(
          {
            user_id: user.id,
            unidade,
            mes: `${mes}-01`,
            volume: Number(volume),
            pessoas: 0,
          },
          { onConflict: "user_id,mes,unidade" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro salvo");
      setMes(""); setVolume(""); setUnidade("");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("operacional_mensal").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return (
    <>
      <PageHeader
        title="Cadastro Operacional"
        description={`Volume mensal por carteira/unidade. Produtividade calculada via FTE de Colaboradores. Meta: ${META_PRODUTIVIDADE} processos/pessoa.`}
      />
      <div className="p-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Novo registro mensal</CardTitle>
            <CardDescription>Selecione a carteira/unidade. Atualiza automaticamente se já existir.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-1 md:grid-cols-4 gap-4"
              onSubmit={(e) => { e.preventDefault(); upsert.mutate(); }}
            >
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={unidade} onValueChange={(v) => setUnidade(v as UnidadeKey)}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u.key} value={u.key}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mês</Label>
                <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Volume</Label>
                <Input type="number" min={0} value={volume} onChange={(e) => setVolume(e.target.value === "" ? "" : Number(e.target.value))} required />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full" disabled={upsert.isPending}>Salvar</Button>
              </div>
            </form>
            <p className="text-xs text-muted-foreground mt-3">
              FTE (pessoas) e produtividade são calculados automaticamente a partir da aba Cadastro de Colaboradores.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">FTE</TableHead>
                  <TableHead className="text-right">Produtividade</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem registros.</TableCell></TableRow>
                )}
                {rows.map((r) => {
                  const fte = fteMap.get(`${r.unidade}|${r.mes}`) ?? 0;
                  const p = fte > 0 ? r.volume / fte : 0;
                  const ok = p >= META_PRODUTIVIDADE;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{UNIDADE_LABEL[r.unidade] ?? r.unidade}</TableCell>
                      <TableCell>{fmtMes(r.mes)}</TableCell>
                      <TableCell className="text-right">{r.volume}</TableCell>
                      <TableCell className="text-right">{fte.toFixed(1)}</TableCell>
                      <TableCell className={`text-right font-medium ${fte > 0 ? (ok ? "text-success" : "text-destructive") : "text-muted-foreground"}`}>
                        {fte > 0 ? p.toFixed(1) : "—"}
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
    </>
  );
}
