import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useColaboradores } from "@/components/gestao/use-colaboradores";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  ClipboardList,
  MessageSquarePlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  ImportarPlanilha,
  parseData,
  parseNum,
  buscarPorNome,
} from "@/components/importar-planilha";

type Plano = {
  id: string;
  colaborador_id: string;
  competencia: string;
  objetivo: string;
  indicador?: string;
  start_date?: string;
  due_date?: string;
  status: string;
  progresso: number;
  evidencias?: string;
};
type AtivDev = {
  id: string;
  plano_id: string;
  titulo: string;
  descricao?: string;
  due_date?: string;
  status: string;
  progresso: number;
  evidencia?: string;
};
type Avaliacao = {
  id: string;
  plano_id: string;
  data: string;
  progresso: number;
  avaliacao: string;
};

const STATUS = [
  { v: "nao_iniciado", l: "Não iniciado", cls: "bg-muted text-muted-foreground border-0" },
  { v: "em_andamento", l: "Em andamento", cls: "bg-primary/10 text-primary border-0" },
  { v: "concluido", l: "Concluído", cls: "bg-success/10 text-success border-0" },
  { v: "atrasado", l: "Atrasado", cls: "bg-destructive/10 text-destructive border-0" },
  { v: "cancelado", l: "Cancelado", cls: "bg-muted text-muted-foreground border-0" },
];
const ATIV_STATUS = [
  { v: "nao_iniciada", l: "Não iniciada" },
  { v: "em_andamento", l: "Em andamento" },
  { v: "concluida", l: "Concluída" },
  { v: "atrasada", l: "Atrasada" },
  { v: "cancelada", l: "Cancelada" },
];

const emptyPlano = {
  colaborador_id: "",
  competencia: "",
  objetivo: "",
  indicador: "",
  start_date: "",
  due_date: "",
  status: "nao_iniciado",
  progresso: "0",
  evidencias: "",
};
const emptyAtiv = {
  titulo: "",
  descricao: "",
  due_date: "",
  status: "nao_iniciada",
  progresso: "0",
  evidencia: "",
};
const emptyAval = { data: new Date().toISOString().slice(0, 10), progresso: "0", avaliacao: "" };

const fmtDate = (d?: string) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

