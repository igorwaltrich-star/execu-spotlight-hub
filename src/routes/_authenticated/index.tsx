import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  fmtMes,
  MESES_PT,
  META_PRODUTIVIDADE,
  META_SLA,
  UNIDADES,
  UNIDADE_LABEL,
  type UnidadeKey,
} from "@/lib/constants";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  ReferenceLine,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  Users,
  Gauge,
  AlertTriangle,
  Target,
  CheckCircle2,
  Lightbulb,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardPage,
});

const C1 = "var(--color-primary)";
const C2 = "var(--color-accent)";
const C3 = "var(--color-success)";
const CD = "var(--color-destructive)";

type OpRow = {
  id: string;
  mes: string;
  volume: number;
  pessoas: number;
  produtividade: number | null;
  unidade: UnidadeKey;
};
type SlaMidea = { mes: string; start_up: number; otcc: number; otd: number; sotd: number };
type SlaBosch = {
  mes: string;
  dig_conf: number;
  start_up: number;
  otcc: number;
  desvios: number;
  pinho: number;
};
type Gargalo = { id: string; item: string; impacto: string; risco: "alto" | "medio" | "baixo" };
type Melhoria = { id: string; titulo: string; descricao: string; tipo: "atencao" | "oportunidade" };

function DashboardPage() {
  useRealtimeTable("operacional_mensal", ["operacional_mensal"]);
  useRealtimeTable("sla_midea", ["sla_midea"]);
  useRealtimeTable("sla_bosch", ["sla_bosch"]);
  useRealtimeTable("gargalos", ["gargalos"]);
  
  useRealtimeTable("melhorias", ["melhorias"]);

  const melhorias = useQuery({
    queryKey: ["melhorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("melhorias")
        .select("id, titulo, descricao, tipo")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Melhoria[];
    },
  });

  const op = useQuery({
    queryKey: ["operacional_mensal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("operacional_mensal").select("*").order("mes");
      if (error) throw error;
      return data as OpRow[];
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


  const opAll = op.data ?? [];
  const grupoDe = (u: UnidadeKey) => UNIDADES.find((x) => x.key === u)?.grupo;

  const mesesOp = useMemo(
    () => [...new Set(opAll.map((r) => r.mes))].sort((a, b) => b.localeCompare(a)),
    [opAll],
  );
  const mesesMidea = useMemo(
    () => [...new Set((midea.data ?? []).map((r) => r.mes))].sort((a, b) => b.localeCompare(a)),
    [midea.data],
  );
  const mesesBosch = useMemo(
    () => [...new Set((bosch.data ?? []).map((r) => r.mes))].sort((a, b) => b.localeCompare(a)),
    [bosch.data],
  );

  // Per-chart filters
  const [filtroGrupoVol, setFiltroGrupoVol] = useState<"all" | "midea" | "bosch">("all");
  const [filtroMesVol, setFiltroMesVol] = useState<string>("all");
  const [filtroGrupoProd, setFiltroGrupoProd] = useState<"all" | "midea" | "bosch">("all");
  const [filtroMesProd, setFiltroMesProd] = useState<string>("all");
  const [filtroUnidade, setFiltroUnidade] = useState<"all" | UnidadeKey>("all");
  const [filtroMesCart, setFiltroMesCart] = useState<string>("all");
  const [filtroMesMidea, setFiltroMesMidea] = useState<string>("all");
  const [filtroMesBosch, setFiltroMesBosch] = useState<string>("all");
  const [filtroUnidadeEvol, setFiltroUnidadeEvol] = useState<"all" | UnidadeKey>("all");
  const [filtroMesEvol, setFiltroMesEvol] = useState<string>("all");

  const matchesMes = (m: string, f: string) => f === "all" || m === f;

  // Aggregate per month: volume, pessoas (sum), produtividade = volume/pessoas
  const aggByMonth = (rows: OpRow[]) => {
    const map = new Map<string, { mes: string; volume: number; pessoas: number }>();
    for (const r of rows) {
      const cur = map.get(r.mes) ?? { mes: r.mes, volume: 0, pessoas: 0 };
      cur.volume += r.volume;
      cur.pessoas += Number(r.pessoas ?? 0);
      map.set(r.mes, cur);
    }
    return [...map.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((r) => ({
        mes: fmtMes(r.mes),
        volume: r.volume,
        pessoas: r.pessoas,
        produtividade: r.pessoas > 0 ? Number((r.volume / r.pessoas).toFixed(1)) : 0,
      }));
  };

  const volumeData = useMemo(() => {
    const rows = opAll.filter(
      (r) =>
        (filtroGrupoVol === "all" || grupoDe(r.unidade) === filtroGrupoVol) &&
        matchesMes(r.mes, filtroMesVol),
    );
    return aggByMonth(rows);
  }, [opAll, filtroGrupoVol, filtroMesVol]);

  const prodData = useMemo(() => {
    const rows = opAll.filter(
      (r) =>
        (filtroGrupoProd === "all" || grupoDe(r.unidade) === filtroGrupoProd) &&
        matchesMes(r.mes, filtroMesProd),
    );
    return aggByMonth(rows);
  }, [opAll, filtroGrupoProd, filtroMesProd]);

  // KPI por unidade respeitando filtro do slide carteiras
  const kpiPorUnidade = useMemo(
    () =>
      UNIDADES.map((u) => {
        const rows = opAll.filter((r) => r.unidade === u.key && matchesMes(r.mes, filtroMesCart));
        const volume = rows.reduce((s, r) => s + r.volume, 0);
        // Headcount não soma o mesmo time mês a mês: usa o máximo do período.
        const headcount = rows.reduce((m, r) => Math.max(m, Number(r.pessoas ?? 0)), 0);
        const totalPessoas = rows.reduce((s, r) => s + Number(r.pessoas ?? 0), 0);
        const prod = totalPessoas > 0 ? volume / totalPessoas : 0;
        return { ...u, volume, headcount, prod, meses: rows.length };
      }),
    [opAll, filtroMesCart],
  );

  const totalizador = (grupo: "midea" | "bosch", uniFilter: "all" | UnidadeKey = "all") => {
    const items = kpiPorUnidade.filter(
      (k) => k.grupo === grupo && (uniFilter === "all" || k.key === uniFilter),
    );
    const volume = items.reduce((s, r) => s + r.volume, 0);
    const headcount = items.reduce((s, r) => s + r.headcount, 0);
    // produtividade do bloco: volume total / soma(pessoas) mês a mês das unidades exibidas
    const rows = opAll.filter(
      (r) =>
        grupoDe(r.unidade) === grupo &&
        (uniFilter === "all" || r.unidade === uniFilter) &&
        matchesMes(r.mes, filtroMesCart),
    );
    const totalPessoas = rows.reduce((s, r) => s + Number(r.pessoas ?? 0), 0);
    const prod = totalPessoas > 0 ? volume / totalPessoas : 0;
    return { volume, headcount, prod };
  };

  // KPIs do topo (todos os meses)
  const allMonthly = aggByMonth(opAll);
  const totalVolume = allMonthly.reduce((s, r) => s + r.volume, 0);
  const totalPessoasMes = allMonthly.reduce((s, r) => s + r.pessoas, 0);
  const avgProd = totalPessoasMes > 0 ? totalVolume / totalPessoasMes : 0;
  // Headcount total = soma do MAX(pessoas) de cada unidade (sem dupla contagem)
  const headcountTotal = UNIDADES.reduce((sum, u) => {
    const rows = opAll.filter((r) => r.unidade === u.key);
    return sum + rows.reduce((m, r) => Math.max(m, Number(r.pessoas ?? 0)), 0);
  }, 0);

  const mideaFiltrada = (midea.data ?? []).filter((r) => matchesMes(r.mes, filtroMesMidea));
  const boschFiltrada = (bosch.data ?? []).filter((r) => matchesMes(r.mes, filtroMesBosch));

  const allSla = [
    ...(midea.data ?? []).flatMap((r) => [r.start_up, r.otcc, r.otd, r.sotd]),
    ...(bosch.data ?? []).flatMap((r) => [r.dig_conf, r.start_up, r.otcc, r.desvios, r.pinho]),
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
    const labels: Record<string, string> = {
      dig_conf: "Dig.Conf.",
      start_up: "Start-up",
      otcc: "OTCC",
      desvios: "Desvios",
      pinho: "Pinho",
    };
    return keys.map((k) => ({
      indicador: labels[k],
      valor: rows.reduce((s, r) => s + Number(r[k] || 0), 0) / rows.length,
    }));
  }, [boschFiltrada]);

  // Evolução de produtividade por operação (Jan até mês atual)
  const evolucaoProd = useMemo(() => {
    const currentMonth = new Date().getUTCMonth();
    const mesFiltroIdx = filtroMesEvol === "all" ? null : new Date(filtroMesEvol).getUTCMonth();
    // mes -> unidade -> { volume, pessoas }
    const map = new Map<number, Map<UnidadeKey, { volume: number; pessoas: number }>>();
    for (const r of opAll) {
      if (filtroUnidadeEvol !== "all" && r.unidade !== filtroUnidadeEvol) continue;
      const idx = new Date(r.mes).getUTCMonth();
      if (idx > currentMonth) continue;
      if (mesFiltroIdx !== null && idx !== mesFiltroIdx) continue;
      const inner = map.get(idx) ?? new Map();
      const cur = inner.get(r.unidade) ?? { volume: 0, pessoas: 0 };
      cur.volume += r.volume;
      cur.pessoas += Number(r.pessoas ?? 0);
      inner.set(r.unidade, cur);
      map.set(idx, inner);
    }
    const out: Array<Record<string, number | string | null>> = [];
    const fromIdx = mesFiltroIdx !== null ? mesFiltroIdx : 0;
    const toIdx = mesFiltroIdx !== null ? mesFiltroIdx : currentMonth;
    for (let i = fromIdx; i <= toIdx; i++) {
      const row: Record<string, number | string | null> = { mes: MESES_PT[i] };
      const inner = map.get(i);
      for (const u of UNIDADES) {
        if (filtroUnidadeEvol !== "all" && u.key !== filtroUnidadeEvol) continue;
        const v = inner?.get(u.key);
        row[u.key] = v && v.pessoas > 0 ? Number((v.volume / v.pessoas).toFixed(1)) : null;
      }
      out.push(row);
    }
    return out;
  }, [opAll, filtroUnidadeEvol, filtroMesEvol]);


  return (
    <div className="bg-gradient-to-b from-background via-background to-muted/30">
      {/* Slide 1 — Capa + KPIs */}
      <Slide tone="primary">
        <div className="flex flex-col items-start justify-center h-full max-w-6xl mx-auto w-full">
          <Badge variant="secondary" className="mb-4">
            Apresentação à Diretoria
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-primary-foreground">
            Performance Operacional
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/80 mt-4 max-w-3xl">
            Resultados, indicadores de SLA, riscos identificados e plano estratégico para 2026.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 w-full">
            <Kpi
              icon={TrendingUp}
              label="Volume Total"
              value={totalVolume.toLocaleString("pt-BR")}
            />
            <Kpi
              icon={Users}
              label="Headcount Total"
              value={headcountTotal.toLocaleString("pt-BR")}
              sub="Sem dupla contagem"
            />
            <Kpi
              icon={Gauge}
              label="Produtividade média"
              value={avgProd.toFixed(1)}
              sub={`Meta ${META_PRODUTIVIDADE}`}
              good={avgProd >= META_PRODUTIVIDADE}
            />
            <Kpi
              icon={Target}
              label="SLA médio"
              value={`${slaMedio.toFixed(1)}%`}
              sub={`Meta ${META_SLA}%`}
              good={slaMedio >= META_SLA}
            />
          </div>
        </div>
      </Slide>

      {/* Slide 2 — Indicadores por Carteira */}
      <Slide>
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Indicadores por Carteira
            </h2>
            <p className="text-muted-foreground mt-1">
              Volume e produtividade consolidados por unidade
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <FiltroUnidade value={filtroUnidade} onChange={setFiltroUnidade} />
            <FiltroMes value={filtroMesCart} onChange={setFiltroMesCart} meses={mesesOp} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 flex-1 min-h-0">
          {(filtroUnidade === "all" || grupoDe(filtroUnidade as UnidadeKey) === "midea") && (
            <GrupoBlock
              titulo="Midea"
              tone="border-primary/40 bg-primary/5"
              total={totalizador("midea", filtroUnidade)}
              unidades={kpiPorUnidade.filter(
                (k) => k.grupo === "midea" && (filtroUnidade === "all" || k.key === filtroUnidade),
              )}
            />
          )}
          {(filtroUnidade === "all" || grupoDe(filtroUnidade as UnidadeKey) === "bosch") && (
            <GrupoBlock
              titulo="Bosch"
              tone="border-accent/40 bg-accent/5"
              total={totalizador("bosch", filtroUnidade)}
              unidades={kpiPorUnidade.filter(
                (k) => k.grupo === "bosch" && (filtroUnidade === "all" || k.key === filtroUnidade),
              )}
            />
          )}
        </div>
      </Slide>

      {/* Slide 3 — Tendência de Volume */}
      <Slide>
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Tendência de Volume</h2>
            <p className="text-muted-foreground mt-1">Volume mensal de processos</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <FiltroGrupo value={filtroGrupoVol} onChange={setFiltroGrupoVol} />
            <FiltroMes value={filtroMesVol} onChange={setFiltroMesVol} meses={mesesOp} />
          </div>
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
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke={C1}
                  fill="url(#gv)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Slide>


      {/* Slide — Melhorias e Pontos de Atenção */}
      <Slide>
        <SlideHeader
          title="Melhorias & Pontos de Atenção"
          subtitle="Itens de atenção e oportunidades identificadas pela operação"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
          {(["atencao", "oportunidade"] as const).map((t) => {
            const items = (melhorias.data ?? []).filter((m) => m.tipo === t);
            const isAtencao = t === "atencao";
            const Icon = isAtencao ? AlertCircle : Lightbulb;
            return (
              <Card key={t} className="flex flex-col min-h-0">
                <CardHeader className="flex flex-row items-center justify-between flex-shrink-0">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className={`h-5 w-5 ${isAtencao ? "text-warning" : "text-success"}`} />
                    {isAtencao ? "Pontos de Atenção" : "Oportunidades"}
                  </CardTitle>
                  <Badge variant="secondary">{items.length}</Badge>
                </CardHeader>
                <CardContent className="space-y-3 overflow-auto flex-1">
                  {items.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum item cadastrado.</p>
                  )}
                  {items.map((m) => (
                    <div key={m.id} className="border rounded-md p-3">
                      <div className="font-medium text-sm">{m.titulo}</div>
                      {m.descricao && (
                        <div className="text-xs text-muted-foreground mt-1">{m.descricao}</div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Slide>

      {/* Slide 5 — Evolução de Produtividade por Operação */}
      <Slide>
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Evolução da Operação</h2>
            <p className="text-muted-foreground mt-1">
              Produtividade mensal por operação (Jan até o mês atual) — meta {META_PRODUTIVIDADE}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <FiltroUnidade value={filtroUnidadeEvol} onChange={setFiltroUnidadeEvol} />
            <FiltroMes value={filtroMesEvol} onChange={setFiltroMesEvol} meses={mesesOp} />
          </div>
        </div>
        <Card className="flex-1 min-h-0">
          <CardContent className="pt-6 h-[460px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucaoProd}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Legend />
                <ReferenceLine
                  y={META_PRODUTIVIDADE}
                  stroke={CD}
                  strokeDasharray="6 4"
                  label={{ value: `Meta ${META_PRODUTIVIDADE}`, position: "right", fill: CD }}
                />
                {UNIDADES.filter(
                  (u) => filtroUnidadeEvol === "all" || u.key === filtroUnidadeEvol,
                ).map((u, i) => {
                  const palette = [
                    C1,
                    C2,
                    C3,
                    "var(--color-warning)",
                    "var(--color-muted-foreground)",
                    CD,
                  ];
                  return (
                    <Line
                      key={u.key}
                      type="monotone"
                      dataKey={u.key}
                      name={u.label}
                      stroke={palette[i % palette.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Slide>

      {/* Slide 6 — SLA Midea */}
      <Slide>
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">SLA — Midea</h2>
            <p className="text-muted-foreground mt-1">{`Meta ${META_SLA}% por indicador`}</p>
          </div>
          <FiltroMes value={filtroMesMidea} onChange={setFiltroMesMidea} meses={mesesMidea} />
        </div>
        <Card className="flex-1 min-h-0">
          <CardContent className="pt-6 h-[460px]">
            {mideaRadar.length === 0 ? (
              <Empty msg="Sem dados de SLA Midea cadastrados." />
            ) : (
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

      {/* Slide 7 — SLA BOSCH */}
      <Slide>
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">SLA — BOSCH</h2>
            <p className="text-muted-foreground mt-1">{`Média por indicador vs meta ${META_SLA}%`}</p>
          </div>
          <FiltroMes value={filtroMesBosch} onChange={setFiltroMesBosch} meses={mesesBosch} />
        </div>
        <Card className="flex-1 min-h-0">
          <CardContent className="pt-6 h-[460px]">
            {boschBars.length === 0 ? (
              <Empty msg="Sem dados de SLA BOSCH cadastrados." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={boschBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="indicador" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <ReferenceLine
                    y={META_SLA}
                    stroke={CD}
                    strokeDasharray="6 4"
                    label={{ value: `Meta ${META_SLA}%`, position: "right", fill: CD }}
                  />
                  <Bar
                    dataKey="valor"
                    radius={[6, 6, 0, 0]}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    shape={(props: any) => {
                      const ok = props.payload.valor >= META_SLA;
                      return (
                        <rect
                          x={props.x}
                          y={props.y}
                          width={props.width}
                          height={props.height}
                          rx={6}
                          fill={ok ? C3 : CD}
                        />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </Slide>

      {/* Slide 8 — Riscos */}
      <Slide>
        <SlideHeader title="Gargalos & Riscos" subtitle="Mapeamento de pontos críticos" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
          {(["alto", "medio", "baixo"] as const).map((nivel) => {
            const items = (gargalos.data ?? []).filter((r) => r.risco === nivel);
            const tone =
              nivel === "alto"
                ? "border-destructive"
                : nivel === "medio"
                  ? "border-warning"
                  : "border-success";
            return (
              <Card key={nivel} className={`border-2 ${tone}`}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="capitalize flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" /> Risco{" "}
                    {nivel === "medio" ? "Médio" : nivel}
                  </CardTitle>
                  <Badge variant="secondary">{items.length}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum item.</p>
                  )}
                  {items.map((r) => (
                    <div key={r.id} className="border rounded p-3">
                      <div className="font-medium">{r.item}</div>
                      {r.impacto && (
                        <div className="text-xs text-muted-foreground mt-1">{r.impacto}</div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Slide>

    </div>
  );
}

function Slide({ children, tone }: { children: React.ReactNode; tone?: "primary" }) {
  return (
    <section
      className={`min-h-screen w-full px-8 py-10 flex flex-col ${tone === "primary" ? "bg-gradient-to-br from-primary via-primary to-accent" : ""}`}
    >
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

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  good,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  good?: boolean;
}) {
  return (
    <Card className="bg-card/95 backdrop-blur">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div
          className={`text-3xl font-bold ${good === false ? "text-destructive" : good === true ? "text-success" : ""}`}
        >
          {value}
        </div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
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
  value,
  onChange,
  meses,
}: {
  value: string;
  onChange: (v: string) => void;
  meses: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Mês" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos os meses</SelectItem>
        {meses.map((m) => (
          <SelectItem key={m} value={m}>
            {fmtMes(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FiltroGrupo({
  value,
  onChange,
}: {
  value: "all" | "midea" | "bosch";
  onChange: (v: "all" | "midea" | "bosch") => void;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as "all" | "midea" | "bosch")}>
      <TabsList>
        <TabsTrigger value="all">Toda Operação</TabsTrigger>
        <TabsTrigger value="midea">Midea</TabsTrigger>
        <TabsTrigger value="bosch">Bosch</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function FiltroUnidade({
  value,
  onChange,
}: {
  value: "all" | UnidadeKey;
  onChange: (v: "all" | UnidadeKey) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as "all" | UnidadeKey)}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Filtrar operação" />
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
  );
}

type UnidadeKpi = {
  key: UnidadeKey;
  label: string;
  grupo: "midea" | "bosch";
  volume: number;
  headcount: number;
  prod: number;
  meses: number;
};

function GrupoBlock({
  titulo,
  tone,
  total,
  unidades,
}: {
  titulo: string;
  tone: string;
  total: { volume: number; headcount: number; prod: number };
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
          <MiniKpi label="Headcount" value={total.headcount.toLocaleString("pt-BR")} />
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
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {u.label}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Stat label="Vol." value={u.volume.toLocaleString("pt-BR")} />
                  <Stat label="HC" value={u.headcount.toLocaleString("pt-BR")} />
                  <Stat
                    label="Prod."
                    value={u.prod.toFixed(1)}
                    className={
                      u.meses === 0
                        ? "text-muted-foreground"
                        : ok
                          ? "text-success"
                          : "text-destructive"
                    }
                  />
                </div>
                {u.meses === 0 && (
                  <div className="text-[11px] text-muted-foreground mt-2">Sem cadastros</div>
                )}
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
      <div
        className={`text-lg font-bold ${good === false ? "text-destructive" : good === true ? "text-success" : ""}`}
      >
        {value}
      </div>
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
