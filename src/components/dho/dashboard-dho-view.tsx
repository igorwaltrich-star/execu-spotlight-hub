import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useColaboradores } from "@/components/gestao/use-colaboradores";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Award, BriefcaseBusiness, CheckCircle2, Clock3, Users } from "lucide-react";

type Equipe = { id: string; nome: string; ativo: boolean };
type Membro = { equipe_id: string; user_id: string; ativo: boolean };
type Perfil = { id: string; ativo: boolean };
type Ciclo = { id: string; nome: string; periodo_inicio: string; periodo_fim: string; status: string };
type Avaliacao = {
  ciclo_id: string;
  colaborador_id: string;
  destaque: boolean;
  nota_produtividade: number | null;
  nota_qualidade: number | null;
  nota_confiabilidade: number | null;
  nota_multiplicacao: number | null;
  nota_iniciativa: number | null;
};
type Plano = { id: string; colaborador_id: string; status: string; progresso: number; due_date: string | null };
type AtividadePdi = { plano_id: string; status: string; due_date: string | null };

const DIMENSOES = [
  ["nota_produtividade", "Produtividade"],
  ["nota_qualidade", "Qualidade"],
  ["nota_confiabilidade", "Confiabilidade"],
  ["nota_multiplicacao", "Multiplicação"],
  ["nota_iniciativa", "Iniciativa"],
] as const;

const media = (valores: Array<number | null | undefined>) => {
  const validos = valores.filter((v): v is number => v != null);
  return validos.length ? validos.reduce((s, v) => s + Number(v), 0) / validos.length : null;
};