export function PdiView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: colabs = [] } = useColaboradores();
  const [filtroColab, setFiltroColab] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openPlano, setOpenPlano] = useState(false);
  const [openAtiv, setOpenAtiv] = useState(false);
  const [openAval, setOpenAval] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selPlanoId, setSelPlanoId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyPlano);
  const [ativForm, setAtivForm] = useState(emptyAtiv);
  const [avalForm, setAvalForm] = useState(emptyAval);

  const { data: planos = [] } = useQuery({
    queryKey: ["planos_desenvolvimento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos_desenvolvimento")
        .select("*")
        .order("due_date", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Plano[];
    },
  });
  const { data: ativs = [] } = useQuery({
    queryKey: ["atividades_desenvolvimento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atividades_desenvolvimento")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as AtivDev[];
    },
  });
  const { data: avals = [] } = useQuery({
    queryKey: ["avaliacoes_pdi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avaliacoes_pdi")
        .select("*")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Avaliacao[];
    },
  });

  const nome = (id: string) => colabs.find((c) => c.id === id)?.nome ?? "—";
  const ativsDoPlano = (pid: string) => ativs.filter((a) => a.plano_id === pid);
  const avalsDoPlano = (pid: string) => avals.filter((a) => a.plano_id === pid);

  const filtrados =
    filtroColab === "all" ? planos : planos.filter((p) => p.colaborador_id === filtroColab);

  const kpis = {
    total: planos.length,
    andamento: planos.filter((p) => p.status === "em_andamento").length,
    concluidos: planos.filter((p) => p.status === "concluido").length,
    mediaProg: planos.length > 0 ? planos.reduce((s, p) => s + p.progresso, 0) / planos.length : 0,
  };

  const savePlano = useMutation({
    mutationFn: async () => {
      if (!user || !form.colaborador_id || !form.competencia || !form.objetivo)
        throw new Error("Preencha colaborador, competência e objetivo");
      const p = {
        colaborador_id: form.colaborador_id,
        competencia: form.competencia,
        objetivo: form.objetivo,
        indicador: form.indicador || null,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
        status: form.status,
        progresso: Number(form.progresso),
        evidencias: form.evidencias || null,
        created_by: user.id,
      };
      if (editId) {
        const { error } = await supabase.from("planos_desenvolvimento").update(p).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("planos_desenvolvimento").insert(p);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "PDI atualizado" : "PDI criado");
      qc.invalidateQueries({ queryKey: ["planos_desenvolvimento"] });
      setOpenPlano(false);
      setEditId(null);
      setForm(emptyPlano);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const delPlano = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("planos_desenvolvimento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("PDI removido");
      qc.invalidateQueries({ queryKey: ["planos_desenvolvimento"] });
    },
  });

  const patchPlano = async (id: string, campos: Partial<Plano>) => {
    const { error } = await supabase.from("planos_desenvolvimento").update(campos).eq("id", id);
    if (error) toast.error("Erro ao atualizar");
    else qc.invalidateQueries({ queryKey: ["planos_desenvolvimento"] });
  };

  const saveAtiv = useMutation({
    mutationFn: async () => {
      if (!selPlanoId || !ativForm.titulo) throw new Error("Título obrigatório");
      const { error } = await supabase.from("atividades_desenvolvimento").insert({
        plano_id: selPlanoId,
        titulo: ativForm.titulo,
        descricao: ativForm.descricao || null,
        due_date: ativForm.due_date || null,
        status: ativForm.status,
        progresso: Number(ativForm.progresso),
        evidencia: ativForm.evidencia || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atividade adicionada");
      qc.invalidateQueries({ queryKey: ["atividades_desenvolvimento"] });
      setOpenAtiv(false);
      setAtivForm(emptyAtiv);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const patchAtiv = async (id: string, campos: Partial<AtivDev>) => {
    const { error } = await supabase.from("atividades_desenvolvimento").update(campos).eq("id", id);
    if (!error) qc.invalidateQueries({ queryKey: ["atividades_desenvolvimento"] });
  };

  const delAtiv = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("atividades_desenvolvimento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["atividades_desenvolvimento"] }),
  });

  const saveAval = useMutation({
    mutationFn: async () => {
      if (!selPlanoId || !avalForm.avaliacao) throw new Error("Escreva a avaliação");
      const { error } = await supabase.from("avaliacoes_pdi").insert({
        plano_id: selPlanoId,
        data: avalForm.data,
        progresso: Number(avalForm.progresso),
        avaliacao: avalForm.avaliacao,
        avaliador_id: user?.id ?? null,
      });
      if (error) throw error;
      await supabase
        .from("planos_desenvolvimento")
        .update({ progresso: Number(avalForm.progresso) })
        .eq("id", selPlanoId);
    },
    onSuccess: () => {
      toast.success("Avaliação registrada");
      qc.invalidateQueries({ queryKey: ["avaliacoes_pdi"] });
      qc.invalidateQueries({ queryKey: ["planos_desenvolvimento"] });
      setOpenAval(false);
      setAvalForm(emptyAval);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const startEdit = (p: Plano) => {
    setForm({
      colaborador_id: p.colaborador_id,
      competencia: p.competencia,
      objetivo: p.objetivo,
      indicador: p.indicador ?? "",
      start_date: p.start_date ?? "",
      due_date: p.due_date ?? "",
      status: p.status,
      progresso: String(p.progresso),
      evidencias: p.evidencias ?? "",
    });
    setEditId(p.id);
    setOpenPlano(true);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">PDI — Plano de Desenvolvimento Individual</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Competências, atividades de desenvolvimento e avaliações periódicas
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ImportarPlanilha
            nomeArquivo="pdi"
            tabela="planos_desenvolvimento"
            invalidar={["planos_desenvolvimento"]}
            ajuda="Status: nao_iniciado, em_andamento, concluido, atrasado, cancelado."
            campos={[
              {
                coluna: "Colaborador",
                exemplo: "Nome do colaborador",
                obrigatorio: true,
                largura: 26,
              },
              {
                coluna: "Competencia",
                exemplo: "Dominio de DUIMP",
                obrigatorio: true,
                largura: 28,
              },
              {
                coluna: "Objetivo",
                exemplo: "O que se espera ao final",
                obrigatorio: true,
                largura: 34,
              },
              { coluna: "Indicador", exemplo: "", largura: 26 },
              { coluna: "Inicio", exemplo: "" },
              { coluna: "Prazo", exemplo: "" },
              { coluna: "Status", exemplo: "nao_iniciado", largura: 16 },
              { coluna: "Progresso", exemplo: 0 },
            ]}
            montarRegistro={(l) => {
              const c = buscarPorNome(colabs, l.colaborador);
              if (!c) return { ok: false, erro: `Colaborador "${l.colaborador}" nao encontrado` };
              const st = (l.status || "nao_iniciado").toLowerCase();
              if (!STATUS.some((x) => x.v === st))
                return { ok: false, erro: `Status "${l.status}" invalido` };
              if (l.inicio && !parseData(l.inicio))
                return { ok: false, erro: `Inicio "${l.inicio}" invalido` };
              if (l.prazo && !parseData(l.prazo))
                return { ok: false, erro: `Prazo "${l.prazo}" invalido` };
              return {
                ok: true,
                registro: {
                  colaborador_id: c.id,
                  competencia: l.competencia,
                  objetivo: l.objetivo,
                  indicador: l.indicador || null,
                  start_date: l.inicio ? parseData(l.inicio) : null,
                  due_date: l.prazo ? parseData(l.prazo) : null,
                  status: st,
                  progresso: Math.max(0, Math.min(100, Math.round(parseNum(l.progresso)))),
                  created_by: user?.id,
                },
              };
            }}
          />
          <Button
            size="sm"
            onClick={() => {
              setForm(emptyPlano);
              setEditId(null);
              setOpenPlano(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Novo PDI
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: "PDIs ativos", v: kpis.total, cls: "" },
          { l: "Em andamento", v: kpis.andamento, cls: "text-primary" },
          { l: "Concluídos", v: kpis.concluidos, cls: "text-success" },
          {
            l: "Progresso médio",
            v: `${kpis.mediaProg.toFixed(0)}%`,
            cls:
              kpis.mediaProg >= 70
                ? "text-success"
                : kpis.mediaProg >= 40
                  ? "text-warning"
                  : "text-muted-foreground",
          },
        ].map(({ l, v, cls }) => (
          <Card key={l}>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{l}</div>
              <div className={`text-2xl font-semibold ${cls}`}>{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Select value={filtroColab} onValueChange={setFiltroColab}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Colaborador" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os colaboradores</SelectItem>
          {colabs.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="space-y-3">
        {filtrados.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <GraduationCap className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <div>Nenhum PDI cadastrado</div>
            </CardContent>
          </Card>
        )}
        {filtrados.map((p) => {
          const st = STATUS.find((s) => s.v === p.status) ?? STATUS[0];
          const pAtivs = ativsDoPlano(p.id);
          const pAvals = avalsDoPlano(p.id);
          const concl = pAtivs.filter((a) => a.status === "concluida").length;
          const expanded = expandedId === p.id;
          return (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <button
                    className="flex items-start gap-2 flex-1 min-w-0 text-left"
                    onClick={() => setExpandedId(expanded ? null : p.id)}
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <CardTitle className="text-sm">{p.competencia}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {nome(p.colaborador_id)} · prazo {fmtDate(p.due_date)}
                      </CardDescription>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={st.cls}>{st.l}</Badge>
                    <Button size="icon" variant="ghost" onClick={() => startEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => delPlano.mutate(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-medium">{p.progresso}%</span>
                  </div>
                  <Progress value={p.progresso} className="h-1.5" />
                </div>
              </CardHeader>

              {expanded && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Objetivo:</span>
                      <div>{p.objetivo}</div>
                    </div>
                    {p.indicador && (
                      <div>
                        <span className="text-muted-foreground text-xs">
                          Indicador de evolução:
                        </span>
                        <div>{p.indicador}</div>
                      </div>
                    )}
                  </div>
                  {p.evidencias && (
                    <div className="text-sm border-l-2 border-muted pl-3">
                      <span className="text-muted-foreground text-xs">Evidências:</span>
                      <div>{p.evidencias}</div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Select value={p.status} onValueChange={(v) => patchPlano(p.id, { status: v })}>
                      <SelectTrigger className="h-7 text-xs w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS.map((s) => (
                          <SelectItem key={s.v} value={s.v}>
                            {s.l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={p.progresso}
                      onChange={(e) =>
                        patchPlano(p.id, {
                          progresso: Math.max(0, Math.min(100, Number(e.target.value))),
                        })
                      }
                      className="h-7 w-20 text-xs"
                    />
                  </div>

                  {/* Atividades de desenvolvimento */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Atividades de desenvolvimento{" "}
                        {pAtivs.length > 0 && `(${concl}/${pAtivs.length})`}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs"
                        onClick={() => {
                          setSelPlanoId(p.id);
                          setAtivForm(emptyAtiv);
                          setOpenAtiv(true);
                        }}
                      >
                        <ClipboardList className="h-3 w-3 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                    {pAtivs.length === 0 && (
                      <p className="text-xs text-muted-foreground">Nenhuma atividade cadastrada</p>
                    )}
                    <div className="space-y-1.5">
                      {pAtivs.map((a) => (
                        <div key={a.id} className="p-2.5 rounded border space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{a.titulo}</div>
                              {a.descricao && (
                                <div className="text-xs text-muted-foreground">{a.descricao}</div>
                              )}
                              {a.due_date && (
                                <div className="text-xs text-muted-foreground">
                                  Prazo: {fmtDate(a.due_date)}
                                </div>
                              )}
                              {a.evidencia && (
                                <div className="text-xs text-primary mt-0.5">📎 {a.evidencia}</div>
                              )}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 shrink-0"
                              onClick={() => delAtiv.mutate(a.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={a.status}
                              onValueChange={(v) => patchAtiv(a.id, { status: v })}
                            >
                              <SelectTrigger className="h-6 text-xs w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ATIV_STATUS.map((s) => (
                                  <SelectItem key={s.v} value={s.v}>
                                    {s.l}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Progress value={a.progresso} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground w-9 text-right">
                              {a.progresso}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Avaliações periódicas */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Avaliações periódicas {pAvals.length > 0 && `(${pAvals.length})`}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs"
                        onClick={() => {
                          setSelPlanoId(p.id);
                          setAvalForm({ ...emptyAval, progresso: String(p.progresso) });
                          setOpenAval(true);
                        }}
                      >
                        <MessageSquarePlus className="h-3 w-3 mr-1" />
                        Avaliar
                      </Button>
                    </div>
                    {pAvals.length === 0 && (
                      <p className="text-xs text-muted-foreground">Nenhuma avaliação registrada</p>
                    )}
                    <div className="space-y-1.5">
                      {pAvals.map((a) => (
                        <div key={a.id} className="p-2.5 rounded border bg-muted/30">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">{fmtDate(a.data)}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {a.progresso}%
                            </Badge>
                          </div>
                          <p className="text-sm">{a.avaliacao}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Dialog PDI */}
      <Dialog
        open={openPlano}
        onOpenChange={(v) => {
          if (!v) {
            setEditId(null);
            setForm(emptyPlano);
          }
          setOpenPlano(v);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar PDI" : "Novo PDI"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Colaborador *</Label>
              <Select
                value={form.colaborador_id}
                onValueChange={(v) => setForm((f) => ({ ...f, colaborador_id: v }))}
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
            <div>
              <Label>Competência a desenvolver *</Label>
              <Input
                value={form.competencia}
                onChange={(e) => setForm((f) => ({ ...f, competencia: e.target.value }))}
                placeholder="Ex: Domínio de SAP/ZMM066"
              />
            </div>
            <div>
              <Label>Objetivo de desenvolvimento *</Label>
              <Textarea
                value={form.objetivo}
                onChange={(e) => setForm((f) => ({ ...f, objetivo: e.target.value }))}
                rows={2}
                placeholder="O que se espera ao final"
              />
            </div>
            <div>
              <Label>Indicador de evolução</Label>
              <Input
                value={form.indicador}
                onChange={(e) => setForm((f) => ({ ...f, indicador: e.target.value }))}
                placeholder="Como medir o avanço"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Prazo</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS.map((s) => (
                      <SelectItem key={s.v} value={s.v}>
                        {s.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Progresso (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.progresso}
                  onChange={(e) => setForm((f) => ({ ...f, progresso: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Evidências / Observações</Label>
              <Textarea
                value={form.evidencias}
                onChange={(e) => setForm((f) => ({ ...f, evidencias: e.target.value }))}
                rows={2}
              />
            </div>
            <Button
              onClick={() => savePlano.mutate()}
              disabled={savePlano.isPending}
              className="w-full"
            >
              {savePlano.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog atividade de desenvolvimento */}
      <Dialog open={openAtiv} onOpenChange={setOpenAtiv}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova atividade de desenvolvimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input
                value={ativForm.titulo}
                onChange={(e) => setAtivForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Curso de DUIMP avançado"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={ativForm.descricao}
                onChange={(e) => setAtivForm((f) => ({ ...f, descricao: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prazo</Label>
                <Input
                  type="date"
                  value={ativForm.due_date}
                  onChange={(e) => setAtivForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={ativForm.status}
                  onValueChange={(v) => setAtivForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ATIV_STATUS.map((s) => (
                      <SelectItem key={s.v} value={s.v}>
                        {s.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Progresso (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={ativForm.progresso}
                onChange={(e) => setAtivForm((f) => ({ ...f, progresso: e.target.value }))}
              />
            </div>
            <div>
              <Label>Evidência</Label>
              <Input
                value={ativForm.evidencia}
                onChange={(e) => setAtivForm((f) => ({ ...f, evidencia: e.target.value }))}
                placeholder="Certificado, link, observação"
              />
            </div>
            <Button
              onClick={() => saveAtiv.mutate()}
              disabled={saveAtiv.isPending}
              className="w-full"
            >
              {saveAtiv.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog avaliação */}
      <Dialog open={openAval} onOpenChange={setOpenAval}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Avaliação periódica</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={avalForm.data}
                  onChange={(e) => setAvalForm((f) => ({ ...f, data: e.target.value }))}
                />
              </div>
              <div>
                <Label>Progresso (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={avalForm.progresso}
                  onChange={(e) => setAvalForm((f) => ({ ...f, progresso: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Avaliação *</Label>
              <Textarea
                value={avalForm.avaliacao}
                onChange={(e) => setAvalForm((f) => ({ ...f, avaliacao: e.target.value }))}
                rows={4}
                placeholder="Evolução observada, pontos fortes, próximos passos..."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O progresso informado aqui atualiza o progresso geral do PDI.
            </p>
            <Button
              onClick={() => saveAval.mutate()}
              disabled={saveAval.isPending}
              className="w-full"
            >
              {saveAval.isPending ? "Salvando..." : "Registrar avaliação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
