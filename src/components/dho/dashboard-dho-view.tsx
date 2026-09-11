import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useColaboradores } from "@/components/gestao/use-colaboradores";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Users,
  CheckCircle2,
  AlertCircle,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  MessageSquare,
  CalendarCheck,
} from "lucide-react";

type Atividade = {
  id: string;
  titulo: string;
  owner_id?: string;
  equipe_id?: string;
  status: string;
  prioridade: string;
  due_date?: string;
  tipo: string;
};
type Ocorrencia = {
  id: string;
  atividade_id: string;
  week_start: string;
  resultado?: string;
  pontuacao?: number;
};
type Meta = {
  id: string;
  titulo: string;
  owner_id?: string;
  equipe_id?: string;
  valor_esperado: number;
  unidade: string;
  status: string;
};
type Resultado = {
  id: string;
  meta_id: string;
  periodo_inicio: string;
  pct_atingimento: number;
  valor_realizado: number;
};
type Revisao = {
  id: string;
  user_id: string;
  week_start: string;
  status: string;
  pontuacao_geral?: number;
};
type Equipe = { id: string; nome: string };
type Membro = { equipe_id: string; user_id: string; ativo: boolean };
type ItemCk = {
  id: string;
  tipo: string;
  titulo: string;
  responsavel_id?: string;
  prazo?: string;
  status_acompanhamento: string;
};

const C = {
  primary: "var(--color-primary)",
  accent: "var(--color-accent)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  destructive: "var(--color-destructive)",
  muted: "var(--color-muted-foreground)",
};
const RES_CFG: Record<string, { label: string; color: string }> = {
  sucesso: { label: "Sucesso", color: C.success },
  atraso: { label: "Com atraso", color: "#F5C842" },
  desvios: { label: "Com desvios", color: C.warning },
  nao_realizado: { label: "Não realizado", color: C.destructive },
  nao_aplicavel: { label: "Não aplicável", color: C.muted },
};