export function DashboardDhoView() {
  const { data: colaboradores = [] } = useColaboradores();
  const [equipeSel, setEquipeSel] = useState("all");
  const fetchAll = <T,>(tabela: string, ordem?: string) => async () => {
    let query = (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)(tabela).select("*");
    if (ordem) query = query.order(ordem, { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as T[];
  };

  const { data: equipes = [] } = useQuery({ queryKey: ["equipes"], queryFn: fetchAll<Equipe>("equipes") });
  const { data: membros = [] } = useQuery({ queryKey: ["membros_equipe"], queryFn: fetchAll<Membro>("membros_equipe") });
  const { data: perfis = [] } = useQuery({ queryKey: ["dash_profiles"], queryFn: fetchAll<Perfil>("profiles") });
  const { data: ciclos = [] } = useQuery({ queryKey: ["sc_ciclos"], queryFn: fetchAll<Ciclo>("scorecard_ciclos", "periodo_inicio") });
  const { data: avaliacoes = [] } = useQuery({ queryKey: ["sc_avals"], queryFn: fetchAll<Avaliacao>("scorecard_avaliacoes") });
  const { data: planos = [] } = useQuery({ queryKey: ["planos_desenvolvimento"], queryFn: fetchAll<Plano>("planos_desenvolvimento") });
  const { data: atividadesPdi = [] } = useQuery({ queryKey: ["atividades_desenvolvimento"], queryFn: fetchAll<AtividadePdi>("atividades_desenvolvimento") });

  const equipesAtivas = equipes.filter((e) => e.ativo);
  const membrosAtivos = membros.filter((m) => m.ativo);
  const idsEquipe = useMemo(() => equipeSel === "all" ? null : new Set(membrosAtivos.filter((m) => m.equipe_id === equipeSel).map((m) => m.user_id)), [equipeSel, membrosAtivos]);
  const colabsFiltrados = colaboradores.filter((c) => !idsEquipe || idsEquipe.has(c.id));
  const colabIds = new Set(colabsFiltrados.map((c) => c.id));
  const cicloAtual = ciclos.find((c) => c.status === "publicado") ?? ciclos.find((c) => c.status === "fechado") ?? ciclos[0];
  const avaliacoesCiclo = avaliacoes.filter((a) => a.ciclo_id === cicloAtual?.id && colabIds.has(a.colaborador_id));
  const planosFiltrados = planos.filter((p) => colabIds.has(p.colaborador_id));
  const planoIds = new Set(planosFiltrados.map((p) => p.id));
  const atividadesFiltradas = atividadesPdi.filter((a) => planoIds.has(a.plano_id));
  const hoje = new Date().toISOString().slice(0, 10);
  const em30dias = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const scorePorPessoa = avaliacoesCiclo.map((a) => ({
    ...a,
    score: media(DIMENSOES.map(([campo]) => a[campo])),
  }));
  const mediaGeral = media(scorePorPessoa.map((a) => a.score));
  const dimensoes = DIMENSOES.map(([campo, label]) => ({ label, valor: media(avaliacoesCiclo.map((a) => a[campo])) }));
  const ranking = colabsFiltrados.map((c) => {
    const av = scorePorPessoa.find((a) => a.colaborador_id === c.id);
    const ps = planosFiltrados.filter((p) => p.colaborador_id === c.id);
    const equipe = equipesAtivas.find((e) => membrosAtivos.some((m) => m.user_id === c.id && m.equipe_id === e.id));
    return { ...c, equipe: equipe?.nome ?? "Sem equipe", score: av?.score ?? null, destaque: av?.destaque ?? false, pdis: ps.length, progresso: media(ps.map((p) => p.progresso)) };
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  const pdiAndamento = planosFiltrados.filter((p) => p.status === "em_andamento").length;
  const pdiConcluidos = planosFiltrados.filter((p) => p.status === "concluido").length;
  const pdiVencidos = planosFiltrados.filter((p) => p.due_date && p.due_date < hoje && p.status !== "concluido").length;
  const pdiProximos = planosFiltrados.filter((p) => p.due_date && p.due_date >= hoje && p.due_date <= em30dias && p.status !== "concluido").length;
  const atividadesPendentes = atividadesFiltradas.filter((a) => !["concluida", "cancelada"].includes(a.status)).length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Dashboard Gestão</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Equipes, funcionários, Scorecard e PDI em uma visão única</p>
        </div>
        <Select value={equipeSel} onValueChange={setEquipeSel}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Equipe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as equipes</SelectItem>
            {equipesAtivas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Colaboradores", valor: colabsFiltrados.length, detalhe: `${perfis.filter((p) => p.ativo).length} acessos ativos`, icon: Users },
          { label: "Equipes ativas", valor: equipeSel === "all" ? equipesAtivas.length : 1, detalhe: `${membrosAtivos.filter((m) => !idsEquipe || idsEquipe.has(m.user_id)).length} vínculos ativos`, icon: BriefcaseBusiness },
          { label: "Scorecard", valor: mediaGeral == null ? "—" : mediaGeral.toFixed(1), detalhe: cicloAtual ? `${avaliacoesCiclo.length} avaliados · ${cicloAtual.nome}` : "Nenhum ciclo", icon: Award },
          { label: "PDI em andamento", valor: pdiAndamento, detalhe: `${pdiConcluidos} concluídos · ${atividadesPendentes} atividades pendentes`, icon: CheckCircle2 },
        ].map(({ label, valor, detalhe, icon: Icon }) => (
          <Card key={label}><CardContent className="pt-4"><div className="flex items-center justify-between"><span className="text-xs uppercase text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-muted-foreground" /></div><div className="text-2xl font-semibold mt-1">{valor}</div><div className="text-xs text-muted-foreground mt-1">{detalhe}</div></CardContent></Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Scorecard por dimensão</CardTitle><CardDescription>{cicloAtual ? `${cicloAtual.nome} · ${cicloAtual.status}` : "Crie um ciclo para iniciar as avaliações"}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {dimensoes.some((d) => d.valor != null) ? dimensoes.map((d) => <div key={d.label}><div className="flex justify-between text-sm mb-1"><span>{d.label}</span><strong>{d.valor?.toFixed(1) ?? "—"}</strong></div><Progress value={d.valor ?? 0} className="h-2" /></div>) : <p className="text-sm text-muted-foreground text-center py-10">Nenhuma avaliação registrada neste ciclo.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Acompanhamento de PDI</CardTitle><CardDescription>Progresso, prazos e atividades de desenvolvimento</CardDescription></CardHeader>
          <CardContent>
            {planosFiltrados.length === 0 ? <p className="text-sm text-muted-foreground text-center py-10">Nenhum PDI cadastrado para este recorte.</p> : <div className="space-y-4"><div><div className="flex justify-between text-sm mb-1"><span>Progresso médio</span><strong>{(media(planosFiltrados.map((p) => p.progresso)) ?? 0).toFixed(0)}%</strong></div><Progress value={media(planosFiltrados.map((p) => p.progresso)) ?? 0} className="h-2" /></div><div className="grid grid-cols-3 gap-2 text-center"><div className="border rounded p-3"><div className="text-xl font-semibold text-destructive">{pdiVencidos}</div><div className="text-xs text-muted-foreground">vencidos</div></div><div className="border rounded p-3"><div className="text-xl font-semibold text-warning">{pdiProximos}</div><div className="text-xs text-muted-foreground">próximos 30 dias</div></div><div className="border rounded p-3"><div className="text-xl font-semibold">{atividadesPendentes}</div><div className="text-xs text-muted-foreground">atividades pendentes</div></div></div></div>}
          </CardContent>
        </Card>
      </div>

      {(pdiVencidos > 0 || pdiProximos > 0) && <Card className="border-warning"><CardContent className="pt-4 flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-warning" /><div className="text-sm"><strong>Atenção aos prazos:</strong> {pdiVencidos} PDI(s) vencido(s) e {pdiProximos} com vencimento nos próximos 30 dias.</div></CardContent></Card>}

      <Card>
        <CardHeader><CardTitle className="text-sm">Visão por colaborador</CardTitle><CardDescription>Equipe, resultado do ciclo atual e evolução do PDI</CardDescription></CardHeader>
        <CardContent className="p-0">
          {ranking.length === 0 ? <p className="text-sm text-muted-foreground text-center py-10">Nenhum colaborador neste recorte.</p> : <div className="divide-y">{ranking.map((p, i) => <div key={p.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] md:grid-cols-[2rem_minmax(0,1fr)_9rem_8rem_7rem] items-center gap-3 px-4 py-3"><span className="text-xs text-muted-foreground text-center">{i + 1}</span><div className="min-w-0"><div className="text-sm font-medium truncate">{p.nome} {p.destaque && <Badge className="ml-1 bg-success/10 text-success border-0">Destaque</Badge>}</div><div className="text-xs text-muted-foreground truncate">{p.cargo} · {p.area}</div></div><div className="hidden md:block text-xs text-muted-foreground truncate">{p.equipe}</div><div className="hidden md:block"><Progress value={p.progresso ?? 0} className="h-1.5" /><div className="text-[10px] text-muted-foreground mt-1">{p.pdis} PDI(s) · {p.progresso?.toFixed(0) ?? 0}%</div></div><div className="text-right"><div className="font-semibold">{p.score?.toFixed(1) ?? "—"}</div><div className="text-[10px] text-muted-foreground">Scorecard</div></div></div>)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
