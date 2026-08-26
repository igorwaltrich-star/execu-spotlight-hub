import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useColaboradores } from "@/components/gestao/use-colaboradores";
import { usePerfil } from "@/hooks/use-perfil";
import {
  gerarInsights,
  resumoExecutivo,
  type Insight,
  type Severidade,
  type DadosProd,
  type DadosNC,
  type DadosCusto,
  type DadosCheckin,
  type DadosBanco,
} from "@/lib/insights-engine";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertOctagon, AlertTriangle, TrendingUp, Info, Lightbulb } from "lucide-react";

const SEV: Record<
  Severidade,
  { label: string; icon: typeof Info; cls: string; border: string; bg: string }
> = {
  critico: {
    label: "Crítico",
    icon: AlertOctagon,
    cls: "text-destructive",
    border: "border-l-destructive",
    bg: "bg-destructive/5",
  },
  atencao: {
    label: "Atenção",
    icon: AlertTriangle,
    cls: "text-warning",
    border: "border-l-warning",
    bg: "bg-warning/5",
  },
  positivo: {
    label: "Positivo",
    icon: TrendingUp,
    cls: "text-success",
    border: "border-l-success",
    bg: "bg-success/5",
  },
  info: {
    label: "Contexto",
    icon: Info,
    cls: "text-primary",
    border: "border-l-primary",
    bg: "bg-primary/5",
  },
};

const CATEGORIA: Record<string, string> = {
  produtividade: "Produtividade",
  qualidade: "Qualidade",
  custo: "Custo",
  pessoas: "Pessoas",
  processo: "Processo",
};

const mesAnterior = (m: string) => {
  const d = new Date(m + "-01T00:00:00");
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
};
const fimDoMes = (m: string) => {
  const d = new Date(m + "-01T00:00:00");
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
};

