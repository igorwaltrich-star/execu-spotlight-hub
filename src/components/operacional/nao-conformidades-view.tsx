import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useColaboradores } from "@/components/gestao/use-colaboradores";
import { UNIDADES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Pencil, Trash2, AlertTriangle, DollarSign, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import {
  ImportarPlanilha,
  parseData,
  parseNum,
  buscarPorNome,
} from "@/components/importar-planilha";

type NC = {
  id: string;
  operacao: string;
  colaborador_id?: string;
  tipo: string;
  descricao: string;
  data_ocorrencia: string;
  ref_pinho?: string;
  ref_cliente?: string;
  numero_oc?: string;
  numero_processo?: string;
  custo_gerado: number;
  reembolsavel: boolean;
  status_financeiro: string;
  forma_resolucao?: string;
  valor_recuperado?: number;
  data_resolucao?: string;
};

const TIPOS = [
  { value: "erro_digitacao", label: "Erro de digitação" },
  { value: "prazo_perdido", label: "Prazo perdido" },
  { value: "doc_incorreto", label: "Documento incorreto" },
  { value: "comunicacao", label: "Falha de comunicação" },
  { value: "outro", label: "Outro" },
];
const STATUS_FIN = [
  { value: "nao_aplicavel", label: "Não aplicável" },
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago/Resolvido" },
];
const FORMA_RES = [
  { value: "reembolso_cliente", label: "Reembolso ao cliente" },
  { value: "servico_adicional", label: "Serviço adicional" },
  { value: "absorvido", label: "Absorvido (sem recuperação)" },
];

const emptyForm: Partial<NC> & { colaborador_id: string } = {
  operacao: "",
  colaborador_id: "",
  tipo: "erro_digitacao",
  descricao: "",
  data_ocorrencia: new Date().toISOString().slice(0, 10),
  ref_pinho: "",
  ref_cliente: "",
  numero_oc: "",
  numero_processo: "",
  custo_gerado: 0,
  reembolsavel: false,
  status_financeiro: "nao_aplicavel",
  forma_resolucao: "",
  valor_recuperado: 0,
};

const fmt = (v?: number) =>
  v ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
const fmtDate = (d?: string) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

export function NaoConformidadesView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: colabs = [] } = useColaboradores();
  const [filtroOp, setFiltroOp] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);

  const { data: ncs = [] } = useQuery({
    queryKey: ["nao_conformidades", filtroOp, filtroStatus],
    queryFn: async () => {
      let q = supabase
        .from("nao_conformidades")
        .select("*")
        .order("data_ocorrencia", { ascending: false });
      if (filtroOp !== "all") q = q.eq("operacao", filtroOp);
      if (filtroStatus !== "all") q = q.eq("status_financeiro", filtroStatus);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as NC[];
    },
  });

  const kpis = {
    total: ncs.length,
    abertas: ncs.filter((n) => n.status_financeiro === "pendente").length,
    custo: ncs.reduce((s, n) => s + Number(n.custo_gerado ?? 0), 0),
    recuperado: ncs.reduce((s, n) => s + Number(n.valor_recuperado ?? 0), 0),
  };

  const nome = (id?: string) => (id ? (colabs.find((c) => c.id === id)?.nome ?? "—") : "—");

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !form.operacao || !form.descricao || !form.data_ocorrencia)
        throw new Error("Preencha operação, descrição e data");
      const payload = {
        ...form,
        operacao: form.operacao,
        descricao: form.descricao,
        data_ocorrencia: form.data_ocorrencia,
        user_id: user.id,
        colaborador_id: form.colaborador_id || null,
      };
      if (editId) {
        const { error } = await supabase.from("nao_conformidades").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("nao_conformidades").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Atualizado" : "Registrado");
      qc.invalidateQueries({ queryKey: ["nao_conformidades"] });
      setOpen(false);
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nao_conformidades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["nao_conformidades"] });
    },
  });

  const startEdit = (n: NC) => {
    setForm({ ...n, colaborador_id: n.colaborador_id ?? "" });
    setEditId(n.id);
    setOpen(true);
  };

  const statusBadge = (s: string) => {
    if (s === "pago")
      return <Badge className="bg-success/10 text-success border-0">Resolvido</Badge>;
    if (s === "pendente") return <Badge variant="destructive">Pendente</Badge>;
    return <Badge variant="outline">N/A</Badge>;
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Não Conformidades</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registro de ocorrências com controle de custo e recuperação
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ImportarPlanilha
            nomeArquivo="nao-conformidades"
            tabela="nao_conformidades"
            invalidar={["nao_conformidades"]}
            ajuda="Tipo: erro_digitacao, prazo_perdido, doc_incorreto, comunicacao, outro. Data em AAAA-MM-DD ou DD/MM/AAAA."
            campos={[
              { coluna: "Data", exemplo: new Date().toISOString().slice(0, 10), obrigatorio: true },
              { coluna: "Operacao", exemplo: "Bosch", obrigatorio: true },
              { coluna: "Tipo", exemplo: "prazo_perdido", obrigatorio: true, largura: 18 },
              {
                coluna: "Descricao",
                exemplo: "Descreva a ocorrencia",
                obrigatorio: true,
                largura: 36,
              },
              { coluna: "Responsavel", exemplo: "", largura: 24 },
              { coluna: "Ref Pinho", exemplo: "PNH-2026-0001", largura: 18 },
              { coluna: "Ref Cliente", exemplo: "", largura: 18 },
              { coluna: "Numero OC", exemplo: "", largura: 16 },
              { coluna: "Numero Processo", exemplo: "", largura: 18 },
              { coluna: "Custo", exemplo: 0 },
              { coluna: "Reembolsavel", exemplo: "nao" },
              { coluna: "Status", exemplo: "pendente", largura: 16 },
              { coluna: "Valor Recuperado", exemplo: 0, largura: 18 },
            ]}
            montarRegistro={(l) => {
              const op = UNIDADES.find(
                (u) =>
                  u.key === l.operacao.toLowerCase() ||
                  u.label.toLowerCase() === l.operacao.toLowerCase(),
              );
              if (!op) return { ok: false, erro: `Operacao "${l.operacao}" nao reconhecida` };
              const data = parseData(l.data);
              if (!data) return { ok: false, erro: `Data "${l.data}" invalida` };
              const tipo = l.tipo.toLowerCase();
              if (!TIPOS.some((t) => t.value === tipo))
                return { ok: false, erro: `Tipo "${l.tipo}" invalido` };
              const status = (l.status || "nao_aplicavel").toLowerCase();
              if (!STATUS_FIN.some((x) => x.value === status))
                return { ok: false, erro: `Status "${l.status}" invalido` };
              const resp = l.responsavel ? buscarPorNome(colabs, l.responsavel) : undefined;
              if (l.responsavel && !resp)
                return { ok: false, erro: `Responsavel "${l.responsavel}" nao encontrado` };
              return {
                ok: true,
                registro: {
                  user_id: user?.id,
                  operacao: op.key,
                  tipo,
                  descricao: l.descricao,
                  data_ocorrencia: data,
                  colaborador_id: resp?.id ?? null,
                  ref_pinho: l.ref_pinho || null,
                  ref_cliente: l.ref_cliente || null,
                  numero_oc: l.numero_oc || null,
                  numero_processo: l.numero_processo || null,
                  custo_gerado: parseNum(l.custo),
                  reembolsavel: ["sim", "true", "1", "s"].includes(
                    (l.reembolsavel || "").toLowerCase(),
                  ),
                  status_financeiro: status,
                  valor_recuperado: parseNum(l.valor_recuperado),
                },
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
            <Plus className="h-4 w-4 mr-1.5" /> Nova Ocorrência
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={filtroOp} onValueChange={setFiltroOp}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Operação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {UNIDADES.map((u) => (
              <SelectItem key={u.key} value={u.key}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status financeiro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {STATUS_FIN.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: kpis.total, icon: AlertTriangle, cls: "" },
          { label: "Pendentes", value: kpis.abertas, icon: AlertTriangle, cls: "text-destructive" },
          {
            label: "Custo Gerado",
            value: fmt(kpis.custo),
            icon: DollarSign,
            cls: "text-destructive",
          },
          {
            label: "Recuperado",
            value: fmt(kpis.recuperado),
            icon: CheckCircle,
            cls: "text-success",
          },
        ].map(({ label, value, icon: Icon, cls }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {label}
                </span>
                <Icon className={`h-4 w-4 ${cls || "text-muted-foreground"}`} />
              </div>
              <div className={`text-xl font-semibold ${cls}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ref. Pinho</TableHead>
                <TableHead>Ref. Cliente</TableHead>
                <TableHead>OC</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ncs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                    Nenhuma ocorrência registrada
                  </TableCell>
                </TableRow>
              )}
              {ncs.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="whitespace-nowrap">{fmtDate(n.data_ocorrencia)}</TableCell>
                  <TableCell>
                    {UNIDADES.find((u) => u.key === n.operacao)?.label ?? n.operacao}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {TIPOS.find((t) => t.value === n.tipo)?.label ?? n.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{n.ref_pinho || "—"}</TableCell>
                  <TableCell className="text-xs">{n.ref_cliente || "—"}</TableCell>
                  <TableCell className="text-xs">{n.numero_oc || "—"}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(n.custo_gerado)}</TableCell>
                  <TableCell>{statusBadge(n.status_financeiro)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(n)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(n.id)}>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar ocorrência" : "Registrar não conformidade"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Operação *</Label>
                <Select
                  value={form.operacao}
                  onValueChange={(v) => setForm((f) => ({ ...f, operacao: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u.key} value={u.key}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data da ocorrência *</Label>
                <Input
                  type="date"
                  value={form.data_ocorrencia}
                  onChange={(e) => setForm((f) => ({ ...f, data_ocorrencia: e.target.value }))}
                />
              </div>
              <div>
                <Label>Responsável</Label>
                <Select
                  value={form.colaborador_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, colaborador_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)" />
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
            </div>
            <div>
              <Label>Descrição *</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                rows={3}
                placeholder="Descreva a ocorrência detalhadamente"
              />
            </div>
            <div className="border rounded-lg p-3 space-y-3">
              <div className="text-sm font-medium text-muted-foreground">
                Referências do processo
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ref. Pinho</Label>
                  <Input
                    value={form.ref_pinho ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, ref_pinho: e.target.value }))}
                    placeholder="PNH-2026-XXXX"
                  />
                </div>
                <div>
                  <Label>Ref. Cliente</Label>
                  <Input
                    value={form.ref_cliente ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, ref_cliente: e.target.value }))}
                    placeholder="Referência do cliente"
                  />
                </div>
                <div>
                  <Label>Número da OC</Label>
                  <Input
                    value={form.numero_oc ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, numero_oc: e.target.value }))}
                    placeholder="OC-XXXXX"
                  />
                </div>
                <div>
                  <Label>DU-IMP / DI</Label>
                  <Input
                    value={form.numero_processo ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, numero_processo: e.target.value }))}
                    placeholder="Número do processo (opcional)"
                  />
                </div>
              </div>
            </div>
            <div className="border rounded-lg p-3 space-y-3">
              <div className="text-sm font-medium text-muted-foreground">Financeiro</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Custo gerado (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.custo_gerado ?? 0}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, custo_gerado: Number(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <Label>Status financeiro</Label>
                  <Select
                    value={form.status_financeiro}
                    onValueChange={(v) => setForm((f) => ({ ...f, status_financeiro: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_FIN.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Forma de resolução</Label>
                  <Select
                    value={form.forma_resolucao ?? ""}
                    onValueChange={(v) => setForm((f) => ({ ...f, forma_resolucao: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMA_RES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor recuperado (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.valor_recuperado ?? 0}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, valor_recuperado: Number(e.target.value) }))
                    }
                  />
                </div>
              </div>
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
