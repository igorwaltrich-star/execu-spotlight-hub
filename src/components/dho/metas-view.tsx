import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
import { Plus, Pencil, Trash2, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { ImportarPlanilha, parseData, parseNum } from "@/components/importar-planilha";

type Meta = {
  id: string;
  titulo: string;
  descricao?: string;
  valor_esperado: number;
  unidade: string;
  start_date: string;
  end_date: string;
  recorrencia?: string;
  status: string;
};
type Resultado = {
  id: string;
  meta_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  valor_esperado: number;
  valor_realizado: number;
  pct_atingimento: number;
  resultado?: string;
  justificativa?: string;
};

const emptyMeta = {
  titulo: "",
  descricao: "",
  valor_esperado: "",
  unidade: "processos",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: "",
  recorrencia: "",
  status: "ativa",
};
const emptyRes = {
  meta_id: "",
  periodo_inicio: new Date().toISOString().slice(0, 10),
  periodo_fim: new Date().toISOString().slice(0, 10),
  valor_esperado: "",
  valor_realizado: "",
  justificativa: "",
};

const UNIDADES_META = [
  "processos",
  "quantidade",
  "percentual",
  "horas",
  "dias",
  "documentos",
  "R$",
  "outro",
];
const fmtDate = (d?: string) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

export function MetasView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openMeta, setOpenMeta] = useState(false);
  const [openRes, setOpenRes] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selMetaId, setSelMetaId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyMeta);
  const [resForm, setResForm] = useState(emptyRes);

  const { data: metas = [] } = useQuery({
    queryKey: ["metas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas")
        .select("*")
        .order("status")
        .order("end_date");
      if (error) throw error;
      return (data ?? []) as Meta[];
    },
  });

  const { data: resultados = [] } = useQuery({
    queryKey: ["resultados_meta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resultados_meta")
        .select("*")
        .order("periodo_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Resultado[];
    },
  });

  const saveMeta = useMutation({
    mutationFn: async () => {
      if (!user || !form.titulo || !form.valor_esperado || !form.end_date)
        throw new Error("Preencha título, valor e prazo");
      const p = {
        ...form,
        created_by: user.id,
        owner_id: user.id,
        valor_esperado: Number(form.valor_esperado),
        recorrencia: form.recorrencia || null,
      };
      if (editId) {
        const { error } = await supabase.from("metas").update(p).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("metas").insert(p);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Atualizado" : "Meta criada");
      qc.invalidateQueries({ queryKey: ["metas"] });
      setOpenMeta(false);
      setEditId(null);
      setForm(emptyMeta);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const saveRes = useMutation({
    mutationFn: async () => {
      if (!resForm.meta_id || !resForm.valor_realizado)
        throw new Error("Preencha meta e valor realizado");
      const meta = metas.find((m) => m.id === resForm.meta_id);
      const p = {
        ...resForm,
        valor_esperado: meta ? meta.valor_esperado : Number(resForm.valor_esperado),
        valor_realizado: Number(resForm.valor_realizado),
      };
      const { error } = await supabase.from("resultados_meta").insert(p);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resultado registrado");
      qc.invalidateQueries({ queryKey: ["resultados_meta"] });
      setOpenRes(false);
      setResForm(emptyRes);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("metas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["metas"] });
    },
  });

  const startEdit = (m: Meta) => {
    setForm({
      titulo: m.titulo,
      descricao: m.descricao ?? "",
      valor_esperado: String(m.valor_esperado),
      unidade: m.unidade,
      start_date: m.start_date,
      end_date: m.end_date,
      recorrencia: m.recorrencia ?? "",
      status: m.status,
    });
    setEditId(m.id);
    setOpenMeta(true);
  };

  const kpis = {
    total: metas.length,
    atingidas: resultados.filter((r) => Number(r.pct_atingimento) >= 100).length,
    mediaAtingimento:
      resultados.length > 0
        ? resultados.reduce((s, r) => s + Number(r.pct_atingimento), 0) / resultados.length
        : 0,
    resultadosTotal: resultados.length,
  };

  const lastResultado = (metaId: string) => resultados.find((r) => r.meta_id === metaId);
  const pctColor = (pct: number) =>
    pct >= 100 ? "text-success" : pct >= 70 ? "text-warning" : "text-destructive";

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Metas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Acompanhamento de metas com atingimento automático
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setResForm(emptyRes);
              setOpenRes(true);
            }}
          >
            <TrendingUp className="h-4 w-4 mr-1.5" /> Registrar Resultado
          </Button>
          <div className="flex gap-2 flex-wrap">
            <ImportarPlanilha
              nomeArquivo="metas"
              tabela="metas"
              invalidar={["metas"]}
              ajuda="Unidade sugerida: processos, quantidade, percentual, horas, dias, documentos."
              campos={[
                {
                  coluna: "Titulo",
                  exemplo: "Processar 50 processos por semana",
                  obrigatorio: true,
                  largura: 34,
                },
                { coluna: "Descricao", exemplo: "", largura: 30 },
                { coluna: "Valor esperado", exemplo: 50, obrigatorio: true, largura: 16 },
                { coluna: "Unidade", exemplo: "processos", obrigatorio: true },
                {
                  coluna: "Inicio",
                  exemplo: new Date().toISOString().slice(0, 10),
                  obrigatorio: true,
                },
                { coluna: "Prazo", exemplo: "", obrigatorio: true },
                { coluna: "Recorrencia", exemplo: "semanal" },
              ]}
              montarRegistro={(l) => {
                const ini = parseData(l.inicio);
                if (!ini) return { ok: false, erro: `Inicio "${l.inicio}" invalido` };
                const fim = parseData(l.prazo);
                if (!fim) return { ok: false, erro: `Prazo "${l.prazo}" invalido` };
                const val = parseNum(l.valor_esperado);
                if (val <= 0) return { ok: false, erro: "Valor esperado deve ser maior que zero" };
                const rec = (l.recorrencia || "").toLowerCase();
                if (rec && !["semanal", "quinzenal", "mensal"].includes(rec))
                  return { ok: false, erro: `Recorrencia "${l.recorrencia}" invalida` };
                return {
                  ok: true,
                  registro: {
                    titulo: l.titulo,
                    descricao: l.descricao || null,
                    valor_esperado: val,
                    unidade: l.unidade || "quantidade",
                    start_date: ini,
                    end_date: fim,
                    recorrencia: rec || null,
                    status: "ativa",
                    owner_id: user?.id,
                    created_by: user?.id,
                  },
                };
              }}
            />
            <Button
              size="sm"
              onClick={() => {
                setForm(emptyMeta);
                setEditId(null);
                setOpenMeta(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Nova Meta
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { l: "Metas ativas", v: kpis.total, cls: "" },
          { l: "Resultados", v: kpis.resultadosTotal, cls: "" },
          { l: "Atingidas (≥100%)", v: kpis.atingidas, cls: "text-success" },
          {
            l: "Média de atingimento",
            v: kpis.mediaAtingimento.toFixed(1) + "%",
            cls:
              kpis.mediaAtingimento >= 100
                ? "text-success"
                : kpis.mediaAtingimento >= 70
                  ? "text-warning"
                  : "text-destructive",
          },
        ].map(({ l, v, cls }) => (
          <Card key={l}>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{l}</div>
              <div className={`text-2xl font-semibold ${cls}`}>{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meta</TableHead>
                <TableHead className="text-right">Esperado</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="w-40">Progresso</TableHead>
                <TableHead className="text-right">% Ating.</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Recorrência</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {metas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    Nenhuma meta cadastrada
                  </TableCell>
                </TableRow>
              )}
              {metas.map((m) => {
                const res = lastResultado(m.id);
                const pct = res ? Number(res.pct_atingimento) : 0;
                const real = res ? res.valor_realizado : null;
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{m.titulo}</div>
                      {m.descricao && (
                        <div className="text-xs text-muted-foreground">
                          {m.descricao.slice(0, 60)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {m.valor_esperado}{" "}
                      <span className="text-xs text-muted-foreground">{m.unidade}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {real != null ? `${real} ${m.unidade}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Progress value={Math.min(pct, 100)} className="h-2" />
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${res ? pctColor(pct) : "text-muted-foreground"}`}
                    >
                      {res ? `${pct.toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(m.end_date)}</TableCell>
                    <TableCell>
                      {m.recorrencia ? (
                        <Badge variant="outline" className="text-[10px]">
                          {m.recorrencia}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(m)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => del.mutate(m.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Meta */}
      <Dialog
        open={openMeta}
        onOpenChange={(v) => {
          if (!v) {
            setEditId(null);
            setForm(emptyMeta);
          }
          setOpenMeta(v);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar meta" : "Nova meta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor esperado *</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.valor_esperado}
                  onChange={(e) => setForm((f) => ({ ...f, valor_esperado: e.target.value }))}
                />
              </div>
              <div>
                <Label>Unidade *</Label>
                <Select
                  value={form.unidade}
                  onValueChange={(v) => setForm((f) => ({ ...f, unidade: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES_META.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Início</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Prazo *</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Recorrência</Label>
                <Select
                  value={form.recorrencia || "none"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, recorrencia: v === "none" ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem recorrência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem recorrência</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quinzenal">Quinzenal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={() => saveMeta.mutate()}
              disabled={saveMeta.isPending}
              className="w-full"
            >
              {saveMeta.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Resultado */}
      <Dialog open={openRes} onOpenChange={setOpenRes}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar resultado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Meta *</Label>
              <Select
                value={resForm.meta_id}
                onValueChange={(v) => setResForm((f) => ({ ...f, meta_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a meta" />
                </SelectTrigger>
                <SelectContent>
                  {metas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {resForm.meta_id &&
                (() => {
                  const m = metas.find((x) => x.id === resForm.meta_id);
                  return m ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Esperado: {m.valor_esperado} {m.unidade}
                    </p>
                  ) : null;
                })()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Período início</Label>
                <Input
                  type="date"
                  value={resForm.periodo_inicio}
                  onChange={(e) => setResForm((f) => ({ ...f, periodo_inicio: e.target.value }))}
                />
              </div>
              <div>
                <Label>Período fim</Label>
                <Input
                  type="date"
                  value={resForm.periodo_fim}
                  onChange={(e) => setResForm((f) => ({ ...f, periodo_fim: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Valor realizado *</Label>
              <Input
                type="number"
                step="any"
                value={resForm.valor_realizado}
                onChange={(e) => setResForm((f) => ({ ...f, valor_realizado: e.target.value }))}
              />
            </div>
            {resForm.meta_id &&
              resForm.valor_realizado &&
              (() => {
                const m = metas.find((x) => x.id === resForm.meta_id);
                if (!m) return null;
                const pct = ((Number(resForm.valor_realizado) / m.valor_esperado) * 100).toFixed(1);
                return (
                  <div
                    className={`p-2 rounded-lg text-sm font-medium text-center ${Number(pct) >= 100 ? "bg-success/10 text-success" : Number(pct) >= 70 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}
                  >
                    Atingimento: {pct}%
                  </div>
                );
              })()}
            <div>
              <Label>Justificativa (se necessário)</Label>
              <Textarea
                value={resForm.justificativa}
                onChange={(e) => setResForm((f) => ({ ...f, justificativa: e.target.value }))}
                rows={2}
              />
            </div>
            <Button
              onClick={() => saveRes.mutate()}
              disabled={saveRes.isPending}
              className="w-full"
            >
              {saveRes.isPending ? "Salvando..." : "Registrar resultado"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
