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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Users, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { ImportarPlanilha, buscarPorNome } from "@/components/importar-planilha";

type Equipe = { id: string; nome: string; descricao?: string; gestor_id?: string; ativo: boolean };
type Membro = { id: string; equipe_id: string; user_id: string; ativo: boolean };

export function EquipesView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: colabs = [] } = useColaboradores();
  const [open, setOpen] = useState(false);
  const [openMembros, setOpenMembros] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selEquipe, setSelEquipe] = useState<Equipe | null>(null);
  const [newMembroId, setNewMembroId] = useState("");
  const [form, setForm] = useState({ nome: "", descricao: "", gestor_id: "" });

  const { data: equipes = [] } = useQuery({
    queryKey: ["equipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipes")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Equipe[];
    },
  });

  const { data: membros = [] } = useQuery({
    queryKey: ["membros_equipe"],
    queryFn: async () => {
      const { data, error } = await supabase.from("membros_equipe").select("*").eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as Membro[];
    },
  });

  const nome = (id?: string) => (id ? (colabs.find((c) => c.id === id)?.nome ?? "—") : "—");
  const membrosEquipe = (eid: string) => membros.filter((m) => m.equipe_id === eid);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.nome) throw new Error("Nome obrigatório");
      const p = {
        nome: form.nome,
        descricao: form.descricao || null,
        gestor_id: form.gestor_id || null,
        ativo: true,
      };
      if (editId) {
        const { error } = await supabase.from("equipes").update(p).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("equipes").insert(p);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Atualizada" : "Equipe criada");
      qc.invalidateQueries({ queryKey: ["equipes"] });
      setOpen(false);
      setEditId(null);
      setForm({ nome: "", descricao: "", gestor_id: "" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const delEquipe = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipes").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Equipe removida");
      qc.invalidateQueries({ queryKey: ["equipes"] });
    },
  });

  const addMembro = useMutation({
    mutationFn: async () => {
      if (!selEquipe || !newMembroId) throw new Error("Selecione um colaborador");
      const { error } = await supabase.from("membros_equipe").upsert(
        {
          equipe_id: selEquipe.id,
          user_id: newMembroId,
          ativo: true,
          data_entrada: new Date().toISOString().slice(0, 10),
        },
        { onConflict: "equipe_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membro adicionado");
      qc.invalidateQueries({ queryKey: ["membros_equipe"] });
      setNewMembroId("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const remMembro = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("membros_equipe").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membro removido");
      qc.invalidateQueries({ queryKey: ["membros_equipe"] });
    },
  });

  const startEdit = (e: Equipe) => {
    setForm({ nome: e.nome, descricao: e.descricao ?? "", gestor_id: e.gestor_id ?? "" });
    setEditId(e.id);
    setOpen(true);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Equipes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestão de equipes e membros</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ImportarPlanilha
            nomeArquivo="equipes"
            tabela="equipes"
            invalidar={["equipes"]}
            ajuda="O gestor deve existir no cadastro de colaboradores. Os membros sao adicionados depois, pelo botao Gerenciar."
            campos={[
              { coluna: "Nome", exemplo: "Importacao", obrigatorio: true, largura: 24 },
              { coluna: "Descricao", exemplo: "", largura: 34 },
              { coluna: "Gestor", exemplo: "", largura: 24 },
            ]}
            montarRegistro={(l) => {
              const g = l.gestor ? buscarPorNome(colabs, l.gestor) : undefined;
              if (l.gestor && !g) return { ok: false, erro: `Gestor "${l.gestor}" nao encontrado` };
              return {
                ok: true,
                registro: {
                  nome: l.nome,
                  descricao: l.descricao || null,
                  gestor_id: g?.id ?? null,
                  ativo: true,
                },
              };
            }}
          />
          <Button
            size="sm"
            onClick={() => {
              setForm({ nome: "", descricao: "", gestor_id: "" });
              setEditId(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nova Equipe
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {equipes.length === 0 && (
          <p className="col-span-3 text-center text-muted-foreground py-10">
            Nenhuma equipe cadastrada
          </p>
        )}
        {equipes.map((e) => {
          const mem = membrosEquipe(e.id);
          return (
            <Card key={e.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{e.nome}</CardTitle>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(e)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => delEquipe.mutate(e.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {e.gestor_id && <CardDescription>Gestor: {nome(e.gestor_id)}</CardDescription>}
                {e.descricao && <p className="text-xs text-muted-foreground mt-1">{e.descricao}</p>}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Membros ({mem.length})
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs"
                    onClick={() => {
                      setSelEquipe(e);
                      setOpenMembros(true);
                    }}
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    Gerenciar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {mem.length === 0 && (
                    <span className="text-xs text-muted-foreground">Nenhum membro</span>
                  )}
                  {mem.slice(0, 4).map((m) => (
                    <Badge key={m.id} variant="secondary" className="text-[10px]">
                      {nome(m.user_id)}
                    </Badge>
                  ))}
                  {mem.length > 4 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{mem.length - 4}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) setEditId(null);
          setOpen(v);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar equipe" : "Nova equipe"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
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
            <div>
              <Label>Gestor responsável</Label>
              <Select
                value={form.gestor_id || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, gestor_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
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
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openMembros} onOpenChange={setOpenMembros}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Membros — {selEquipe?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Select value={newMembroId} onValueChange={setNewMembroId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Adicionar colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {colabs
                    .filter(
                      (c) =>
                        !membros.find((m) => m.equipe_id === selEquipe?.id && m.user_id === c.id),
                    )
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => addMembro.mutate()}
                disabled={!newMembroId || addMembro.isPending}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {selEquipe && membrosEquipe(selEquipe.id).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum membro</p>
              )}
              {selEquipe &&
                membrosEquipe(selEquipe.id).map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded border">
                    <span className="text-sm">{nome(m.user_id)}</span>
                    <Button size="icon" variant="ghost" onClick={() => remMembro.mutate(m.id)}>
                      <UserMinus className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