function weekKey(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return d.toISOString().slice(0, 10);
}
const weekLabel = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function DashboardDhoView() {
  const { data: colabs = [] } = useColaboradores();
  const [equipeSel, setEquipeSel] = useState("all");

  const fetchAll =
    <T,>(table: string) =>
    async () => {
      const { data, error } = await (
        supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>
      )(table).select("*");
      if (error) throw error;
      return (data ?? []) as T[];
    };

  const { data: atividades = [] } = useQuery({
    queryKey: ["dho_atividades"],
    queryFn: fetchAll<Atividade>("atividades"),
  });
  const { data: ocorrencias = [] } = useQuery({
    queryKey: ["dho_ocorrencias"],
    queryFn: fetchAll<Ocorrencia>("ocorrencias_atividade"),
  });
  const { data: metas = [] } = useQuery({
    queryKey: ["dho_metas"],
    queryFn: fetchAll<Meta>("metas"),
  });
  const { data: resultados = [] } = useQuery({
    queryKey: ["dho_resultados"],
    queryFn: fetchAll<Resultado>("resultados_meta"),
  });
  const { data: revisoes = [] } = useQuery({
    queryKey: ["dho_revisoes"],
    queryFn: fetchAll<Revisao>("revisoes_semanais"),
  });
  const { data: equipes = [] } = useQuery({
    queryKey: ["dho_equipes"],
    queryFn: fetchAll<Equipe>("equipes"),
  });
  const { data: membros = [] } = useQuery({
    queryKey: ["dho_membros"],
    queryFn: fetchAll<Membro>("membros_equipe"),
  });
  const { data: itensCk = [] } = useQuery({
    queryKey: ["dho_itens_ck"],
    queryFn: fetchAll<ItemCk>("checkin_gerencial_itens"),
  });

  const nome = (id?: string) => (id ? (colabs.find((c) => c.id === id)?.nome ?? "—") : "—");

  /* ── filtro por equipe ── */
  const membrosDaEquipe = useMemo(
    () =>
      equipeSel === "all"
        ? null
        : new Set(
            membros.filter((m) => m.equipe_id === equipeSel && m.ativo).map((m) => m.user_id),
          ),
    [membros, equipeSel],
  );
  const ativFiltradas = useMemo(
    () =>
      membrosDaEquipe
        ? atividades.filter((a) => a.owner_id && membrosDaEquipe.has(a.owner_id))
        : atividades,
    [atividades, membrosDaEquipe],
  );
  const metasFiltradas = useMemo(
    () =>
      membrosDaEquipe ? metas.filter((m) => m.owner_id && membrosDaEquipe.has(m.owner_id)) : metas,
    [metas, membrosDaEquipe],
  );

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const total = ativFiltradas.length;
    const concl = ativFiltradas.filter((a) => a.status === "concluida").length;
    const atras = ativFiltradas.filter((a) => a.status === "atrasada").length;
    const semanaAtual = weekKey(0);
    const revSemana = revisoes.filter((r) => r.week_start === semanaAtual);
    const esperadas = membrosDaEquipe ? membrosDaEquipe.size : colabs.length;
    const metaComRes = metasFiltradas
      .map((m) => {
        const r = resultados
          .filter((x) => x.meta_id === m.id)
          .sort((a, b) => b.periodo_inicio.localeCompare(a.periodo_inicio))[0];
        return r ? Number(r.pct_atingimento) : null;
      })
      .filter((v): v is number => v !== null);
    return {
      colaboradores: esperadas,
      equipes: equipes.length,
      pctConcluidas: total > 0 ? Math.round((concl / total) * 100) : 0,
      totalAtiv: total,
      atrasadas: atras,
      revisoesPendentes: Math.max(
        esperadas - revSemana.filter((r) => r.status !== "pendente").length,
        0,
      ),
      metasAtingidas: metaComRes.filter((v) => v >= 100).length,
      totalMetas: metaComRes.length,
      mediaAting:
        metaComRes.length > 0 ? metaComRes.reduce((s, v) => s + v, 0) / metaComRes.length : 0,
    };
  }, [ativFiltradas, metasFiltradas, resultados, revisoes, colabs, equipes, membrosDaEquipe]);

  /* ── evolução 8 semanas ── */
  const evolucao = useMemo(() => {
    const ativIds = new Set(ativFiltradas.map((a) => a.id));
    return Array.from({ length: 8 }, (_, i) => {
      const wk = weekKey(-(7 - i));
      const ocs = ocorrencias.filter((o) => o.week_start === wk && ativIds.has(o.atividade_id));
      const tot = ocs.length || 1;
      const cnt = (r: string) => ocs.filter((o) => o.resultado === r).length;
      return {
        semana: weekLabel(wk),
        Sucesso: Math.round((cnt("sucesso") / tot) * 100),
        Atraso: Math.round((cnt("atraso") / tot) * 100),
        Desvios: Math.round((cnt("desvios") / tot) * 100),
        "Não realizado": Math.round((cnt("nao_realizado") / tot) * 100),
        _registros: ocs.length,
      };
    });
  }, [ocorrencias, ativFiltradas]);

  const temHistorico = evolucao.some((e) => e._registros > 0);

  /* ── distribuição resultados ── */
  const distribuicao = useMemo(() => {
    const ativIds = new Set(ativFiltradas.map((a) => a.id));
    const ocs = ocorrencias.filter((o) => ativIds.has(o.atividade_id));
    return Object.entries(RES_CFG)
      .map(([k, cfg]) => ({
        name: cfg.label,
        value: ocs.filter((o) => o.resultado === k).length,
        color: cfg.color,
      }))
      .filter((d) => d.value > 0);
  }, [ocorrencias, ativFiltradas]);

  /* ── status atividades ── */
  const statusDist = useMemo(() => {
    const map: Record<string, { label: string; color: string }> = {
      concluida: { label: "Concluídas", color: C.success },
      em_andamento: { label: "Em andamento", color: C.primary },
      atrasada: { label: "Atrasadas", color: C.destructive },
      nao_iniciada: { label: "Não iniciadas", color: C.muted },
      bloqueada: { label: "Bloqueadas", color: C.warning },
    };
    return Object.entries(map)
      .map(([k, cfg]) => ({
        status: cfg.label,
        qtd: ativFiltradas.filter((a) => a.status === k).length,
        color: cfg.color,
      }))
      .filter((d) => d.qtd > 0);
  }, [ativFiltradas]);

  /* ── desempenho por colaborador ── */
  const porColaborador = useMemo(() => {
    const ativByOwner = new Map<string, string[]>();
    ativFiltradas.forEach((a) => {
      if (!a.owner_id) return;
      const arr = ativByOwner.get(a.owner_id) ?? [];
      arr.push(a.id);
      ativByOwner.set(a.owner_id, arr);
    });
    return Array.from(ativByOwner.entries())
      .map(([uid, ids]) => {
        const idSet = new Set(ids);
        const ocs = ocorrencias.filter((o) => idSet.has(o.atividade_id));
        const semanas = Array.from({ length: 4 }, (_, i) => {
          const wk = weekKey(-(3 - i));
          const wkOcs = ocs.filter((o) => o.week_start === wk);
          return wkOcs.length > 0
            ? wkOcs.reduce((s, o) => s + Number(o.pontuacao ?? 0), 0) / wkOcs.length
            : null;
        });
        const validas = semanas.filter((v): v is number => v !== null);
        const media = validas.length > 0 ? validas.reduce((s, v) => s + v, 0) / validas.length : 0;
        const primeira = validas[0] ?? 0,
          ultima = validas[validas.length - 1] ?? 0;
        const delta = ultima - primeira;
        return {
          user_id: uid,
          nome: nome(uid),
          media,
          delta,
          tendencia: validas.length < 2 ? "flat" : delta > 5 ? "up" : delta < -5 ? "down" : "flat",
          atividades: ids.length,
          avaliacoes: ocs.length,
        };
      })
      .sort((a, b) => b.media - a.media);
  }, [ativFiltradas, ocorrencias, colabs]);

  /* ── metas por equipe ── */
  const metasPorEquipe = useMemo(() => {
    return equipes
      .map((e) => {
        const mems = new Set(
          membros.filter((m) => m.equipe_id === e.id && m.ativo).map((m) => m.user_id),
        );
        const ms = metas.filter((m) => m.owner_id && mems.has(m.owner_id));
        const pcts = ms
          .map((m) => {
            const r = resultados
              .filter((x) => x.meta_id === m.id)
              .sort((a, b) => b.periodo_inicio.localeCompare(a.periodo_inicio))[0];
            return r ? Number(r.pct_atingimento) : null;
          })
          .filter((v): v is number => v !== null);
        return {
          equipe: e.nome,
          total: ms.length,
          atingidas: pcts.filter((v) => v >= 100).length,
          media: pcts.length > 0 ? pcts.reduce((s, v) => s + v, 0) / pcts.length : 0,
        };
      })
      .filter((x) => x.total > 0);
  }, [equipes, membros, metas, resultados]);

  /* ── alertas ── */
  const alertas = useMemo(() => {
    const out: { tipo: "err" | "warn" | "info"; texto: string }[] = [];
    if (kpis.revisoesPendentes > 0)
      out.push({
        tipo: "err",
        texto: `${kpis.revisoesPendentes} colaborador(es) não fizeram a revisão semanal`,
      });
    if (kpis.atrasadas > 0)
      out.push({ tipo: "err", texto: `${kpis.atrasadas} atividade(s) atrasada(s)` });
    porColaborador
      .filter((p) => p.tendencia === "down" && p.avaliacoes >= 2)
      .slice(0, 3)
      .forEach((p) =>
        out.push({
          tipo: "warn",
          texto: `${p.nome} — tendência de queda (${p.delta.toFixed(0)}pp nas últimas semanas)`,
        }),
      );
    const encAtrasados = itensCk.filter(
      (i) => i.tipo === "encaminhamento" && i.status_acompanhamento === "atrasado",
    );
    if (encAtrasados.length > 0)
      out.push({
        tipo: "err",
        texto: `${encAtrasados.length} encaminhamento(s) do Check IN Gerencial atrasado(s)`,
      });
    const encAbertos = itensCk.filter(
      (i) => i.tipo === "encaminhamento" && i.status_acompanhamento === "aberto",
    );
    if (encAbertos.length > 0)
      out.push({ tipo: "info", texto: `${encAbertos.length} encaminhamento(s) em aberto` });
    metasPorEquipe
      .filter((m) => m.media > 0 && m.media < 80)
      .forEach((m) =>
        out.push({
          tipo: "warn",
          texto: `Equipe ${m.equipe} atingiu apenas ${m.media.toFixed(0)}% das metas`,
        }),
      );
    return out;
  }, [kpis, porColaborador, itensCk, metasPorEquipe]);

  const TrendIcon = ({ t }: { t: string }) =>
    t === "up" ? (
      <TrendingUp className="h-3.5 w-3.5 text-success" />
    ) : t === "down" ? (
      <TrendingDown className="h-3.5 w-3.5 text-destructive" />
    ) : (
      <Minus className="h-3.5 w-3.5 text-muted-foreground" />
    );

  const scoreColor = (v: number) =>
    v >= 85 ? "text-success" : v >= 70 ? "text-warning" : "text-destructive";

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard Gestão — DHO</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Desempenho de pessoas, atividades e metas
          </p>
        </div>
        <Select value={equipeSel} onValueChange={setEquipeSel}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Equipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as equipes</SelectItem>
            {equipes.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            l: "Colaboradores",
            v: kpis.colaboradores,
            sub: `${kpis.equipes} equipe(s)`,
            icon: Users,
            cls: "",
          },
          {
            l: "Atividades concluídas",
            v: `${kpis.pctConcluidas}%`,
            sub: `de ${kpis.totalAtiv} atividades`,
            icon: CheckCircle2,
            cls:
              kpis.pctConcluidas >= 80
                ? "text-success"
                : kpis.pctConcluidas >= 60
                  ? "text-warning"
                  : "text-destructive",
          },
          {
            l: "Revisões pendentes",
            v: kpis.revisoesPendentes,
            sub: "semana atual",
            icon: CalendarCheck,
            cls: kpis.revisoesPendentes > 0 ? "text-warning" : "text-success",
          },
          {
            l: "Metas atingidas",
            v:
              kpis.totalMetas > 0
                ? `${Math.round((kpis.metasAtingidas / kpis.totalMetas) * 100)}%`
                : "—",
            sub: `${kpis.metasAtingidas} de ${kpis.totalMetas} · média ${kpis.mediaAting.toFixed(0)}%`,
            icon: Target,
            cls:
              kpis.mediaAting >= 100
                ? "text-success"
                : kpis.mediaAting >= 70
                  ? "text-warning"
                  : "text-destructive",
          },
        ].map(({ l, v, sub, icon: Icon, cls }) => (
          <Card key={l}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">{l}</span>
                <Icon className={`h-4 w-4 ${cls || "text-muted-foreground"}`} />
              </div>
              <div className={`text-2xl font-semibold ${cls}`}>{v}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <Card className="border-warning">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" /> Atenção necessária
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {alertas.map((a, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 p-2 rounded text-sm border-l-2 ${
                  a.tipo === "err"
                    ? "bg-destructive/5 border-destructive"
                    : a.tipo === "warn"
                      ? "bg-warning/5 border-warning"
                      : "bg-primary/5 border-primary"
                }`}
              >
                <span>{a.texto}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="evolucao">
        <TabsList>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
          <TabsTrigger value="pessoas">Por colaborador</TabsTrigger>
          <TabsTrigger value="metas">Metas por equipe</TabsTrigger>
        </TabsList>

        {/* ── EVOLUÇÃO ── */}
        <TabsContent value="evolucao" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Evolução semanal — resultados</CardTitle>
                <CardDescription>Distribuição percentual das últimas 8 semanas</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                {!temHistorico ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-6">
                    Sem histórico de revisões ainda. Os dados aparecem aqui conforme as revisões
                    semanais forem enviadas.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={evolucao} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Sucesso" stackId="a" fill={C.success} />
                      <Bar dataKey="Atraso" stackId="a" fill="#F5C842" />
                      <Bar dataKey="Desvios" stackId="a" fill={C.warning} />
                      <Bar
                        dataKey="Não realizado"
                        stackId="a"
                        fill={C.destructive}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Distribuição de resultados</CardTitle>
                <CardDescription>Todas as revisões registradas</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                {distribuicao.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    Sem dados
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distribuicao}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={2}
                      >
                        {distribuicao.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Atividades por status</CardTitle>
            </CardHeader>
            <CardContent className="h-[220px]">
              {statusDist.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Nenhuma atividade cadastrada
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusDist} layout="vertical" margin={{ left: 20, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="status" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="qtd" name="Atividades" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {statusDist.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── POR COLABORADOR ── */}
        <TabsContent value="pessoas" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Desempenho individual</CardTitle>
              <CardDescription>
                Pontuação média das últimas 4 semanas — indicador auxiliar, não nota isolada
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {porColaborador.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Nenhum dado de desempenho ainda
                </p>
              ) : (
                <div className="divide-y">
                  {porColaborador.map((p, i) => (
                    <div key={p.user_id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-6 text-center text-sm">
                        {i === 0 ? (
                          "🥇"
                        ) : i === 1 ? (
                          "🥈"
                        ) : i === 2 ? (
                          "🥉"
                        ) : (
                          <span className="text-muted-foreground text-xs">{i + 1}</span>
                        )}
                      </span>
                      <div className="h-8 w-8 rounded-full bg-primary/10 grid place-items-center text-[10px] font-semibold text-primary shrink-0">
                        {p.nome
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.atividades} atividade(s) · {p.avaliacoes} avaliação(ões)
                        </div>
                      </div>
                      <div className="w-28 shrink-0">
                        <Progress value={Math.min(p.media, 100)} className="h-1.5" />
                      </div>
                      <div
                        className={`w-12 text-right text-sm font-semibold ${scoreColor(p.media)}`}
                      >
                        {p.avaliacoes > 0 ? `${p.media.toFixed(0)}%` : "—"}
                      </div>
                      <TrendIcon t={p.tendencia} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {porColaborador.filter((p) => p.avaliacoes > 0).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Comparativo de pontuação</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={porColaborador
                      .filter((p) => p.avaliacoes > 0)
                      .map((p) => ({
                        nome: p.nome.split(" ")[0],
                        pontuacao: Number(p.media.toFixed(1)),
                      }))}
                    margin={{ top: 8, right: 8, left: -20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Bar
                      dataKey="pontuacao"
                      name="Pontuação média"
                      fill={C.primary}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── METAS POR EQUIPE ── */}
        <TabsContent value="metas" className="space-y-4 mt-4">
          {metasPorEquipe.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Nenhuma meta vinculada a equipes ainda. Cadastre equipes, adicione membros e crie
                metas.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Atingimento médio por equipe</CardTitle>
                </CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={metasPorEquipe.map((m) => ({
                        equipe: m.equipe,
                        media: Number(m.media.toFixed(1)),
                      }))}
                      layout="vertical"
                      margin={{ left: 20, right: 50 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis type="number" domain={[0, 120]} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="equipe" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Bar
                        dataKey="media"
                        name="Atingimento médio"
                        radius={[0, 4, 4, 0]}
                        maxBarSize={28}
                      >
                        {metasPorEquipe.map((m, i) => (
                          <Cell
                            key={i}
                            fill={
                              m.media >= 100 ? C.success : m.media >= 70 ? C.warning : C.destructive
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {metasPorEquipe.map((m) => (
                  <Card key={m.equipe}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{m.equipe}</CardTitle>
                      <CardDescription>
                        {m.atingidas} de {m.total} metas atingidas
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-semibold ${scoreColor(m.media)}`}>
                        {m.media.toFixed(0)}%
                      </div>
                      <Progress value={Math.min(m.media, 100)} className="h-1.5 mt-2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
