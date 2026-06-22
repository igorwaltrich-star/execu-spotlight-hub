import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
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
} from "@/components/ui/dialog";
import { Plus, Trash2, Download, Upload, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useColaboradores } from "./use-colaboradores";

export function CadastroColaboradores() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeTable("colaboradores", ["colaboradores"]);
  const { data: rows = [] } = useColaboradores();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [area, setArea] = useState("");

  const resetForm = () => { setNome(""); setCargo(""); setArea(""); };

  const handleClose = (v: boolean) => {
    if (!v) { setEditId(null); resetForm(); }
    setOpen(v);
  };

  const startEdit = (r: { id: string; nome: string; cargo: string; area: string }) => {
    setNome(r.nome);
    setCargo(r.cargo ?? "");
    setArea(r.area ?? "");
    setEditId(r.id);
    setOpen(true);
  };

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
      setOpen(false); resetForm();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      if (!nome) throw new Error("Nome obrigatório");
      const { error } = await supabase
        .from("colaboradores")
        .update({ nome, cargo, area })
        .eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Colaborador atualizado");
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
      setOpen(false); setEditId(null); resetForm();
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

  const importar = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Não autenticado");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const norm = (k: string) => k.toString().trim().toLowerCase();
      const records = json
        .map((r) => {
          const entries: Record<string, string> = {};
          Object.entries(r).forEach(([k, v]) => {
            entries[norm(k)] = String(v ?? "").trim();
          });
          return {
            user_id: user.id,
            nome: entries.nome || entries.colaborador || "",
            cargo: entries.cargo || "",
            area: entries["área"] || entries.area || "",
          };
        })
        .filter((r) => r.nome);
      if (records.length === 0) throw new Error("Nenhuma linha válida (coluna 'nome' obrigatória)");
      const { error } = await supabase.from("colaboradores").insert(records);
      if (error) throw error;
      return records.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} colaborador(es) importado(s)`);
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao importar"),
  });

  const baixarModelo = () => {
    const ws = XLSX.utils.json_to_sheet([
      { nome: "João Silva", cargo: "Analista", area: "Operações" },
      { nome: "Maria Souza", cargo: "Coordenadora", area: "Logística" },
    ]);
    ws["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");
    XLSX.writeFile(wb, "modelo-colaboradores.xlsx");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle>Colaboradores</CardTitle>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={baixarModelo}>
            <Download className="h-4 w-4 mr-1" />Modelo
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={importar.isPending}>
            <Upload className="h-4 w-4 mr-1" />{importar.isPending ? "Importando..." : "Importar"}
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importar.mutate(f); e.target.value = ""; }} />
          <Button size="sm" onClick={() => { resetForm(); setEditId(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Adicionar
          </Button>
        </div>
      </CardHeader>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar colaborador" : "Novo colaborador"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><Label>Cargo</Label><Input value={cargo} onChange={(e) => setCargo(e.target.value)} /></div>
            <div><Label>Área</Label><Input value={area} onChange={(e) => setArea(e.target.value)} /></div>
            <Button onClick={() => editId ? update.mutate() : add.mutate()}
              disabled={add.isPending || update.isPending} className="w-full">
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Área</TableHead>
              <TableHead className="w-20"></TableHead>
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
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
