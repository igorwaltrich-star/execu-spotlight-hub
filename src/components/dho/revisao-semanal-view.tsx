import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock, AlertCircle, ChevronRight, Send, CalendarCheck } from "lucide-react";
import { toast } from "sonner";

type Atividade = {
  id: string;
  titulo: string;
  tipo: string;
  prioridade: string;
  due_date?: string;
  status: string;
};
type Revisao = {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  status: string;
};

const RESULTADOS = [
  { v: "sucesso", l: "✅ Realizado com sucesso", req_justif: false },
  { v: "atraso", l: "⏱ Realizado com atraso", req_justif: true },
  { v: "desvios", l: "⚠️ Realizado com desvios", req_justif: true },
  { v: "nao_realizado", l: "❌ Não realizado", req_justif: true },
  { v: "nao_aplicavel", l: "— Não aplicável", req_justif: false },
];

const PONTOS: Record<string, number> = {
  sucesso: 100,
  atraso: 80,
  desvios: 60,
  nao_realizado: 0,
  nao_aplicavel: 100,
};
const PRIORIDADE_CLS: Record<string, string> = {
  critica: "text-destructive",
  alta: "text-warning",
  media: "text-primary",
  baixa: "text-muted-foreground",
};

function getWeek(offset = 0) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

const fmtW = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

