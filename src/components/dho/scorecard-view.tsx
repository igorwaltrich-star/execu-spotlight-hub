import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePerfil } from "@/hooks/use-perfil";
import { useColaboradores } from "@/components/gestao/use-colaboradores";
import { UNIDADES } from "@/lib/constants";
import {
  DIMENSOES,
  PESOS_PADRAO,
  consolidar,
  faixa,
  tendencia,
  calcularProdutividade,
  calcularQualidade,
  fatorComplexidade,
  type DimensaoKey,
  type PesosCiclo,
  type PesoBpmn,
  type OperacionalMensal,
  type AlocacaoPeriodo,
  type RegistroProd,
  type NaoConf,
} from "@/lib/scorecard-engine";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Lock,
  Send,
  Pencil,
  NotebookPen,
  Trash2,
  Info,
  Target,
} from "lucide-react";
import { toast } from "sonner";

type Ciclo = {
  id: string;
  nome: string;
  periodo_inicio: string;
  periodo_fim: string;
  status: string;
  peso_produtividade: number;
  peso_qualidade: number;
  peso_confiabilidade: number;
  peso_multiplicacao: number;
  peso_iniciativa: number;
  criterio_publicado?: string;
  publicado_em?: string;
};
type Avaliacao = {
  id: string;
  ciclo_id: string;
  colaborador_id: string;
  nota_produtividade?: number;
  nota_qualidade?: number;
  nota_confiabilidade?: number;
  nota_multiplicacao?: number;
  nota_iniciativa?: number;
  origem_produtividade: string;
  origem_qualidade: string;
  origem_confiabilidade: string;
  evidencia_multiplicacao?: string;
  evidencia_iniciativa?: string;
  justificativa_ajuste?: string;
  destaque: boolean;
  motivo_destaque?: string;
};
type Registro = {
  id: string;
  colaborador_id: string;
  mes: string;
  nota: string;
  dimensao?: string;
  tipo: string;
  created_at: string;
};

const STATUS_CICLO: Record<string, { l: string; cls: string }> = {
  rascunho: { l: "Rascunho", cls: "bg-muted text-muted-foreground border-0" },
  publicado: { l: "Publicado", cls: "bg-primary/10 text-primary border-0" },
  fechado: { l: "Fechado", cls: "bg-success/10 text-success border-0" },
};
const fmtD = (d?: string) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");
const fmtMes = (d: string) => {
  const [y, m] = d.split("-");
  return `${["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][Number(m) - 1]}/${y.slice(2)}`;
};

