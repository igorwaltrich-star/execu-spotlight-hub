import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useColaboradores } from "@/components/gestao/use-colaboradores";
import { UNIDADES, metaProdUnidade } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, TrendingUp, Users, Activity } from "lucide-react";
import { toast } from "sonner";
import {
  ImportarPlanilha,
  parseMes,
  parseNum,
  buscarPorNome,
} from "@/components/importar-planilha";

type Registro = {
  id: string;
  colaborador_id: string;
  operacao: string;
  mes: string;
  volume_processos: number;
  dias_trabalhados: number;
  dias_uteis_mes: number;
  fte: number;
  produtividade: number;
  observacoes?: string;
};

type Alocacao = {
  id: string;
  colaborador_id: string;
  operacao: string;
  mes: string;
  dias_na_operacao: number;
  dias_uteis_mes: number;
  fte: number;
  tipo: string;
  motivo?: string;
};

const MESES_UTEIS: Record<string, number> = {
  "2026-01": 22,
  "2026-02": 20,
  "2026-03": 21,
  "2026-04": 22,
  "2026-05": 21,
  "2026-06": 21,
  "2026-07": 23,
  "2026-08": 21,
  "2026-09": 22,
  "2026-10": 22,
  "2026-11": 20,
  "2026-12": 23,
};

const emptyForm = {
  colaborador_id: "",
  operacao: "",
  mes: new Date().toISOString().slice(0, 7),
  volume_processos: "",
  dias_trabalhados: "",
  dias_uteis_mes: "22",
  observacoes: "",
};

