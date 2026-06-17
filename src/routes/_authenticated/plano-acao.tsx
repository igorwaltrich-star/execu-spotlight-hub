import { createFileRoute } from "@tanstack/react-router";
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
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cadastro-operacional-view";

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

export const Route = createFileRoute("/_authenticated/plano-acao")({
  component: PlanoAcaoPage,
});

function statusColor(s: Status) {
  if (s === "concluido") return "bg-success text-success-foreground";
  if (s === "atrasado") return "bg-destructive text-destructive-foreground";
  return "bg-accent text-accent-foreground";
}
function statusLabel(s: Status) {
  return s === "concluido" ? "Concluído" : s === "atrasado" ? "Atrasado" : "Em andamento";
}

function PlanoAcaoPage() {
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

  const [iniciativa, setIniciativa] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [meta, setMeta] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [prazo, setPrazo] = useState("");
  const [status, setStatus] = useState<Status>("andamento");

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("plano_acao").insert({
        user_id: user.id,
        iniciativa,
        objetivo: objetivo || null,
        meta: meta || null,
        responsavel,
        prazo: prazo || null,
        status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Iniciativa adicionada");
      setIniciativa("");
      setObjetivo("");
      setMeta("");
      setResponsavel("");
      setPrazo("");
      setStatus("andamento");
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

  return (
    <>
      <PageHeader
        title="Plano de Ação 2026"
        description="Iniciativas estratégicas, responsáveis e status."
      />
      <div className="p-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Nova iniciativa</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-1 md:grid-cols-12 gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                add.mutate();
              }}
            >
              <div className="space-y-2 md:col-span-4">
                <Label>Iniciativa</Label>
                <Input
                  value={iniciativa}
                  onChange={(e) => setIniciativa(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-4">
                <Label>Objetivo</Label>
                <Input
                  value={objetivo}
                  onChange={(e) => setObjetivo(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-4">
                <Label>Meta</Label>
                <Input
                  value={meta}
                  onChange={(e) => setMeta(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-4">
                <Label>Responsável</Label>
                <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>Prazo</Label>
                <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
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
              <div className="flex items-end md:col-span-2">
                <Button type="submit" className="w-full" disabled={add.isPending}>
                  + Adicionar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Iniciativas</CardTitle>
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
                  <TableHead className="w-12" />
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
                      {r.prazo ? new Date(r.prazo).toLocaleDateString("pt-BR", { timeZone: 'UTC' }) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor(r.status)}>{statusLabel(r.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
