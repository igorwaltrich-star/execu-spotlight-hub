import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useColaboradores } from "./use-colaboradores";

export function CadastroColaboradores() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeTable("colaboradores", ["colaboradores"]);
  const { data: rows = [] } = useColaboradores();

  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [area, setArea] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!nome) throw new Error("Nome obrigatório");
      const { error } = await supabase
        .from("colaboradores")
        .insert({ user_id: user.id, nome, cargo, area });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Colaborador adicionado");
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
      setOpen(false);
      setNome("");
      setCargo("");
      setArea("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("colaboradores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["colaboradores"] }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Colaboradores</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo colaborador</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div>
                <Label>Cargo</Label>
                <Input value={cargo} onChange={(e) => setCargo(e.target.value)} />
              </div>
              <div>
                <Label>Área</Label>
                <Input value={area} onChange={(e) => setArea(e.target.value)} />
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
              <TableHead>Nome</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Área</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  Nenhum colaborador cadastrado
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell>{r.cargo}</TableCell>
                <TableCell>{r.area}</TableCell>
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