export function ProdutividadeView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: colabs = [] } = useColaboradores();
  const [filtroOp, setFiltroOp] = useState("all");
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7));
  const [openReg, setOpenReg] = useState(false);
  const [openAloc, setOpenAloc] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [alocForm, setAlocForm] = useState({
    colaborador_id: "",
    operacao: "",
    mes: new Date().toISOString().slice(0, 7),
    dias_na_operacao: "",
    dias_uteis_mes: "22",
    tipo: "temporario",
    motivo: "",
  });

  const { data: registros = [] } = useQuery({
    queryKey: ["registros_produtividade", filtroOp, filtroMes],
    queryFn: async () => {
      let q = supabase.from("registros_produtividade").select("*");
      if (filtroOp !== "all") q = q.eq("operacao", filtroOp);
      if (filtroMes) q = q.eq("mes", filtroMes + "-01");
      const { data, error } = await q.order("operacao").order("colaborador_id");
      if (error) throw error;
      return (data ?? []) as Registro[];
    },
  });

  const { data: alocacoes = [] } = useQuery({
    queryKey: ["alocacoes_periodo", filtroMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alocacoes_periodo")
        .select("*")
        .eq("mes", filtroMes + "-01");
      if (error) throw error;
      return (data ?? []) as Alocacao[];
    },
  });

  const nome = (id: string) => colabs.find((c) => c.id === id)?.nome ?? "—";

  const kpis = useMemo(() => {
    const totalFte = registros.reduce((s, r) => s + Number(r.fte ?? 0), 0);
    const totalVol = registros.reduce((s, r) => s + r.volume_processos, 0);
    const avgProd = totalFte > 0 ? totalVol / totalFte : 0;
    return { totalFte, totalVol, avgProd, count: registros.length };
  }, [registros]);

  const addReg = useMutation({
    mutationFn: async () => {
      if (!user || !form.colaborador_id || !form.operacao)
        throw new Error("Preencha todos os campos obrigatórios");
      const payload = {
        user_id: user.id,
        colaborador_id: form.colaborador_id,
        operacao: form.operacao,
        mes: form.mes + "-01",
        volume_processos: Number(form.volume_processos),
        dias_trabalhados: Number(form.dias_trabalhados),
        dias_uteis_mes: Number(form.dias_uteis_mes),
        observacoes: form.observacoes || null,
      };
      if (editId) {
        const { error } = await supabase
          .from("registros_produtividade")
          .update(payload)
          .eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("registros_produtividade").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Registro atualizado" : "Registro adicionado");
      qc.invalidateQueries({ queryKey: ["registros_produtividade"] });
      setOpenReg(false);
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const delReg = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("registros_produtividade").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["registros_produtividade"] });
    },
  });

  const addAloc = useMutation({
    mutationFn: async () => {
      if (!user || !alocForm.colaborador_id || !alocForm.operacao)
        throw new Error("Preencha todos os campos");
      const { error } = await supabase.from("alocacoes_periodo").upsert(
        {
          created_by: user.id,
          colaborador_id: alocForm.colaborador_id,
          operacao: alocForm.operacao,
          mes: alocForm.mes + "-01",
          dias_na_operacao: Number(alocForm.dias_na_operacao),
          dias_uteis_mes: Number(alocForm.dias_uteis_mes),
          tipo: alocForm.tipo,
          motivo: alocForm.motivo || null,
        },
        { onConflict: "colaborador_id,operacao,mes" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alocação registrada");
      qc.invalidateQueries({ queryKey: ["alocacoes_periodo"] });
      setOpenAloc(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const startEdit = (r: Registro) => {
    setForm({
      colaborador_id: r.colaborador_id,
      operacao: r.operacao,
      mes: r.mes.slice(0, 7),
      volume_processos: String(r.volume_processos),
      dias_trabalhados: String(r.dias_trabalhados),
      dias_uteis_mes: String(r.dias_uteis_mes),
      observacoes: r.observacoes ?? "",
    });
    setEditId(r.id);
    setOpenReg(true);
  };

  const prodColor = (prod: number, op: string) => {
    const meta = metaProdUnidade(op);
    const pct = meta > 0 ? prod / meta : 0;
    return pct >= 1 ? "text-success" : pct >= 0.7 ? "text-warning" : "text-destructive";
  };

  const handleMesChange = (mes: string) => {
    setForm((f) => ({ ...f, mes, dias_uteis_mes: String(MESES_UTEIS[mes] ?? 22) }));
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Produtividade por Pessoa</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registro individual com FTE proporcional · rotation integrado
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-2 flex-wrap">
            <ImportarPlanilha
              nomeArquivo="produtividade"
              tabela="registros_produtividade"
              onConflict="colaborador_id,operacao,mes"
              invalidar={["registros_produtividade"]}
              ajuda="Colaborador precisa existir no cadastro. Operação aceita o rótulo (Midea SC) ou a chave (midea_sc). Mês no formato AAAA-MM."
              campos={[
                {
                  coluna: "Colaborador",
                  exemplo: colabs[0]?.nome ?? "Nome do colaborador",
                  obrigatorio: true,
                  largura: 26,
                },
                { coluna: "Operacao", exemplo: "Midea SC", obrigatorio: true, largura: 16 },
                { coluna: "Mes", exemplo: new Date().toISOString().slice(0, 7), obrigatorio: true },
                { coluna: "Volume", exemplo: 85, obrigatorio: true },
                { coluna: "Dias trabalhados", exemplo: 22, obrigatorio: true, largura: 18 },
                { coluna: "Dias uteis", exemplo: 22, obrigatorio: true },
                { coluna: "Observacoes", exemplo: "", largura: 30 },
              ]}
              montarRegistro={(l) => {
                const c = buscarPorNome(colabs, l.colaborador);
                if (!c) return { ok: false, erro: `Colaborador "${l.colaborador}" nao encontrado` };
                const op = UNIDADES.find(
                  (u) =>
                    u.key === l.operacao.toLowerCase() ||
                    u.label.toLowerCase() === l.operacao.toLowerCase(),
                );
                if (!op) return { ok: false, erro: `Operacao "${l.operacao}" nao reconhecida` };
                const mes = parseMes(l.mes);
                if (!mes) return { ok: false, erro: `Mes "${l.mes}" invalido (use AAAA-MM)` };
                const uteis = parseNum(l.dias_uteis);
                if (uteis <= 0) return { ok: false, erro: "Dias uteis deve ser maior que zero" };
                return {
                  ok: true,
                  registro: {
                    user_id: user?.id,
                    colaborador_id: c.id,
                    operacao: op.key,
                    mes,
                    volume_processos: Math.round(parseNum(l.volume)),
                    dias_trabalhados: parseNum(l.dias_trabalhados),
                    dias_uteis_mes: Math.round(uteis),
                    observacoes: l.observacoes || null,
                  },
                };
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpenAloc(true);
              }}
            >
              <Users className="h-4 w-4 mr-1.5" /> Registrar Rotation
            </Button>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setForm(emptyForm);
              setEditId(null);
              setOpenReg(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Novo Registro
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filtroOp} onValueChange={setFiltroOp}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Operação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as operações</SelectItem>
            {UNIDADES.map((u) => (
              <SelectItem key={u.key} value={u.key}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="month"
          value={filtroMes}
          onChange={(e) => setFiltroMes(e.target.value)}
          className="w-40"
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Registros",
            value: kpis.count,
            icon: Activity,
            sub: "colaboradores no período",
          },
          {
            label: "FTE Total",
            value: kpis.totalFte.toFixed(1),
            icon: Users,
            sub: "equivalente jornada completa",
          },
          {
            label: "Volume Total",
            value: kpis.totalVol.toLocaleString("pt-BR"),
            icon: TrendingUp,
            sub: "processos no período",
          },
          {
            label: "Produtividade Média",
            value: kpis.avgProd.toFixed(1),
            icon: TrendingUp,
            sub: "proc/FTE",
          },
        ].map(({ label, value, icon: Icon, sub }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {label}
                </span>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-semibold">{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Registros</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead className="text-right">Dias Trab.</TableHead>
                <TableHead className="text-right">FTE</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">Produt.</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead className="text-right">% Meta</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                    Nenhum registro para o período selecionado
                  </TableCell>
                </TableRow>
              )}
              {registros.map((r) => {
                const meta = metaProdUnidade(r.operacao);
                const pct = meta > 0 ? Math.round((Number(r.produtividade) / meta) * 100) : 0;
                const aloc = alocacoes.find(
                  (a) => a.colaborador_id === r.colaborador_id && a.operacao === r.operacao,
                );
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {nome(r.colaborador_id)}
                      {aloc?.tipo === "temporario" && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          Rotation
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {UNIDADES.find((u) => u.key === r.operacao)?.label ?? r.operacao}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.dias_trabalhados}/{r.dias_uteis_mes}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(r.fte ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">{r.volume_processos}</TableCell>
                    <TableCell
                      className={`text-right font-semibold ${prodColor(Number(r.produtividade), r.operacao)}`}
                    >
                      {Number(r.produtividade).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{meta}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={pct >= 100 ? "default" : pct >= 70 ? "secondary" : "destructive"}
                      >
                        {pct}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => delReg.mutate(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Alocações/Rotation */}
      {alocacoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Rotations ativos no período</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead className="text-right">Dias</TableHead>
                  <TableHead className="text-right">FTE</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alocacoes.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{nome(a.colaborador_id)}</TableCell>
                    <TableCell>
                      {UNIDADES.find((u) => u.key === a.operacao)?.label ?? a.operacao}
                    </TableCell>
                    <TableCell className="text-right">
                      {a.dias_na_operacao}/{a.dias_uteis_mes}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(a.fte ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.tipo === "temporario" ? "outline" : "default"}>
                        {a.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {a.motivo ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog — Novo registro */}
      <Dialog
        open={openReg}
        onOpenChange={(v) => {
          if (!v) {
            setEditId(null);
            setForm(emptyForm);
          }
          setOpenReg(v);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Editar registro" : "Novo registro de produtividade"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Colaborador</Label>
                <Select
                  value={form.colaborador_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, colaborador_id: v }))}
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
                <Label>Operação</Label>
                <Select
                  value={form.operacao}
                  onValueChange={(v) => setForm((f) => ({ ...f, operacao: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u.key} value={u.key}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mês</Label>
                <Input
                  type="month"
                  value={form.mes}
                  onChange={(e) => handleMesChange(e.target.value)}
                />
              </div>
              <div>
                <Label>Dias úteis do mês</Label>
                <Input
                  type="number"
                  value={form.dias_uteis_mes}
                  onChange={(e) => setForm((f) => ({ ...f, dias_uteis_mes: e.target.value }))}
                />
              </div>
              <div>
                <Label>Dias trabalhados</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={form.dias_trabalhados}
                  onChange={(e) => setForm((f) => ({ ...f, dias_trabalhados: e.target.value }))}
                  placeholder="Ex: 22"
                />
              </div>
              <div>
                <Label>Volume de processos</Label>
                <Input
                  type="number"
                  value={form.volume_processos}
                  onChange={(e) => setForm((f) => ({ ...f, volume_processos: e.target.value }))}
                  placeholder="Ex: 85"
                />
              </div>
            </div>
            {form.dias_trabalhados && form.dias_uteis_mes && form.volume_processos && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <span className="text-muted-foreground">FTE calculado: </span>
                <strong>
                  {(Number(form.dias_trabalhados) / Number(form.dias_uteis_mes)).toFixed(2)}
                </strong>
                <span className="text-muted-foreground ml-3">Produtividade: </span>
                <strong>
                  {Number(form.dias_trabalhados) > 0
                    ? (
                        Number(form.volume_processos) /
                        (Number(form.dias_trabalhados) / Number(form.dias_uteis_mes))
                      ).toFixed(1)
                    : "—"}
                </strong>
              </div>
            )}
            <div>
              <Label>Observações</Label>
              <Input
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
            <Button onClick={() => addReg.mutate()} disabled={addReg.isPending} className="w-full">
              {addReg.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog — Rotation */}
      <Dialog open={openAloc} onOpenChange={setOpenAloc}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Rotation / Alocação parcial</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Registre quando um colaborador trabalhou parcialmente em uma operação diferente da
              sua. O FTE será calculado proporcionalmente.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Colaborador</Label>
                <Select
                  value={alocForm.colaborador_id}
                  onValueChange={(v) => setAlocForm((f) => ({ ...f, colaborador_id: v }))}
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
                <Label>Operação (destino)</Label>
                <Select
                  value={alocForm.operacao}
                  onValueChange={(v) => setAlocForm((f) => ({ ...f, operacao: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u.key} value={u.key}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mês</Label>
                <Input
                  type="month"
                  value={alocForm.mes}
                  onChange={(e) => setAlocForm((f) => ({ ...f, mes: e.target.value }))}
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={alocForm.tipo}
                  onValueChange={(v) => setAlocForm((f) => ({ ...f, tipo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="temporario">Temporário</SelectItem>
                    <SelectItem value="fixo">Fixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dias nesta operação</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={alocForm.dias_na_operacao}
                  onChange={(e) => setAlocForm((f) => ({ ...f, dias_na_operacao: e.target.value }))}
                  placeholder="Ex: 11"
                />
              </div>
              <div>
                <Label>Dias úteis do mês</Label>
                <Input
                  type="number"
                  value={alocForm.dias_uteis_mes}
                  onChange={(e) => setAlocForm((f) => ({ ...f, dias_uteis_mes: e.target.value }))}
                />
              </div>
            </div>
            {alocForm.dias_na_operacao && alocForm.dias_uteis_mes && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <span className="text-muted-foreground">FTE nesta operação: </span>
                <strong>
                  {(Number(alocForm.dias_na_operacao) / Number(alocForm.dias_uteis_mes)).toFixed(2)}
                </strong>
              </div>
            )}
            <div>
              <Label>Motivo</Label>
              <Input
                value={alocForm.motivo}
                onChange={(e) => setAlocForm((f) => ({ ...f, motivo: e.target.value }))}
                placeholder="Ex: Cobertura de férias"
              />
            </div>
            <Button
              onClick={() => addAloc.mutate()}
              disabled={addAloc.isPending}
              className="w-full"
            >
              {addAloc.isPending ? "Salvando..." : "Registrar alocação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
