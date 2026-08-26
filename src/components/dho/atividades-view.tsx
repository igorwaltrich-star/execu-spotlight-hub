import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type Atividade = {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: string;
  owner_id?: string;
  prioridade: string;
  start_date?: string;
  due_date?: string;
  recorrencia?: string;
  status: string;
  observacoes?: string;
  created_by?: string;
};

const PRIORIDADES = [
  { v: "baixa", l: "Baixa" },
  { v: "media", l: "Média" },
  { v: "alta", l: "Alta" },
  { v: "critica", l: "Crítica" },
];
const TIPOS = [
  { v: "rotineira", l: "Rotineira" },
  { v: "prazo", l: "Com prazo" },
  { v: "projeto", l: "Projeto" },
  { v: "pdi", l: "PDI" },
];
const STATUS_LIST = [
  { v: "nao_iniciada", l: "Não iniciada", cls: "bg-muted text-muted-foreground border-0" },
  { v: "em_andamento", l: "Em andamento", cls: "bg-primary/10 text-primary border-0" },
  { v: "concluida", l: "Concluída", cls: "bg-success/10 text-success border-0" },
  { v: "atrasada", l: "Atrasada", cls: "bg-destructive/10 text-destructive border-0" },
  { v: "cancelada", l: "Cancelada", cls: "bg-muted text-muted-foreground border-0 line-through" },
  { v: "bloqueada", l: "Bloqueada", cls: "bg-warning/10 text-warning border-0" },
];
const PRIORIDADE_CLS: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground border-0",
  media: "bg-primary/10 text-primary border-0",
  alta: "bg-warning/10 text-warning border-0",
  critica: "bg-destructive/10 text-destructive border-0",
};

const emptyForm = {
  titulo: "",
  descricao: "",
  tipo: "rotineira",
  prioridade: "media",
  start_date: "",
  due_date: "",
  recorrencia: "",
  status: "nao_iniciada",
  observacoes: "",
};
const fmtDate = (d?: string) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

export function AtividadesView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [filtroPrio, setFiltroPrio] = useState("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: atividades = [] } = useQuery({
    queryKey: ["atividades", filtroStatus, filtroPrio],
    queryFn: async () => {
      let q = supabase.from("atividades").select("*").order("prioridade").order("due_date");
      if (filtroStatus !== "all") q = q.eq("status", filtroStatus);
      if (filtroPrio !== "all") q = q.eq("prioridade", filtroPrio);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Atividade[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !form.titulo) throw new Error("Título obrigatório");
      const payload = {
        ...form,
        created_by: user.id,
        owner_id: user.id,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
        recorrencia: form.recorrencia || null,
      };
      if (editId) {
        const { error } = await supabase.from("atividades").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("atividades").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Atualizado" : "Criado");
      qc.invalidateQueries({ queryKey: ["atividades"] });
      setOpen(false);
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("atividades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["atividades"] });
    },
  });

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("atividades").update({ status }).eq("id", id);
    if (!error) qc.invalidateQueries({ queryKey: ["atividades"] });
  };

  const startEdit = (a: Atividade) => {
    setForm({
      titulo: a.titulo,
      descricao: a.descricao ?? "",
      tipo: a.tipo,
      prioridade: a.prioridade,
      start_date: a.start_date ?? "",
      due_date: a.due_date ?? "",
      recorrencia: a.recorrencia ?? "",
      status: a.status,
      observacoes: a.observacoes ?? "",
    });
    setEditId(a.id);
    setOpen(true);
  };

  const kpis = {
    total: atividades.length,
    concluidas: atividades.filter((a) => a.status === "concluida").length,
    atrasadas: atividades.filter((a) => a.status === "atrasada").length,
    andamento: atividades.filter((a) => a.status === "em_andamento").length,
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Atividades</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestão de atividades rotineiras e com prazo
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setForm(emptyForm);
            setEditId(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" /> Nova Atividade
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { l: "Total", v: kpis.total, icon: CheckCircle2, cls: "" },
          { l: "Em andamento", v: kpis.andamento, icon: Clock, cls: "text-primary" },
          { l: "Concluídas", v: kpis.concluidas, icon: CheckCircle2, cls: "text-success" },
          { l: "Atrasadas", v: kpis.atrasadas, icon: AlertCircle, cls: "text-destructive" },
        ].map(({ l, v, icon: Icon, cls }) => (
          <Card key={l}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">{l}</span>
                <Icon className={`h-4 w-4 ${cls || "text-muted-foreground"}`} />
              </div>
              <div className={`text-2xl font-semibold ${cls}`}>{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS_LIST.map((s) => (
              <SelectItem key={s.v} value={s.v}>
                {s.l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroPrio} onValueChange={setFiltroPrio}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {PRIORIDADES.map((p) => (
              <SelectItem key={p.v} value={p.v}>
                {p.l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Recorrência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {atividades.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    Nenhuma atividade cadastrada
                  </TableCell>
                </TableRow>
              )}
              {atividades.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{a.titulo}</div>
                    {a.descricao && (
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {a.descricao}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {TIPOS.find((t) => t.v === a.tipo)?.l}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={PRIORIDADE_CLS[a.prioridade]}>
                      {PRIORIDADES.find((p) => p.v === a.prioridade)?.l}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-sm ${a.status === "atrasada" ? "text-destructive font-medium" : ""}`}
                  >
                    {fmtDate(a.due_date)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.recorrencia ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Select value={a.status} onValueChange={(v) => updateStatus(a.id, v)}>
                      <SelectTrigger className="h-7 w-36 text-xs">
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
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(a)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            setEditId(null);
            setForm(emptyForm);
          }
          setOpen(v);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar atividade" : "Nova atividade"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.v} value={t.v}>
                        {t.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select
                  value={form.prioridade}
                  onValueChange={(v) => setForm((f) => ({ ...f, prioridade: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((p) => (
                      <SelectItem key={p.v} value={p.v}>
                        {p.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                <Label>Recorrência</Label>
                <Select
                  value={form.recorrencia || "none"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, recorrencia: v === "none" ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem recorrência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem recorrência</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quinzenal">Quinzenal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
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
                    {STATUS_LIST.map((s) => (
                      <SelectItem key={s.v} value={s.v}>
                        {s.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                rows={2}
              />
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
