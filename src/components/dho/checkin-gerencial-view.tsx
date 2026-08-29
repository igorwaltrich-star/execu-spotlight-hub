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
import {
  Plus,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

type CheckIn = {
  id: string;
  data: string;
  frequencia: string;
  status: string;
  gestor_id: string;
  participantes: string[];
  pauta_previa?: Record<string, unknown>;
  observacoes?: string;
};
type Item = {
  id: string;
  checkin_id: string;
  titulo: string;
  tipo: string;
  discussao?: string;
  decisao?: string;
  responsavel_id?: string;
  prazo?: string;
  status_acompanhamento: string;
};

const STATUS_CK = {
  agendado: { l: "Agendado", cls: "bg-primary/10 text-primary border-0" },
  realizado: { l: "Realizado", cls: "bg-success/10 text-success border-0" },
  cancelado: { l: "Cancelado", cls: "bg-muted text-muted-foreground border-0" },
  reagendado: { l: "Reagendado", cls: "bg-warning/10 text-warning border-0" },
};
const STATUS_ITEM = {
  aberto: { l: "Aberto", cls: "bg-muted text-muted-foreground border-0", icon: Clock },
  concluido: { l: "Concluído", cls: "bg-success/10 text-success border-0", icon: CheckCircle },
  atrasado: {
    l: "Atrasado",
    cls: "bg-destructive/10 text-destructive border-0",
    icon: AlertTriangle,
  },
};

const emptyCheckin = {
  data: new Date().toISOString().slice(0, 10),
  frequencia: "semanal",
  observacoes: "",
};
const emptyItem = {
  titulo: "",
  tipo: "pauta",
  discussao: "",
  decisao: "",
  responsavel_id: "",
  prazo: "",
};

export function CheckinGerencialView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: colabs = [] } = useColaboradores();
  const [openCk, setOpenCk] = useState(false);
  const [openItem, setOpenItem] = useState(false);
  const [selCkId, setSelCkId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ckForm, setCkForm] = useState(emptyCheckin);
  const [itemForm, setItemForm] = useState(emptyItem);

  const { data: checkins = [] } = useQuery({
    queryKey: ["checkins_gerenciais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkins_gerenciais")
        .select("*")
        .order("data", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as CheckIn[];
    },
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["checkin_gerencial_itens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkin_gerencial_itens")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const nome = (id?: string) => (id ? (colabs.find((c) => c.id === id)?.nome ?? "—") : "—");
  const itensCk = (ckId: string) => itens.filter((i) => i.checkin_id === ckId);
  const encAbertos = itens.filter(
    (i) => i.tipo === "encaminhamento" && i.status_acompanhamento === "aberto",
  );

  const saveCk = useMutation({
    mutationFn: async () => {
      if (!user || !ckForm.data) throw new Error("Data obrigatória");
      const { error } = await supabase.from("checkins_gerenciais").insert({
        gestor_id: user.id,
        data: ckForm.data,
        frequencia: ckForm.frequencia,
        status: "agendado",
        observacoes: ckForm.observacoes || null,
        participantes: [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Check IN criado");
      qc.invalidateQueries({ queryKey: ["checkins_gerenciais"] });
      setOpenCk(false);
      setCkForm(emptyCheckin);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("checkins_gerenciais").update({ status }).eq("id", id);
    if (!error) {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["checkins_gerenciais"] });
    }
  };

  const saveItem = useMutation({
    mutationFn: async () => {
      if (!selCkId || !itemForm.titulo) throw new Error("Título obrigatório");
      const { error } = await supabase.from("checkin_gerencial_itens").insert({
        checkin_id: selCkId,
        titulo: itemForm.titulo,
        tipo: itemForm.tipo,
        discussao: itemForm.discussao || null,
        decisao: itemForm.decisao || null,
        responsavel_id: itemForm.responsavel_id || null,
        prazo: itemForm.prazo || null,
        status_acompanhamento: "aberto",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item adicionado");
      qc.invalidateQueries({ queryKey: ["checkin_gerencial_itens"] });
      setOpenItem(false);
      setItemForm(emptyItem);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const updateItemStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("checkin_gerencial_itens")
      .update({ status_acompanhamento: status })
      .eq("id", id);
    if (!error) qc.invalidateQueries({ queryKey: ["checkin_gerencial_itens"] });
  };

  const TIPO_CLS: Record<string, string> = {
    pauta: "bg-primary/10 text-primary",
    encaminhamento: "bg-warning/10 text-warning",
    acompanhamento: "bg-muted text-muted-foreground",
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Check IN Gerencial</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Reuniões estruturadas com pauta, decisões e encaminhamentos
          </p>
        </div>
        <Button size="sm" onClick={() => setOpenCk(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nova Reunião
        </Button>
      </div>

      {/* Encaminhamentos abertos */}
      {encAbertos.length > 0 && (
        <Card className="border-warning">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Encaminhamentos abertos ({encAbertos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {encAbertos.slice(0, 5).map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between gap-3 p-2 rounded border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{i.titulo}</div>
                    {i.responsavel_id && (
                      <div className="text-xs text-muted-foreground">
                        Responsável: {nome(i.responsavel_id)}
                      </div>
                    )}
                    {i.prazo && (
                      <div className="text-xs text-warning">
                        Prazo: {new Date(i.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => updateItemStatus(i.id, "concluido")}
                    >
                      Concluir
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive"
                      onClick={() => updateItemStatus(i.id, "atrasado")}
                    >
                      Atrasado
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de reuniões */}
      <div className="space-y-3">
        {checkins.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <div>Nenhuma reunião registrada</div>
            </CardContent>
          </Card>
        )}
        {checkins.map((ck) => {
          const st = STATUS_CK[ck.status as keyof typeof STATUS_CK] ?? STATUS_CK.agendado;
          const itensDoCk = itensCk(ck.id);
          const expanded = expandedId === ck.id;
          return (
            <Card key={ck.id}>
              <CardHeader
                className="pb-2 cursor-pointer"
                onClick={() => setExpandedId(expanded ? null : ck.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <CardTitle className="text-sm">
                        {new Date(ck.data + "T00:00:00").toLocaleDateString("pt-BR", {
                          weekday: "long",
                          day: "2-digit",
                          month: "long",
                        })}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {ck.frequencia} · {itensDoCk.length} item(ns)
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={st.cls}>{st.l}</Badge>
                    <Select value={ck.status} onValueChange={(v) => updateStatus(ck.id, v)}>
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CK).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v.l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>

              {expanded && (
                <CardContent className="space-y-3">
                  {ck.observacoes && (
                    <p className="text-sm text-muted-foreground border-l-2 border-muted pl-3">
                      {ck.observacoes}
                    </p>
                  )}

                  {itensDoCk.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-3">
                      Nenhum item. Adicione itens de pauta ou encaminhamentos.
                    </p>
                  )}

                  {itensDoCk.map((it) => {
                    const ist =
                      STATUS_ITEM[it.status_acompanhamento as keyof typeof STATUS_ITEM] ??
                      STATUS_ITEM.aberto;
                    const IstIcon = ist.icon;
                    return (
                      <div key={it.id} className="p-3 rounded-lg border space-y-1.5">
                        <div className="flex items-start gap-2 justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-medium ${TIPO_CLS[it.tipo]}`}
                            >
                              {it.tipo}
                            </span>
                            <span className="text-sm font-medium">{it.titulo}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <IstIcon className={`h-3.5 w-3.5 ${ist.cls.split(" ")[1]}`} />
                            <Badge className={`${ist.cls} text-[10px]`}>{ist.l}</Badge>
                          </div>
                        </div>
                        {it.discussao && (
                          <p className="text-xs text-muted-foreground pl-2 border-l border-muted">
                            📝 {it.discussao}
                          </p>
                        )}
                        {it.decisao && (
                          <p className="text-xs text-primary pl-2 border-l-2 border-primary">
                            ✅ {it.decisao}
                          </p>
                        )}
                        {it.tipo === "encaminhamento" && (
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            {it.responsavel_id && <span>👤 {nome(it.responsavel_id)}</span>}
                            {it.prazo && (
                              <span>
                                📅 {new Date(it.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                              </span>
                            )}
                            {it.status_acompanhamento === "aberto" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 text-xs text-success p-0"
                                onClick={() => updateItemStatus(it.id, "concluido")}
                              >
                                Marcar concluído
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSelCkId(ck.id);
                      setItemForm(emptyItem);
                      setOpenItem(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Adicionar item
                  </Button>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Dialog nova reunião */}
      <Dialog open={openCk} onOpenChange={setOpenCk}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova reunião gerencial</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Data da reunião *</Label>
              <Input
                type="date"
                value={ckForm.data}
                onChange={(e) => setCkForm((f) => ({ ...f, data: e.target.value }))}
              />
            </div>
            <div>
              <Label>Frequência</Label>
              <Select
                value={ckForm.frequencia}
                onValueChange={(v) => setCkForm((f) => ({ ...f, frequencia: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações gerais</Label>
              <Textarea
                value={ckForm.observacoes}
                onChange={(e) => setCkForm((f) => ({ ...f, observacoes: e.target.value }))}
                rows={3}
                placeholder="Pauta prévia, contexto..."
              />
            </div>
            <Button onClick={() => saveCk.mutate()} disabled={saveCk.isPending} className="w-full">
              {saveCk.isPending ? "Criando..." : "Criar reunião"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog novo item */}
      <Dialog open={openItem} onOpenChange={setOpenItem}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar item à reunião</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select
                value={itemForm.tipo}
                onValueChange={(v) => setItemForm((f) => ({ ...f, tipo: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pauta">Pauta</SelectItem>
                  <SelectItem value="encaminhamento">Encaminhamento</SelectItem>
                  <SelectItem value="acompanhamento">Acompanhamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título / Assunto *</Label>
              <Input
                value={itemForm.titulo}
                onChange={(e) => setItemForm((f) => ({ ...f, titulo: e.target.value }))}
              />
            </div>
            <div>
              <Label>Discussão / Observações</Label>
              <Textarea
                value={itemForm.discussao}
                onChange={(e) => setItemForm((f) => ({ ...f, discussao: e.target.value }))}
                rows={2}
              />
            </div>
            <div>
              <Label>Decisão tomada</Label>
              <Input
                value={itemForm.decisao}
                onChange={(e) => setItemForm((f) => ({ ...f, decisao: e.target.value }))}
                placeholder="Resultado da discussão"
              />
            </div>
            {itemForm.tipo === "encaminhamento" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Responsável</Label>
                  <Select
                    value={itemForm.responsavel_id || "none"}
                    onValueChange={(v) =>
                      setItemForm((f) => ({ ...f, responsavel_id: v === "none" ? "" : v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {colabs.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prazo</Label>
                  <Input
                    type="date"
                    value={itemForm.prazo}
                    onChange={(e) => setItemForm((f) => ({ ...f, prazo: e.target.value }))}
                  />
                </div>
              </div>
            )}
            <Button
              onClick={() => saveItem.mutate()}
              disabled={saveItem.isPending}
              className="w-full"
            >
              {saveItem.isPending ? "Salvando..." : "Salvar item"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