export function RevisaoSemanalView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [semanaOffset, setSemanaOffset] = useState(-1); // -1 = semana anterior
  const semana = useMemo(() => getWeek(semanaOffset), [semanaOffset]);
  const semanaLabel =
    semanaOffset === -1
      ? "Semana anterior"
      : semanaOffset === 0
        ? "Semana atual"
        : `Semana ${semanaOffset > 0 ? "+" : ""}${semanaOffset}`;
  const [respostas, setRespostas] = useState<
    Record<string, { resultado: string; justificativa: string }>
  >({});

  const { data: atividades = [] } = useQuery({
    queryKey: ["revisao_atividades", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("atividades")
        .select("*")
        .eq("owner_id", user.id)
        .neq("status", "cancelada");
      if (error) throw error;
      return (data ?? []) as Atividade[];
    },
  });

  const { data: revisoes = [] } = useQuery({
    queryKey: ["revisoes_semanais", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("revisoes_semanais")
        .select("*")
        .eq("user_id", user.id)
        .order("week_start", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as Revisao[];
    },
  });

  const revisaoAtual = revisoes.find((r) => r.week_start === semana.start);
  const jaRevisada = revisaoAtual?.status === "concluida" || revisaoAtual?.status === "aprovada";

  const setResp = (id: string, campo: "resultado" | "justificativa", valor: string) => {
    setRespostas((prev) => ({
      ...prev,
      [id]: {
        resultado: prev[id]?.resultado ?? "",
        justificativa: prev[id]?.justificativa ?? "",
        [campo]: valor,
      },
    }));
  };

  const totalRespondidas = atividades.filter((a) => respostas[a.id]?.resultado).length;
  const progresso =
    atividades.length > 0 ? Math.round((totalRespondidas / atividades.length) * 100) : 0;

  const pontMedia = useMemo(() => {
    const vals = Object.values(respostas).map((r) => PONTOS[r.resultado] ?? 0);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  }, [respostas]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const pendentes = atividades.filter((a) => {
        const r = respostas[a.id];
        return !r?.resultado;
      });
      if (pendentes.length > 0)
        throw new Error(`${pendentes.length} atividade(s) sem classificação`);

      const desvioSemJustif = atividades.find((a) => {
        const r = respostas[a.id];
        const cfg = RESULTADOS.find((x) => x.v === r?.resultado);
        return cfg?.req_justif && !r?.justificativa?.trim();
      });
      if (desvioSemJustif)
        throw new Error("Justificativa obrigatória para desvios, atrasos e não realizados");

      // Upsert revisão
      const { data: rev, error: revErr } = await supabase
        .from("revisoes_semanais")
        .upsert(
          {
            user_id: user.id,
            week_start: semana.start,
            week_end: semana.end,
            status: "concluida",
            pontuacao_geral: pontMedia,
          },
          { onConflict: "user_id,week_start" },
        )
        .select()
        .single();
      if (revErr) throw revErr;

      // Insert ocorrências
      const ocorrencias = atividades.map((a) => {
        const r = respostas[a.id];
        return {
          atividade_id: a.id,
          week_start: semana.start,
          week_end: semana.end,
          status: r.resultado,
          resultado: r.resultado,
          justificativa: r.justificativa || null,
          pontuacao: PONTOS[r.resultado] ?? 0,
        };
      });
      const { error: ocErr } = await supabase.from("ocorrencias_atividade").insert(ocorrencias);
      if (ocErr && !ocErr.message.includes("unique")) throw ocErr;
    },
    onSuccess: () => {
      toast.success("Revisão enviada com sucesso!");
      qc.invalidateQueries({ queryKey: ["revisoes_semanais"] });
      setRespostas({});
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar revisão"),
  });

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Revisão Semanal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Classifique cada atividade e registre o resultado da semana
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={semanaOffset <= -4}
            onClick={() => setSemanaOffset((o) => o - 1)}
          >
            ← Anterior
          </Button>
          <span className="flex items-center px-3 text-sm font-medium">{semanaLabel}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={semanaOffset >= 0}
            onClick={() => setSemanaOffset((o) => o + 1)}
          >
            Próxima →
          </Button>
        </div>
      </div>

      {/* Cabeçalho da semana */}
      <Card className={jaRevisada ? "border-success" : "border-primary"}>
        <CardContent className="py-4 px-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="font-medium">
                {fmtW(semana.start)} — {fmtW(semana.end)}
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {atividades.length} atividade(s) para revisar
              </div>
            </div>
            {jaRevisada ? (
              <Badge className="bg-success/10 text-success border-0">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Revisão concluída
              </Badge>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Progresso</div>
                  <div className="font-semibold">
                    {totalRespondidas}/{atividades.length}
                  </div>
                </div>
                <Progress value={progresso} className="w-24 h-2" />
              </div>
            )}
          </div>
          {!jaRevisada && pontMedia > 0 && (
            <div className="mt-3 pt-3 border-t flex gap-4 text-sm">
              <span className="text-muted-foreground">Pontuação estimada:</span>
              <span
                className={`font-semibold ${pontMedia >= 80 ? "text-success" : pontMedia >= 60 ? "text-warning" : "text-destructive"}`}
              >
                {pontMedia.toFixed(0)}%
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Atividades para revisar */}
      {atividades.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma atividade para revisar. Cadastre atividades na aba <strong>Atividades</strong>.
          </CardContent>
        </Card>
      )}

      {!jaRevisada &&
        atividades.map((a) => {
          const resp = respostas[a.id];
          const cfg = RESULTADOS.find((r) => r.v === resp?.resultado);
          const needsJustif = cfg?.req_justif ?? false;
          return (
            <Card
              key={a.id}
              className={resp?.resultado ? "border-border" : "border-dashed border-muted"}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 shrink-0 ${resp?.resultado ? "text-success" : "text-muted-foreground/30"}`}
                  >
                    {resp?.resultado ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Clock className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-sm font-medium">{a.titulo}</CardTitle>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">
                        {a.tipo}
                      </Badge>
                      <span className={`text-[10px] font-medium ${PRIORIDADE_CLS[a.prioridade]}`}>
                        {a.prioridade}
                      </span>
                      {a.due_date && (
                        <span className="text-[10px] text-muted-foreground">
                          Prazo: {new Date(a.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={resp?.resultado ?? ""}
                  onValueChange={(v) => setResp(a.id, "resultado", v)}
                >
                  <SelectTrigger className={!resp?.resultado ? "border-dashed" : ""}>
                    <SelectValue placeholder="Selecione o resultado..." />
                  </SelectTrigger>
                  <SelectContent>
                    {RESULTADOS.map((r) => (
                      <SelectItem key={r.v} value={r.v}>
                        {r.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {needsJustif && (
                  <div>
                    <Textarea
                      placeholder="Justificativa obrigatória para desvios, atrasos e não realizados..."
                      value={resp?.justificativa ?? ""}
                      onChange={(e) => setResp(a.id, "justificativa", e.target.value)}
                      rows={2}
                      className={!resp?.justificativa?.trim() ? "border-warning" : ""}
                    />
                    {!resp?.justificativa?.trim() && (
                      <p className="text-xs text-warning mt-1">⚠️ Justificativa obrigatória</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

      {jaRevisada && (
        <Card>
          <CardContent className="py-10 text-center">
            <CalendarCheck className="h-10 w-10 text-success mx-auto mb-3" />
            <div className="font-medium text-success">Revisão já concluída para esta semana</div>
            <div className="text-sm text-muted-foreground mt-1">
              Pontuação geral:{" "}
              {revisaoAtual?.status === "aprovada"
                ? "Aprovada pelo gestor"
                : "Aguardando aprovação"}
            </div>
          </CardContent>
        </Card>
      )}

      {!jaRevisada && atividades.length > 0 && (
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setRespostas({})}>
            Limpar
          </Button>
          <Button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || totalRespondidas < atividades.length}
          >
            <Send className="h-4 w-4 mr-2" />
            {submit.isPending
              ? "Enviando..."
              : `Enviar revisão (${totalRespondidas}/${atividades.length})`}
          </Button>
        </div>
      )}

      {/* Histórico */}
      {revisoes.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Histórico de revisões
          </div>
          <div className="space-y-2">
            {revisoes.slice(0, 8).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="text-sm">
                  {fmtW(r.week_start)} — {fmtW(r.week_end)}
                </div>
                <Badge
                  className={
                    r.status === "aprovada"
                      ? "bg-success/10 text-success border-0"
                      : r.status === "concluida"
                        ? "bg-primary/10 text-primary border-0"
                        : "bg-muted text-muted-foreground border-0"
                  }
                >
                  {r.status === "aprovada"
                    ? "✓ Aprovada"
                    : r.status === "concluida"
                      ? "Concluída"
                      : "Pendente"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
