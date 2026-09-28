import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDadosOperacionais } from "@/hooks/use-dados-operacionais";
import { usePerfil } from "@/hooks/use-perfil";
import { useColaboradores } from "@/components/gestao/use-colaboradores";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, BriefcaseBusiness, Users } from "lucide-react";

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
  const { eUmDe } = usePerfil();
  const podeVerCusto = eUmDe(["gestor", "coordenador"]);
  const op = useDadosOperacionais(undefined, podeVerCusto);
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

  const equipesAtivas = equipes.filter((e) => e.ativo);
  const membrosAtivos = membros.filter((m) => m.ativo);
  const idsEquipe = useMemo(() => equipeSel === "all" ? null : new Set(membrosAtivos.filter((m) => m.equipe_id === equipeSel).map((m) => m.user_id)), [equipeSel, membrosAtivos]);
  const colabsFiltrados = colaboradores.filter((c) => !idsEquipe || idsEquipe.has(c.id));
  const colabIds = new Set(colabsFiltrados.map((c) => c.id));
  const cicloAtual = ciclos.find((c) => c.status === "publicado") ?? ciclos.find((c) => c.status === "fechado") ?? ciclos[0];
  const avaliacoesCiclo = avaliacoes.filter((a) => a.ciclo_id === cicloAtual?.id && colabIds.has(a.colaborador_id));

  const scorePorPessoa = avaliacoesCiclo.map((a) => ({
    ...a,
    score: media(DIMENSOES.map(([campo]) => a[campo])),
  }));
  const mediaGeral = media(scorePorPessoa.map((a) => a.score));
  const dimensoes = DIMENSOES.map(([campo, label]) => ({ label, valor: media(avaliacoesCiclo.map((a) => a[campo])) }));
  const ranking = colabsFiltrados.map((c) => {
    const av = scorePorPessoa.find((a) => a.colaborador_id === c.id);
    const equipe = equipesAtivas.find((e) => membrosAtivos.some((m) => m.user_id === c.id && m.equipe_id === e.id));
    return { ...c, equipe: equipe?.nome ?? "Sem equipe", score: av?.score ?? null, destaque: av?.destaque ?? false };
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Dashboard Gestão</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Equipes, funcionários e Scorecard em uma visão única</p>
        </div>
        <Select value={equipeSel} onValueChange={setEquipeSel}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Equipe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as equipes</SelectItem>
            {equipesAtivas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Indicadores operacionais — Cadastro Operacional e lançamentos por pessoa */}
      {op.temDados && (
        <>
          <div className={`grid grid-cols-2 gap-3 ${podeVerCusto ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
            {[
              {
                label: "Volume",
                valor: op.totais.volume.toLocaleString("pt-BR"),
                detalhe: `${op.totais.operacoesAtivas} operação(ões) com dado`,
                cls: "",
              },
              {
                label: "Pessoas",
                valor: op.totais.pessoas.toLocaleString("pt-BR"),
                detalhe: `${op.totais.fte.toFixed(1)} FTE`,
                cls: "",
              },
              {
                label: "Produtividade",
                valor: op.totais.produtividade.toFixed(1),
                detalhe: `meta média ${op.totais.metaMedia.toFixed(0)}`,
                cls:
                  op.totais.metaMedia > 0 && op.totais.produtividade >= op.totais.metaMedia
                    ? "text-success"
                    : "text-warning",
              },
              {
                label: "Não conformidades",
                valor: op.totais.ncQtd.toLocaleString("pt-BR"),
                detalhe:
                  op.totais.ncCusto > 0
                    ? op.totais.ncCusto.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        maximumFractionDigits: 0,
                      })
                    : "sem custo lançado",
                cls: op.totais.ncQtd > 0 ? "text-destructive" : "",
              },
              ...(podeVerCusto
                ? [
                    {
                      label: "Custo / processo",
                      valor:
                        op.totais.custoPorProcesso > 0
                          ? op.totais.custoPorProcesso.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                              maximumFractionDigits: 0,
                            })
                          : "—",
                      detalhe:
                        op.totais.custo > 0
                          ? op.totais.custo.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                              maximumFractionDigits: 0,
                            })
                          : "custo não lançado",
                      cls: "",
                    },
                  ]
                : []),
            ].map(({ label, valor, detalhe, cls }) => (
              <Card key={label}>
                <CardContent className="pt-4">
                  <span className="text-xs uppercase text-muted-foreground">{label}</span>
                  <div className={`text-2xl font-semibold mt-1 ${cls}`}>{valor}</div>
                  <div className="text-xs text-muted-foreground mt-1">{detalhe}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Produtividade por operação</CardTitle>
              <CardDescription>
                Volume ÷ FTE contra a meta de cada unidade · dados do Cadastro Operacional
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {op.comDados
                  .filter((o) => o.fte > 0)
                  .sort((a, b) => b.volume - a.volume)
                  .map((o) => (
                    <div key={o.key} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-32 min-w-0">
                        <div className="text-sm font-medium truncate">{o.label}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {o.volume.toLocaleString("pt-BR")} proc · {o.fte.toFixed(1)} FTE
                        </div>
                      </div>
                      <Progress value={Math.min(o.pctMeta, 100)} className="h-1.5 flex-1" />
                      <div className="w-24 text-right">
                        <span
                          className={`text-sm font-semibold ${
                            o.pctMeta >= 100
                              ? "text-success"
                              : o.pctMeta >= 70
                                ? "text-warning"
                                : "text-destructive"
                          }`}
                        >
                          {o.produtividade.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-muted-foreground"> / {o.meta}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] w-14 justify-center">
                        {o.pctMeta.toFixed(0)}%
                      </Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: "Colaboradores", valor: colabsFiltrados.length, detalhe: `${perfis.filter((p) => p.ativo).length} acessos ativos`, icon: Users },
          { label: "Equipes ativas", valor: equipeSel === "all" ? equipesAtivas.length : 1, detalhe: `${membrosAtivos.filter((m) => !idsEquipe || idsEquipe.has(m.user_id)).length} vínculos ativos`, icon: BriefcaseBusiness },
          { label: "Scorecard", valor: mediaGeral == null ? "—" : mediaGeral.toFixed(1), detalhe: cicloAtual ? `${avaliacoesCiclo.length} avaliados · ${cicloAtual.nome}` : "Nenhum ciclo", icon: Award },
        ].map(({ label, valor, detalhe, icon: Icon }) => (
          <Card key={label}><CardContent className="pt-4"><div className="flex items-center justify-between"><span className="text-xs uppercase text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-muted-foreground" /></div><div className="text-2xl font-semibold mt-1">{valor}</div><div className="text-xs text-muted-foreground mt-1">{detalhe}</div></CardContent></Card>
        ))}
      </div>

      <div>
        <Card>
          <CardHeader><CardTitle className="text-sm">Scorecard por dimensão</CardTitle><CardDescription>{cicloAtual ? `${cicloAtual.nome} · ${cicloAtual.status}` : "Crie um ciclo para iniciar as avaliações"}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {dimensoes.some((d) => d.valor != null) ? dimensoes.map((d) => <div key={d.label}><div className="flex justify-between text-sm mb-1"><span>{d.label}</span><strong>{d.valor?.toFixed(1) ?? "—"}</strong></div><Progress value={d.valor ?? 0} className="h-2" /></div>) : <p className="text-sm text-muted-foreground text-center py-10">Nenhuma avaliação registrada neste ciclo.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Visão por colaborador</CardTitle><CardDescription>Equipe e resultado do ciclo atual do Scorecard</CardDescription></CardHeader>
        <CardContent className="p-0">
          {ranking.length === 0 ? <p className="text-sm text-muted-foreground text-center py-10">Nenhum colaborador neste recorte.</p> : <div className="divide-y">{ranking.map((p, i) => <div key={p.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] md:grid-cols-[2rem_minmax(0,1fr)_10rem_7rem] items-center gap-3 px-4 py-3"><span className="text-xs text-muted-foreground text-center">{i + 1}</span><div className="min-w-0"><div className="text-sm font-medium truncate">{p.nome} {p.destaque && <Badge className="ml-1 bg-success/10 text-success border-0">Destaque</Badge>}</div><div className="text-xs text-muted-foreground truncate">{p.cargo} · {p.area}</div></div><div className="hidden md:block text-xs text-muted-foreground truncate">{p.equipe}</div><div className="text-right"><div className="font-semibold">{p.score?.toFixed(1) ?? "—"}</div><div className="text-[10px] text-muted-foreground">Scorecard</div></div></div>)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
