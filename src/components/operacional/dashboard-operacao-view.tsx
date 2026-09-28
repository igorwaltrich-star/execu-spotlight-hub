import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/use-perfil";
import { useColaboradores } from "@/components/gestao/use-colaboradores";
import { useDadosOperacionais } from "@/hooks/use-dados-operacionais";
import { UNIDADES, metaProdUnidade, type UnidadeKey } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
} from "recharts";
import { Building2, TrendingUp, Users, AlertTriangle, DollarSign, Target } from "lucide-react";

type RegProd = {
  colaborador_id: string;
  operacao: string;
  mes: string;
  volume_processos: number;
  fte: number;
  produtividade: number;
};
type NaoConf = {
  operacao: string;
  colaborador_id?: string | null;
  tipo: string;
  data_ocorrencia: string;
  custo_gerado: number;
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const n0 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const fmtMes = (m: string) => {
  const [y, mm] = m.split("-");
  return `${["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][Number(mm) - 1]}/${y.slice(2)}`;
};

/** Pontuação 0-100 por dimensão operacional, sem inventar dado que não existe. */
function notaOu(valor: number | null): number | null {
  return valor === null ? null : Math.max(0, Math.min(100, valor));
}

export function DashboardOperacaoView() {
  const { eUmDe } = usePerfil();
  const podeVerCusto = eUmDe(["gestor", "coordenador"]);
  const { data: colabs = [] } = useColaboradores();
  const [opSel, setOpSel] = useState<UnidadeKey>(UNIDADES[0].key);
  const [mes, setMes] = useState("");

  const dados = useDadosOperacionais(mes || undefined, podeVerCusto);
  const indicador = dados.porOperacao.find((o) => o.key === opSel);
  const unidade = UNIDADES.find((u) => u.key === opSel)!;

  const { data: regProd = [] } = useQuery({
    queryKey: ["dashop_prod", opSel, mes],
    queryFn: async () => {
      let q = supabase.from("registros_produtividade").select("*").eq("operacao", opSel);
      if (mes) q = q.eq("mes", `${mes}-01`);
      const { data, error } = await q.order("mes");
      if (error) throw error;
      return (data ?? []) as RegProd[];
    },
  });

  const { data: ncs = [] } = useQuery({
    queryKey: ["dashop_nc", opSel, mes],
    queryFn: async () => {
      let q = supabase.from("nao_conformidades").select("*").eq("operacao", opSel);
      if (mes) {
        const base = new Date(`${mes}-01T00:00:00Z`);
        const fim = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0))
          .toISOString()
          .slice(0, 10);
        q = q.gte("data_ocorrencia", `${mes}-01`).lte("data_ocorrencia", fim);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as NaoConf[];
    },
  });

  const nome = (id: string) => colabs.find((c) => c.id === id)?.nome ?? "—";

  /* ── contribuição por colaborador ── */
  const contribuicao = useMemo(() => {
    const mapa = new Map<
      string,
      { volume: number; fte: number; ncs: number; meses: Set<string> }
    >();
    for (const r of regProd) {
      const x = mapa.get(r.colaborador_id) ?? {
        volume: 0,
        fte: 0,
        ncs: 0,
        meses: new Set<string>(),
      };
      x.volume += Number(r.volume_processos ?? 0);
      x.fte += Number(r.fte ?? 0);
      x.meses.add(r.mes.slice(0, 7));
      mapa.set(r.colaborador_id, x);
    }
    for (const n of ncs) {
      if (!n.colaborador_id) continue;
      const x = mapa.get(n.colaborador_id);
      if (x) x.ncs += 1;
    }
    const volTotal = [...mapa.values()].reduce((s, x) => s + x.volume, 0);
    const meta = metaProdUnidade(opSel);
    return [...mapa.entries()]
      .map(([id, x]) => {
        const prod = x.fte > 0 ? x.volume / x.fte : 0;
        return {
          id,
          nome: nome(id),
          volume: x.volume,
          fte: x.fte,
          produtividade: prod,
          pctMeta: meta > 0 ? (prod / meta) * 100 : 0,
          share: volTotal > 0 ? (x.volume / volTotal) * 100 : 0,
          ncs: x.ncs,
          meses: x.meses.size,
        };
      })
      .sort((a, b) => b.volume - a.volume);
  }, [regProd, ncs, colabs, opSel]);

  /* ── scorecard da operação ── */
  const scorecard = useMemo(() => {
    const meta = metaProdUnidade(opSel);
    const prod = indicador && indicador.fte > 0 ? indicador.produtividade : null;
    const notaProd = prod !== null && meta > 0 ? notaOu((prod / meta) * 100) : null;

    // qualidade: desconta pela incidência de NC sobre o volume
    const vol = indicador?.volume ?? 0;
    const notaQual =
      vol > 0 ? notaOu(100 - (ncs.length / vol) * 100 * 10) : ncs.length > 0 ? 0 : null;

    // eficiência de custo: compara custo/processo com a média das operações
    const cpps = dados.comDados
      .filter((o) => o.custoPorProcesso > 0)
      .map((o) => o.custoPorProcesso);
    const mediaCpp = cpps.length > 0 ? cpps.reduce((a, b) => a + b, 0) / cpps.length : 0;
    const cpp = indicador?.custoPorProcesso ?? 0;
    const notaCusto =
      podeVerCusto && cpp > 0 && mediaCpp > 0 ? notaOu((mediaCpp / cpp) * 100) : null;

    const dims = [
      { key: "produtividade", label: "Produtividade", nota: notaProd, peso: 40 },
      { key: "qualidade", label: "Qualidade", nota: notaQual, peso: 25 },
      ...(podeVerCusto
        ? [{ key: "custo", label: "Eficiência de custo", nota: notaCusto, peso: 15 }]
        : []),
    ];
    const validas = dims.filter((d) => d.nota !== null);
    const pesoAplicado = validas.reduce((s, d) => s + d.peso, 0);
    const total =
      pesoAplicado > 0
        ? validas.reduce((s, d) => s + (d.nota as number) * d.peso, 0) / pesoAplicado
        : 0;
    return { dims, total, pesoAplicado, ausentes: dims.length - validas.length };
  }, [indicador, ncs, dados.comDados, podeVerCusto, opSel]);

  /* ── evolução da operação ── */
  const evolucao = useMemo(() => {
    const mapa = new Map<string, { mes: string; volume: number; fte: number }>();
    for (const r of regProd) {
      const k = r.mes.slice(0, 7);
      const e = mapa.get(k) ?? { mes: k, volume: 0, fte: 0 };
      e.volume += Number(r.volume_processos ?? 0);
      e.fte += Number(r.fte ?? 0);
      mapa.set(k, e);
    }
    const meta = metaProdUnidade(opSel);
    return [...mapa.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((e) => ({
        mes: fmtMes(e.mes),
        volume: e.volume,
        produtividade: e.fte > 0 ? Number((e.volume / e.fte).toFixed(1)) : 0,
        meta,
      }));
  }, [regProd, opSel]);

  const tiposNc = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of ncs) m.set(n.tipo, (m.get(n.tipo) ?? 0) + 1);
    const LABEL: Record<string, string> = {
      erro_digitacao: "Erro de digitação",
      prazo_perdido: "Prazo perdido",
      doc_incorreto: "Doc. incorreto",
      comunicacao: "Comunicação",
      outro: "Outro",
    };
    return [...m.entries()]
      .map(([k, v]) => ({ tipo: LABEL[k] ?? k, qtd: v }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [ncs]);

  const cls = (p: number) =>
    p >= 100 ? "text-success" : p >= 70 ? "text-warning" : "text-destructive";
  const C = {
    p: "var(--color-primary)",
    s: "var(--color-success)",
    w: "var(--color-warning)",
    d: "var(--color-destructive)",
    m: "var(--color-muted-foreground)",
  };

  const semDados = !indicador || (indicador.fonte === "sem_dados" && ncs.length === 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Dashboard por Operação
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Indicadores, scorecard e contribuição individual de cada unidade
          </p>
        </div>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <Label className="text-xs">Operação</Label>
            <Select value={opSel} onValueChange={(v) => setOpSel(v as UnidadeKey)}>
              <SelectTrigger className="w-48">
                <SelectValue />
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
            <Label className="text-xs">Mês</Label>
            <Input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-40"
            />
          </div>
          {mes && (
            <button
              className="text-xs text-muted-foreground underline pb-2"
              onClick={() => setMes("")}
            >
              todo o período
            </button>
          )}
        </div>
      </div>

      {semDados ? (
        <Card>
          <CardContent className="py-14 text-center">
            <div className="font-medium mb-1">Sem dados para {unidade.label}</div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Lance volume e pessoas em <strong>Cadastro Operacional</strong> ou registros
              individuais em <strong>Produtividade</strong> para esta operação.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div
            className={`grid grid-cols-2 gap-3 ${podeVerCusto ? "md:grid-cols-5" : "md:grid-cols-4"}`}
          >
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Volume
                  </span>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-semibold">{n0(indicador!.volume)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">processos</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Pessoas
                  </span>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-semibold">{indicador!.pessoas}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {indicador!.fte.toFixed(1)} FTE
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Produtividade
                  </span>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className={`text-2xl font-semibold ${cls(indicador!.pctMeta)}`}>
                  {indicador!.produtividade.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  meta {indicador!.meta} · {indicador!.pctMeta.toFixed(0)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Não conf.
                  </span>
                  <AlertTriangle
                    className={`h-4 w-4 ${ncs.length > 0 ? "text-destructive" : "text-muted-foreground"}`}
                  />
                </div>
                <div
                  className={`text-2xl font-semibold ${ncs.length > 0 ? "text-destructive" : ""}`}
                >
                  {ncs.length}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {indicador!.ncCusto > 0 ? fmtBRL(indicador!.ncCusto) : "sem custo"}
                </div>
              </CardContent>
            </Card>

            {podeVerCusto && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      Custo/proc.
                    </span>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold">
                    {indicador!.custoPorProcesso > 0 ? fmtBRL(indicador!.custoPorProcesso) : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {indicador!.custo > 0 ? fmtBRL(indicador!.custo) : "custo não lançado"}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Tabs defaultValue="scorecard">
            <TabsList>
              <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
              <TabsTrigger value="contribuicao">Contribuição</TabsTrigger>
              <TabsTrigger value="evolucao">Evolução</TabsTrigger>
              <TabsTrigger value="qualidade">Qualidade</TabsTrigger>
            </TabsList>

            {/* ── SCORECARD DA OPERAÇÃO ── */}
            <TabsContent value="scorecard" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm">Scorecard de {unidade.label}</CardTitle>
                        <CardDescription>
                          {scorecard.ausentes > 0
                            ? `${scorecard.pesoAplicado}% do peso aplicado — ${scorecard.ausentes} dimensão(ões) sem dado`
                            : "peso integral aplicado"}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-semibold ${cls(scorecard.total)}`}>
                          {scorecard.total.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {scorecard.dims.map((d) => (
                      <div key={d.key}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>
                            {d.label} <span className="text-muted-foreground">({d.peso}%)</span>
                          </span>
                          <span className={d.nota === null ? "text-muted-foreground" : cls(d.nota)}>
                            {d.nota === null ? "sem dado" : d.nota.toFixed(1)}
                          </span>
                        </div>
                        <Progress value={d.nota ?? 0} className="h-1.5" />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Perfil da operação</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart
                        data={scorecard.dims.map((d) => ({
                          dim: d.label.split(" ")[0],
                          valor: d.nota ?? 0,
                        }))}
                      >
                        <PolarGrid stroke="var(--color-border)" />
                        <PolarAngleAxis dataKey="dim" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                        <Radar dataKey="valor" stroke={C.p} fill={C.p} fillOpacity={0.25} />
                        <Tooltip formatter={(v: number) => v.toFixed(1)} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Comparativo entre operações</CardTitle>
                  <CardDescription>Produtividade contra a meta de cada unidade</CardDescription>
                </CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dados.comDados
                        .filter((o) => o.fte > 0)
                        .map((o) => ({
                          label: o.label,
                          pct: Number(o.pctMeta.toFixed(1)),
                          atual: o.key === opSel,
                        }))}
                      margin={{ top: 8, right: 12, left: -18 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => `${v}% da meta`} />
                      <Bar dataKey="pct" name="% da meta" radius={[4, 4, 0, 0]} maxBarSize={44}>
                        {dados.comDados
                          .filter((o) => o.fte > 0)
                          .map((o, i) => (
                            <Cell
                              key={i}
                              fill={
                                o.key === opSel
                                  ? C.p
                                  : o.pctMeta >= 100
                                    ? C.s
                                    : o.pctMeta >= 70
                                      ? C.w
                                      : C.d
                              }
                              fillOpacity={o.key === opSel ? 1 : 0.45}
                            />
                          ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── CONTRIBUIÇÃO ── */}
            <TabsContent value="contribuicao" className="space-y-4 mt-4">
              {contribuicao.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    A contribuição individual exige lançamento por pessoa em{" "}
                    <strong>Produtividade</strong>. O Cadastro Operacional registra o total da
                    unidade, sem atribuição individual.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Contribuição por colaborador</CardTitle>
                      <CardDescription>
                        Participação no volume e produtividade individual
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Colaborador</TableHead>
                            <TableHead className="text-right">Volume</TableHead>
                            <TableHead className="w-32">Participação</TableHead>
                            <TableHead className="text-right">FTE</TableHead>
                            <TableHead className="text-right">Produt.</TableHead>
                            <TableHead className="text-right">% meta</TableHead>
                            <TableHead className="text-right">NCs</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contribuicao.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell className="font-medium">
                                {c.nome}
                                {c.meses > 1 && (
                                  <span className="text-[10px] text-muted-foreground ml-1.5">
                                    {c.meses} meses
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">{n0(c.volume)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={c.share} className="h-1.5 flex-1" />
                                  <span className="text-xs w-10 text-right">
                                    {c.share.toFixed(0)}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {c.fte.toFixed(2)}
                              </TableCell>
                              <TableCell className={`text-right font-semibold ${cls(c.pctMeta)}`}>
                                {c.produtividade.toFixed(1)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  variant={
                                    c.pctMeta >= 100
                                      ? "default"
                                      : c.pctMeta >= 70
                                        ? "secondary"
                                        : "destructive"
                                  }
                                  className="text-[10px]"
                                >
                                  {c.pctMeta.toFixed(0)}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {c.ncs > 0 ? (
                                  <span className="text-destructive font-medium">{c.ncs}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {contribuicao.length >= 3 &&
                    (() => {
                      const prods = contribuicao
                        .filter((c) => c.produtividade > 0)
                        .map((c) => c.produtividade);
                      if (prods.length < 3) return null;
                      const maior = Math.max(...prods),
                        menor = Math.min(...prods);
                      const razao = menor > 0 ? maior / menor : 0;
                      if (razao < 2) return null;
                      return (
                        <Card className="border-warning">
                          <CardContent className="pt-4 flex gap-3">
                            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <div className="font-medium mb-1">
                                Dispersão de {razao.toFixed(1)}× entre o maior e o menor desempenho
                              </div>
                              <p className="text-muted-foreground">
                                Antes de tratar como performance, vale checar se a carteira está
                                distribuída de forma equivalente — complexidade diferente produz
                                números diferentes.
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()}
                </>
              )}
            </TabsContent>

            {/* ── EVOLUÇÃO ── */}
            <TabsContent value="evolucao" className="space-y-4 mt-4">
              {evolucao.length < 2 ? (
                <Card>
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    A curva aparece a partir do segundo mês com lançamento individual.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Produtividade mês a mês</CardTitle>
                      <CardDescription>
                        Contra a meta de {metaProdUnidade(opSel)} proc/FTE
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={evolucao} margin={{ top: 8, right: 12, left: -18 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line
                            type="monotone"
                            dataKey="produtividade"
                            name="Realizado"
                            stroke={C.p}
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="meta"
                            name="Meta"
                            stroke={C.d}
                            strokeWidth={1.5}
                            strokeDasharray="5 4"
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Volume mensal</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={evolucao} margin={{ top: 8, right: 12, left: -18 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => n0(v)} />
                          <Bar
                            dataKey="volume"
                            name="Volume"
                            fill={C.p}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={48}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* ── QUALIDADE ── */}
            <TabsContent value="qualidade" className="space-y-4 mt-4">
              {ncs.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    Nenhuma não conformidade registrada para {unidade.label} no período.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Ocorrências por tipo</CardTitle>
                      <CardDescription>
                        {ncs.length} ocorrência(s) · {fmtBRL(indicador!.ncCusto)} em custo gerado
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tiposNc} layout="vertical" margin={{ left: 20, right: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                          <YAxis
                            type="category"
                            dataKey="tipo"
                            width={130}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip />
                          <Bar
                            dataKey="qtd"
                            name="Ocorrências"
                            fill={C.d}
                            radius={[0, 4, 4, 0]}
                            maxBarSize={26}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                </>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
