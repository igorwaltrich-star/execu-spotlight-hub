import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useColaboradores } from "./use-colaboradores";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex"];

type Row = {
  id: string;
  colaborador_id: string;
  dias_semana: string[];
  status: "ativo" | "pausado";
};

export function EscalaHomeOffice() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeTable("escala_home_office", ["escala_home_office"]);
  const { data: colabs = [] } = useColaboradores();

  const { data: rows = [] } = useQuery({
    queryKey: ["escala_home_office"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escala_home_office")
        .select("id, colaborador_id, dias_semana, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [open, setOpen] = useState(false);
  const [colaboradorId, setColaboradorId] = useState("");
  const [dias, setDias] = useState<string[]>([]);
  const [status, setStatus] = useState<"ativo" | "pausado">("ativo");

  const add = useMutation({
    mutationFn: async () => {
      if (!user || !colaboradorId) throw new Error("Selecione um colaborador");
      const { error } = await supabase
        .from("escala_home_office")
        .insert({ user_id: user.id, colaborador_id: colaboradorId, dias_semana: dias, status });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escala adicionada");
      qc.invalidateQueries({ queryKey: ["escala_home_office"] });
      setOpen(false);
      setColaboradorId("");
      setDias([]);
      setStatus("ativo");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("escala_home_office").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["escala_home_office"] }),
  });

  const nome = (id: string) => colabs.find((c) => c.id === id)?.nome ?? "—";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Escala Home Office</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova escala</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Colaborador</Label>
                <Select value={colaboradorId} onValueChange={setColaboradorId}>
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
                <Label>Dias em Home Office</Label>
                <div className="flex gap-3 mt-2">
                  {DIAS.map((d) => (
                    <label key={d} className="flex items-center gap-1 text-sm">
                      <Checkbox
                        checked={dias.includes(d)}
                        onCheckedChange={(c) =>
                          setDias((prev) => (c ? [...prev, d] : prev.filter((x) => x !== d)))
                        }
                      />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as never)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => add.mutate()} disabled={add.isPending} className="w-full">
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Dias em Home Office</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  Sem escalas cadastradas
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{nome(r.colaborador_id)}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {r.dias_semana.map((d) => (
                      <Badge key={d} variant="secondary">
                        {d}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={r.status === "ativo" ? "default" : "outline"}>
                    {r.status === "ativo" ? "Ativo" : "Pausado"}
                  </Badge>
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
  );
}
