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
  metaProdUnidade,
  META_SLA,
  UNIDADES,
  UNIDADE_LABEL,
  BOSCH_PLANTAS,
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
  TrendingDown,
  Users,
  Gauge,
  Target,
  Sparkles,
  AlertTriangle,
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
type SlaMidea = { mes: string; start_up: number; otcc: number; otd: number; sotd: number; unidade: UnidadeKey | null };
type SlaBosch = {
  mes: string;
  planta: string;
  dig_conf: number;
  start_up: number;
  otcc: number;
  pinho: number;
  proc_aereos: number | null;
  proc_maritimos: number | null;
  proc_canal_verde: number | null;
  proc_canal_vermelho: number | null;
  tm_dig_conf_h: number | null;
  tm_registro_dias: number | null;
  tm_liberacao_dias: number | null;
};
type PlanoAcaoRow = {
  id: string;
  iniciativa: string;
  objetivo: string | null;
  meta: string | null;
  responsavel: string;
  prazo: string | null;
  status: "andamento" | "concluido" | "atrasado";
};

function DashboardPage() {
  useRealtimeTable("operacional_mensal", ["operacional_mensal"]);
  useRealtimeTable("sla_midea", ["sla_midea"]);
  useRealtimeTable("sla_bosch", ["sla_bosch"]);
  useRealtimeTable("plano_acao", ["plano_acao_dash"]);
  useRealtimeTable("swot", ["swot_dash"]);

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

  const planoAcao = useQuery({
    queryKey: ["plano_acao_dash"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plano_acao").select("*").order("prazo", { ascending: true });
      if (error) throw error;
      return data as PlanoAcaoRow[];
    },
  });

  const swot = useQuery({
    queryKey: ["swot_dash"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("swot")
        .select("id, titulo, forcas, fraquezas, oportunidades, ameacas, created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        titulo: string;
        forcas: string[];
        fraquezas: string[];
        oportunidades: string[];
        ameacas: string[];
      }>;
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

  // Global month filter (applies to every slide)
  const [filtroMesGlobal, setFiltroMesGlobal] = useState<string>("all");

  // Per-chart filters (used when global = "all")
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

  const effMes = (local: string) => (filtroMesGlobal !== "all" ? filtroMesGlobal : local);
  const mesesGlobais = useMemo(
    () =>
      [...new Set([...mesesOp, ...mesesMidea, ...mesesBosch])].sort((a, b) =>
        b.localeCompare(a),
      ),
    [mesesOp, mesesMidea, mesesBosch],
  );

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
        matchesMes(r.mes, effMes(filtroMesVol)),
    );
    return aggByMonth(rows);
  }, [opAll, filtroGrupoVol, filtroMesVol, filtroMesGlobal]);

  const prodData = useMemo(() => {
    const rows = opAll.filter(
      (r) =>
        (filtroGrupoProd === "all" || grupoDe(r.unidade) === filtroGrupoProd) &&
        matchesMes(r.mes, effMes(filtroMesProd)),
    );
    return aggByMonth(rows);
  }, [opAll, filtroGrupoProd, filtroMesProd, filtroMesGlobal]);

  // KPI por unidade respeitando filtro do slide carteiras
  const kpiPorUnidade = useMemo(
    () =>
      UNIDADES.map((u) => {
        const rows = opAll.filter(
          (r) => r.unidade === u.key && matchesMes(r.mes, effMes(filtroMesCart)),
        );
        const volume = rows.reduce((s, r) => s + r.volume, 0);
        // Headcount não soma o mesmo time mês a mês: usa o máximo do período.
        const headcount = rows.reduce((m, r) => Math.max(m, Number(r.pessoas ?? 0)), 0);
        const totalPessoas = rows.reduce((s, r) => s + Number(r.pessoas ?? 0), 0);
        const prod = totalPessoas > 0 ? volume / totalPessoas : 0;
        return { ...u, volume, headcount, prod, meses: rows.length };
      }),
    [opAll, filtroMesCart, filtroMesGlobal],
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
        matchesMes(r.mes, effMes(filtroMesCart)),
    );
    const totalPessoas = rows.reduce((s, r) => s + Number(r.pessoas ?? 0), 0);
    const prod = totalPessoas > 0 ? volume / totalPessoas : 0;
    return { volume, headcount, prod };
  };

  // KPIs do topo (respeitam o filtro global de mês)
  const opGlobal = useMemo(
    () => opAll.filter((r) => matchesMes(r.mes, filtroMesGlobal)),
    [opAll, filtroMesGlobal],
  );
  const mideaGlobal = useMemo(
    () => (midea.data ?? []).filter((r) => matchesMes(r.mes, filtroMesGlobal)),
    [midea.data, filtroMesGlobal],
  );
  const boschGlobal = useMemo(
    () => (bosch.data ?? []).filter((r) => matchesMes(r.mes, filtroMesGlobal)),
    [bosch.data, filtroMesGlobal],
  );

  const allMonthly = aggByMonth(opGlobal);
  const totalVolume = allMonthly.reduce((s, r) => s + r.volume, 0);
  const totalPessoasMes = allMonthly.reduce((s, r) => s + r.pessoas, 0);
  const avgProd = totalPessoasMes > 0 ? totalVolume / totalPessoasMes : 0;
  // Headcount total = soma do MAX(pessoas) de cada unidade (sem dupla contagem)
  const headcountTotal = UNIDADES.reduce((sum, u) => {
    const rows = opGlobal.filter((r) => r.unidade === u.key);
    return sum + rows.reduce((m, r) => Math.max(m, Number(r.pessoas ?? 0)), 0);
  }, 0);

  const mideaFiltrada = (midea.data ?? []).filter((r) =>
    matchesMes(r.mes, effMes(filtroMesMidea)),
  );
  const boschFiltrada = (bosch.data ?? []).filter((r) =>
    matchesMes(r.mes, effMes(filtroMesBosch)),
  );

  const allSla = [
    ...mideaGlobal.flatMap((r) => [r.start_up, r.otcc, r.otd, r.sotd]),
    ...boschGlobal.flatMap((r) => [r.dig_conf, r.start_up, r.otcc, r.pinho]),
  ].map(Number);
  const slaMedio = allSla.length ? allSla.reduce((s, n) => s + n, 0) / allSla.length : 0;

  const totMidea = totalizador("midea", "all");
  const totBosch = totalizador("bosch", "all");

  const slaMideaVals = mideaGlobal
    .flatMap((r) => [r.start_up, r.otcc, r.otd, r.sotd])
    .map(Number);
  const slaMedioMidea = slaMideaVals.length
    ? slaMideaVals.reduce((s, n) => s + n, 0) / slaMideaVals.length
    : 0;

  const slaBoschVals = boschGlobal
    .flatMap((r) => [r.dig_conf, r.start_up, r.otcc, r.pinho])
    .map(Number);
  const slaMedioBosch = slaBoschVals.length
    ? slaBoschVals.reduce((s, n) => s + n, 0) / slaBoschVals.length
    : 0;


  // Evolução mensal de produtividade por unidade (série completa para gráfico de barras)
  const evolucaoPorUnidade = useMemo(() => {
    return UNIDADES.map((u) => {
      const rows = opAll.filter((r) => r.unidade === u.key);
      const byMes = new Map<string, { volume: number; pessoas: number }>();
      for (const r of rows) {
        const cur = byMes.get(r.mes) ?? { volume: 0, pessoas: 0 };
        cur.volume += r.volume;
        cur.pessoas += Number(r.pessoas ?? 0);
        byMes.set(r.mes, cur);
      }
      const data = [...byMes.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mes, v]) => ({
          mes: fmtMes(mes),
          produtividade: v.pessoas > 0 ? Number((v.volume / v.pessoas).toFixed(1)) : 0,
          volume: v.volume,
        }));
      return { ...u, data };
    });
  }, [opAll]);

  const mideaRadarPorUnidade = useMemo(() => {
    const keys = ["start_up", "otcc", "otd", "sotd"] as const;
    const unidadesMidea = UNIDADES.filter((u) => u.grupo === "midea");
    return unidadesMidea.map((u) => {
      const rows = mideaFiltrada.filter((r) => r.unidade === u.key);
      const data = keys.map((k) => ({
        indicador: k.toUpperCase().replace("_", "-"),
        valor: rows.length ? rows.reduce((s, r) => s + Number(r[k] || 0), 0) / rows.length : 0,
        meta: META_SLA,
      }));
      const valores = data.map((d) => d.valor);
      const geral = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
      return { unidade: u, data, rowsCount: rows.length, geral };
    });
  }, [mideaFiltrada]);

  const boschBarsPorPlanta = useMemo(() => {
    const keys = ["dig_conf", "start_up", "otcc", "pinho"] as const;
    const labels: Record<string, string> = {
      dig_conf: "Digitação/Conferência",
      start_up: "Registro DI/DUIMP",
      otcc: "Liberação Transporte",
      pinho: "Pinho",
    };
    return BOSCH_PLANTAS.map((p) => {
      const rows = boschFiltrada.filter((r) => r.planta === p.key);
      const data = keys.map((k) => ({
        indicador: labels[k],
        valor: rows.length ? rows.reduce((s, r) => s + Number(r[k] || 0), 0) / rows.length : 0,
      }));
      const valores = data.map((d) => d.valor);
      const geral = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
      return { planta: p, data, rowsCount: rows.length, geral };
    });
  }, [boschFiltrada]);

  // KPIs operacionais Bosch por planta (médias do período filtrado globalmente)
  const kpisBoschPorPlanta = useMemo(() => {
    const kpiDefs = [
      { key: "proc_aereos", label: "Aéreos", unit: "" },
      { key: "proc_maritimos", label: "Marítimos", unit: "" },
      { key: "proc_canal_verde", label: "C. Verde", unit: "" },
      { key: "proc_canal_vermelho", label: "C. Vermelho", unit: "" },
      { key: "tm_dig_conf_h", label: "TM Dig/Conf", unit: "h" },
      { key: "tm_registro_dias", label: "TM Registro", unit: "d" },
      { key: "tm_liberacao_dias", label: "TM Liberação", unit: "d" },
    ] as const;
    const map = new Map<string, Array<{ label: string; value: number; unit: string }>>();
    for (const p of BOSCH_PLANTAS) {
      const rows = boschGlobal.filter((r) => r.planta === p.key);
      const kpis = kpiDefs.map(({ key, label, unit }) => {
        const vals = rows.map((r) => Number(r[key as keyof SlaBosch] ?? 0)).filter((n) => !Number.isNaN(n));
        const avg = vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : 0;
        return { label, value: avg, unit };
      });
      map.set(p.key, kpis);
    }
    return map;
  }, [boschGlobal]);

  // Evolução de produtividade por operação (Jan até mês atual)
  const evolucaoProd = useMemo(() => {
    const currentMonth = new Date().getUTCMonth();
    const mesEvolEff = effMes(filtroMesEvol);
    const mesFiltroIdx = mesEvolEff === "all" ? null : new Date(mesEvolEff).getUTCMonth();
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
  }, [opAll, filtroUnidadeEvol, filtroMesEvol, filtroMesGlobal]);


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
          <div className="mt-6 flex items-center gap-3">
            <span className="text-sm text-primary-foreground/80 uppercase tracking-wide">
              Filtro global de mês
            </span>
            <div className="bg-card/95 backdrop-blur rounded-md">
              <FiltroMes
                value={filtroMesGlobal}
                onChange={setFiltroMesGlobal}
                meses={mesesGlobais}
              />
            </div>
            {filtroMesGlobal !== "all" && (
              <Badge variant="secondary">{fmtMes(filtroMesGlobal)}</Badge>
            )}
          </div>
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

          {/* KPIs por operação */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <OpKpiCard
              titulo="Midea"
              volume={totMidea.volume}
              headcount={totMidea.headcount}
              prod={totMidea.prod}
              sla={slaMedioMidea}
              tone="border-primary/40 bg-primary/10"
            />
            <OpKpiCard
              titulo="Bosch"
              volume={totBosch.volume}
              headcount={totBosch.headcount}
              prod={totBosch.prod}
              sla={slaMedioBosch}
              tone="border-accent/40 bg-accent/10"
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
              Evolução mensal de produtividade por operação
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 flex-1 min-h-0">
          <GrupoBlock
            titulo="Midea"
            tone="border-primary/40 bg-primary/5"
            total={totalizador("midea", "all")}
            unidades={kpiPorUnidade.filter((k) => k.grupo === "midea")}
            chartData={evolucaoPorUnidade.filter((u) => u.grupo === "midea")}
          />
          <GrupoBlock
            titulo="Bosch"
            tone="border-accent/40 bg-accent/5"
            total={totalizador("bosch", "all")}
            unidades={kpiPorUnidade.filter((k) => k.grupo === "bosch")}
            chartData={evolucaoPorUnidade.filter((u) => u.grupo === "bosch")}
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

      {/* Slide 6 — SLA Midea por Operação */}
      <Slide>
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">SLA — Midea</h2>
            <p className="text-muted-foreground mt-1">{`SLA Geral por operação — Meta ${META_SLA}%`}</p>
          </div>
          <FiltroMes value={filtroMesMidea} onChange={setFiltroMesMidea} meses={mesesMidea} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          {mideaRadarPorUnidade.map(({ unidade, data, rowsCount, geral }) => {
            const ok = geral >= META_SLA;
            return (
              <Card key={unidade.key} className="min-h-0 flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{unidade.label}</span>
                    <span className={`text-base font-semibold ${ok ? "text-success" : "text-destructive"}`}>
                      {geral.toFixed(1)}%
                    </span>
                  </CardTitle>
                  <CardDescription>SLA Geral (média dos indicadores)</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 min-h-[320px]">
                  {rowsCount === 0 ? (
                    <Empty msg="Sem dados cadastrados." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data} layout="vertical" margin={{ left: 16, right: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis type="category" dataKey="indicador" width={80} />
                        <Tooltip formatter={(v: number) => `${Number(v).toFixed(1)}%`} />
                        <ReferenceLine x={META_SLA} stroke={CD} strokeDasharray="4 4"
                          label={{ value: `Meta ${META_SLA}%`, fill: CD, position: "top" }} />
                        <Bar dataKey="valor" name="Real" fill={C1} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Slide>

      {/* Slide 7 — SLA BOSCH por Planta */}
      <Slide>
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">SLA — BOSCH</h2>
            <p className="text-muted-foreground mt-1">{`SLA Geral por planta — Meta ${META_SLA}%`}</p>
          </div>
          <FiltroMes value={filtroMesBosch} onChange={setFiltroMesBosch} meses={mesesBosch} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          {boschBarsPorPlanta.map(({ planta, data, rowsCount, geral }) => {
            const ok = geral >= META_SLA;
            return (
              <Card key={planta.key} className="min-h-0 flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Planta {planta.label}</span>
                    <span className={`text-base font-semibold ${ok ? "text-success" : "text-destructive"}`}>
                      {geral.toFixed(1)}%
                    </span>
                  </CardTitle>
                  <CardDescription>SLA Geral (média dos indicadores)</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 min-h-[320px]">
                  {rowsCount === 0 ? (
                    <Empty msg="Sem dados cadastrados." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data} layout="vertical" margin={{ left: 16, right: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis type="category" dataKey="indicador" width={160} />
                        <Tooltip formatter={(v: number) => `${Number(v).toFixed(1)}%`} />
                        <ReferenceLine x={META_SLA} stroke={CD} strokeDasharray="4 4"
                          label={{ value: `Meta ${META_SLA}%`, fill: CD, position: "top" }} />
                        <Bar dataKey="valor" name="Real" fill={C1} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Slide>



      {/* Slide 8 — Plano de Ação Estratégico */}
      <Slide>
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Plano de Ação Estratégico</h2>
            <p className="text-muted-foreground mt-1">Atingimento de Metas e Resolução de Riscos e Gargalos</p>
          </div>
        </div>
        <Card className="flex-1 min-h-0 overflow-auto">
          <CardContent className="p-0">
            <div className="w-full">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b border-border bg-muted/50">
                  <tr className="border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Iniciativa</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Objetivo</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Meta</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Responsável</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Prazo</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {!planoAcao.data?.length ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-muted-foreground">
                        Sem iniciativas cadastradas.
                      </td>
                    </tr>
                  ) : (
                    planoAcao.data.map((r) => {
                      const statusColors: Record<string, string> = {
                        andamento: "bg-accent text-accent-foreground",
                        concluido: "bg-success text-success-foreground",
                        atrasado: "bg-destructive text-destructive-foreground",
                      };
                      const statusLabels: Record<string, string> = {
                        andamento: "Em andamento",
                        concluido: "Concluído",
                        atrasado: "Atrasado",
                      };
                      return (
                        <tr key={r.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                          <td className="p-4 align-middle font-medium">{r.iniciativa}</td>
                          <td className="p-4 align-middle">{r.objetivo || "—"}</td>
                          <td className="p-4 align-middle">{r.meta || "—"}</td>
                          <td className="p-4 align-middle">{r.responsavel || "—"}</td>
                          <td className="p-4 align-middle">
                            {r.prazo ? new Date(r.prazo).toLocaleDateString("pt-BR", { timeZone: 'UTC' }) : "—"}
                          </td>
                          <td className="p-4 align-middle">
                            <Badge className={statusColors[r.status]}>{statusLabels[r.status]}</Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </Slide>

      {/* Slide 9 — Análise SWOT */}
      <Slide>
        <div className="mb-6">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Análise SWOT</h2>
          <p className="text-muted-foreground mt-1">
            {swot.data?.[0]?.titulo ?? "Cadastre uma análise em Gerenciamento Operacional › Ferramentas › SWOT"}
          </p>
        </div>
        {(() => {
          const s = swot.data?.[0];
          const quadrantes = [
            { key: "forcas", label: "Forças", icon: TrendingUp, cls: "bg-success/10 border-success/30 text-success" },
            { key: "fraquezas", label: "Fraquezas", icon: TrendingDown, cls: "bg-destructive/10 border-destructive/30 text-destructive" },
            { key: "oportunidades", label: "Oportunidades", icon: Sparkles, cls: "bg-primary/10 border-primary/30 text-primary" },
            { key: "ameacas", label: "Ameaças", icon: AlertTriangle, cls: "bg-warning/10 border-warning/30 text-warning" },
          ] as const;
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
              {quadrantes.map((q) => {
                const Icon = q.icon;
                const items = (s?.[q.key] as string[] | undefined) ?? [];
                return (
                  <Card key={q.key} className={`border-2 ${q.cls.split(" ").slice(0, 2).join(" ")}`}>
                    <CardHeader>
                      <CardTitle className={`flex items-center gap-2 ${q.cls.split(" ").slice(2).join(" ")}`}>
                        <Icon className="h-5 w-5" />
                        {q.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">Sem itens cadastrados.</p>
                      ) : (
                        <ul className="list-disc pl-5 text-sm space-y-1">
                          {items.map((it, i) => (
                            <li key={i}>{it}</li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })()}
      </Slide>

    </div>
  );
}

function OpKpiCard({
  titulo,
  volume,
  headcount,
  prod,
  sla,
  tone,
}: {
  titulo: string;
  volume: number;
  headcount: number;
  prod: number;
  sla: number;
  tone: string;
}) {
  return (
    <Card className={`border-2 ${tone}`}>
      <CardHeader>
        <CardTitle className="text-xl text-white">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniKpi label="Volume" value={volume.toLocaleString("pt-BR")} />
          <MiniKpi label="Headcount" value={headcount.toLocaleString("pt-BR")} />
          <MiniKpi
            label="Produtividade"
            value={prod.toFixed(1)}
            good={prod >= META_PRODUTIVIDADE}
          />
          <MiniKpi
            label="SLA médio"
            value={`${sla.toFixed(1)}%`}
            good={sla >= META_SLA}
          />
        </div>
      </CardContent>
    </Card>
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
  chartData,
}: {
  titulo: string;
  tone: string;
  total: { volume: number; headcount: number; prod: number };
  unidades: UnidadeKpi[];
  chartData: Array<{ key: UnidadeKey; label: string; data: Array<{ mes: string; produtividade: number }> }>;
}) {
  const avgMeta = unidades.length > 0
    ? unidades.reduce((s, u) => s + metaProdUnidade(u.key), 0) / unidades.length
    : META_PRODUTIVIDADE;

  return (
    <Card className={`border-2 ${tone}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-2xl">{titulo}</CardTitle>
          <CardDescription>Totalizador consolidado — evolução mensal por operação</CardDescription>
        </div>
        <div className="flex gap-3">
          <MiniKpi label="Volume Total" value={total.volume.toLocaleString("pt-BR")} />
          <MiniKpi label="Headcount" value={total.headcount.toLocaleString("pt-BR")} />
          <MiniKpi
            label="Produtividade"
            value={total.prod.toFixed(1)}
            good={total.prod >= avgMeta}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={`grid gap-5 ${
          chartData.length === 1 ? "grid-cols-1" :
          chartData.length === 2 ? "grid-cols-1 md:grid-cols-2" :
          "grid-cols-1 md:grid-cols-3"
        }`}>
          {chartData.map((u) => {
            const meta = metaProdUnidade(u.key);
            return (
              <div key={u.key} className="rounded-lg border bg-card p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {u.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Meta: <span className="font-bold text-destructive">{meta}</span>
                  </span>
                </div>
                {u.data.length === 0 ? (
                  <div className="h-[280px] grid place-items-center text-muted-foreground text-sm">
                    Sem dados cadastrados
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={u.data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(v: number) => [v.toFixed(1), "Produtividade"]}
                        labelStyle={{ fontSize: 12 }}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <ReferenceLine
                        y={meta}
                        stroke={CD}
                        strokeDasharray="5 3"
                        strokeWidth={2}
                        label={{ value: `Meta ${meta}`, fill: CD, position: "insideTopRight", fontSize: 11 }}
                      />
                      <Bar dataKey="produtividade" fill={C1} radius={[4, 4, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  </ResponsiveContainer>
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
