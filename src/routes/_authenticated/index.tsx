import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fmtMes, MESES_PT, META_PRODUTIVIDADE, META_SLA, UNIDADES, UNIDADE_LABEL, type UnidadeKey } from "@/lib/constants";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, ReferenceLine, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line,
} from "recharts";
import { TrendingUp, Users, Gauge, AlertTriangle, Target, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardPage,
});

const C1 = "var(--color-primary)";
const C2 = "var(--color-accent)";
const C3 = "var(--color-success)";
const CD = "var(--color-destructive)";

type OpRow = { id: string; mes: string; volume: number; pessoas: number; produtividade: number | null; unidade: UnidadeKey };
type Colab = { id: string; nome: string; unidade: UnidadeKey; mes: string; ausencias: number; fte: number | null };
type SlaMidea = { mes: string; start_up: number; otcc: number; otd: number; sotd: number };
type SlaBosch = { mes: string; dig_conf: number; start_up: number; otcc: number; desvios: number; pinho: number };
type Gargalo = { id: string; item: string; impacto: string; risco: "alto" | "medio" | "baixo" };
type Acao = { id: string; iniciativa: string; responsavel: string; prazo: string | null; status: "andamento" | "concluido" | "atrasado" };

const fmtFte = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function DashboardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useRealtimeTable("operacional_mensal", ["operacional_mensal"]);
  useRealtimeTable("colaboradores", ["colaboradores"]);
  useRealtimeTable("sla_midea", ["sla_midea"]);
  useRealtimeTable("sla_bosch", ["sla_bosch"]);
  useRealtimeTable("gargalos", ["gargalos"]);
  useRealtimeTable("plano_acao", ["plano_acao"]);
  useRealtimeTable("config", ["config"]);

  const op = useQuery({
    queryKey: ["operacional_mensal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("operacional_mensal").select("*").order("mes");
      if (error) throw error;
      return data as OpRow[];
    },
  });

  const colab = useQuery({
    queryKey: ["colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("colaboradores").select("*");
      if (error) throw error;
      return data as Colab[];
    },
  });

  const midea = useQuery({
    queryKey: ["sla_midea"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sla_midea").select("*").order("mes");
      if (error) throw error;
      return data as SlaMidea[];
    },
  });

  const bosch = useQuery({
    queryKey: ["sla_bosch"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sla_bosch").select("*").order("mes");
      if (error) throw error;
      return data as SlaBosch[];
    },
  });

  const gargalos = useQuery({
    queryKey: ["gargalos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gargalos").select("*");
      if (error) throw error;
      return data as Gargalo[];
    },
  });

  const acoes = useQuery({
    queryKey: ["plano_acao"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plano_acao").select("*").order("prazo");
      if (error) throw error;
      return data as Acao[];
    },
  });

  const config = useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("config").select("*").maybeSingle();
      if (error) throw error;
      return data as { id?: string; fator_sazonalidade?: number } | null;
    },
  });

  const fator = Number(config.data?.fator_sazonalidade ?? 0);

  const saveFator = useMutation({
    mutationFn: async (v: number) => {
      if (!user) return;
      const { error } = await supabase
        .from("config")
        .upsert({ user_id: user.id, fator_sazonalidade: v }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["config"] }),
  });

  const [filtroGrupo, setFiltroGrupo] = useState<"all" | "midea" | "bosch">("all");
  const [filtroMes, setFiltroMes] = useState<string>("all");

  const opAll = op.data ?? [];

  const grupoDe = (u: UnidadeKey) => UNIDADES.find((x) => x.key === u)?.grupo;

  // Distinct months available across all data sources, sorted desc
  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const r of opAll) set.add(r.mes);
    for (const r of midea.data ?? []) set.add(r.mes);
    for (const r of bosch.data ?? []) set.add(r.mes);
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [opAll, midea.data, bosch.data]);

  const matchMes = (m: string) => filtroMes === "all" || m === filtroMes;

  // Build FTE lookup per (unidade|mes) from colaboradores (sum of FTE)
  const fteMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of colab.data ?? []) {
      const k = `${c.unidade}|${c.mes}`;
      m.set(k, (m.get(k) ?? 0) + Number(c.fte ?? 0));
    }
    return m;
  }, [colab.data]);

  // Returns FTE for a row; falls back to legacy headcount if no colaboradores cadastrados
  const fteOf = (r: OpRow) => {
    const v = fteMap.get(`${r.unidade}|${r.mes}`);
    return v !== undefined ? v : r.pessoas;
  };

  const opData = opAll.filter((r) => matchMes(r.mes));

  const opFiltrado = opData.filter((r) =>
    filtroGrupo === "all" ? true : grupoDe(r.unidade) === filtroGrupo
  );

  // Aggregate per month for filtered trend charts (sum volume, sum FTE, real productivity)
  const aggByMonth = (rows: OpRow[]) => {
    const map = new Map<string, { mes: string; volume: number; pessoas: number }>();
    for (const r of rows) {
      const k = r.mes;
      const cur = map.get(k) ?? { mes: k, volume: 0, pessoas: 0 };
      cur.volume += r.volume;
      cur.pessoas += fteOf(r);
      map.set(k, cur);
    }
    return [...map.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((r) => ({
        mes: fmtMes(r.mes),
        volume: r.volume,
        pessoas: Number(r.pessoas.toFixed(1)),
        produtividade: r.pessoas > 0 ? r.volume / r.pessoas : 0,
      }));
  };

  const volumeData = aggByMonth(opFiltrado);

  // Per-unit aggregated KPIs (respect month filter) — pessoas = soma de FTE
  const kpiPorUnidade = UNIDADES.map((u) => {
    const rows = opData.filter((r) => r.unidade === u.key);
    const volume = rows.reduce((s, r) => s + r.volume, 0);
    const fteTotal = rows.reduce((s, r) => s + fteOf(r), 0);
    const prod = fteTotal > 0 ? volume / fteTotal : 0;
    return { ...u, volume, pessoas: fteTotal, prod, meses: rows.length };
  });

  const totalizador = (grupo: "midea" | "bosch") => {
    const items = kpiPorUnidade.filter((k) => k.grupo === grupo);
    const volume = items.reduce((s, r) => s + r.volume, 0);
    const pessoas = items.reduce((s, r) => s + r.pessoas, 0);
    const prod = pessoas > 0 ? volume / pessoas : 0;
    return { volume, pessoas, prod };
  };

  const totalVolume = opData.reduce((s, r) => s + r.volume, 0);
  const avgProd = volumeData.length ? volumeData.reduce((s, r) => s + r.produtividade, 0) / volumeData.length : 0;
  const totalPessoasFte = opData.reduce((s, r) => s + fteOf(r), 0);
  const avgPessoas = volumeData.length ? totalPessoasFte / volumeData.length : 0;

  const mideaFiltrada = (midea.data ?? []).filter((r) => matchMes(r.mes));
  const boschFiltrada = (bosch.data ?? []).filter((r) => matchMes(r.mes));

  const allSla = [
    ...mideaFiltrada.flatMap((r) => [r.start_up, r.otcc, r.otd, r.sotd]),
    ...boschFiltrada.flatMap((r) => [r.dig_conf, r.start_up, r.otcc, r.desvios, r.pinho]),
  ].map(Number);
  const slaMedio = allSla.length ? allSla.reduce((s, n) => s + n, 0) / allSla.length : 0;

  const mideaRadar = useMemo(() => {
    const rows = mideaFiltrada;
    if (!rows.length) return [];
    const keys = ["start_up", "otcc", "otd", "sotd"] as const;
    return keys.map((k) => ({
      indicador: k.toUpperCase(),
      valor: rows.reduce((s, r) => s + Number(r[k] || 0), 0) / rows.length,
      meta: META_SLA,
    }));
  }, [mideaFiltrada]);

  const boschBars = useMemo(() => {
    const rows = boschFiltrada;
    if (!rows.length) return [];
    const keys = ["dig_conf", "start_up", "otcc", "desvios", "pinho"] as const;
    const labels: Record<string, string> = { dig_conf: "Dig.Conf.", start_up: "Start-up", otcc: "OTCC", desvios: "Desvios", pinho: "Pinho" };
    return keys.map((k) => ({
      indicador: labels[k],
      valor: rows.reduce((s, r) => s + Number(r[k] || 0), 0) / rows.length,
    }));
  }, [boschFiltrada]);

  // Projection: moving average × (1 + fator/100) for Jul–Dez
  const projecao = useMemo(() => {
    const histVolume = (op.data ?? []).map((r) => r.volume);
    const avg = histVolume.length ? histVolume.reduce((s, v) => s + v, 0) / histVolume.length : 0;
    const proj = avg * (1 + fator / 100);
    const out: { mes: string; historico: number | null; projetado: number | null }[] = [];
    for (let i = 0; i < 12; i++) {
      const histRow = (op.data ?? []).find((r) => new Date(r.mes).getUTCMonth() === i);
      out.push({
        mes: MESES_PT[i],
        historico: histRow ? histRow.volume : null,
        projetado: i >= 6 ? Math.round(proj) : null,
      });
    }
    return out;
  }, [op.data, fator]);

  const acaoStats = {
    andamento: (acoes.data ?? []).filter((a) => a.status === "andamento").length,
    concluido: (acoes.data ?? []).filter((a) => a.status === "concluido").length,
    atrasado: (acoes.data ?? []).filter((a) => a.status === "atrasado").length,
  };

  return (
    <div className="bg-gradient-to-b from-background via-background to-muted/30">
      <div className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur px-8 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="text-sm text-muted-foreground">
          Filtro de período {filtroMes !== "all" && <span className="ml-2 font-medium text-foreground">{fmtMes(filtroMes)}</span>}
        </div>
        <FiltroMes value={filtroMes} onChange={setFiltroMes} meses={mesesDisponiveis} />
      </div>

      {/* Slide 1 — Capa + KPIs */}
      <Slide tone="primary">
        <div className="flex flex-col items-start justify-center h-full max-w-6xl mx-auto w-full">
          <Badge variant="secondary" className="mb-4">Apresentação à Diretoria</Badge>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-primary-foreground">
            Performance Operacional
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/80 mt-4 max-w-3xl">
            Resultados, indicadores de SLA, riscos identificados e plano estratégico para 2026.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 w-full">
            <Kpi icon={TrendingUp} label="Volume Total" value={totalVolume.toLocaleString("pt-BR")} />
            <Kpi icon={Users} label="Equipe (FTE médio)" value={fmtFte(avgPessoas)} />
            <Kpi icon={Gauge} label="Produtividade média" value={avgProd.toFixed(1)} sub={`Meta ${META_PRODUTIVIDADE}`} good={avgProd >= META_PRODUTIVIDADE} />
            <Kpi icon={Target} label="SLA médio" value={`${slaMedio.toFixed(1)}%`} sub={`Meta ${META_SLA}%`} good={slaMedio >= META_SLA} />
          </div>
        </div>
      </Slide>

      {/* Slide 2 — Indicadores por Carteira (Midea / Bosch) */}
      <Slide>
        <SlideHeader title="Indicadores por Carteira" subtitle="Volume, equipe e produtividade consolidados por unidade" />
        <div className="grid grid-cols-1 gap-6 flex-1 min-h-0">
          <GrupoBlock
            titulo="Midea"
            tone="border-primary/40 bg-primary/5"
            total={totalizador("midea")}
            unidades={kpiPorUnidade.filter((k) => k.grupo === "midea")}
          />
          <GrupoBlock
            titulo="Bosch"
            tone="border-accent/40 bg-accent/5"
            total={totalizador("bosch")}
            unidades={kpiPorUnidade.filter((k) => k.grupo === "bosch")}
          />
        </div>
      </Slide>

      {/* Slide 3 — Tendência de Volume */}
      <Slide>
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Tendência de Volume</h2>
            <p className="text-muted-foreground mt-1">Volume mensal de processos</p>
          </div>
          <FiltroGrupo value={filtroGrupo} onChange={setFiltroGrupo} />
        </div>
        <Card className="flex-1 min-h-0">
          <CardContent className="pt-6 h-[460px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeData}>
                <defs>
                  <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C1} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={C1} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="volume" stroke={C1} fill="url(#gv)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Slide>

      {/* Slide 4 — Produtividade vs Meta */}
      <Slide>
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{`Produtividade Mensal — Meta ${META_PRODUTIVIDADE} processos/pessoa`}</h2>
            <p className="text-muted-foreground mt-1">Barras vermelhas indicam meses abaixo da meta</p>
          </div>
          <FiltroGrupo value={filtroGrupo} onChange={setFiltroGrupo} />
        </div>
        <Card className="flex-1 min-h-0">
          <CardContent className="pt-6 h-[460px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <ReferenceLine y={META_PRODUTIVIDADE} stroke={CD} strokeDasharray="6 4" label={{ value: `Meta ${META_PRODUTIVIDADE}`, position: "right", fill: CD }} />
                <Bar dataKey="produtividade" radius={[6, 6, 0, 0]}
                  fill={C2}
                  shape={(props: any) => {
                    const ok = props.payload.produtividade >= META_PRODUTIVIDADE;
                    return <rect x={props.x} y={props.y} width={props.width} height={props.height} rx={6} fill={ok ? C3 : CD} />;
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Slide>

      {/* Slide 4 — SLA Midea */}
      <Slide>
        <SlideHeader title="SLA — Midea" subtitle={`Meta ${META_SLA}% por indicador`} />
        <Card className="flex-1 min-h-0">
          <CardContent className="pt-6 h-[460px]">
            {mideaRadar.length === 0 ? <Empty msg="Sem dados de SLA Midea cadastrados." /> : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={mideaRadar}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="indicador" />
                  <PolarRadiusAxis domain={[0, 100]} />
                  <Radar name="Real" dataKey="valor" stroke={C1} fill={C1} fillOpacity={0.4} />
                  <Radar name="Meta" dataKey="meta" stroke={CD} fill={CD} fillOpacity={0.05} />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </Slide>

      {/* Slide 5 — SLA BOSCH */}
      <Slide>
        <SlideHeader title="SLA — BOSCH" subtitle={`Média por indicador vs meta ${META_SLA}%`} />
        <Card className="flex-1 min-h-0">
          <CardContent className="pt-6 h-[460px]">
            {boschBars.length === 0 ? <Empty msg="Sem dados de SLA BOSCH cadastrados." /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={boschBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="indicador" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <ReferenceLine y={META_SLA} stroke={CD} strokeDasharray="6 4" label={{ value: `Meta ${META_SLA}%`, position: "right", fill: CD }} />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}
                    shape={(props: any) => {
                      const ok = props.payload.valor >= META_SLA;
                      return <rect x={props.x} y={props.y} width={props.width} height={props.height} rx={6} fill={ok ? C3 : CD} />;
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </Slide>

      {/* Slide 6 — Projeção 2º semestre */}
      <Slide>
        <SlideHeader title="Projeção 2º Semestre" subtitle="Média móvel × (1 + fator de sazonalidade)" />
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
          <Card className="flex-1 min-h-0">
            <CardContent className="pt-6 h-[460px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projecao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="historico" stroke={C1} strokeWidth={3} name="Histórico" connectNulls />
                  <Line type="monotone" dataKey="projetado" stroke={C2} strokeDasharray="6 4" strokeWidth={3} name="Projetado" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="lg:w-80">
            <CardHeader>
              <CardTitle className="text-base">Fator de Sazonalidade</CardTitle>
              <CardDescription>Ajuste a previsão para o 2º semestre.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>% sobre média histórica</Label>
                <Input
                  type="number"
                  step="0.1"
                  defaultValue={fator}
                  onBlur={(e) => saveFator.mutate(Number(e.target.value || 0))}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Valor atual: <span className="font-semibold text-foreground">{fator > 0 ? "+" : ""}{fator}%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </Slide>

      {/* Slide 7 — Riscos */}
      <Slide>
        <SlideHeader title="Gargalos & Riscos" subtitle="Mapeamento de pontos críticos" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
          {(["alto", "medio", "baixo"] as const).map((nivel) => {
            const items = (gargalos.data ?? []).filter((r) => r.risco === nivel);
            const tone = nivel === "alto" ? "border-destructive" : nivel === "medio" ? "border-warning" : "border-success";
            return (
              <Card key={nivel} className={`border-2 ${tone}`}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="capitalize flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" /> Risco {nivel === "medio" ? "Médio" : nivel}
                  </CardTitle>
                  <Badge variant="secondary">{items.length}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item.</p>}
                  {items.map((r) => (
                    <div key={r.id} className="border rounded p-3">
                      <div className="font-medium">{r.item}</div>
                      {r.impacto && <div className="text-xs text-muted-foreground mt-1">{r.impacto}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Slide>

      {/* Slide 8 — Plano de Ação */}
      <Slide>
        <SlideHeader title="Plano de Ação 2026" subtitle="Iniciativas estratégicas" />
        <div className="grid grid-cols-3 gap-4 mb-4">
          <StatCard label="Em andamento" value={acaoStats.andamento} tone="bg-accent text-accent-foreground" />
          <StatCard label="Concluídas" value={acaoStats.concluido} tone="bg-success text-success-foreground" icon={CheckCircle2} />
          <StatCard label="Atrasadas" value={acaoStats.atrasado} tone="bg-destructive text-destructive-foreground" />
        </div>
        <Card className="flex-1 min-h-0 overflow-auto">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-3">Iniciativa</th>
                  <th className="text-left px-4 py-3">Responsável</th>
                  <th className="text-left px-4 py-3">Prazo</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {(acoes.data ?? []).length === 0 && (
                  <tr><td colSpan={4} className="text-center text-muted-foreground py-8">Sem iniciativas cadastradas.</td></tr>
                )}
                {(acoes.data ?? []).map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{a.iniciativa}</td>
                    <td className="px-4 py-3">{a.responsavel || "—"}</td>
                    <td className="px-4 py-3">{a.prazo ? new Date(a.prazo).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="px-4 py-3">
                      <Badge className={
                        a.status === "concluido" ? "bg-success text-success-foreground" :
                        a.status === "atrasado" ? "bg-destructive text-destructive-foreground" :
                        "bg-accent text-accent-foreground"
                      }>
                        {a.status === "concluido" ? "Concluído" : a.status === "atrasado" ? "Atrasado" : "Em andamento"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </Slide>
    </div>
  );
}

function Slide({ children, tone }: { children: React.ReactNode; tone?: "primary" }) {
  return (
    <section className={`min-h-screen w-full px-8 py-10 flex flex-col ${tone === "primary" ? "bg-gradient-to-br from-primary via-primary to-accent" : ""}`}>
      <div className="flex-1 flex flex-col w-full max-w-7xl mx-auto">{children}</div>
    </section>
  );
}

function SlideHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
      {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, good }: { icon: any; label: string; value: string; sub?: string; good?: boolean }) {
  return (
    <Card className="bg-card/95 backdrop-blur">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className={`text-3xl font-bold ${good === false ? "text-destructive" : good === true ? "text-success" : ""}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, tone, icon: Icon }: { label: string; value: number; tone: string; icon?: any }) {
  return (
    <div className={`rounded-lg p-4 ${tone}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm">{label}</span>
        {Icon && <Icon className="h-4 w-4" />}
      </div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="h-full grid place-items-center text-muted-foreground text-sm">{msg}</div>;
}

function FiltroMes({
  value, onChange, meses,
}: { value: string; onChange: (v: string) => void; meses: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Selecione o mês" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos os meses</SelectItem>
        {meses.map((m) => (
          <SelectItem key={m} value={m}>{fmtMes(m)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FiltroGrupo({
  value, onChange,
}: { value: "all" | "midea" | "bosch"; onChange: (v: "all" | "midea" | "bosch") => void }) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as "all" | "midea" | "bosch")}>
      <TabsList>
        <TabsTrigger value="all">Toda a Operação</TabsTrigger>
        <TabsTrigger value="midea">Apenas Midea</TabsTrigger>
        <TabsTrigger value="bosch">Apenas Bosch</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

type UnidadeKpi = {
  key: UnidadeKey; label: string; grupo: "midea" | "bosch";
  volume: number; pessoas: number; prod: number; meses: number;
};

function GrupoBlock({
  titulo, tone, total, unidades,
}: {
  titulo: string;
  tone: string;
  total: { volume: number; pessoas: number; prod: number };
  unidades: UnidadeKpi[];
}) {
  return (
    <Card className={`border-2 ${tone}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-2xl">{titulo}</CardTitle>
          <CardDescription>Totalizador consolidado das unidades</CardDescription>
        </div>
        <div className="flex gap-3">
          <MiniKpi label="Volume Total" value={total.volume.toLocaleString("pt-BR")} />
          <MiniKpi label="Equipe (média)" value={total.pessoas.toString()} />
          <MiniKpi
            label="Produtividade"
            value={total.prod.toFixed(1)}
            good={total.prod >= META_PRODUTIVIDADE}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {unidades.map((u) => {
            const ok = u.prod >= META_PRODUTIVIDADE;
            return (
              <div key={u.key} className="rounded-lg border bg-card p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{u.label}</div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Stat label="Volume" value={u.volume.toLocaleString("pt-BR")} />
                  <Stat label="Pessoas" value={u.pessoas.toString()} />
                  <Stat
                    label="Prod."
                    value={u.prod.toFixed(1)}
                    className={u.meses === 0 ? "text-muted-foreground" : ok ? "text-success" : "text-destructive"}
                  />
                </div>
                {u.meses === 0 && <div className="text-[11px] text-muted-foreground mt-2">Sem cadastros</div>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniKpi({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-md bg-card border px-3 py-2 text-right min-w-24">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${good === false ? "text-destructive" : good === true ? "text-success" : ""}`}>{value}</div>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${className ?? ""}`}>{value}</div>
    </div>
  );
}
