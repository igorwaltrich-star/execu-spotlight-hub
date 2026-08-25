import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useColaboradores } from "@/components/gestao/use-colaboradores";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Pencil, Trash2, FolderKanban, AlertTriangle, CheckCircle2, Clock, Link2 } from "lucide-react";
import { toast } from "sonner";

type Projeto = {
  id: string; nome: string; objetivo?: string; descricao?: string;
  responsavel_id?: string; equipe_id?: string; start_date?: string; due_date?: string;
  prioridade: string; status: string; progresso: number; observacoes?: string;
};
type Equipe = { id: string; nome: string };
type Atividade = { id: string; titulo: string; status: string };
type Vinculo = { id: string; projeto_id: string; atividade_id: string };

const PRIORIDADES = [{ v: "baixa", l: "Baixa" }, { v: "media", l: "Média" }, { v: "alta", l: "Alta" }, { v: "critica", l: "Crítica" }];
const PRIO_CLS: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground border-0",
  media: "bg-primary/10 text-primary border-0",
  alta: "bg-warning/10 text-warning border-0",
  critica: "bg-destructive/10 text-destructive border-0",
};
const STATUS = [
  { v: "nao_iniciado", l: "Não iniciado", cls: "bg-muted text-muted-foreground border-0" },
  { v: "em_andamento", l: "Em andamento", cls: "bg-primary/10 text-primary border-0" },
  { v: "concluido",    l: "Concluído",    cls: "bg-success/10 text-success border-0" },
  { v: "atrasado",     l: "Atrasado",     cls: "bg-destructive/10 text-destructive border-0" },
  { v: "pausado",      l: "Pausado",      cls: "bg-warning/10 text-warning border-0" },
  { v: "cancelado",    l: "Cancelado",    cls: "bg-muted text-muted-foreground border-0" },
];

