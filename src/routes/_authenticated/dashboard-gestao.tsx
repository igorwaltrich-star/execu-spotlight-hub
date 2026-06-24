import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Target, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import {
  ResponsiveContainer, RadialBarChart, RadialBar, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard-gestao")({
  component: DashboardGestaoPage,
});

/* ─── tipos ─────────────────────────────────────────── */
type Colaborador = { id: string; nome: string; cargo: string; area: string };
type IndRow = {
  id: string; colaborador_id: string; referencia: string;
  nota_zmm: number | null; sla_po: number | null; sla_sotd: number | null;
  sla_pre_alert: number | null; sla_otd: number | null;
  comportamental: number | null; meta_individual: number | null;
  uep: number | null; ppax: number | null;
};
type MatrizRow = { id: string; colaborador_id: string; tag: string; observacoes: string };
type NavyRow   = { id: string; colaborador_id: string; tag: string; observacoes: string };
type PlanoRow  = { id: string; iniciativa: string; objetivo: string | null; meta: string | null; responsavel: string; prazo: string | null; status: string };

const CAMPOS_IND = ["nota_zmm","sla_po","sla_sotd","sla_pre_alert","sla_otd","comportamental","meta_individual","uep","ppax"] as const;
function media(r: IndRow) {
  const vals = CAMPOS_IND.map((k) => r[k]).filter((v): v is number => typeof v === "number");
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

const TAG_MATRIZ: Record<string, { label: string; cls: string }> = {
  alta_performance:    { label: "Alta Performance",     cls: "bg-success text-success-foreground" },
  zona_desenvolvimento:{ label: "Zona Desenvolvimento", cls: "bg-primary text-primary-foreground" },
  zona_risco:          { label: "Zona de Risco",        cls: "bg-warning text-warning-foreground" },
  zona_desalinhamento: { label: "Zona Desalinhamento",  cls: "bg-destructive text-destructive-foreground" },
};
const TAG_NAVY: Record<string, { label: string; cls: string }> = {
  a_player: { label: "A-Player", cls: "bg-success text-success-foreground" },
  b_player: { label: "B-Player", cls: "bg-secondary text-secondary-foreground" },
  c_player: { label: "C-Player", cls: "bg-destructive text-destructive-foreground" },
};
const STATUS_PLANO: Record<string, { label: string; cls: string }> = {
  andamento: { label: "Em andamento", cls: "bg-accent text-accent-foreground" },
  concluido: { label: "Concluído",    cls: "bg-success text-success-foreground" },
  atrasado:  { label: "Atrasado",     cls: "bg-destructive text-destructive-foreground" },
};

function DashboardGestaoPage() {
  useRealtimeTable("indicadores_performance", ["ind_perf_gestao"]);
  useRealtimeTable("colaboradores",           ["colabs_gestao"]);
  useRealtimeTable("matriz_lideranca",        ["matriz_gestao"]);
  useRealtimeTable("navy_seal",               ["navy_gestao"]);
  useRealtimeTable("plano_acao",              ["plano_gestao"]);

  const { data: colabs = [] } = useQuery<Colaborador[]>({
    queryKey: ["colabs_gestao"],
    queryFn: async () => {
      const { data, error } = await supabase.from("colaboradores").select("id,nome,cargo,area").order("nome");
      if (error) throw error; return data ?? [];
    },
  });
  const { data: ind = [] } = useQuery<IndRow[]>({
    queryKey: ["ind_perf_gestao"],
    queryFn: async () => {
      const { data, error } = await supabase.from("indicadores_performance")
        .select("id,colaborador_id,referencia,nota_zmm,sla_po,sla_sotd,sla_pre_alert,sla_otd,comportamental,meta_individual,uep,ppax");
      if (error) throw error; return (data ?? []) as IndRow[];
    },
  });
  const { data: matriz = [] } = useQuery<MatrizRow[]>({
    queryKey: ["matriz_gestao"],
    queryFn: async () => {
      const { data, error } = await supabase.from("matriz_lideranca").select("id,colaborador_id,tag,observacoes").order("created_at", { ascending: false });
      if (error) throw error; return (data ?? []) as MatrizRow[];
    },
  });
  const { data: navy = [] } = useQuery<NavyRow[]>({
    queryKey: ["navy_gestao"],
    queryFn: async () => {
      const { data, error } = await supabase.from("navy_seal").select("id,colaborador_id,tag,observacoes").order("created_at", { ascending: false });
      if (error) throw error; return (data ?? []) as NavyRow[];
    },
  });
  const { data: plano = [] } = useQuery<PlanoRow[]>({
    queryKey: ["plano_gestao"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plano_acao").select("*").order("prazo", { ascending: true });
      if (error) throw error; return (data ?? []) as PlanoRow[];
    },
  });

  const nome = (id: string) => colabs.find((c) => c.id === id)?.nome ?? "—";

  /* ranking */
  const ranking = useMemo(() => {
    const byColab = new Map<string, number[]>();
    ind.forEach((r) => { const m = media(r); if (m !== null) { const arr = byColab.get(r.colaborador_id) ?? []; arr.push(m); byColab.set(r.colaborador_id, arr); } });
    return Array.from(byColab.entries())
      .map(([id, arr]) => ({ colaborador_id: id, nota: arr.reduce((a, b) => a + b, 0) / arr.length, avaliacoes: arr.length }))
      .sort((a, b) => b.nota - a.nota);
  }, [ind]);

  /* distribuição Matriz */
  const matrizDist = useMemo(() => {
    const counts: Record<string, number> = {};
    matriz.forEach((r) => { counts[r.tag] = (counts[r.tag] ?? 0) + 1; });
    return Object.entries(TAG_MATRIZ).map(([key, meta]) => ({ name: meta.label, value: counts[key] ?? 0 }));
  }, [matriz]);

  /* distribuição Navy */
  const navyDist = useMemo(() => {
    const counts: Record<string, number> = {};
    navy.forEach((r) => { counts[r.tag] = (counts[r.tag] ?? 0) + 1; });
    return Object.entries(TAG_NAVY).map(([key, meta]) => ({ name: meta.label, value: counts[key] ?? 0 }));
  }, [navy]);

  /* plano stats */
  const planoStats = useMemo(() => ({
    total: plano.length,
    concluido: plano.filter((r) => r.status === "concluido").length,
    andamento: plano.filter((r) => r.status === "andamento").length,
    atrasado:  plano.filter((r) => r.status === "atrasado").length,
  }), [plano]);

  const C1 = "var(--color-primary)";
  const C2 = "var(--color-accent)";
  const C3 = "var(--color-success)";
  const CD = "var(--color-destructive)";
  const CW = "var(--color-warning)";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Gestão</h1>
        <p className="text-sm text-muted-foreground mt-1">Pessoas, liderança e acompanhamento estratégico</p>
      </div>

      {/* ── KPIs rápidos ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Colaboradores",     value: colabs.length,        icon: Users,         cls: "" },
          { label: "Planos de Ação",    value: planoStats.total,     icon: Target,        cls: "" },
          { label: "Concluídos",        value: planoStats.concluido, icon: CheckCircle2,  cls: "text-success" },
          { label: "Atrasados",         value: planoStats.atrasado,  icon: AlertCircle,   cls: "text-destructive" },
        ].map(({ label, value, icon: Icon, cls }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
                <Icon className={`h-4 w-4 text-muted-foreground ${cls}`} />
              </div>
              <div className={`text-3xl font-bold ${cls}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Ranking + Plano ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking de Analistas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> Ranking de Analistas</CardTitle>
            <CardDescription>Nota média por indicadores de performance</CardDescription>
          </CardHeader>
          <CardContent>
            {ranking.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem dados cadastrados</p>
            ) : (
              <div className="space-y-2">
                {ranking.map((r, i) => {
                  const pct = Math.min((r.nota / 10) * 100, 100);
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
                  return (
                    <div key={r.colaborador_id} className="flex items-center gap-3">
                      <span className="w-8 text-sm font-bold text-center">{medal}</span>
                      <span className="flex-1 text-sm font-medium truncate">{nome(r.colaborador_id)}</span>
                      <div className="w-32 bg-muted rounded-full h-2">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`text-sm font-bold w-10 text-right ${r.nota >= 8 ? "text-success" : r.nota >= 6 ? "text-warning" : "text-destructive"}`}>
                        {r.nota.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plano de Ação — status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Plano de Ação Estratégico</CardTitle>
            <CardDescription>Atingimento de metas e resolução de riscos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {plano.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem iniciativas cadastradas</p>
            ) : (
              <>
                {/* barras de status */}
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{ name: "Status", Concluído: planoStats.concluido, "Em andamento": planoStats.andamento, Atrasado: planoStats.atrasado }]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="name" hide />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Concluído"    fill={C3} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Em andamento" fill={C2} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Atrasado"     fill={CD} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* lista compacta */}
                <div className="space-y-1.5 max-h-40 overflow-auto">
                  {plano.slice(0, 8).map((r) => {
                    const s = STATUS_PLANO[r.status] ?? STATUS_PLANO.andamento;
                    return (
                      <div key={r.id} className="flex items-center gap-2 text-sm">
                        <Badge className={`${s.cls} text-[10px] shrink-0`}>{s.label}</Badge>
                        <span className="truncate">{r.iniciativa}</span>
                        {r.responsavel && <span className="text-muted-foreground shrink-0 text-xs">· {r.responsavel}</span>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── NavySeal + Matriz ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* NavySeal */}
        <Card>
          <CardHeader>
            <CardTitle>NavySeal — Classificação de Talentos</CardTitle>
            <CardDescription>Distribuição dos colaboradores por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            {navy.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem classificações cadastradas</p>
            ) : (
              <div className="space-y-4">
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={navyDist} margin={{ left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" name="Colaboradores" radius={[4, 4, 0, 0]}>
                        {navyDist.map((_, i) => <Cell key={i} fill={[C3, C1, CD][i % 3]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(TAG_NAVY).map(([key, meta]) => {
                    const items = navy.filter((r) => r.tag === key);
                    return (
                      <div key={key} className="space-y-1">
                        <Badge className={`${meta.cls} text-[10px]`}>{meta.label}</Badge>
                        <div className="space-y-0.5">
                          {items.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                          {items.map((r) => <p key={r.id} className="text-xs truncate">{nome(r.colaborador_id)}</p>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Matriz de Liderança */}
        <Card>
          <CardHeader>
            <CardTitle>Matriz de Liderança</CardTitle>
            <CardDescription>Distribuição por zona de desempenho</CardDescription>
          </CardHeader>
          <CardContent>
            {matriz.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem classificações cadastradas</p>
            ) : (
              <div className="space-y-4">
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={matrizDist} margin={{ left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" name="Colaboradores" radius={[4, 4, 0, 0]}>
                        {matrizDist.map((_, i) => <Cell key={i} fill={[C3, C1, CW, CD][i % 4]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TAG_MATRIZ).map(([key, meta]) => {
                    const items = matriz.filter((r) => r.tag === key);
                    if (items.length === 0) return null;
                    return (
                      <div key={key} className="rounded-md border p-2 space-y-1">
                        <Badge className={`${meta.cls} text-[10px]`}>{meta.label}</Badge>
                        {items.slice(0, 3).map((r) => <p key={r.id} className="text-xs truncate">{nome(r.colaborador_id)}</p>)}
                        {items.length > 3 && <p className="text-[10px] text-muted-foreground">+{items.length - 3} mais</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Performance por Analista (barras) ── */}
      {ranking.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Comparativa dos Analistas</CardTitle>
            <CardDescription>Nota média por analista — escala 0 a 10</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ranking.map((r) => ({ name: nome(r.colaborador_id).split(" ")[0], nota: Number(r.nota.toFixed(2)), avaliacoes: r.avaliacoes }))}
                margin={{ top: 8, right: 16, left: -16, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v.toFixed(2), "Nota Média"]} />
                <Bar dataKey="nota" name="Nota Média" fill={C1} radius={[4, 4, 0, 0]} maxBarSize={52} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