export function InsightsView() {
  const { data: colabs = [] } = useColaboradores();
  const { eUmDe } = usePerfil();
  const podeVerCusto = eUmDe(["gestor", "coordenador"]);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [filtroSev, setFiltroSev] = useState<Severidade | "all">("all");

  const ant = mesAnterior(mes);
  const nome = (id: string) => colabs.find((c) => c.id === id)?.nome ?? "—";

  const { data: prodAtual = [] } = useQuery({
    queryKey: ["ins_prod", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registros_produtividade")
        .select("*")
        .eq("mes", mes + "-01");
      if (error) throw error;
      return (data ?? []) as DadosProd[];
    },
  });
  const { data: prodAnterior = [] } = useQuery({
    queryKey: ["ins_prod", ant],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registros_produtividade")
        .select("*")
        .eq("mes", ant + "-01");
      if (error) throw error;
      return (data ?? []) as DadosProd[];
    },
  });
  const { data: ncs = [] } = useQuery({
    queryKey: ["ins_nc", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nao_conformidades")
        .select("*")
        .gte("data_ocorrencia", mes + "-01")
        .lte("data_ocorrencia", fimDoMes(mes));
      if (error) throw error;
      return (data ?? []) as DadosNC[];
    },
  });
  const { data: ncsAnterior = [] } = useQuery({
    queryKey: ["ins_nc", ant],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nao_conformidades")
        .select("*")
        .gte("data_ocorrencia", ant + "-01")
        .lte("data_ocorrencia", fimDoMes(ant));
      if (error) throw error;
      return (data ?? []) as DadosNC[];
    },
  });
  const { data: custos = [] } = useQuery({
    queryKey: ["ins_custo", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custo_pessoal_mensal")
        .select("operacao,mes_referencia,total")
        .eq("mes_referencia", mes + "-01");
      if (error) throw error;
      return (data ?? []) as DadosCusto[];
    },
    enabled: podeVerCusto,
  });
  const { data: custosAnterior = [] } = useQuery({
    queryKey: ["ins_custo", ant],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custo_pessoal_mensal")
        .select("operacao,mes_referencia,total")
        .eq("mes_referencia", ant + "-01");
      if (error) throw error;
      return (data ?? []) as DadosCusto[];
    },
    enabled: podeVerCusto,
  });
  const { data: checkins = [] } = useQuery({
    queryKey: ["ins_checkin", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkins_operacionais")
        .select("operacao,data,status_geral,ausentes")
        .gte("data", mes + "-01")
        .lte("data", fimDoMes(mes));
      if (error) throw error;
      return (data ?? []) as DadosCheckin[];
    },
  });
  const { data: bancoHoras = [] } = useQuery({
    queryKey: ["ins_banco", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banco_horas")
        .select("colaborador_id,mes,saldo_acumulado")
        .eq("mes", mes + "-01");
      if (error) throw error;
      return (data ?? []) as DadosBanco[];
    },
    enabled: eUmDe(["gestor", "coordenador", "supervisor"]),
  });

  const insights = useMemo(
    () =>
      gerarInsights({
        prodAtual,
        prodAnterior,
        ncs,
        ncsAnterior,
        custos,
        custosAnterior,
        checkins,
        bancoHoras,
        nomeColaborador: nome,
        podeVerCusto,
      }),
    [
      prodAtual,
      prodAnterior,
      ncs,
      ncsAnterior,
      custos,
      custosAnterior,
      checkins,
      bancoHoras,
      colabs,
      podeVerCusto,
    ],
  );

  const resumo = useMemo(() => resumoExecutivo(insights), [insights]);

  const contagem = useMemo(
    () => ({
      critico: insights.filter((i) => i.severidade === "critico").length,
      atencao: insights.filter((i) => i.severidade === "atencao").length,
      positivo: insights.filter((i) => i.severidade === "positivo").length,
      info: insights.filter((i) => i.severidade === "info").length,
    }),
    [insights],
  );

  const visiveis =
    filtroSev === "all" ? insights : insights.filter((i) => i.severidade === filtroSev);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Insights Operacionais
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Análise automática de produtividade, qualidade, custo e pessoas
          </p>
        </div>
        <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-40" />
      </div>

      {/* Resumo executivo */}
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="pt-5">
          <div className="flex gap-3">
            <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">
                Resumo do período
              </div>
              <p className="text-sm leading-relaxed">{resumo}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contadores / filtro */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filtroSev === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFiltroSev("all")}
        >
          Todos ({insights.length})
        </Button>
        {(["critico", "atencao", "positivo", "info"] as Severidade[])
          .filter((s) => contagem[s] > 0)
          .map((s) => {
            const cfg = SEV[s];
            const Icon = cfg.icon;
            return (
              <Button
                key={s}
                variant={filtroSev === s ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroSev(s)}
              >
                <Icon className={`h-3.5 w-3.5 mr-1.5 ${filtroSev === s ? "" : cfg.cls}`} />
                {cfg.label} ({contagem[s]})
              </Button>
            );
          })}
      </div>

      {/* Lista de insights */}
      <div className="space-y-3">
        {visiveis.map((i) => {
          const cfg = SEV[i.severidade];
          const Icon = cfg.icon;
          return (
            <Card key={i.id} className={`border-l-4 ${cfg.border} ${cfg.bg}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${cfg.cls}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <CardTitle className="text-sm">{i.titulo}</CardTitle>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {CATEGORIA[i.categoria]}
                      </Badge>
                    </div>
                    <CardDescription className="mt-1 text-sm leading-relaxed">
                      {i.descricao}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              {(i.evidencia || i.acao) && (
                <CardContent className="pt-0 pl-12 space-y-1.5">
                  {i.evidencia && (
                    <div className="text-xs text-muted-foreground font-mono bg-background/60 rounded px-2 py-1 inline-block">
                      {i.evidencia}
                    </div>
                  )}
                  {i.acao && (
                    <div className="text-sm flex gap-2">
                      <span className="text-muted-foreground shrink-0">→</span>
                      <span>{i.acao}</span>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
        Diagnósticos gerados automaticamente a partir dos dados cadastrados. Servem como ponto de
        partida para investigação, não como conclusão.
      </p>
    </div>
  );
}
