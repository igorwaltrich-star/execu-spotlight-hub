import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Status = "andamento" | "concluido" | "atrasado";
type Row = {
  id: string;
  iniciativa: string;
  objetivo: string | null;
  meta: string | null;
  responsavel: string;
  prazo: string | null;
  status: Status;
};

type Form = {
  iniciativa: string;
  objetivo: string;
  meta: string;
  responsavel: string;
  prazo: string;
  status: Status;
};

const emptyForm: Form = {
  iniciativa: "",
  objetivo: "",
  meta: "",
  responsavel: "",
  prazo: "",
  status: "andamento",
};

function statusColor(s: Status) {
  if (s === "concluido") return "bg-success text-success-foreground";
  if (s === "atrasado") return "bg-destructive text-destructive-foreground";
  return "bg-accent text-accent-foreground";
}
function statusLabel(s: Status) {
  return s === "concluido" ? "Concluído" : s === "atrasado" ? "Atrasado" : "Em andamento";
}

export function PlanoAcaoEstrategico() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["plano_acao"];
  useRealtimeTable("plano_acao", queryKey);

  const { data: rows = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plano_acao")
        .select("*")
        .order("prazo", { ascending: true });
      if (error) throw error;
      return data as Row[];
    },
  });

  const [form, setForm] = useState<Form>(emptyForm);
  const [editing, setEditing] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState<Form>(emptyForm);

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("plano_acao").insert({
        user_id: user.id,
        iniciativa: form.iniciativa,
        objetivo: form.objetivo || null,
        meta: form.meta || null,
        responsavel: form.responsavel,
        prazo: form.prazo || null,
        status: form.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Iniciativa adicionada");
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("plano_acao")
        .update({
          iniciativa: editForm.iniciativa,
          objetivo: editForm.objetivo || null,
          meta: editForm.meta || null,
          responsavel: editForm.responsavel,
          prazo: editForm.prazo || null,
          status: editForm.status,
        })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Iniciativa atualizada");
      setEditing(null);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plano_acao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  function openEdit(r: Row) {
    setEditing(r);
    setEditForm({
      iniciativa: r.iniciativa,
      objetivo: r.objetivo ?? "",
      meta: r.meta ?? "",
      responsavel: r.responsavel ?? "",
      prazo: r.prazo ?? "",
      status: r.status,
    });
  }

  const fields = (f: Form, set: (v: Form) => void) => (
    <>
      <div className="space-y-2 md:col-span-4">
        <Label>Iniciativa</Label>
        <Input value={f.iniciativa} onChange={(e) => set({ ...f, iniciativa: e.target.value })} required />
      </div>
      <div className="space-y-2 md:col-span-4">
        <Label>Objetivo</Label>
        <Input value={f.objetivo} onChange={(e) => set({ ...f, objetivo: e.target.value })} />
      </div>
      <div className="space-y-2 md:col-span-4">
        <Label>Meta</Label>
        <Input value={f.meta} onChange={(e) => set({ ...f, meta: e.target.value })} />
      </div>
      <div className="space-y-2 md:col-span-4">
        <Label>Responsável</Label>
        <Input value={f.responsavel} onChange={(e) => set({ ...f, responsavel: e.target.value })} />
      </div>
      <div className="space-y-2 md:col-span-4">
        <Label>Prazo</Label>
        <Input type="date" value={f.prazo} onChange={(e) => set({ ...f, prazo: e.target.value })} />
      </div>
      <div className="space-y-2 md:col-span-4">
        <Label>Status</Label>
        <Select value={f.status} onValueChange={(v) => set({ ...f, status: v as Status })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="andamento">Em andamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="atrasado">Atrasado</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nova iniciativa estratégica</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 md:grid-cols-12 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            {fields(form, setForm)}
            <div className="flex items-end md:col-span-12">
              <Button type="submit" disabled={add.isPending}>
                + Adicionar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plano de Ação Estratégico</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Iniciativa</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Meta</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Sem iniciativas.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.iniciativa}</TableCell>
                  <TableCell>{r.objetivo || "—"}</TableCell>
                  <TableCell>{r.meta || "—"}</TableCell>
                  <TableCell>{r.responsavel || "—"}</TableCell>
                  <TableCell>
                    {r.prazo ? new Date(r.prazo).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColor(r.status)}>{statusLabel(r.status)}</Badge>
                  </TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)} aria-label="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar iniciativa</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {fields(editForm, setEditForm)}
          </div>
          <Button onClick={() => update.mutate()} disabled={update.isPending} className="w-full">
            Salvar alterações
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
