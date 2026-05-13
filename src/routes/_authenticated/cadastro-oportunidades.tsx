import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cadastro-operacional-view";

export const Route = createFileRoute("/_authenticated/cadastro-oportunidades")({
  component: CadastroOportunidadesPage,
});

type Row = {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  savings: number;
  custo_extra: number;
  status: "identificada" | "em_andamento" | "implementada";
  data: string;
};

const STATUS_LABEL: Record<Row["status"], string> = {
  identificada: "Identificada",
  em_andamento: "Em andamento",
  implementada: "Implementada",
};

const CATEGORIAS = ["Operacional", "Tecnologia", "Processos", "Pessoas", "Comercial", "Risco"];

function CadastroOportunidadesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["oportunidades"];
  useRealtimeTable("oportunidades", queryKey);

  const { data: rows = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oportunidades")
        .select("id, titulo, descricao, categoria, savings, custo_extra, status, data")
        .order("data", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("Operacional");
  const [savings, setSavings] = useState<number | "">("");
  const [custoExtra, setCustoExtra] = useState<number | "">("");
  const [status, setStatus] = useState<Row["status"]>("identificada");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));

  const insert = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!titulo) throw new Error("Preencha o título");
      const { error } = await supabase.from("oportunidades").insert({
        user_id: user.id,
        titulo,
        descricao,
        categoria,
        savings: Number(savings || 0),
        custo_extra: Number(custoExtra || 0),
        status,
        data,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro cadastrado");
      setTitulo(""); setDescricao(""); setSavings(""); setCustoExtra(""); setStatus("identificada");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("oportunidades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const totalSavings = rows.reduce((s, r) => s + Number(r.savings), 0);
  const totalCustoExtra = rows.reduce((s, r) => s + Number(r.custo_extra ?? 0), 0);
  const implementadoSavings = rows.filter((r) => r.status === "implementada").reduce((s, r) => s + Number(r.savings), 0);
  const saldoLiquido = totalSavings - totalCustoExtra;

  return (
    <>
      <PageHeader
        title="Cadastro de Oportunidades e Riscos"
        description="Registre oportunidades de melhoria, savings estimados e custos extras gerados (riscos materializados)."
      />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6">
            <div className="text-xs uppercase text-muted-foreground">Total de registros</div>
            <div className="text-3xl font-bold mt-1">{rows.length}</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <div className="text-xs uppercase text-muted-foreground">Savings totais (R$)</div>
            <div className="text-3xl font-bold mt-1 text-success">{totalSavings.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <div className="text-xs uppercase text-muted-foreground">Custos extras (R$)</div>
            <div className="text-3xl font-bold mt-1 text-destructive">{totalCustoExtra.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <div className="text-xs uppercase text-muted-foreground">Saldo líquido (R$)</div>
            <div className={`text-3xl font-bold mt-1 ${saldoLiquido >= 0 ? "text-success" : "text-destructive"}`}>{saldoLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nova oportunidade</CardTitle>
            <CardDescription>Registre uma nova oportunidade de melhoria com savings estimados.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
              onSubmit={(e) => { e.preventDefault(); insert.mutate(); }}
            >
              <div className="space-y-2 md:col-span-2">
                <Label>Título</Label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Descrição</Label>
                <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as Row["status"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="identificada">Identificada</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="implementada">Implementada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Savings estimados (R$)</Label>
                <Input type="number" step="0.01" min={0} value={savings} onChange={(e) => setSavings(e.target.value === "" ? "" : Number(e.target.value))} required />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={insert.isPending}>Cadastrar</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Histórico de oportunidades</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Savings (R$)</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem oportunidades cadastradas.</TableCell></TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <div>{r.titulo}</div>
                      {r.descricao && <div className="text-xs text-muted-foreground">{r.descricao}</div>}
                    </TableCell>
                    <TableCell>{r.categoria}</TableCell>
                    <TableCell>
                      <Badge className={
                        r.status === "implementada" ? "bg-success text-success-foreground" :
                        r.status === "em_andamento" ? "bg-accent text-accent-foreground" :
                        "bg-muted text-muted-foreground"
                      }>{STATUS_LABEL[r.status]}</Badge>
                    </TableCell>
                    <TableCell>{new Date(r.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-right font-medium">{Number(r.savings).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
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
