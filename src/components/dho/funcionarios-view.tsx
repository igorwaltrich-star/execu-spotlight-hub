import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useColaboradores } from "@/components/gestao/use-colaboradores";
import { UNIDADES } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2, UserCheck, ShieldCheck } from "lucide-react";
import { usePerfil, type Papel } from "@/hooks/use-perfil";
import { ImportarPlanilha } from "@/components/importar-planilha";
import { toast } from "sonner";

type Colab = { id: string; nome: string; cargo?: string; area?: string };

const ROLES = [
  { v: "gestor", l: "Gestor" },
  { v: "coordenador", l: "Coordenador" },
  { v: "supervisor", l: "Supervisor" },
  { v: "analista", l: "Analista" },
];
const CONTRATOS = ["CLT", "PJ", "SALDO_LIVRE"];
const ROLE_CLS: Record<string, string> = {
  gestor: "bg-primary/10 text-primary border-0",
  coordenador: "bg-accent/10 text-accent-foreground border-0",
  supervisor: "bg-warning/10 text-warning border-0",
  analista: "bg-muted text-muted-foreground border-0",
};

const emptyForm = {
  nome: "",
  cargo: "",
  area: "",
  operacao: "",
  tipo_contrato: "CLT",
  data_entrada: new Date().toISOString().slice(0, 10),
};

type PerfilRow = { id: string; nome: string; cargo: string | null; role: Papel; ativo: boolean };

export function FuncionariosView() {
  const { user } = useAuth();
  const { eGestor } = usePerfil();
  const qc = useQueryClient();
  const { data: colabs = [] } = useColaboradores();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  const [form, setForm] = useState(emptyForm);

  const { data: perfis = [] } = useQuery({
    queryKey: ["perfis_sistema"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,nome,cargo,role,ativo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as PerfilRow[];
    },
    enabled: eGestor,
  });

  const alterarPapel = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Papel }) => {
      const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["perfis_sistema"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao alterar perfil"),
  });

  const filtered = colabs.filter(
    (c) =>
      !filtro ||
      c.nome.toLowerCase().includes(filtro.toLowerCase()) ||
      (c.cargo ?? "").toLowerCase().includes(filtro.toLowerCase()),
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !form.nome) throw new Error("Nome obrigatório");
      if (editId) {
        const { error } = await supabase
          .from("colaboradores")
          .update({
            nome: form.nome,
            cargo: form.cargo || null,
            area: form.operacao || form.area || null,
          })
          .eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("colaboradores").insert({
          user_id: user.id,
          nome: form.nome,
          cargo: form.cargo || null,
          area: form.operacao || form.area || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Atualizado" : "Funcionário adicionado");
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
      setOpen(false);
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("colaboradores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
    },
  });

  const startEdit = (c: Colab) => {
    setForm({
      nome: c.nome,
      cargo: c.cargo ?? "",
      area: c.area ?? "",
      operacao: c.area ?? "",
      tipo_contrato: "CLT",
      data_entrada: "",
    });
    setEditId(c.id);
    setOpen(true);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Funcionários</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cadastro de colaboradores da equipe
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ImportarPlanilha
            nomeArquivo="funcionarios"
            tabela="colaboradores"
            invalidar={["colaboradores"]}
            ajuda="Operacao aceita o rotulo (Midea SC) ou a chave (midea_sc)."
            campos={[
              { coluna: "Nome", exemplo: "Nome completo", obrigatorio: true, largura: 28 },
              { coluna: "Cargo", exemplo: "Analista de Importacao", largura: 26 },
              { coluna: "Operacao", exemplo: "Midea SC", largura: 16 },
            ]}
            montarRegistro={(l) => {
              let area: string | null = null;
              if (l.operacao) {
                const op = UNIDADES.find(
                  (u) =>
                    u.key === l.operacao.toLowerCase() ||
                    u.label.toLowerCase() === l.operacao.toLowerCase(),
                );
                if (!op) return { ok: false, erro: `Operacao "${l.operacao}" nao reconhecida` };
                area = op.key;
              }
              return {
                ok: true,
                registro: { user_id: user?.id, nome: l.nome, cargo: l.cargo || null, area },
              };
            }}
          />
          <Button
            size="sm"
            onClick={() => {
              setForm(emptyForm);
              setEditId(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Novo Funcionário
          </Button>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <Input
          placeholder="Buscar por nome ou cargo..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="max-w-sm"
        />
        <Badge variant="secondary">{filtered.length} colaborador(es)</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Operação / Área</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                    Nenhum colaborador encontrado
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{c.cargo ?? "—"}</TableCell>
                  <TableCell>
                    {c.area ? (
                      <Badge variant="outline" className="text-[10px]">
                        {UNIDADES.find((u) => u.key === c.area)?.label ?? c.area}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(c.id)}>
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

      {eGestor && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <div>
                <div className="text-sm font-medium">Perfis de acesso</div>
                <p className="text-xs text-muted-foreground">
                  Define o que cada usuário enxerga no sistema
                </p>
              </div>
            </div>
            {perfis.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                Nenhum usuário com login cadastrado ainda.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="w-44">Perfil de acesso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perfis.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.nome}
                        {p.id === user?.id && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            você
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.cargo ?? "—"}</TableCell>
                      <TableCell>
                        <Select
                          value={p.role}
                          onValueChange={(v) => alterarPapel.mutate({ id: p.id, role: v as Papel })}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gestor">Gestor</SelectItem>
                            <SelectItem value="coordenador">Coordenador</SelectItem>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                            <SelectItem value="analista">Analista</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Gestor e Coordenador acessam custo, salários e relatórios. Supervisor vê banco de
              horas. Analista acessa apenas as próprias atividades e metas.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) setEditId(null);
          setOpen(v);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar funcionário" : "Novo funcionário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome completo *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div>
              <Label>Cargo</Label>
              <Input
                value={form.cargo}
                onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                placeholder="Ex: Analista de Importação"
              />
            </div>
            <div>
              <Label>Operação principal</Label>
              <Select
                value={form.operacao || "none"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    operacao: v === "none" ? "" : v,
                    area: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {UNIDADES.map((u) => (
                    <SelectItem key={u.key} value={u.key}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de entrada</Label>
              <Input
                type="date"
                value={form.data_entrada}
                onChange={(e) => setForm((f) => ({ ...f, data_entrada: e.target.value }))}
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