const emptyForm = {
  nome: "", objetivo: "", descricao: "", responsavel_id: "", equipe_id: "",
  start_date: "", due_date: "", prioridade: "media", status: "nao_iniciado", progresso: "0", observacoes: "",
};
const fmtDate = (d?: string) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
const diasRestantes = (due?: string) => {
  if (!due) return null;
  const diff = Math.ceil((new Date(due + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  return diff;
};

export function ProjetosView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: colabs = [] } = useColaboradores();
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [openVinc, setOpenVinc] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selProj, setSelProj] = useState<Projeto | null>(null);
  const [novaAtivId, setNovaAtivId] = useState("");
  const [form, setForm] = useState(emptyForm);

  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("*").order("due_date", { nullsFirst: false });
      if (error) throw error; return (data ?? []) as Projeto[];
    },
  });
  const { data: equipes = [] } = useQuery({
    queryKey: ["projetos_equipes"],
    queryFn: async () => { const { data, error } = await supabase.from("equipes").select("id,nome").eq("ativo", true); if (error) throw error; return (data ?? []) as Equipe[]; },
  });
  const { data: atividades = [] } = useQuery({
    queryKey: ["projetos_atividades"],
    queryFn: async () => { const { data, error } = await supabase.from("atividades").select("id,titulo,status"); if (error) throw error; return (data ?? []) as Atividade[]; },
  });
  const { data: vinculos = [] } = useQuery({
    queryKey: ["projeto_atividades"],
    queryFn: async () => { const { data, error } = await supabase.from("projeto_atividades").select("*"); if (error) throw error; return (data ?? []) as Vinculo[]; },
  });

  const nome = (id?: string) => id ? colabs.find(c => c.id === id)?.nome ?? "—" : "—";
  const nomeEquipe = (id?: string) => id ? equipes.find(e => e.id === id)?.nome ?? "—" : "—";
  const ativsDoProjeto = (pid: string) => {
    const ids = new Set(vinculos.filter(v => v.projeto_id === pid).map(v => v.atividade_id));
    return atividades.filter(a => ids.has(a.id));
  };

  const filtrados = useMemo(
    () => filtroStatus === "all" ? projetos : projetos.filter(p => p.status === filtroStatus),
    [projetos, filtroStatus],
  );

  const kpis = {
    total: projetos.length,
    andamento: projetos.filter(p => p.status === "em_andamento").length,
    concluidos: projetos.filter(p => p.status === "concluido").length,
    atrasados: projetos.filter(p => {
      if (p.status === "concluido" || p.status === "cancelado") return false;
      const d = diasRestantes(p.due_date);
      return p.status === "atrasado" || (d !== null && d < 0);
    }).length,
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !form.nome) throw new Error("Nome do projeto é obrigatório");
      const p = {
        nome: form.nome, objetivo: form.objetivo || null, descricao: form.descricao || null,
        responsavel_id: form.responsavel_id || null, equipe_id: form.equipe_id || null,
        start_date: form.start_date || null, due_date: form.due_date || null,
        prioridade: form.prioridade, status: form.status, progresso: Number(form.progresso),
        observacoes: form.observacoes || null, owner_id: user.id, created_by: user.id,
      };
      if (editId) { const { error } = await supabase.from("projetos").update(p).eq("id", editId); if (error) throw error; }
      else { const { error } = await supabase.from("projetos").insert(p); if (error) throw error; }
    },
    onSuccess: () => { toast.success(editId ? "Projeto atualizado" : "Projeto criado"); qc.invalidateQueries({ queryKey: ["projetos"] }); setOpen(false); setEditId(null); setForm(emptyForm); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("projetos").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Projeto removido"); qc.invalidateQueries({ queryKey: ["projetos"] }); },
  });

  const patch = async (id: string, campos: Partial<Projeto>) => {
    const { error } = await supabase.from("projetos").update(campos).eq("id", id);
    if (error) toast.error("Erro ao atualizar"); else qc.invalidateQueries({ queryKey: ["projetos"] });
  };

  const vincular = useMutation({
    mutationFn: async () => {
      if (!selProj || !novaAtivId) throw new Error("Selecione uma atividade");
      const { error } = await supabase.from("projeto_atividades").upsert(
        { projeto_id: selProj.id, atividade_id: novaAtivId }, { onConflict: "projeto_id,atividade_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atividade vinculada"); qc.invalidateQueries({ queryKey: ["projeto_atividades"] }); setNovaAtivId(""); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const desvincular = useMutation({
    mutationFn: async (ativId: string) => {
      if (!selProj) return;
      const { error } = await supabase.from("projeto_atividades").delete().eq("projeto_id", selProj.id).eq("atividade_id", ativId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projeto_atividades"] }); },
  });

  const startEdit = (p: Projeto) => {
    setForm({
      nome: p.nome, objetivo: p.objetivo ?? "", descricao: p.descricao ?? "",
      responsavel_id: p.responsavel_id ?? "", equipe_id: p.equipe_id ?? "",
      start_date: p.start_date ?? "", due_date: p.due_date ?? "",
      prioridade: p.prioridade, status: p.status, progresso: String(p.progresso), observacoes: p.observacoes ?? "",
    });
    setEditId(p.id); setOpen(true);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Projetos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Agrupamento de atividades com objetivo, prazo e progresso</p>
        </div>
        <Button size="sm" onClick={() => { setForm(emptyForm); setEditId(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />Novo Projeto
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: "Total", v: kpis.total, icon: FolderKanban, cls: "" },
          { l: "Em andamento", v: kpis.andamento, icon: Clock, cls: "text-primary" },
          { l: "Concluídos", v: kpis.concluidos, icon: CheckCircle2, cls: "text-success" },
          { l: "Atrasados", v: kpis.atrasados, icon: AlertTriangle, cls: "text-destructive" },
        ].map(({ l, v, icon: Icon, cls }) => (
          <Card key={l}><CardContent className="pt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{l}</span>
              <Icon className={`h-4 w-4 ${cls || "text-muted-foreground"}`} />
            </div>
            <div className={`text-2xl font-semibold ${cls}`}>{v}</div>
          </CardContent></Card>
        ))}
      </div>

      <Select value={filtroStatus} onValueChange={setFiltroStatus}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          {STATUS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtrados.length === 0 && (
          <Card className="lg:col-span-2"><CardContent className="py-12 text-center text-muted-foreground">
            <FolderKanban className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <div>Nenhum projeto {filtroStatus !== "all" ? "com esse status" : "cadastrado"}</div>
          </CardContent></Card>
        )}
        {filtrados.map(p => {
          const st = STATUS.find(s => s.v === p.status) ?? STATUS[0];
          const dias = diasRestantes(p.due_date);
          const vencido = dias !== null && dias < 0 && p.status !== "concluido" && p.status !== "cancelado";
          const proximo = dias !== null && dias >= 0 && dias <= 7 && p.status !== "concluido";
          const ativs = ativsDoProjeto(p.id);
          const ativsConcl = ativs.filter(a => a.status === "concluida").length;
          return (
            <Card key={p.id} className={vencido ? "border-destructive" : proximo ? "border-warning" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{p.nome}</CardTitle>
                    {p.objetivo && <CardDescription className="mt-0.5">{p.objetivo}</CardDescription>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => { setSelProj(p); setNovaAtivId(""); setOpenVinc(true); }}><Link2 className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => startEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap mt-1">
                  <Badge className={st.cls}>{st.l}</Badge>
                  <Badge className={PRIO_CLS[p.prioridade]}>{PRIORIDADES.find(x => x.v === p.prioridade)?.l}</Badge>
                  {vencido && <Badge className="bg-destructive/10 text-destructive border-0">Vencido há {Math.abs(dias!)}d</Badge>}
                  {proximo && <Badge className="bg-warning/10 text-warning border-0">Vence em {dias}d</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-medium">{p.progresso}%</span>
                  </div>
                  <Progress value={p.progresso} className="h-2" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>Responsável: <span className="text-foreground">{nome(p.responsavel_id)}</span></div>
                  <div>Equipe: <span className="text-foreground">{nomeEquipe(p.equipe_id)}</span></div>
                  <div>Início: <span className="text-foreground">{fmtDate(p.start_date)}</span></div>
                  <div>Prazo: <span className={vencido ? "text-destructive font-medium" : "text-foreground"}>{fmtDate(p.due_date)}</span></div>
                </div>

                {ativs.length > 0 && (
                  <div className="pt-2 border-t">
                    <div className="text-xs text-muted-foreground mb-1.5">
                      Atividades vinculadas: <span className="text-foreground font-medium">{ativsConcl}/{ativs.length} concluídas</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {ativs.slice(0, 4).map(a => (
                        <Badge key={a.id} variant={a.status === "concluida" ? "secondary" : "outline"} className="text-[10px]">{a.titulo}</Badge>
                      ))}
                      {ativs.length > 4 && <Badge variant="outline" className="text-[10px]">+{ativs.length - 4}</Badge>}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Select value={p.status} onValueChange={v => patch(p.id, { status: v })}>
                    <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input
                    type="number" min={0} max={100} value={p.progresso}
                    onChange={e => patch(p.id, { progresso: Math.max(0, Math.min(100, Number(e.target.value))) })}
                    className="h-7 w-20 text-xs"
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog projeto */}
      <Dialog open={open} onOpenChange={v => { if (!v) { setEditId(null); setForm(emptyForm); } setOpen(v); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Editar projeto" : "Novo projeto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div><Label>Objetivo</Label><Input value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} placeholder="O que este projeto entrega" /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsável</Label>
                <Select value={form.responsavel_id || "none"} onValueChange={v => setForm(f => ({ ...f, responsavel_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">—</SelectItem>{colabs.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Equipe</Label>
                <Select value={form.equipe_id || "none"} onValueChange={v => setForm(f => ({ ...f, equipe_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">—</SelectItem>{equipes.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Início</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
              <div>
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Progresso (%)</Label><Input type="number" min={0} max={100} value={form.progresso} onChange={e => setForm(f => ({ ...f, progresso: e.target.value }))} /></div>
            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">{save.isPending ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog vincular atividades */}
      <Dialog open={openVinc} onOpenChange={setOpenVinc}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Atividades — {selProj?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Select value={novaAtivId} onValueChange={setNovaAtivId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Vincular atividade" /></SelectTrigger>
                <SelectContent>
                  {atividades
                    .filter(a => !vinculos.find(v => v.projeto_id === selProj?.id && v.atividade_id === a.id))
                    .map(a => <SelectItem key={a.id} value={a.id}>{a.titulo}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => vincular.mutate()} disabled={!novaAtivId || vincular.isPending}><Link2 className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {selProj && ativsDoProjeto(selProj.id).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade vinculada</p>}
              {selProj && ativsDoProjeto(selProj.id).map(a => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded border">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{a.titulo}</div>
                    <div className="text-xs text-muted-foreground">{a.status}</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => desvincular.mutate(a.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
