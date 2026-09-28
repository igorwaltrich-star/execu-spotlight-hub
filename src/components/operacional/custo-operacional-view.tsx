import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePerfil } from "@/hooks/use-perfil";
import { useColaboradores } from "@/components/gestao/use-colaboradores";
import { UNIDADES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Upload, Download, DollarSign, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type CustoMensal = {
  id: string;
  colaborador_id: string;
  operacao: string;
  mes_referencia: string;
  tipo_contrato: string;
  salario_bruto: number;
  inss: number;
  fgts: number;
  provisao_ferias: number;
  provisao_13: number;
  aviso_previo: number;
  beneficios: number;
  total: number;
  fonte: string;
};

const emptyForm = {
  colaborador_id: "",
  operacao: "",
  mes_referencia: new Date().toISOString().slice(0, 7),
  tipo_contrato: "CLT",
  salario_bruto: "0",
  inss: "0",
  fgts: "0",
  provisao_ferias: "0",
  provisao_13: "0",
  aviso_previo: "0",
  beneficios: "0",
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtDate = (d: string) => {
  const [y, m] = d.split("-");
  return `${["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][Number(m) - 1]}/${y.slice(2)}`;
};

export function CustoOperacionalView() {
  const { user } = useAuth();
  const { eUmDe } = usePerfil();
  const podeVerCusto = eUmDe(["gestor", "coordenador"]);
  const qc = useQueryClient();
  const { data: colabs = [] } = useColaboradores();
  const fileRef = useRef<HTMLInputElement>(null);
  const [filtroOp, setFiltroOp] = useState("all");
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7));
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: custos = [] } = useQuery({
    queryKey: ["custo_pessoal", filtroOp, filtroMes, podeVerCusto],
    queryFn: async () => {
      let q = supabase
        .from("custo_pessoal_mensal")
        .select("*")
        .order("operacao")
        .order("colaborador_id");
      if (filtroOp !== "all") q = q.eq("operacao", filtroOp);
      if (filtroMes) q = q.eq("mes_referencia", filtroMes + "-01");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CustoMensal[];
    },
    enabled: podeVerCusto,
  });

  const nome = (id: string) => colabs.find((c) => c.id === id)?.nome ?? "—";

  const kpis = {
    totalGeral: custos.reduce((s, c) => s + Number(c.total), 0),
    totalRem: custos.reduce((s, c) => s + Number(c.salario_bruto), 0),
    totalBen: custos.reduce((s, c) => s + Number(c.beneficios), 0),
    count: custos.length,
  };

  const byOp = UNIDADES.map((u) => {
    const items = custos.filter((c) => c.operacao === u.key);
    return {
      label: u.label,
      total: items.reduce((s, c) => s + Number(c.total), 0),
      count: items.length,
    };
  }).filter((x) => x.count > 0);

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !form.colaborador_id || !form.operacao)
        throw new Error("Preencha colaborador e operação");
      const payload = {
        user_id: user.id,
        colaborador_id: form.colaborador_id,
        operacao: form.operacao,
        mes_referencia: form.mes_referencia + "-01",
        tipo_contrato: form.tipo_contrato,
        fonte: "manual",
        salario_bruto: Number(form.salario_bruto),
        inss: Number(form.inss),
        fgts: Number(form.fgts),
        provisao_ferias: Number(form.provisao_ferias),
        provisao_13: Number(form.provisao_13),
        aviso_previo: Number(form.aviso_previo),
        beneficios: Number(form.beneficios),
      };
      if (editId) {
        const { error } = await supabase
          .from("custo_pessoal_mensal")
          .update(payload)
          .eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("custo_pessoal_mensal")
          .upsert(payload, { onConflict: "colaborador_id,mes_referencia" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Custo salvo");
      qc.invalidateQueries({ queryKey: ["custo_pessoal"] });
      setOpen(false);
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const importar = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Não autenticado");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const norm = (k: string) =>
        k
          .toString()
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Mn}/gu, "")
          .replace(/\s+/g, "_");
      const byNome = new Map(colabs.map((c) => [c.nome.trim().toLowerCase(), c.id]));
      const byOp = new Map(UNIDADES.map((u) => [u.label.toLowerCase(), u.key]));

      const records = json
        .map((r) => {
          const e: Record<string, string> = {};
          Object.entries(r).forEach(([k, v]) => {
            e[norm(k)] = String(v ?? "").trim();
          });
          const colabId = byNome.get((e.nome || e.colaborador || "").toLowerCase());
          if (!colabId) return null;
          const mes = e.mes || e.mes_referencia || "";
          const mesFormatted = mes.match(/^\d{4}-\d{2}$/) ? mes + "-01" : null;
          if (!mesFormatted) return null;
          const opKey = e.operacao ? (byOp.get(e.operacao.toLowerCase()) ?? e.operacao) : "";
          return {
            user_id: user.id,
            colaborador_id: colabId,
            operacao: opKey,
            mes_referencia: mesFormatted,
            tipo_contrato: e.tipo_contrato || e.tipo || "CLT",
            fonte: "excel_upload",
            salario_bruto: Number(e.salario_bruto || e.remuneracao_bruta || 0),
            inss: Number(e.inss || 0),
            fgts: Number(e.fgts || 0),
            provisao_ferias: Number(e.provisao_ferias || e.ferias || 0),
            provisao_13: Number(e.provisao_13 || e["13"] || 0),
            aviso_previo: Number(e.aviso_previo || e.aviso || 0),
            beneficios: Number(e.beneficios || e.plano_de_saude || 0),
          };
        })
        .filter(Boolean);
      if (records.length === 0) throw new Error("Nenhuma linha válida. Verifique o modelo.");
      const { error } = await supabase
        .from("custo_pessoal_mensal")
        .upsert(records as never[], { onConflict: "colaborador_id,mes_referencia" });
      if (error) throw error;
      return records.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} registros importados`);
      qc.invalidateQueries({ queryKey: ["custo_pessoal"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const baixarModelo = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        nome: "João Silva",
        mes: "2026-08",
        operacao: "Midea AM",
        tipo_contrato: "CLT",
        salario_bruto: 5000,
        inss: 550,
        fgts: 400,
        provisao_ferias: 600,
        provisao_13: 416,
        aviso_previo: 0,
        beneficios: 800,
      },
    ]);
    ws["!cols"] = [
      { wch: 28 },
      { wch: 10 },
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
      { wch: 8 },
      { wch: 8 },
      { wch: 16 },
      { wch: 14 },
      { wch: 13 },
      { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Custo");
    XLSX.writeFile(wb, "modelo-custo-pessoal.xlsx");
  };

  const startEdit = (c: CustoMensal) => {
    setForm({
      colaborador_id: c.colaborador_id,
      operacao: c.operacao,
      mes_referencia: c.mes_referencia.slice(0, 7),
      tipo_contrato: c.tipo_contrato,
      salario_bruto: String(c.salario_bruto),
      inss: String(c.inss),
      fgts: String(c.fgts),
      provisao_ferias: String(c.provisao_ferias),
      provisao_13: String(c.provisao_13),
      aviso_previo: String(c.aviso_previo),
      beneficios: String(c.beneficios),
    });
    setEditId(c.id);
    setOpen(true);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Custo Operacional</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload de planilha ou cadastro manual por colaborador
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={baixarModelo}>
            <Download className="h-4 w-4 mr-1.5" />
            Modelo Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={importar.isPending}
          >
            <Upload className="h-4 w-4 mr-1.5" />
            {importar.isPending ? "Importando..." : "Importar Excel"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importar.mutate(f);
              e.target.value = "";
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
            Cadastro Manual
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
        <Input
          type="month"
          value={filtroMes}
          onChange={(e) => setFiltroMes(e.target.value)}
          className="w-40"
        />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { l: "Colaboradores", v: kpis.count, icon: Users, cls: "" },
          { l: "Total Geral", v: fmt(kpis.totalGeral), icon: DollarSign, cls: "text-primary" },
          { l: "Remuneração", v: fmt(kpis.totalRem), icon: DollarSign, cls: "" },
          { l: "Benefícios", v: fmt(kpis.totalBen), icon: DollarSign, cls: "" },
        ].map(({ l, v, icon: Icon, cls }) => (
          <Card key={l}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">{l}</span>
                <Icon className={`h-4 w-4 ${cls || "text-muted-foreground"}`} />
              </div>
              <div className={`text-xl font-semibold ${cls}`}>{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="detalhe">
        <TabsList>
          <TabsTrigger value="detalhe">Por colaborador</TabsTrigger>
          <TabsTrigger value="resumo">Resumo por operação</TabsTrigger>
        </TabsList>

        <TabsContent value="detalhe">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Operação</TableHead>
                    <TableHead>Mês</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead className="text-right">Rem. bruta</TableHead>
                    <TableHead className="text-right">Encargos</TableHead>
                    <TableHead className="text-right">Benefícios</TableHead>
                    <TableHead className="text-right font-semibold">Total</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {custos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                        Nenhum registro. Importe uma planilha ou adicione manualmente.
                      </TableCell>
                    </TableRow>
                  )}
                  {custos.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{nome(c.colaborador_id)}</TableCell>
                      <TableCell>
                        {UNIDADES.find((u) => u.key === c.operacao)?.label ?? c.operacao}
                      </TableCell>
                      <TableCell>{fmtDate(c.mes_referencia)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {c.tipo_contrato}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmt(Number(c.salario_bruto))}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fmt(
                          Number(c.inss) +
                            Number(c.fgts) +
                            Number(c.provisao_ferias) +
                            Number(c.provisao_13) +
                            Number(c.aviso_previo),
                        )}
                      </TableCell>
                      <TableCell className="text-right">{fmt(Number(c.beneficios))}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {fmt(Number(c.total))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={c.fonte === "excel_upload" ? "secondary" : "outline"}
                          className="text-[10px]"
                        >
                          {c.fonte === "excel_upload" ? "Excel" : "Manual"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => startEdit(c)}>
                          <span className="text-xs">✏️</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resumo">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {byOp.length === 0 && (
              <p className="col-span-3 text-center text-muted-foreground py-10">
                Nenhum dado para o período selecionado
              </p>
            )}
            {byOp
              .sort((a, b) => b.total - a.total)
              .map((op) => (
                <Card key={op.label}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{op.label}</CardTitle>
                    <CardDescription>{op.count} colaborador(es)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-primary">{fmt(op.total)}</div>
                    <div className="text-xs text-muted-foreground mt-1">custo total no período</div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>

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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar custo" : "Cadastro manual de custo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Colaborador *</Label>
                <Select
                  value={form.colaborador_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, colaborador_id: v }))}
                >
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
                <Label>Mês</Label>
                <Input
                  type="month"
                  value={form.mes_referencia}
                  onChange={(e) => setForm((f) => ({ ...f, mes_referencia: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Tipo de contrato</Label>
              <Select
                value={form.tipo_contrato}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo_contrato: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLT">CLT</SelectItem>
                  <SelectItem value="PJ">PJ</SelectItem>
                  <SelectItem value="SALDO_LIVRE">Saldo Livre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border rounded-lg p-3 space-y-3">
              <div className="text-sm font-medium text-muted-foreground">
                Componentes de custo (R$)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Salário bruto</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.salario_bruto}
                    onChange={(e) => setForm((f) => ({ ...f, salario_bruto: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>INSS</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.inss}
                    onChange={(e) => setForm((f) => ({ ...f, inss: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>FGTS</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.fgts}
                    onChange={(e) => setForm((f) => ({ ...f, fgts: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Provisão férias</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.provisao_ferias}
                    onChange={(e) => setForm((f) => ({ ...f, provisao_ferias: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Provisão 13°</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.provisao_13}
                    onChange={(e) => setForm((f) => ({ ...f, provisao_13: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Aviso prévio</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.aviso_previo}
                    onChange={(e) => setForm((f) => ({ ...f, aviso_previo: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Benefícios (saúde + VR + VC + odonto)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.beneficios}
                    onChange={(e) => setForm((f) => ({ ...f, beneficios: e.target.value }))}
                  />
                </div>
              </div>
              <div className="p-2 bg-muted rounded text-sm font-medium">
                Total:{" "}
                {fmt(
                  Number(form.salario_bruto) +
                    Number(form.inss) +
                    Number(form.fgts) +
                    Number(form.provisao_ferias) +
                    Number(form.provisao_13) +
                    Number(form.aviso_previo) +
                    Number(form.beneficios),
                )}
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
