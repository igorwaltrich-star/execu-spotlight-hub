import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { useColaboradores } from "@/components/gestao/use-colaboradores";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GripVertical, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { UNIDADES } from "@/lib/constants";
import { NAVY_CLASS, NAVY_LABEL, num, useNavySealTags } from "./use-paineis-data";

type Status = "identificado" | "em_tratamento" | "mitigado" | "aceito";

type Risco = {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  operacao: string;
  colaborador_id: string | null;
  origem: string;
  probabilidade: number;
  impacto: number;
  severidade: number | null;
  status: string;
  responsavel: string;
  plano_acao: string;
  prazo: string | null;
  data_identificacao: string;
};

const STATUS_META: Record<Status, { label: string; className: string }> = {
  identificado: { label: "Identificado", className: "bg-secondary text-secondary-foreground" },
  em_tratamento: { label: "Em tratamento", className: "bg-primary text-primary-foreground" },
  mitigado: { label: "Mitigado", className: "bg-success text-success-foreground" },
  aceito: { label: "Aceito / monitorado", className: "bg-warning text-warning-foreground" },
};

const STATUSES = Object.keys(STATUS_META) as Status[];

const CATEGORIAS = ["operacional", "pessoas", "financeiro", "cliente", "processo", "compliance"];

const labelUnidade = (k: string) => UNIDADES.find((u) => u.key === k)?.label ?? k;

function nivel(sev: number) {
  if (sev >= 15) return { label: "Crítico", cls: "bg-destructive text-destructive-foreground" };
  if (sev >= 9) return { label: "Alto", cls: "bg-warning text-warning-foreground" };
  if (sev >= 4) return { label: "Médio", cls: "bg-secondary text-secondary-foreground" };
  return { label: "Baixo", cls: "bg-muted text-muted-foreground" };
}

const emptyForm = {
  titulo: "",
  descricao: "",
  categoria: "operacional",
  operacao: "",
  colaborador_id: "",
  probabilidade: 3,
  impacto: 3,
  status: "identificado" as Status,
  responsavel: "",
  plano_acao: "",
  prazo: "",
};