export function ScorecardView() {
  const { user } = useAuth();
  const { eUmDe } = usePerfil();
  const podeAvaliar = eUmDe(["gestor", "coordenador", "supervisor"]);
  const podeGerirCiclo = eUmDe(["gestor", "coordenador"]);
  const qc = useQueryClient();
  const { data: colabs = [] } = useColaboradores();

  const [cicloSel, setCicloSel] = useState<string>("");
  const [openCiclo, setOpenCiclo] = useState(false);
  const [openAval, setOpenAval] = useState(false);
  const [openNota, setOpenNota] = useState(false);
  const [openBpmn, setOpenBpmn] = useState(false);
  const [colabAval, setColabAval] = useState<string | null>(null);

  const fetchAll =
    <T,>(t: string, ord?: string) =>
    async () => {
      let q = (supabase.from as unknown as (x: string) => ReturnType<typeof supabase.from>)(
        t,
      ).select("*");
      if (ord) q = q.order(ord, { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as T[];
    };

  const { data: ciclos = [] } = useQuery({
    queryKey: ["sc_ciclos"],
    queryFn: fetchAll<Ciclo>("scorecard_ciclos", "periodo_inicio"),
  });
  const { data: avals = [] } = useQuery({
    queryKey: ["sc_avals"],
    queryFn: fetchAll<Avaliacao>("scorecard_avaliacoes"),
  });
  const { data: registros = [] } = useQuery({
    queryKey: ["sc_registros"],
    queryFn: fetchAll<Registro>("scorecard_registros", "mes"),
  });
  const { data: bpmn = [] } = useQuery({
    queryKey: ["sc_bpmn"],
    queryFn: fetchAll<PesoBpmn & { id: string }>("complexidade_bpmn"),
  });
  const { data: opMensal = [] } = useQuery({
    queryKey: ["sc_op_mensal"],
    queryFn: fetchAll<OperacionalMensal>("operacional_mensal"),
  });
  const { data: alocacoes = [] } = useQuery({
    queryKey: ["sc_alocacoes"],
    queryFn: fetchAll<AlocacaoPeriodo>("alocacoes_periodo"),
  });
  const { data: regsProd = [] } = useQuery({
    queryKey: ["sc_prod"],
    queryFn: fetchAll<RegistroProd>("registros_produtividade"),
  });
  const { data: ncs = [] } = useQuery({
    queryKey: ["sc_ncs"],
    queryFn: fetchAll<NaoConf>("nao_conformidades"),
  });
  const ciclo = useMemo(
    () =>
      ciclos.find((c) => c.id === cicloSel) ??
      ciclos.find((c) => c.status === "publicado") ??
      ciclos[0],
    [ciclos, cicloSel],
  );
  const nome = (id: string) => colabs.find((c) => c.id === id)?.nome ?? "—";

  const pesos: PesosCiclo = ciclo
    ? {
        produtividade: Number(ciclo.peso_produtividade),
        qualidade: Number(ciclo.peso_qualidade),
        confiabilidade: Number(ciclo.peso_confiabilidade),
        multiplicacao: Number(ciclo.peso_multiplicacao),
        iniciativa: Number(ciclo.peso_iniciativa),
      }
    : PESOS_PADRAO;

  /** Scorecard de uma pessoa num ciclo: calculado + ajustes do avaliador. */
  const scorecardDe = (colabId: string, c: Ciclo) => {
    const per = { inicio: c.periodo_inicio, fim: c.periodo_fim };
    const av = avals.find((a) => a.ciclo_id === c.id && a.colaborador_id === colabId);

    const prod = calcularProdutividade(regsProd, bpmn, colabId, per, opMensal, alocacoes);
    const qual = calcularQualidade(ncs, regsProd, colabId, per);

    const usar = (calc: number, semDados: boolean, origem?: string, manual?: number) =>
      origem === "ajustado" && manual != null ? Number(manual) : semDados ? null : calc;

    const notas: Record<DimensaoKey, number | null> = {
      produtividade: usar(
        prod.nota,
        prod.semDados,
        av?.origem_produtividade,
        av?.nota_produtividade,
      ),
      qualidade: usar(qual.nota, qual.semDados, av?.origem_qualidade, av?.nota_qualidade),
      confiabilidade: av?.nota_confiabilidade != null ? Number(av.nota_confiabilidade) : null,
      multiplicacao: av?.nota_multiplicacao != null ? Number(av.nota_multiplicacao) : null,
      iniciativa: av?.nota_iniciativa != null ? Number(av.nota_iniciativa) : null,
    };
    return { ...consolidar(notas, pesos), notas, prod, qual, av };
  };

  const scorecards = useMemo(() => {
    if (!ciclo) return [];
    return colabs.map((c) => ({ colaborador: c, ...scorecardDe(c.id, ciclo) }));
  }, [colabs, ciclo, avals, bpmn, regsProd, ncs, pesos]);

  const avaliados = scorecards.filter((s) => s.pesoAplicado > 0);
  const destaques = scorecards.filter((s) => s.av?.destaque && s.av.motivo_destaque);

  /* ── evolução entre ciclos (visão diretoria) ── */
  const evolucao = useMemo(() => {
    const fechadosOuPub = ciclos
      .filter((c) => c.status !== "rascunho")
      .sort((a, b) => a.periodo_inicio.localeCompare(b.periodo_inicio))
      .slice(-8);
    return fechadosOuPub.map((c) => {
      const scs = colabs.map((col) => scorecardDe(col.id, c)).filter((s) => s.pesoAplicado > 0);
      const media = scs.length ? scs.reduce((s, x) => s + x.total, 0) / scs.length : 0;
      const porDim: Record<string, number> = {};
      DIMENSOES.forEach((d) => {
        const vals = scs.map((s) => s.notas[d.key]).filter((v): v is number => v !== null);
        porDim[d.label] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      });
      return { ciclo: c.nome, media: Number(media.toFixed(1)), avaliados: scs.length, ...porDim };
    });
  }, [ciclos, colabs, avals, bpmn, regsProd, ncs]);

  const serieEquipe = evolucao.map((e) => e.media);
  const tendEquipe = tendencia(serieEquipe);

  /* ── mutations ── */
  const [formCiclo, setFormCiclo] = useState({
    nome: "",
    periodo_inicio: "",
    periodo_fim: "",
    criterio_publicado: "",
    ...Object.fromEntries(DIMENSOES.map((d) => [`peso_${d.key}`, String(PESOS_PADRAO[d.key])])),
  } as Record<string, string>);

  const somaPesos = DIMENSOES.reduce((s, d) => s + Number(formCiclo[`peso_${d.key}`] || 0), 0);

  const salvarCiclo = useMutation({
    mutationFn: async () => {
      if (!formCiclo.nome || !formCiclo.periodo_inicio || !formCiclo.periodo_fim)
        throw new Error("Preencha nome e período");
      if (somaPesos !== 100)
        throw new Error(`Os pesos somam ${somaPesos}%. Precisa fechar em 100%.`);
      const { error } = await supabase.from("scorecard_ciclos").insert({
        nome: formCiclo.nome,
        periodo_inicio: formCiclo.periodo_inicio,
        periodo_fim: formCiclo.periodo_fim,
        criterio_publicado: formCiclo.criterio_publicado || null,
        status: "rascunho",
        peso_produtividade: Number(formCiclo.peso_produtividade),
        peso_qualidade: Number(formCiclo.peso_qualidade),
        peso_confiabilidade: Number(formCiclo.peso_confiabilidade),
        peso_multiplicacao: Number(formCiclo.peso_multiplicacao),
        peso_iniciativa: Number(formCiclo.peso_iniciativa),
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ciclo criado");
      qc.invalidateQueries({ queryKey: ["sc_ciclos"] });
      setOpenCiclo(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const mudarStatus = async (c: Ciclo, status: string) => {
    const patch: {
      status: string;
      publicado_em?: string;
      fechado_em?: string;
    } = { status };
    if (status === "publicado") patch.publicado_em = new Date().toISOString();
    if (status === "fechado") patch.fechado_em = new Date().toISOString();
    const { error } = await supabase.from("scorecard_ciclos").update(patch).eq("id", c.id);
    if (error) toast.error("Erro ao mudar status");
    else {
      toast.success(
        status === "publicado" ? "Critério publicado para a equipe" : "Ciclo atualizado",
      );
      qc.invalidateQueries({ queryKey: ["sc_ciclos"] });
    }
  };

  const excluirCiclo = useMutation({
    mutationFn: async (c: Ciclo) => {
      const { error } = await supabase.from("scorecard_ciclos").delete().eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: (_d, c) => {
      toast.success(`Ciclo "${c.nome}" excluído`);
      if (cicloSel === c.id) setCicloSel("");
      qc.invalidateQueries({ queryKey: ["sc_ciclos"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao excluir ciclo"),
  });

  const [formAval, setFormAval] = useState<Record<string, string>>({});
  const abrirAval = (colabId: string) => {
    const av = avals.find((a) => a.ciclo_id === ciclo?.id && a.colaborador_id === colabId);
    setFormAval({
      nota_confiabilidade:
        av?.nota_confiabilidade != null ? String(av.nota_confiabilidade) : "",
      nota_multiplicacao: av?.nota_multiplicacao != null ? String(av.nota_multiplicacao) : "",
      nota_iniciativa: av?.nota_iniciativa != null ? String(av.nota_iniciativa) : "",
      evidencia_multiplicacao: av?.evidencia_multiplicacao ?? "",
      evidencia_iniciativa: av?.evidencia_iniciativa ?? "",
      motivo_destaque: av?.motivo_destaque ?? "",
      destaque: av?.destaque ? "1" : "",
    });
    setColabAval(colabId);
    setOpenAval(true);
  };

  const salvarAval = useMutation({
    mutationFn: async () => {
      if (!ciclo || !colabAval) throw new Error("Selecione um ciclo");
      if (ciclo.status === "rascunho") throw new Error("Publique o critério antes de avaliar");
      const mult = formAval.nota_multiplicacao,
        ini = formAval.nota_iniciativa;
      if (mult && !formAval.evidencia_multiplicacao.trim())
        throw new Error("Multiplicação exige evidência escrita");
      if (ini && !formAval.evidencia_iniciativa.trim())
        throw new Error("Iniciativa exige evidência escrita");
      if (formAval.destaque && !formAval.motivo_destaque.trim())
        throw new Error("Destaque exige o motivo — é o que será divulgado");

      const { error } = await supabase.from("scorecard_avaliacoes").upsert(
        {
          ciclo_id: ciclo.id,
          colaborador_id: colabAval,
          nota_multiplicacao: mult ? Number(mult) : null,
          nota_iniciativa: ini ? Number(ini) : null,
          nota_confiabilidade: formAval.nota_confiabilidade
            ? Number(formAval.nota_confiabilidade)
            : null,
          origem_confiabilidade: "avaliacao_lideranca",
          evidencia_multiplicacao: formAval.evidencia_multiplicacao || null,
          evidencia_iniciativa: formAval.evidencia_iniciativa || null,
          destaque: !!formAval.destaque,
          motivo_destaque: formAval.motivo_destaque || null,
          avaliador_id: user?.id,
        },
        { onConflict: "ciclo_id,colaborador_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Avaliação salva");
      qc.invalidateQueries({ queryKey: ["sc_avals"] });
      setOpenAval(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const [formNota, setFormNota] = useState({
    colaborador_id: "",
    mes: new Date().toISOString().slice(0, 7),
    nota: "",
    dimensao: "geral",
    tipo: "observacao",
  });
  const salvarNota = useMutation({
    mutationFn: async () => {
      if (!formNota.colaborador_id || !formNota.nota.trim())
        throw new Error("Selecione a pessoa e escreva a nota");
      const { error } = await supabase.from("scorecard_registros").upsert(
        {
          colaborador_id: formNota.colaborador_id,
          mes: formNota.mes + "-01",
          nota: formNota.nota,
          dimensao: formNota.dimensao,
          tipo: formNota.tipo,
          autor_id: user?.id,
        },
        { onConflict: "colaborador_id,mes,dimensao" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro salvo");
      qc.invalidateQueries({ queryKey: ["sc_registros"] });
      setOpenNota(false);
      setFormNota((f) => ({ ...f, nota: "" }));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const [formBpmn, setFormBpmn] = useState({
    operacao: "",
    processo: "",
    peso: "1",
    participacao: "",
    referencia: "",
  });
  const salvarBpmn = useMutation({
    mutationFn: async () => {
      if (!formBpmn.operacao || !formBpmn.processo) throw new Error("Informe operação e processo");
      const { error } = await supabase.from("complexidade_bpmn").upsert(
        {
          operacao: formBpmn.operacao,
          processo: formBpmn.processo,
          peso: Number(formBpmn.peso),
          participacao: Number(formBpmn.participacao || 0),
          referencia: formBpmn.referencia || null,
          ativo: true,
          created_by: user?.id,
        },
        { onConflict: "operacao,processo" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Processo mapeado");
      qc.invalidateQueries({ queryKey: ["sc_bpmn"] });
      setFormBpmn((f) => ({ ...f, processo: "", peso: "1", participacao: "" }));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const delBpmn = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("complexidade_bpmn").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sc_bpmn"] }),
  });

  /* ── registros do mês corrente, para cobrar a cadência ── */
  const mesCorrente = new Date().toISOString().slice(0, 7) + "-01";
  const semRegistroNoMes = colabs.filter(
    (c) => !registros.some((r) => r.colaborador_id === c.id && r.mes === mesCorrente),
  );

  const Tend = ({ t }: { t: string }) =>
    t === "alta" ? (
      <TrendingUp className="h-4 w-4 text-success" />
    ) : t === "queda" ? (
      <TrendingDown className="h-4 w-4 text-destructive" />
    ) : (
      <Minus className="h-4 w-4 text-muted-foreground" />
    );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Performance Scorecard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cinco dimensões ponderadas, com complexidade vinda do BPMN
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {ciclos.length > 0 && (
            <Select value={ciclo?.id ?? ""} onValueChange={setCicloSel}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Ciclo" />
              </SelectTrigger>
              <SelectContent>
                {ciclos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} · {STATUS_CICLO[c.status]?.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {podeGerirCiclo && (
            <Button size="sm" onClick={() => setOpenCiclo(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Novo ciclo
            </Button>
          )}
        </div>
      </div>

      {ciclos.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <Target className="h-9 w-9 mx-auto mb-3 text-muted-foreground opacity-30" />
            <div className="font-medium mb-1">Nenhum ciclo criado</div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Comece criando um ciclo com os pesos das cinco dimensões. O critério precisa ser
              publicado antes do período de avaliação começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="evolucao">
          <TabsList>
            <TabsTrigger value="evolucao">Evolução</TabsTrigger>
            <TabsTrigger value="reconhecimento">Reconhecimento</TabsTrigger>
            {podeAvaliar && <TabsTrigger value="avaliacao">Avaliação</TabsTrigger>}
            {podeAvaliar && <TabsTrigger value="registros">Registro contínuo</TabsTrigger>}
            <TabsTrigger value="criterio">Critério</TabsTrigger>
          </TabsList>

          {/* ═══ EVOLUÇÃO — visão diretoria ═══ */}
          <TabsContent value="evolucao" className="space-y-4 mt-4">
            {evolucao.length < 2 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  A curva de evolução aparece a partir do segundo ciclo publicado. Um ciclo isolado
                  é foto, não tendência.
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                        Média da equipe
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-semibold">
                          {serieEquipe[serieEquipe.length - 1]?.toFixed(1) ?? "—"}
                        </span>
                        <Tend t={tendEquipe} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">ciclo atual</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                        Variação
                      </div>
                      <div
                        className={`text-2xl font-semibold ${tendEquipe === "alta" ? "text-success" : tendEquipe === "queda" ? "text-destructive" : ""}`}
                      >
                        {serieEquipe.length >= 2
                          ? `${serieEquipe[serieEquipe.length - 1] - serieEquipe[serieEquipe.length - 2] >= 0 ? "+" : ""}${(serieEquipe[serieEquipe.length - 1] - serieEquipe[serieEquipe.length - 2]).toFixed(1)}`
                          : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">vs ciclo anterior</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                        Ciclos
                      </div>
                      <div className="text-2xl font-semibold">{evolucao.length}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">série histórica</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                        Avaliados
                      </div>
                      <div className="text-2xl font-semibold">{avaliados.length}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        de {colabs.length} colaboradores
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      Evolução do scorecard ao longo dos ciclos
                    </CardTitle>
                    <CardDescription>
                      Média da equipe e comportamento de cada dimensão
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={evolucao} margin={{ top: 8, right: 12, left: -18 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="ciclo" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line
                          type="monotone"
                          dataKey="media"
                          name="Média geral"
                          stroke="var(--color-primary)"
                          strokeWidth={3}
                          dot={{ r: 4 }}
                        />
                        {DIMENSOES.map((d, i) => (
                          <Line
                            key={d.key}
                            type="monotone"
                            dataKey={d.label}
                            name={d.label}
                            stroke={
                              [
                                "var(--color-accent)",
                                "var(--color-success)",
                                "var(--color-warning)",
                                "var(--color-destructive)",
                                "var(--color-muted-foreground)",
                              ][i]
                            }
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ═══ RECONHECIMENTO — não é ranking ═══ */}
          <TabsContent value="reconhecimento" className="space-y-4 mt-4">
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="pt-4 flex gap-3">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm">
                  Esta aba divulga <strong>quem se destacou e por quê</strong>. A lista completa
                  ordenada não é exibida: comparação ponta a ponta fica restrita à aba de avaliação,
                  visível só para a liderança.
                </p>
              </CardContent>
            </Card>

            {destaques.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum destaque marcado neste ciclo. Na aba Avaliação, marque quem se destacou e
                  escreva o motivo — é esse texto que será divulgado.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {destaques.map((s) => (
                  <Card key={s.colaborador.id} className="border-l-4 border-l-success">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-success/10 grid place-items-center text-sm font-semibold text-success shrink-0">
                          {s.colaborador.nome
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div>
                          <CardTitle className="text-sm">{s.colaborador.nome}</CardTitle>
                          <CardDescription>{s.colaborador.cargo ?? "—"}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">{s.av?.motivo_destaque}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ═══ AVALIAÇÃO — liderança ═══ */}
          {podeAvaliar && (
            <TabsContent value="avaliacao" className="space-y-4 mt-4">
              {ciclo?.status === "rascunho" && (
                <Card className="border-warning">
                  <CardContent className="pt-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex gap-2 items-start">
                      <Lock className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                      <p className="text-sm">
                        O critério ainda não foi publicado. Avaliar antes de divulgar a régua
                        inverte a ordem que sustenta o sistema.
                      </p>
                    </div>
                    {podeGerirCiclo && (
                      <Button size="sm" onClick={() => mudarStatus(ciclo, "publicado")}>
                        <Send className="h-4 w-4 mr-1.5" />
                        Publicar critério
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Colaboradores · {ciclo?.nome}</CardTitle>
                  <CardDescription>
                    Ordem alfabética. Produtividade e qualidade vêm dos dados; confiabilidade,
                    multiplicação e iniciativa são registradas pela liderança.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        {DIMENSOES.map((d) => (
                          <TableHead key={d.key} className="text-right text-[10px]">
                            {d.label.split(" ")[0]}
                          </TableHead>
                        ))}
                        <TableHead className="text-right">Scorecard</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scorecards.map((s) => {
                        const fx = faixa(s.total);
                        return (
                          <TableRow key={s.colaborador.id}>
                            <TableCell className="font-medium">
                              {s.colaborador.nome}
                              {s.av?.destaque && (
                                <Badge className="ml-2 bg-success/10 text-success border-0 text-[10px]">
                                  destaque
                                </Badge>
                              )}
                            </TableCell>
                            {DIMENSOES.map((d) => {
                              const n = s.notas[d.key];
                              return (
                                <TableCell key={d.key} className="text-right text-xs">
                                  {n === null ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    <span
                                      className={
                                        n >= 75
                                          ? "text-success"
                                          : n >= 60
                                            ? "text-warning"
                                            : "text-destructive"
                                      }
                                    >
                                      {n.toFixed(0)}
                                    </span>
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-right">
                              {s.pesoAplicado === 0 ? (
                                <span className="text-xs text-muted-foreground">sem dados</span>
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  <span className={`font-semibold ${fx.cls}`}>
                                    {s.total.toFixed(1)}
                                  </span>
                                  {s.ausentes.length > 0 && (
                                    <Badge variant="outline" className="text-[9px]">
                                      {s.pesoAplicado}% do peso
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => abrirAval(s.colaborador.id)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* radar do primeiro avaliado, como leitura de perfil */}
              {avaliados.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Perfil por dimensão — média da equipe</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart
                        data={DIMENSOES.map((d) => {
                          const vals = avaliados
                            .map((s) => s.notas[d.key])
                            .filter((v): v is number => v !== null);
                          return {
                            dimensao: d.label.split(" ")[0],
                            valor: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
                          };
                        })}
                      >
                        <PolarGrid stroke="var(--color-border)" />
                        <PolarAngleAxis dataKey="dimensao" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                        <Radar
                          dataKey="valor"
                          stroke="var(--color-primary)"
                          fill="var(--color-primary)"
                          fillOpacity={0.25}
                        />
                        <Tooltip formatter={(v: number) => v.toFixed(1)} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* ═══ REGISTRO CONTÍNUO ═══ */}
          {podeAvaliar && (
            <TabsContent value="registros" className="space-y-4 mt-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm text-muted-foreground max-w-xl">
                  Uma anotação curta por pessoa por mês. Sem essa cadência, a avaliação do ciclo
                  vira retrato do último mês.
                </p>
                <Button size="sm" onClick={() => setOpenNota(true)}>
                  <NotebookPen className="h-4 w-4 mr-1.5" />
                  Nova anotação
                </Button>
              </div>

              {semRegistroNoMes.length > 0 && (
                <Card className="border-warning">
                  <CardContent className="pt-4">
                    <div className="text-sm font-medium mb-2">
                      {semRegistroNoMes.length} pessoa(s) sem anotação em {fmtMes(mesCorrente)}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {semRegistroNoMes.map((c) => (
                        <Badge
                          key={c.id}
                          variant="outline"
                          className="text-[10px] cursor-pointer"
                          onClick={() => {
                            setFormNota((f) => ({ ...f, colaborador_id: c.id }));
                            setOpenNota(true);
                          }}
                        >
                          {c.nome}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Anotações recentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {registros.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma anotação registrada
                    </p>
                  )}
                  {registros.slice(0, 30).map((r) => (
                    <div key={r.id} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium">{nome(r.colaborador_id)}</span>
                        <div className="flex gap-1.5 items-center">
                          {r.dimensao && r.dimensao !== "geral" && (
                            <Badge variant="outline" className="text-[10px]">
                              {r.dimensao}
                            </Badge>
                          )}
                          <Badge
                            className={`text-[10px] border-0 ${
                              r.tipo === "destaque"
                                ? "bg-success/10 text-success"
                                : r.tipo === "atencao"
                                  ? "bg-warning/10 text-warning"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {r.tipo}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{fmtMes(r.mes)}</span>
                        </div>
                      </div>
                      <p className="text-sm">{r.nota}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ═══ CRITÉRIO ═══ */}
          <TabsContent value="criterio" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-sm">{ciclo?.nome}</CardTitle>
                    <CardDescription>
                      {fmtD(ciclo?.periodo_inicio)} a {fmtD(ciclo?.periodo_fim)}
                      {ciclo?.publicado_em &&
                        ` · publicado em ${new Date(ciclo.publicado_em).toLocaleDateString("pt-BR")}`}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge className={STATUS_CICLO[ciclo?.status ?? "rascunho"]?.cls}>
                      {STATUS_CICLO[ciclo?.status ?? "rascunho"]?.l}
                    </Badge>
                    {podeGerirCiclo && ciclo?.status === "rascunho" && (
                      <>
                        <Button size="sm" onClick={() => mudarStatus(ciclo, "publicado")}>
                          <Send className="h-4 w-4 mr-1.5" />
                          Publicar
                        </Button>
                      </>
                    )}
                    {podeGerirCiclo && ciclo?.status === "publicado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => mudarStatus(ciclo, "fechado")}
                      >
                        <Lock className="h-4 w-4 mr-1.5" />
                        Fechar ciclo
                      </Button>
                    )}
                    {podeGerirCiclo && ciclo && ciclo.status !== "fechado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={excluirCiclo.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Excluir o ciclo completo "${ciclo.nome}"? Todas as avaliações e registros vinculados serão removidos. Esta ação não pode ser desfeita.`,
                            )
                          )
                            excluirCiclo.mutate(ciclo);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Excluir ciclo
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dimensão</TableHead>
                      <TableHead className="w-20 text-right">Peso</TableHead>
                      <TableHead>O que mede</TableHead>
                      <TableHead className="w-28">Origem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {DIMENSOES.map((d) => (
                      <TableRow key={d.key}>
                        <TableCell className="font-medium">{d.label}</TableCell>
                        <TableCell className="text-right font-semibold">{pesos[d.key]}%</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.mede}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {["confiabilidade", "multiplicacao", "iniciativa"].includes(d.key)
                              ? "avaliação"
                              : "dados"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {ciclo?.criterio_publicado && (
                  <div className="p-3 rounded-lg bg-muted text-sm whitespace-pre-line">
                    {ciclo.criterio_publicado}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Complexidade BPMN */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-sm">Complexidade por processo (BPMN)</CardTitle>
                    <CardDescription>
                      O peso de cada processo vem do mapeamento, não de percepção. Sem isso, a
                      produtividade ajustada é contestável.
                    </CardDescription>
                  </div>
                  {podeGerirCiclo && (
                    <Button size="sm" variant="outline" onClick={() => setOpenBpmn(true)}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Mapear processo
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {bpmn.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 px-6">
                    Nenhum processo mapeado. Enquanto isso, todas as operações usam fator 1 —
                    ninguém é beneficiado nem penalizado.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operação</TableHead>
                        <TableHead>Processo</TableHead>
                        <TableHead className="text-right">Peso</TableHead>
                        <TableHead className="text-right">Participação</TableHead>
                        <TableHead>Referência</TableHead>
                        {podeGerirCiclo && <TableHead className="w-12" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bpmn.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell>
                            {UNIDADES.find((u) => u.key === b.operacao)?.label ?? b.operacao}
                          </TableCell>
                          <TableCell className="font-medium">{b.processo}</TableCell>
                          <TableCell className="text-right font-mono">
                            {Number(b.peso).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(b.participacao).toFixed(0)}%
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {b.referencia ?? "—"}
                          </TableCell>
                          {podeGerirCiclo && (
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => delBpmn.mutate(b.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {bpmn.length > 0 && (
                  <div className="px-6 py-3 border-t flex gap-4 flex-wrap text-xs">
                    <span className="text-muted-foreground">Fator resultante:</span>
                    {[...new Set(bpmn.map((b) => b.operacao))].map((op) => (
                      <span key={op}>
                        {UNIDADES.find((u) => u.key === op)?.label ?? op}:{" "}
                        <strong>{fatorComplexidade(bpmn, op).toFixed(2)}×</strong>
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* ── Dialog: novo ciclo ── */}
      <Dialog open={openCiclo} onOpenChange={setOpenCiclo}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo ciclo de avaliação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input
                value={formCiclo.nome}
                onChange={(e) => setFormCiclo((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: 1º semestre 2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início *</Label>
                <Input
                  type="date"
                  value={formCiclo.periodo_inicio}
                  onChange={(e) => setFormCiclo((f) => ({ ...f, periodo_inicio: e.target.value }))}
                />
              </div>
              <div>
                <Label>Fim *</Label>
                <Input
                  type="date"
                  value={formCiclo.periodo_fim}
                  onChange={(e) => setFormCiclo((f) => ({ ...f, periodo_fim: e.target.value }))}
                />
              </div>
            </div>
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Pesos das dimensões</span>
                <Badge
                  className={
                    somaPesos === 100
                      ? "bg-success/10 text-success border-0"
                      : "bg-destructive/10 text-destructive border-0"
                  }
                >
                  {somaPesos}%
                </Badge>
              </div>
              {DIMENSOES.map((d) => (
                <div key={d.key} className="flex items-center gap-2">
                  <span className="text-sm flex-1">{d.label}</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="w-20 h-8"
                    value={formCiclo[`peso_${d.key}`]}
                    onChange={(e) =>
                      setFormCiclo((f) => ({ ...f, [`peso_${d.key}`]: e.target.value }))
                    }
                  />
                  <span className="text-sm text-muted-foreground w-4">%</span>
                </div>
              ))}
            </div>
            <div>
              <Label>Critério a publicar</Label>
              <Textarea
                rows={4}
                value={formCiclo.criterio_publicado}
                onChange={(e) =>
                  setFormCiclo((f) => ({ ...f, criterio_publicado: e.target.value }))
                }
                placeholder="Texto que a equipe verá antes do ciclo começar: o que será avaliado, como e com que evidência."
              />
            </div>
            <Button
              onClick={() => salvarCiclo.mutate()}
              disabled={salvarCiclo.isPending}
              className="w-full"
            >
              {salvarCiclo.isPending ? "Criando..." : "Criar como rascunho"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: avaliar pessoa ── */}
      <Dialog open={openAval} onOpenChange={setOpenAval}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {colabAval ? nome(colabAval) : ""} · {ciclo?.nome}
            </DialogTitle>
          </DialogHeader>
          {colabAval &&
            ciclo &&
            (() => {
              const s = scorecardDe(colabAval, ciclo);
              return (
                <div className="space-y-4">
                  {/* dimensões calculadas */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Calculado dos dados
                    </div>
                    {[
                      {
                        k: "produtividade" as const,
                        det: `${s.prod.volume} proc · fator ${s.prod.fator.toFixed(2)}× · FTE ${s.prod.fte.toFixed(2)} · meta ${s.prod.meta.toFixed(0)}${s.prod.origem === "rateado" ? " · rateado do Cadastro Operacional" : ""}`,
                      },
                      {
                        k: "qualidade" as const,
                        det: `${s.qual.ocorrencias} não conformidade(s) · base ${s.qual.baseAvaliada} processos`,
                      },
                    ].map(({ k, det }) => {
                      const n = s.notas[k];
                      const d = DIMENSOES.find((x) => x.key === k)!;
                      return (
                        <div key={k} className="p-2.5 rounded border">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">
                              {d.label} <span className="text-muted-foreground">({pesos[k]}%)</span>
                            </span>
                            <span
                              className={`font-semibold ${n === null ? "text-muted-foreground" : n >= 75 ? "text-success" : n >= 60 ? "text-warning" : "text-destructive"}`}
                            >
                              {n === null ? "sem dados" : n.toFixed(1)}
                            </span>
                          </div>
                          {n !== null && <Progress value={n} className="h-1.5 mb-1" />}
                          <p className="text-xs text-muted-foreground">{det}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* dimensões avaliadas */}
                  <div className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Avaliação da liderança
                    </div>
                    <div className="p-3 rounded border">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium flex-1">
                          Confiabilidade <span className="text-muted-foreground">({pesos.confiabilidade}%)</span>
                        </span>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="w-20 h-8"
                          value={formAval.nota_confiabilidade ?? ""}
                          onChange={(e) =>
                            setFormAval((f) => ({ ...f, nota_confiabilidade: e.target.value }))
                          }
                          placeholder="0-100"
                        />
                      </div>
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Multiplicação e iniciativa — exigem evidência
                    </div>
                    {(
                      [
                        {
                          k: "multiplicacao",
                          label: "Multiplicação",
                          campo: "nota_multiplicacao",
                          ev: "evidencia_multiplicacao",
                          ph: "Quem mentorou, qual backup assumiu, que rotation cobriu",
                        },
                        {
                          k: "iniciativa",
                          label: "Iniciativa",
                          campo: "nota_iniciativa",
                          ev: "evidencia_iniciativa",
                          ph: "Que problema antecipou, que melhoria propôs e o que mudou",
                        },
                      ] as const
                    ).map((d) => (
                      <div key={d.k} className="p-3 rounded border space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium flex-1">
                            {d.label} <span className="text-muted-foreground">({pesos[d.k]}%)</span>
                          </span>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            className="w-20 h-8"
                            value={formAval[d.campo] ?? ""}
                            onChange={(e) =>
                              setFormAval((f) => ({ ...f, [d.campo]: e.target.value }))
                            }
                            placeholder="0-100"
                          />
                        </div>
                        <Textarea
                          rows={2}
                          placeholder={d.ph}
                          value={formAval[d.ev] ?? ""}
                          onChange={(e) => setFormAval((f) => ({ ...f, [d.ev]: e.target.value }))}
                          className={
                            formAval[d.campo] && !formAval[d.ev]?.trim() ? "border-warning" : ""
                          }
                        />
                        {formAval[d.campo] && !formAval[d.ev]?.trim() && (
                          <p className="text-xs text-warning">Nota sem evidência não é aceita</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* destaque */}
                  <div className="p-3 rounded border space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!formAval.destaque}
                        onChange={(e) =>
                          setFormAval((f) => ({ ...f, destaque: e.target.checked ? "1" : "" }))
                        }
                      />
                      Marcar como destaque do ciclo
                    </label>
                    {formAval.destaque && (
                      <>
                        <Textarea
                          rows={2}
                          placeholder="Por que se destacou — este texto é o que será divulgado"
                          value={formAval.motivo_destaque ?? ""}
                          onChange={(e) =>
                            setFormAval((f) => ({ ...f, motivo_destaque: e.target.value }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          O reconhecimento divulgado é o motivo, não a posição numa lista.
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted">
                    <div>
                      <div className="text-xs text-muted-foreground">Scorecard consolidado</div>
                      <div className="text-xs text-muted-foreground">
                        {s.ausentes.length > 0
                          ? `${s.pesoAplicado}% do peso aplicado`
                          : "peso integral"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-semibold ${faixa(s.total).cls}`}>
                        {s.total.toFixed(1)}
                      </div>
                      <div className={`text-xs ${faixa(s.total).cls}`}>{faixa(s.total).label}</div>
                    </div>
                  </div>

                  <Button
                    onClick={() => salvarAval.mutate()}
                    disabled={salvarAval.isPending}
                    className="w-full"
                  >
                    {salvarAval.isPending ? "Salvando..." : "Salvar avaliação"}
                  </Button>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: anotação mensal ── */}
      <Dialog open={openNota} onOpenChange={setOpenNota}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Anotação do mês</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Colaborador *</Label>
              <Select
                value={formNota.colaborador_id}
                onValueChange={(v) => setFormNota((f) => ({ ...f, colaborador_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {colabs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mês</Label>
                <Input
                  type="month"
                  value={formNota.mes}
                  onChange={(e) => setFormNota((f) => ({ ...f, mes: e.target.value }))}
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={formNota.tipo}
                  onValueChange={(v) => setFormNota((f) => ({ ...f, tipo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="observacao">Observação</SelectItem>
                    <SelectItem value="destaque">Destaque</SelectItem>
                    <SelectItem value="atencao">Ponto de atenção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Dimensão</Label>
              <Select
                value={formNota.dimensao}
                onValueChange={(v) => setFormNota((f) => ({ ...f, dimensao: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="geral">Geral</SelectItem>
                  {DIMENSOES.map((d) => (
                    <SelectItem key={d.key} value={d.key}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Anotação *</Label>
              <Textarea
                rows={3}
                value={formNota.nota}
                onChange={(e) => setFormNota((f) => ({ ...f, nota: e.target.value }))}
                placeholder="Fato observado, curto e específico. Duas linhas bastam."
              />
            </div>
            <Button
              onClick={() => salvarNota.mutate()}
              disabled={salvarNota.isPending}
              className="w-full"
            >
              {salvarNota.isPending ? "Salvando..." : "Salvar anotação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: mapear processo BPMN ── */}
      <Dialog open={openBpmn} onOpenChange={setOpenBpmn}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mapear processo do BPMN</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Operação *</Label>
              <Select
                value={formBpmn.operacao}
                onValueChange={(v) => setFormBpmn((f) => ({ ...f, operacao: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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
              <Label>Processo *</Label>
              <Input
                value={formBpmn.processo}
                onChange={(e) => setFormBpmn((f) => ({ ...f, processo: e.target.value }))}
                placeholder="Ex: DUIMP canal vermelho"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Peso de complexidade *</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={formBpmn.peso}
                  onChange={(e) => setFormBpmn((f) => ({ ...f, peso: e.target.value }))}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  1,0 = processo de referência
                </p>
              </div>
              <div>
                <Label>Participação no mix</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formBpmn.participacao}
                  onChange={(e) => setFormBpmn((f) => ({ ...f, participacao: e.target.value }))}
                  placeholder="%"
                />
                <p className="text-[10px] text-muted-foreground mt-1">% do volume da operação</p>
              </div>
            </div>
            <div>
              <Label>Referência no BPMN</Label>
              <Input
                value={formBpmn.referencia}
                onChange={(e) => setFormBpmn((f) => ({ ...f, referencia: e.target.value }))}
                placeholder="Identificação do diagrama ou versão"
              />
            </div>
            <Button
              onClick={() => salvarBpmn.mutate()}
              disabled={salvarBpmn.isPending}
              className="w-full"
            >
              {salvarBpmn.isPending ? "Salvando..." : "Salvar processo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
