import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Clock, AlertCircle, Target, TrendingUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

const PRIORIDADE_CLS: Record<string, string> = {
  critica: "bg-destructive/10 text-destructive border-0",
  alta: "bg-warning/10 text-warning border-0",
  media: "bg-primary/10 text-primary border-0",
  baixa: "bg-muted text-muted-foreground border-0",
};
const STATUS_LIST = [
  { v: "nao_iniciada", l: "Não iniciada" },
  { v: "em_andamento", l: "Em andamento" },
  { v: "concluida", l: "Concluída" },
  { v: "atrasada", l: "Atrasada" },
  { v: "bloqueada", l: "Bloqueada" },
];
const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  concluida: CheckCircle2,
  em_andamento: Clock,
  atrasada: AlertCircle,
  nao_iniciada: Clock,
  bloqueada: AlertCircle,
};
const STATUS_CLS: Record<string, string> = {
  concluida: "text-success",
  em_andamento: "text-primary",
  atrasada: "text-destructive",
  nao_iniciada: "text-muted-foreground",
  bloqueada: "text-warning",
};
const fmtDate = (d?: string) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

export function MinhaSemanaView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const fmtW = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  const { data: atividades = [] } = useQuery({
    queryKey: ["minha_semana_atividades", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("atividades")
        .select("*")
        .eq("owner_id", user.id)
        .not("status", "in", '("cancelada","concluida")')
        .order("prioridade");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: metas = [] } = useQuery({
    queryKey: ["minha_semana_metas", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("metas")
        .select("*")
        .eq("owner_id", user.id)
        .eq("status", "ativa")
        .order("end_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: resultados = [] } = useQuery({
    queryKey: ["minha_semana_resultados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resultados_meta")
        .select("*")
        .order("periodo_inicio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("atividades").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["minha_semana_atividades"] });
    },
  });

  const kpis = {
    total: atividades.length,
    concluidas: atividades.filter((a) => a.status === "concluida").length,
    atrasadas: atividades.filter((a) => a.status === "atrasada").length,
  };
  const pctConcluido = kpis.total > 0 ? Math.round((kpis.concluidas / kpis.total) * 100) : 0;
  const lastResultado = (metaId: string) => resultados.find((r) => r.meta_id === metaId);

  const isMonday = now.getDay() === 1;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Minha Semana</h1>
          <p className="text-sm text-muted-foreground">
            {fmtW(weekStart)} — {fmtW(weekEnd)}
          </p>
        </div>
        <div className="flex gap-2">
          {isMonday && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/revisao-semanal" as never })}
            >
              📋 Revisão semanal pendente
            </Button>
          )}
          <Button size="sm" onClick={() => navigate({ to: "/atividades" as never })}>
            <Plus className="h-4 w-4 mr-1.5" /> Nova atividade
          </Button>
        </div>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-4 px-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                Progresso da semana
              </span>
              <span className="text-lg font-semibold">{pctConcluido}%</span>
            </div>
            <Progress value={pctConcluido} className="h-2" />
            <div className="text-xs text-muted-foreground mt-1">
              {kpis.concluidas} de {kpis.total} atividades
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                Atrasadas
              </span>
            </div>
            <div
              className={`text-2xl font-semibold ${kpis.atrasadas > 0 ? "text-destructive" : "text-success"}`}
            >
              {kpis.atrasadas}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                Metas ativas
              </span>
            </div>
            <div className="text-2xl font-semibold">{metas.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Atividades */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              Minhas atividades
              <Badge variant="outline">{atividades.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {atividades.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma atividade pendente 🎉
              </p>
            )}
            {atividades.map((a) => {
              const Icon = STATUS_ICON[a.status] ?? Clock;
              const cls = STATUS_CLS[a.status] ?? "text-muted-foreground";
              return (
                <div
                  key={a.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cls}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{a.titulo}</span>
                      <Badge className={`${PRIORIDADE_CLS[a.prioridade]} text-[10px]`}>
                        {a.prioridade}
                      </Badge>
                    </div>
                    {a.due_date && (
                      <div
                        className={`text-xs mt-0.5 ${a.status === "atrasada" ? "text-destructive font-medium" : "text-muted-foreground"}`}
                      >
                        Prazo: {fmtDate(a.due_date)}
                      </div>
                    )}
                  </div>
                  <Select
                    value={a.status}
                    onValueChange={(v) => updateStatus.mutate({ id: a.id, status: v })}
                  >
                    <SelectTrigger className="h-7 w-32 text-xs shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_LIST.map((s) => (
                        <SelectItem key={s.v} value={s.v}>
                          {s.l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Metas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              Minhas metas
              <Badge variant="outline">{metas.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {metas.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma meta ativa</p>
            )}
            {metas.map((m) => {
              const res = lastResultado(m.id);
              const pct = res ? Number(res.pct_atingimento) : 0;
              const pctCls =
                pct >= 100 ? "text-success" : pct >= 70 ? "text-warning" : "text-destructive";
              return (
                <div key={m.id} className="p-3 rounded-lg border">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="text-sm font-medium">{m.titulo}</div>
                      <div className="text-xs text-muted-foreground">
                        Esperado: {m.valor_esperado} {m.unidade} · Prazo: {fmtDate(m.end_date)}
                      </div>
                    </div>
                    <div className={`text-lg font-bold shrink-0 ${pctCls}`}>
                      {res ? `${pct.toFixed(0)}%` : "—"}
                    </div>
                  </div>
                  <Progress value={Math.min(pct, 100)} className="h-1.5" />
                  {res && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Realizado: {res.valor_realizado} {m.unidade}
                    </div>
                  )}
                </div>
              );
            })}
            {metas.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => navigate({ to: "/metas" as never })}
              >
                <TrendingUp className="h-4 w-4 mr-1.5" /> Registrar resultado
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