export function RiscosOperacionaisPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeTable("riscos_operacionais", ["riscos_operacionais"]);
  const { data: colabs = [] } = useColaboradores();
  const { data: navy = [] } = useNavySealTags();

  const { data: riscos = [] } = useQuery({
    queryKey: ["riscos_operacionais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("riscos_operacionais")
        .select(
          "id, titulo, descricao, categoria, operacao, colaborador_id, origem, probabilidade, impacto, severidade, status, responsavel, plano_acao, prazo, data_identificacao",
        )
        .order("severidade", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Risco[];
    },
  });

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Status | null>(null);

  const nomePorColab = useMemo(() => new Map(colabs.map((c) => [c.id, c.nome])), [colabs]);
  const tagPorColab = useMemo(() => new Map(navy.map((n) => [n.colaborador_id, n.tag])), [navy]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada");
      if (!form.titulo.trim()) throw new Error("Informe o título do risco");
      const payload = {
        titulo: form.titulo.trim(),
        descricao: form.descricao,
        categoria: form.categoria,
        operacao: form.operacao,
        colaborador_id: form.colaborador_id || null,
        probabilidade: form.probabilidade,
        impacto: form.impacto,
        status: form.status,
        responsavel: form.responsavel,
        plano_acao: form.plano_acao,
        prazo: form.prazo || null,
      };
      if (editId) {
        const { error } = await supabase.from("riscos_operacionais").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("riscos_operacionais")
          .insert({ ...payload, user_id: user.id, origem: form.colaborador_id ? "navy_seal" : "manual" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Risco atualizado" : "Risco cadastrado");
      setOpen(false);
      setEditId(null);
      setForm({ ...emptyForm });
      qc.invalidateQueries({ queryKey: ["riscos_operacionais"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const mudarStatus = useMutation({
    mutationFn: async (p: { id: string; status: Status }) => {
      const { error } = await supabase.from("riscos_operacionais").update({ status: p.status }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acompanhamento atualizado");
      qc.invalidateQueries({ queryKey: ["riscos_operacionais"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("riscos_operacionais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Risco excluído");
      qc.invalidateQueries({ queryKey: ["riscos_operacionais"] });
    },
  });

  const abrirNovo = (pre?: Partial<typeof emptyForm>) => {
    setEditId(null);
    setForm({ ...emptyForm, ...pre });
    setOpen(true);
  };

  const abrirEdicao = (r: Risco) => {
    setEditId(r.id);
    setForm({
      titulo: r.titulo,
      descricao: r.descricao,
      categoria: r.categoria,
      operacao: r.operacao,
      colaborador_id: r.colaborador_id ?? "",
      probabilidade: r.probabilidade,
      impacto: r.impacto,
      status: (r.status as Status) ?? "identificado",
      responsavel: r.responsavel,
      plano_acao: r.plano_acao,
      prazo: r.prazo ?? "",
    });
    setOpen(true);
  };

  const drop = (status: Status) => {
    setDragOver(null);
    const id = dragging;
    setDragging(null);
    if (!id) return;
    const atual = riscos.find((r) => r.id === id);
    if (!atual || atual.status === status) return;
    mudarStatus.mutate({ id, status });
  };

  // Sugestões vindas do Kanban do NavySeal: C-Players ainda sem risco registrado
  const sugestoes = navy
    .filter((n) => n.tag === "c_player")
    .filter((n) => !riscos.some((r) => r.colaborador_id === n.colaborador_id))
    .map((n) => ({ id: n.colaborador_id, nome: nomePorColab.get(n.colaborador_id) ?? "", obs: n.observacoes }))
    .filter((s) => s.nome);

  const abertos = riscos.filter((r) => r.status !== "mitigado");
  const criticos = abertos.filter((r) => (r.severidade ?? 0) >= 15).length;
  const sevMedia = abertos.length
    ? abertos.reduce((s, r) => s + (r.severidade ?? 0), 0) / abertos.length
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Riscos abertos</p><p className="text-2xl font-semibold mt-1">{abertos.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Críticos</p><p className="text-2xl font-semibold mt-1 text-destructive">{criticos}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Severidade média</p><p className="text-2xl font-semibold mt-1">{num(sevMedia)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Mitigados</p><p className="text-2xl font-semibold mt-1 text-success">{riscos.length - abertos.length}</p></CardContent></Card>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Arraste o cartão para atualizar o acompanhamento. Severidade = probabilidade × impacto (1 a 25).
        </p>
        <Button onClick={() => abrirNovo()}>
          <Plus className="h-4 w-4 mr-2" /> Novo risco
        </Button>
      </div>

      {sugestoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-warning" /> Sugestões do NavySeal
            </CardTitle>
            <CardDescription>Colaboradores classificados como C-Player e ainda sem risco registrado</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {sugestoes.map((s) => (
              <Button
                key={s.id}
                variant="outline"
                size="sm"
                onClick={() =>
                  abrirNovo({
                    titulo: `Risco de performance — ${s.nome}`,
                    descricao: s.obs || "Colaborador classificado como C-Player no quadro NavySeal.",
                    categoria: "pessoas",
                    colaborador_id: s.id,
                    probabilidade: 4,
                    impacto: 4,
                  })
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> {s.nome}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {STATUSES.map((st) => {
          const lista = riscos
            .filter((r) => r.status === st)
            .sort((a, b) => (b.severidade ?? 0) - (a.severidade ?? 0));
          return (
            <div
              key={st}
              onDragOver={(e) => { e.preventDefault(); setDragOver(st); }}
              onDragLeave={() => setDragOver((p) => (p === st ? null : p))}
              onDrop={(e) => { e.preventDefault(); drop(st); }}
              className={cn(
                "rounded-lg border bg-muted/30 p-3 space-y-2 min-h-40 transition-colors",
                dragOver === st && "border-primary bg-primary/10",
              )}
            >
              <div className="flex items-center gap-2">
                <Badge className={STATUS_META[st].className}>{STATUS_META[st].label}</Badge>
                <span className="text-xs text-muted-foreground">({lista.length})</span>
              </div>
              {lista.length === 0 && <p className="text-xs text-muted-foreground">Solte aqui</p>}
              {lista.map((r) => {
                const n = nivel(r.severidade ?? 0);
                const tag = r.colaborador_id ? tagPorColab.get(r.colaborador_id) : null;
                return (
                  <div
                    key={r.id}
                    draggable
                    onDragStart={() => setDragging(r.id)}
                    onDragEnd={() => { setDragging(null); setDragOver(null); }}
                    className={cn(
                      "p-3 rounded-md border bg-card space-y-1.5 cursor-grab active:cursor-grabbing",
                      dragging === r.id && "opacity-50",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <p className="font-medium text-sm leading-snug flex-1">{r.titulo}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge className={n.cls}>{n.label} • {r.severidade ?? 0}</Badge>
                      <Badge variant="outline">{r.categoria}</Badge>
                      {r.operacao && <Badge variant="outline">{labelUnidade(r.operacao)}</Badge>}
                      {tag && <Badge className={NAVY_CLASS[tag]}>{NAVY_LABEL[tag]}</Badge>}
                    </div>
                    {r.colaborador_id && (
                      <p className="text-xs text-muted-foreground">
                        Colaborador: {nomePorColab.get(r.colaborador_id) ?? "-"}
                      </p>
                    )}
                    {r.descricao && <p className="text-xs text-muted-foreground line-clamp-3">{r.descricao}</p>}
                    {r.plano_acao && <p className="text-xs"><span className="text-muted-foreground">Ação:</span> {r.plano_acao}</p>}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {r.responsavel || "sem responsável"}
                        {r.prazo && ` • ${new Date(`${r.prazo}T00:00:00`).toLocaleDateString("pt-BR")}`}
                      </span>
                      <span className="flex gap-0.5">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => abrirEdicao(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => { if (window.confirm("Excluir este risco?")) excluir.mutate(r.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ ...emptyForm }); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar risco" : "Novo risco operacional"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Operação</Label>
                <Select value={form.operacao || "nenhuma"} onValueChange={(v) => setForm({ ...form, operacao: v === "nenhuma" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Todas / não se aplica</SelectItem>
                    {UNIDADES.map((u) => <SelectItem key={u.key} value={u.key}>{u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Colaborador (vínculo com o NavySeal)</Label>
              <Select
                value={form.colaborador_id || "nenhum"}
                onValueChange={(v) => setForm({ ...form, colaborador_id: v === "nenhum" ? "" : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  {colabs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                      {tagPorColab.get(c.id) ? ` — ${NAVY_LABEL[tagPorColab.get(c.id)!]}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Probabilidade (1-5)</Label>
                <Select value={String(form.probabilidade)} onValueChange={(v) => setForm({ ...form, probabilidade: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Impacto (1-5)</Label>
                <Select value={String(form.impacto)} onValueChange={(v) => setForm({ ...form, impacto: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Severidade</Label>
                <div className="h-9 flex items-center">
                  <Badge className={nivel(form.probabilidade * form.impacto).cls}>
                    {form.probabilidade * form.impacto} • {nivel(form.probabilidade * form.impacto).label}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prazo</Label>
                <Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
            </div>
            <div>
              <Label>Plano de ação / acompanhamento</Label>
              <Textarea value={form.plano_acao} onChange={(e) => setForm({ ...form, plano_acao: e.target.value })} />
            </div>
            <Button className="w-full" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
              {editId ? "Salvar alterações" : "Cadastrar risco"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
