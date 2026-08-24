import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  type UnidadeGrupo,
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
  Eye,
  EyeOff,
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
type SlaMidea = { mes: string; start_up: number; otcc: number; otd: number; unidade: UnidadeKey | null };
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

  // Global month filter (applies to every slide)
  const [filtroMesGlobal, setFiltroMesGlobal] = useState<string>("all");
  const [filtroGrupoKpi, setFiltroGrupoKpi] = useState<"all" | "midea" | "bosch" | "outros">("all");
  const [showCusto, setShowCusto] = useState(false);

  // Visibilidade de seções do dashboard
  const [hideTendencia, setHideTendencia] = useState(false);
  const [hidePlano, setHidePlano] = useState(false);
  const [hideSwot, setHideSwot] = useState(false);

  // Filtros por slide (Mês + Operação independentes)
  const [filtroMesCart,  setFiltroMesCart]  = useState<string>("all");
  const [filtroOpCart,   setFiltroOpCart]   = useState<"all" | UnidadeKey>("all");

  const effMes = (local: string) => (filtroMesGlobal !== "all" ? filtroMesGlobal : local);
  const mesesGlobais = useMemo(
    () => [...new Set(mesesOp)].sort((a, b) => b.localeCompare(a)),
    [mesesOp],
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

  // Tendência de volume: histórico + projeção dos próximos 3 meses (regressão linear)
  const tendencia = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of opAll) map.set(r.mes, (map.get(r.mes) ?? 0) + Number(r.volume ?? 0));
    const hist = [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mes, volume]) => ({ mes, volume }));

    const data = hist.map((h) => ({
      mes: fmtMes(h.mes),
      real: h.volume,
      previsto: null as number | null,
    }));

    if (hist.length < 2) return { data, media: 0, tendenciaPct: 0, hasForecast: false };

    // regressão sobre os últimos 12 meses (mínimo 2 pontos)
    const base = hist.slice(-12);
    const n = base.length;
    const sx = base.reduce((s, _, i) => s + i, 0);
    const sy = base.reduce((s, r) => s + r.volume, 0);
    const sxy = base.reduce((s, r, i) => s + i * r.volume, 0);
    const sxx = base.reduce((s, _, i) => s + i * i, 0);
    const denom = n * sxx - sx * sx;
    const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;

    // conecta a linha prevista ao último ponto real
    data[data.length - 1].previsto = hist[hist.length - 1].volume;

    const last = new Date(`${hist[hist.length - 1].mes.slice(0, 7)}-01T00:00:00Z`);
    for (let k = 1; k <= 3; k++) {
      const d = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + k, 1));
      const val = Math.max(0, Math.round(intercept + slope * (n - 1 + k)));
      data.push({ mes: fmtMes(d), real: null as unknown as number, previsto: val });
    }

    const media = sy / n;
    const tendenciaPct = media > 0 ? (slope / media) * 100 : 0;
    return { data, media, tendenciaPct, hasForecast: true };
  }, [opAll]);

  // Tendência por operação: histórico cadastrado + projeção automática de 3 meses
  const tendenciaPorUnidade = useMemo(() => {
    return UNIDADES.map((unidade) => {
      const map = new Map<string, number>();
      for (const r of opAll) {
        if (r.unidade !== unidade.key) continue;
        map.set(r.mes, (map.get(r.mes) ?? 0) + Number(r.volume ?? 0));
      }
      const hist = [...map.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([mes, volume]) => ({ mes, volume }));

      const data = hist.map((h) => ({
        mes: fmtMes(h.mes),
        real: h.volume,
        previsto: null as number | null,
      }));

      if (hist.length < 2) {
        return { unidade, data, tendenciaPct: 0, hasForecast: false, rowsCount: hist.length };
      }

      const base = hist.slice(-12);
      const n = base.length;
      const sx = base.reduce((s, _, i) => s + i, 0);
      const sy = base.reduce((s, r) => s + r.volume, 0);
      const sxy = base.reduce((s, r, i) => s + i * r.volume, 0);
      const sxx = base.reduce((s, _, i) => s + i * i, 0);
      const denom = n * sxx - sx * sx;
      const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
      const intercept = (sy - slope * sx) / n;

      data[data.length - 1].previsto = hist[hist.length - 1].volume;
      const last = new Date(`${hist[hist.length - 1].mes.slice(0, 7)}-01T00:00:00Z`);
      for (let k = 1; k <= 3; k++) {
        const d = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + k, 1));
        data.push({
          mes: fmtMes(d),
          real: null as unknown as number,
          previsto: Math.max(0, Math.round(intercept + slope * (n - 1 + k))),
        });
      }
      const media = sy / n;
      return {
        unidade,
        data,
        tendenciaPct: media > 0 ? (slope / media) * 100 : 0,
        hasForecast: true,
        rowsCount: hist.length,
      };
    }).filter((t) => t.rowsCount > 0);
  }, [opAll]);




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

  const totalizador = (grupo: "midea" | "bosch" | "outros", uniFilter: "all" | UnidadeKey = "all") => {
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

  // KPIs do topo (respeitam o filtro global de mês E o filtro de grupo)
  const opGlobal = useMemo(
    () => opAll.filter((r) => matchesMes(r.mes, filtroMesGlobal)),
    [opAll, filtroMesGlobal],
  );
  const opGlobalKpi = useMemo(
    () => opGlobal.filter((r) => filtroGrupoKpi === "all" || grupoDe(r.unidade) === filtroGrupoKpi),
    [opGlobal, filtroGrupoKpi],
  );
  const allMonthly = aggByMonth(opGlobalKpi);
  const totalVolume = allMonthly.reduce((s, r) => s + r.volume, 0);
  const totalPessoasMes = allMonthly.reduce((s, r) => s + r.pessoas, 0);
  const avgProd = totalPessoasMes > 0 ? totalVolume / totalPessoasMes : 0;
  const headcountTotal = UNIDADES.filter((u) => filtroGrupoKpi === "all" || u.grupo === filtroGrupoKpi).reduce((sum, u) => {
    const rows = opGlobalKpi.filter((r) => r.unidade === u.key);
    return sum + rows.reduce((m, r) => Math.max(m, Number(r.pessoas ?? 0)), 0);
  }, 0);

  const filtroGrupoUnids = filtroGrupoKpi === "all"
    ? UNIDADES
    : UNIDADES.filter((u) => u.grupo === filtroGrupoKpi);
  const avgMetaKpi = filtroGrupoUnids.length > 0
    ? filtroGrupoUnids.reduce((s, u) => s + metaProdUnidade(u.key), 0) / filtroGrupoUnids.length
    : META_PRODUTIVIDADE;

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
            Dashboard Operacional
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/80 mt-4 max-w-3xl">
            Resultados, indicadores de SLA, riscos identificados e plano estratégico para 2026.
          </p>
          <div className="mt-6 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-primary-foreground/80 uppercase tracking-wide">Mês</span>
              <div className="bg-card/95 backdrop-blur rounded-md">
                <FiltroMes value={filtroMesGlobal} onChange={setFiltroMesGlobal} meses={mesesGlobais} />
              </div>
            </div>
            <div className="bg-card/95 backdrop-blur rounded-md">
              <FiltroGrupo value={filtroGrupoKpi} onChange={setFiltroGrupoKpi} />
            </div>
            <button
              onClick={() => setShowCusto((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold border transition-colors ${
                showCusto
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card/95 text-foreground border-border hover:bg-muted"
              }`}
            >
              💰 {showCusto ? "Ocultar Custo" : "Ver Custo Operacional"}
            </button>
          </div>
          {(hideTendencia || hidePlano || hideSwot) && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-primary-foreground/80 uppercase tracking-wide">Seções ocultas</span>
              {hideTendencia && (
                <button
                  onClick={() => setHideTendencia(false)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold border bg-card/95 text-foreground border-border hover:bg-muted transition-colors"
                >
                  <Eye className="h-4 w-4" /> Tendência de Volume
                </button>
              )}
              {hidePlano && (
                <button
                  onClick={() => setHidePlano(false)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold border bg-card/95 text-foreground border-border hover:bg-muted transition-colors"
                >
                  <Eye className="h-4 w-4" /> Plano de Ação Estratégico
                </button>
              )}
              {hideSwot && (
                <button
                  onClick={() => setHideSwot(false)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold border bg-card/95 text-foreground border-border hover:bg-muted transition-colors"
                >
                  <Eye className="h-4 w-4" /> Análise SWOT
                </button>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-10 w-full">
            <Kpi icon={TrendingUp} label="Volume Total" value={totalVolume.toLocaleString("pt-BR")} />
            <Kpi icon={Users} label="Headcount Total" value={headcountTotal.toLocaleString("pt-BR")} sub="Sem dupla contagem" />
            <Kpi
              icon={Gauge}
              label="Produtividade média"
              value={avgProd.toFixed(1)}
              sub={`Meta ${avgMetaKpi.toFixed(0)}`}
              good={avgProd >= avgMetaKpi}
            />
          </div>
        </div>
      </Slide>

      {/* Slide 2 — Indicadores por Carteira */}
      <Slide>
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Indicadores por Carteira</h2>
            <p className="text-muted-foreground mt-1">Evolução mensal de produtividade por operação</p>
          </div>
          <FiltroPadrao
            mes={filtroMesCart} onMes={setFiltroMesCart} meses={mesesOp}
            op={filtroOpCart}   onOp={setFiltroOpCart}
          />
        </div>
        <div className="grid grid-cols-1 gap-6 flex-1 min-h-0">
          {(filtroOpCart === "all" || filtroOpCart === "midea_sc" || filtroOpCart === "midea_am" || filtroOpCart === "midea_rs") && (
            <GrupoBlock
              titulo="Midea"
              tone="border-primary/40 bg-primary/5"
              total={totalizador("midea", filtroOpCart.startsWith("midea") ? filtroOpCart : "all")}
              unidades={kpiPorUnidade.filter((k) => k.grupo === "midea" && (filtroOpCart === "all" || k.key === filtroOpCart))}
              chartData={evolucaoPorUnidade.filter((u) => u.grupo === "midea" && (filtroOpCart === "all" || u.key === filtroOpCart))}
            />
          )}
          {(filtroOpCart === "all" || filtroOpCart === "bosch") && (
            <GrupoBlock
              titulo="Bosch"
              tone="border-accent/40 bg-accent/5"
              total={totalizador("bosch", "all")}
              unidades={kpiPorUnidade.filter((k) => k.grupo === "bosch")}
              chartData={evolucaoPorUnidade.filter((u) => u.grupo === "bosch")}
            />
          )}
          {(filtroOpCart === "all" || ["volkswagen","perkins","brp","hyundai","gwm"].includes(filtroOpCart)) && (
            <GrupoBlock
              titulo="Outras Operações"
              tone="border-warning/40 bg-warning/5"
              total={totalizador("outros", ["volkswagen","perkins","brp","hyundai","gwm"].includes(filtroOpCart) ? filtroOpCart : "all")}
              unidades={kpiPorUnidade.filter((k) => k.grupo === "outros" && (filtroOpCart === "all" || k.key === filtroOpCart))}
              chartData={evolucaoPorUnidade.filter((u) => u.grupo === "outros" && (filtroOpCart === "all" || u.key === filtroOpCart))}
            />
          )}
        </div>
      </Slide>

      {/* Slide 3 — Tendência de Volume + Projeção 3 meses */}
      {!hideTendencia && (
        <Slide>
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Tendência de Volume</h2>
              <p className="text-muted-foreground mt-1">
                Histórico consolidado e projeção dos próximos 3 meses (regressão linear sobre os
                últimos 12 meses cadastrados)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHideTendencia(true)}
              aria-label="Ocultar tendência de volume"
            >
              <EyeOff className="h-4 w-4 mr-2" />
              Ocultar
            </Button>
          </div>
          <Card className="flex-1 min-h-0 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-4 flex-wrap">
                <span>Volume mensal — real x previsto</span>
                {tendencia.hasForecast && (
                  <span
                    className={`text-base font-semibold ${tendencia.tendenciaPct >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {tendencia.tendenciaPct >= 0 ? "+" : ""}
                    {tendencia.tendenciaPct.toFixed(1)}% ao mês
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Atualiza automaticamente conforme novos volumes são cadastrados.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-[320px]">
              {tendencia.data.length === 0 ? (
                <Empty msg="Sem volumes cadastrados." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={tendencia.data} margin={{ left: 8, right: 24, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="mes" interval={0} angle={-40} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip
                      formatter={(v: number, name: string) => [Number(v).toLocaleString("pt-BR"), name]}
                    />
                    <Legend />
                    {tendencia.media > 0 && (
                      <ReferenceLine
                        y={Math.round(tendencia.media)}
                        stroke={C2}
                        strokeDasharray="4 4"
                        label={{ value: "Média", fill: C2, position: "right" }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="real"
                      name="Realizado"
                      stroke={C1}
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="previsto"
                      name="Projeção"
                      stroke={C3}
                      strokeWidth={3}
                      strokeDasharray="6 4"
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Slide>
      )}

      {/* Slide 3b — Tendência de Volume por Operação */}
      {!hideTendencia && tendenciaPorUnidade.length > 0 && (
        <Slide>
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                Tendência de Volume por Operação
              </h2>
              <p className="text-muted-foreground mt-1">
                Histórico cadastrado por operação e projeção automática dos próximos 3 meses
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHideTendencia(true)}
              aria-label="Ocultar tendência de volume"
            >
              <EyeOff className="h-4 w-4 mr-2" />
              Ocultar
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
            {tendenciaPorUnidade.map((t) => (
              <Card key={t.unidade.key} className="min-h-0 flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span>{t.unidade.label}</span>
                    {t.hasForecast && (
                      <span
                        className={`text-sm font-semibold ${t.tendenciaPct >= 0 ? "text-success" : "text-destructive"}`}
                      >
                        {t.tendenciaPct >= 0 ? "+" : ""}
                        {t.tendenciaPct.toFixed(1)}%/mês
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>Realizado x projeção (3 meses)</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 min-h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={t.data} margin={{ left: 8, right: 16, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="mes" interval={0} angle={-40} textAnchor="end" height={56} />
                      <YAxis />
                      <Tooltip
                        formatter={(v: number, name: string) => [
                          Number(v).toLocaleString("pt-BR"),
                          name,
                        ]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="real"
                        name="Realizado"
                        stroke={C1}
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        connectNulls={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="previsto"
                        name="Projeção"
                        stroke={C3}
                        strokeWidth={2.5}
                        strokeDasharray="6 4"
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ))}
          </div>
        </Slide>
      )}

      {/* Slide 4 — Plano de Ação Estratégico */}
      {!hidePlano && (
        <Slide>
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Plano de Ação Estratégico</h2>
              <p className="text-muted-foreground mt-1">Atingimento de Metas e Resolução de Riscos e Gargalos</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHidePlano(true)}
              aria-label="Ocultar plano de ação estratégico"
            >
              <EyeOff className="h-4 w-4 mr-2" />
              Ocultar
            </Button>
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
      )}

      {/* Slide 9 — Análise SWOT */}
      {!hideSwot && (
        <Slide>
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Análise SWOT</h2>
              <p className="text-muted-foreground mt-1">
                {swot.data?.[0]?.titulo ?? "Cadastre uma análise em Gerenciamento Operacional › Ferramentas › SWOT"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHideSwot(true)}
              aria-label="Ocultar análise SWOT"
            >
              <EyeOff className="h-4 w-4 mr-2" />
              Ocultar
            </Button>
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
      )}

      {/* Custo Operacional — Midea (toggle) */}
      {showCusto && (
        <Slide>
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">💰 Custo Operacional — Midea</h2>
              <p className="text-muted-foreground mt-1">Custo total por unidade · Referência: planilha vigente</p>
            </div>
            <button onClick={() => setShowCusto(false)}
              className="px-4 py-2 rounded-md border text-sm font-semibold hover:bg-muted transition-colors">
              Ocultar
            </button>
          </div>

          {/* KPIs rápidos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Midea",     value: 382945.12, head: 58 },
              { label: "Midea Manaus",    value: 156354.69, head: 24 },
              { label: "Midea Canoas",    value: 124128.14, head: 18 },
              { label: "Midea SC",        value: 102462.29, head: 16 },
            ].map(({ label, value, head }) => (
              <Card key={label}>
                <CardContent className="pt-5">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
                  <div className="text-2xl font-bold text-primary">
                    {value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{head} colaboradores</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comparativo 2024 vs Atual */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Custo Total por Unidade</CardTitle>
                <CardDescription>Comparativo 2024 vs. Atual</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { planta: "Midea Manaus", atual: 156354.69, ref2024: 88651.59 },
                      { planta: "Midea Canoas", atual: 124128.14, ref2024: 163821.51 },
                      { planta: "Midea SC",     atual: 102462.29, ref2024: 161405.47 },
                    ]}
                    margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="planta" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                    <Legend />
                    <Bar dataKey="atual"   name="Atual"   fill={C1} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="ref2024" name="2024"    fill={C2} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Composição do Custo (Atual)</CardTitle>
                <CardDescription>Distribuição dos componentes por unidade</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { planta: "Manaus", rem: 87472, encargos: 16860, provisoes: 29879, beneficios: 22143 },
                      { planta: "Canoas", rem: 66856, encargos: 14261, provisoes: 24848, beneficios: 18163 },
                      { planta: "SC",     rem: 62202, encargos: 10182, provisoes: 18093, beneficios: 11985 },
                    ]}
                    margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="planta" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="rem"        name="Remuneração"  stackId="a" fill={C1}   />
                    <Bar dataKey="encargos"   name="Encargos"     stackId="a" fill={C2}   />
                    <Bar dataKey="provisoes"  name="Provisões"    stackId="a" fill={C3}   />
                    <Bar dataKey="beneficios" name="Benefícios"   stackId="a" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Cards individuais por planta */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              { label: "Midea Manaus", total: 156354.69, head: 24, rem: 87472.15, inss: 12342.50, fgts: 4517.77, provisoes: 29878.83, beneficios: 22143.45 },
              { label: "Midea Canoas", total: 124128.14, head: 18, rem: 66855.72, inss:  8912.80, fgts: 5348.46, provisoes: 24848.03, beneficios: 18163.12 },
              { label: "Midea SC",     total: 102462.29, head: 16, rem: 62201.85, inss:  7772.47, fgts: 2410.07, provisoes: 18093.25, beneficios: 11984.64 },
            ] as const).map((p) => (
              <Card key={p.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{p.label}</CardTitle>
                  <CardDescription>{p.head} colaboradores</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    { label: "Remuneração bruta", value: p.rem,        pct: (p.rem/p.total*100) },
                    { label: "INSS + FGTS",        value: p.inss+p.fgts, pct: ((p.inss+p.fgts)/p.total*100) },
                    { label: "Provisões",           value: p.provisoes,  pct: (p.provisoes/p.total*100) },
                    { label: "Benefícios",          value: p.beneficios, pct: (p.beneficios/p.total*100) },
                  ].map(({ label, value, pct }) => (
                    <div key={label}>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium tabular-nums">
                          {value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                          <span className="text-muted-foreground text-xs ml-1">({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="pt-1 border-t flex justify-between font-bold">
                    <span>Total</span>
                    <span>{p.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            Bosch: a definir · Dados extraídos da planilha vigente de custo · Valores sujeitos a atualização
          </p>
        </Slide>
      )}

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
  value: "all" | "midea" | "bosch" | "outros";
  onChange: (v: "all" | "midea" | "bosch" | "outros") => void;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as "all" | "midea" | "bosch" | "outros")}>
      <TabsList>
        <TabsTrigger value="all">Toda Operação</TabsTrigger>
        <TabsTrigger value="midea">Midea</TabsTrigger>
        <TabsTrigger value="bosch">Bosch</TabsTrigger>
        <TabsTrigger value="outros">Outros</TabsTrigger>
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
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Operação" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas</SelectItem>
        {UNIDADES.map((u) => (
          <SelectItem key={u.key} value={u.key}>
            {u.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FiltroPadrao({
  mes, onMes, meses, op, onOp,
}: {
  mes: string; onMes: (v: string) => void; meses: string[];
  op: "all" | UnidadeKey; onOp: (v: "all" | UnidadeKey) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mês</span>
        <FiltroMes value={mes} onChange={onMes} meses={meses} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operação</span>
        <FiltroUnidade value={op} onChange={onOp} />
      </div>
    </div>
  );
}

type UnidadeKpi = {
  key: UnidadeKey;
  label: string;
  grupo: UnidadeGrupo;
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
        <div className="flex gap-3 flex-wrap">
          <MiniKpi label="Volume Total" value={total.volume.toLocaleString("pt-BR")} />
          <MiniKpi label="Headcount" value={total.headcount.toLocaleString("pt-BR")} />
          <MiniKpi label="Produtividade" value={total.prod.toFixed(1)} good={total.prod >= avgMeta} />
        </div>
      </CardHeader>
      {/* % meta atingida por operação */}
      <div className="px-6 pb-3 flex gap-2 flex-wrap">
        {unidades.map((u) => {
          const meta = metaProdUnidade(u.key);
          const pct = meta > 0 ? Math.round((u.prod / meta) * 100) : 0;
          const ok = pct >= 100;
          return (
            <div key={u.key} className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs bg-card">
              <span className="text-muted-foreground font-medium">{u.label}</span>
              <span className={`font-bold ${ok ? "text-success" : pct >= 75 ? "text-warning" : "text-destructive"}`}>
                {pct}%
              </span>
              <span className="text-muted-foreground">da meta</span>
            </div>
          );
        })}
      </div>
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
                    <BarChart data={u.data} margin={{ top: 8, right: 12, left: -12, bottom: 28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="mes"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={50}
                        tickMargin={6}
                        minTickGap={0}
                      />
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
