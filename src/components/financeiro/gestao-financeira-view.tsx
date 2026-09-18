import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePerfil } from "@/hooks/use-perfil";
import {
  parseDataSigra,
  calcularFunil,
  leadTimes,
  agingPendentes,
  porCentroCusto,
  contasSemSolicitacao,
  funilExcluindo,
  evolucaoMensal,
  type ProcessoFin,
} from "@/lib/financeiro-engine";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  Cell,
} from "recharts";
import {
  Upload,
  Wallet,
  AlertTriangle,
  Plus,
  MessageSquarePlus,
  Info,
  Download,
} from "lucide-react";
import { toast } from "sonner";

type Categoria = {
  id: string;
  nome: string;
  descricao?: string;
  conta_como_gap: boolean;
  responsavel: string;
  ordem: number;
  ativo: boolean;
};
type Justificativa = {
  id: string;
  processo_id?: string;
  escopo: string;
  centro_custo?: string;
  categoria_id: string;
  justificativa?: string;
  created_at: string;
};

const RESP_LABEL: Record<string, string> = {
  operacao: "Operação",
  cliente: "Cliente",
  financeiro: "Financeiro",
  aduana: "Aduana",
  sistema: "Sistema",
};
const fmtD = (d?: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
const fmtMes = (m: string) => {
  const [y, mm] = m.split("-");
  return `${["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][Number(mm) - 1]}/${y.slice(2)}`;
};
const n0 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const diasDesde = (d?: string | null) =>
  d ? Math.round((Date.now() - Date.parse(d + "T00:00:00Z")) / 86400000) : 0;

export function GestaoFinanceiraView() {
  const { user } = useAuth();
  const { eUmDe } = usePerfil();
  const podeEditar = eUmDe(["gestor", "coordenador", "supervisor"]);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);
  const [erroImport, setErroImport] = useState<string | null>(null);
  const [filtroCC, setFiltroCC] = useState("all");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [excluirSemSol, setExcluirSemSol] = useState(true);
  const [openJust, setOpenJust] = useState(false);
  const [openCat, setOpenCat] = useState(false);
  const [alvoJust, setAlvoJust] = useState<{
    escopo: string;
    processo?: ProcessoFin;
    cc?: string;
  } | null>(null);
  const [formJust, setFormJust] = useState({ categoria_id: "", justificativa: "" });
  const [formCat, setFormCat] = useState({
    nome: "",
    descricao: "",
    conta_como_gap: "1",
    responsavel: "operacao",
  });

  const { data: procs = [], isLoading } = useQuery({
    queryKey: ["fin_processos"],
    queryFn: async () => {
      const todos: ProcessoFin[] = [];
      for (let i = 0; i < 40; i++) {
        const { data, error } = await supabase
          .from("financeiro_processos")
          .select("*")
          .range(i * 1000, i * 1000 + 999);
        if (error) throw error;
        todos.push(...((data ?? []) as ProcessoFin[]));
        if (!data || data.length < 1000) break;
      }
      return todos;
    },
  });

  const { data: cats = [] } = useQuery({
    queryKey: ["fin_categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_categorias")
        .select("*")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
  });

  const { data: justs = [] } = useQuery({
    queryKey: ["fin_justificativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_justificativas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Justificativa[];
    },
  });

  const filtrados = useMemo(
    () =>
      procs.filter((p) => {
        if (filtroCC !== "all" && (p.centro_custo || "") !== filtroCC) return false;
        if (de && (!p.data_registro || p.data_registro < de)) return false;
        if (ate && (!p.data_registro || p.data_registro > ate)) return false;
        return true;
      }),
    [procs, filtroCC, de, ate],
  );

  const resumoCC = useMemo(() => porCentroCusto(filtrados), [filtrados]);
  const semSolicitacao = useMemo(() => contasSemSolicitacao(resumoCC), [resumoCC]);
  const ccsExcluidos = useMemo(() => semSolicitacao.map((c) => c.centro_custo), [semSolicitacao]);

  const funilBruto = useMemo(() => calcularFunil(filtrados), [filtrados]);
  const funilAjustado = useMemo(
    () =>
      excluirSemSol && ccsExcluidos.length > 0
        ? funilExcluindo(filtrados, ccsExcluidos)
        : funilBruto,
    [filtrados, excluirSemSol, ccsExcluidos, funilBruto],
  );
  const escopo = useMemo(
    () =>
      excluirSemSol && ccsExcluidos.length > 0
        ? filtrados.filter((p) => !ccsExcluidos.includes(p.centro_custo || "(sem centro de custo)"))
        : filtrados,
    [filtrados, excluirSemSol, ccsExcluidos],
  );

  const lt = useMemo(() => leadTimes(escopo), [escopo]);
  const aging = useMemo(() => agingPendentes(escopo), [escopo]);
  const evolucao = useMemo(() => evolucaoMensal(escopo), [escopo]);
  const ccsDisponiveis = useMemo(
    () => [...new Set(procs.map((p) => p.centro_custo || "").filter(Boolean))].sort(),
    [procs],
  );

  const catDe = (id: string) => cats.find((c) => c.id === id);
  const justDoCC = (cc: string) =>
    justs.find((j) => j.escopo === "centro_custo" && j.centro_custo === cc);

  const pendentes = useMemo(
    () => escopo.filter((p) => p.data_registro && !p.data_solicitacao),
    [escopo],
  );
  const pendentesSemJust = useMemo(
    () =>
      pendentes.filter(
        (p) => !justs.some((j) => j.processo_id === p.id) && !justDoCC(p.centro_custo || ""),
      ),
    [pendentes, justs],
  );

  /* ── importação da planilha do Sigraweb ── */
  const importar = async (file: File) => {
    setImportando(true);
    setErroImport(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const aba =
        wb.SheetNames.find((n) => n.toLowerCase().includes("acompanha")) ?? wb.SheetNames[0];
      const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[aba], { header: 1, defval: "" });
      if (linhas.length < 2) throw new Error("Planilha sem dados");

      // posições fixas da exportação do Sigraweb
      const C = {
        sigra: 0,
        codigo: 1,
        cc: 2,
        modal: 3,
        di: 22,
        canal: 23,
        reg: 29,
        sol: 40,
        fec: 41,
        imp: 45,
      };
      const registros: Record<string, unknown>[] = [];
      let semSigra = 0;

      for (let i = 1; i < linhas.length; i++) {
        const l = linhas[i];
        const sigra = String(l[C.sigra] ?? "").trim();
        if (!sigra) {
          semSigra++;
          continue;
        }
        registros.push({
          sigra,
          codigo: String(l[C.codigo] ?? "").trim() || null,
          centro_custo: String(l[C.cc] ?? "").trim() || null,
          modal: String(l[C.modal] ?? "").trim() || null,
          di: String(l[C.di] ?? "").trim() || null,
          canal_rfb: String(l[C.canal] ?? "").trim() || null,
          importador: String(l[C.imp] ?? "").trim() || null,
          data_registro: parseDataSigra(l[C.reg]),
          data_solicitacao: parseDataSigra(l[C.sol]),
          data_fechamento: parseDataSigra(l[C.fec]),
          importado_por: user?.id,
          atualizado_em: new Date().toISOString(),
        });
      }
      if (registros.length === 0) throw new Error("Nenhuma linha com código Sigra encontrada");

      // lotes menores reduzem o risco de timeout na base grande
      const TAMANHO_LOTE = 250;
      let gravados = 0;
      for (let i = 0; i < registros.length; i += TAMANHO_LOTE) {
        const lote = registros.slice(i, i + TAMANHO_LOTE);
        const { error } = await supabase
          .from("financeiro_processos")
          .upsert(lote as never[], { onConflict: "sigra" });

        if (error) {
          // o erro do Supabase traz contexto que a mensagem sozinha esconde
          const partes = [error.message, error.details, error.hint].filter(Boolean).join(" · ");
          const codigo = error.code ? ` [${error.code}]` : "";
          throw new Error(
            `Falha no lote ${Math.floor(i / TAMANHO_LOTE) + 1}${codigo}: ${partes || "erro desconhecido"}`,
          );
        }
        gravados += lote.length;
        setProgresso({ feito: gravados, total: registros.length });
      }
      qc.invalidateQueries({ queryKey: ["fin_processos"] });
      toast.success(
        `${n0(gravados)} processos importados${semSigra ? ` · ${semSigra} linha(s) sem Sigra ignorada(s)` : ""}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErroImport(msg);
      toast.error("Importação falhou — veja o detalhe na tela");
    } finally {
      setImportando(false);
      setProgresso(null);
    }
  };

  const salvarJust = useMutation({
    mutationFn: async () => {
      if (!alvoJust || !formJust.categoria_id) throw new Error("Selecione a categoria");
      const { error } = await supabase.from("financeiro_justificativas").insert({
        escopo: alvoJust.escopo,
        processo_id: alvoJust.escopo === "processo" ? alvoJust.processo?.id : null,
        centro_custo: alvoJust.escopo === "centro_custo" ? alvoJust.cc : null,
        categoria_id: formJust.categoria_id,
        justificativa: formJust.justificativa || null,
        autor_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Justificativa registrada");
      qc.invalidateQueries({ queryKey: ["fin_justificativas"] });
      setOpenJust(false);
      setFormJust({ categoria_id: "", justificativa: "" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const salvarCat = useMutation({
    mutationFn: async () => {
      if (!formCat.nome.trim()) throw new Error("Informe o nome da categoria");
      const { error } = await supabase.from("financeiro_categorias").insert({
        nome: formCat.nome,
        descricao: formCat.descricao || null,
        conta_como_gap: formCat.conta_como_gap === "1",
        responsavel: formCat.responsavel,
        ordem: cats.length + 1,
        ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria criada");
      qc.invalidateQueries({ queryKey: ["fin_categorias"] });
      setOpenCat(false);
      setFormCat({ nome: "", descricao: "", conta_como_gap: "1", responsavel: "operacao" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const exportarPendentes = () => {
    const ws = XLSX.utils.json_to_sheet(
      pendentes.slice(0, 5000).map((p) => {
        const j = justs.find((x) => x.processo_id === p.id) ?? justDoCC(p.centro_custo || "");
        return {
          Sigra: p.sigra,
          "Centro de Custo": p.centro_custo ?? "",
          DI: p.di ?? "",
          Modal: p.modal ?? "",
          Registro: fmtD(p.data_registro),
          "Dias desde registro": diasDesde(p.data_registro),
          Justificativa: j ? (catDe(j.categoria_id)?.nome ?? "") : "",
        };
      }),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pendentes");
    XLSX.writeFile(wb, "pendentes-solicitacao-fechamento.xlsx");
  };

  const C = {
    p: "var(--color-primary)",
    s: "var(--color-success)",
    w: "var(--color-warning)",
    d: "var(--color-destructive)",
    m: "var(--color-muted-foreground)",
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Gestão Financeira
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Funil Registro → Solicitação de Fechamento → Fechamento
          </p>
        </div>
        {podeEditar && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={exportarPendentes}
              disabled={pendentes.length === 0}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Exportar pendentes
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={importando}>
              <Upload className="h-4 w-4 mr-1.5" />
              {importando ? "Importando..." : "Importar KPI Sigraweb"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importar(f);
                e.target.value = "";
              }}
            />
          </div>
        )}
      </div>

      {importando && progresso && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Importando processos…</span>
              <span className="text-muted-foreground">
                {n0(progresso.feito)} de {n0(progresso.total)}
              </span>
            </div>
            <Progress value={(progresso.feito / progresso.total) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {erroImport && (
        <Card className="border-destructive">
          <CardContent className="pt-4 space-y-3">
            <div className="flex gap-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium mb-1">Falha na importação</div>
                <p className="text-sm font-mono bg-muted rounded p-2 break-words">{erroImport}</p>
              </div>
            </div>
            <div className="text-sm space-y-1.5 pl-7">
              <div className="font-medium">Causas mais comuns:</div>
              {[
                [
                  "relation",
                  "A tabela ainda não existe — a migration do módulo financeiro não rodou no Supabase.",
                ],
                [
                  "row-level security",
                  "Seu perfil não tem permissão de escrita. Confira em Funcionários se você está como gestor, coordenador ou supervisor.",
                ],
                [
                  "tem_papel",
                  "A função de perfil não existe — a migration de controle de acesso não rodou.",
                ],
                ["duplicate key", "Há códigos Sigra repetidos na planilha."],
                [
                  "timeout",
                  "Base muito grande para uma tentativa só. Filtre a planilha por período e importe em partes.",
                ],
              ].map(([chave, texto]) => (
                <div
                  key={chave}
                  className={`flex gap-2 ${
                    erroImport.toLowerCase().includes(chave)
                      ? "text-destructive font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  <span>·</span>
                  <span>{texto}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setErroImport(null)}>
              Fechar
            </Button>
          </CardContent>
        </Card>
      )}

      {procs.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <Upload className="h-9 w-9 mx-auto mb-3 text-muted-foreground opacity-30" />
            <div className="font-medium mb-1">
              {isLoading ? "Carregando..." : "Nenhum processo importado"}
            </div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Importe a planilha KPI_Acompanhamento exportada do Sigraweb. As colunas AD (Registro),
              AO (Solicitação Fechamento) e AP (Fechamento) são lidas automaticamente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="pt-4 flex gap-3 flex-wrap items-end">
              <div>
                <Label className="text-xs">Centro de custo</Label>
                <Select value={filtroCC} onValueChange={setFiltroCC}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {ccsDisponiveis.map((cc) => (
                      <SelectItem key={cc} value={cc}>
                        {cc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Registro de</Label>
                <Input
                  type="date"
                  value={de}
                  onChange={(e) => setDe(e.target.value)}
                  className="w-40"
                />
              </div>
              <div>
                <Label className="text-xs">até</Label>
                <Input
                  type="date"
                  value={ate}
                  onChange={(e) => setAte(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="text-xs text-muted-foreground pb-2">
                {n0(filtrados.length)} processo(s)
              </div>
            </CardContent>
          </Card>

          {semSolicitacao.length > 0 && (
            <Card className="border-warning">
              <CardContent className="pt-4 space-y-3">
                <div className="flex gap-3">
                  <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium mb-1">
                      {semSolicitacao.length} conta(s) com volume relevante e nenhuma solicitação
                      registrada
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Volume alto com zero solicitação indica fluxo próprio da conta, não falha de
                      execução. Mantê-las na base achata a taxa global e distorce a leitura.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {semSolicitacao.map((c) => {
                    const j = justDoCC(c.centro_custo);
                    return (
                      <div
                        key={c.centro_custo}
                        className="flex items-center gap-2 border rounded-md px-2.5 py-1.5 bg-card"
                      >
                        <span className="text-sm font-medium">{c.centro_custo}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {n0(c.registrados)} proc.
                        </Badge>
                        {j ? (
                          <Badge className="bg-success/10 text-success border-0 text-[10px]">
                            {catDe(j.categoria_id)?.nome ?? "justificada"}
                          </Badge>
                        ) : (
                          podeEditar && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              onClick={() => {
                                setAlvoJust({ escopo: "centro_custo", cc: c.centro_custo });
                                setOpenJust(true);
                              }}
                            >
                              justificar
                            </Button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer pt-2 border-t">
                  <input
                    type="checkbox"
                    checked={excluirSemSol}
                    onChange={(e) => setExcluirSemSol(e.target.checked)}
                  />
                  Excluir essas contas dos indicadores abaixo
                </label>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Registrados
                </div>
                <div className="text-2xl font-semibold">{n0(funilAjustado.registrados)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">no escopo</div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Solicitados
                </div>
                <div className="text-2xl font-semibold text-primary">
                  {n0(funilAjustado.solicitados)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {funilAjustado.taxaSolicitacao.toFixed(1)}% dos registrados
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-success">
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Fechados
                </div>
                <div className="text-2xl font-semibold text-success">
                  {n0(funilAjustado.fechados)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {funilAjustado.taxaFechamento.toFixed(1)}% dos solicitados
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Pendentes
                </div>
                <div className="text-2xl font-semibold text-warning">
                  {n0(funilAjustado.pendentesSolicitacao)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">sem solicitação</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Fila financeira
                </div>
                <div className="text-2xl font-semibold">
                  {n0(funilAjustado.aguardandoFechamento)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  solicitados, não fechados
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="funil">
            <TabsList>
              <TabsTrigger value="funil">Funil e prazos</TabsTrigger>
              <TabsTrigger value="evolucao">Evolução</TabsTrigger>
              <TabsTrigger value="carteiras">Carteiras</TabsTrigger>
              <TabsTrigger value="gaps">Gaps e justificativas</TabsTrigger>
              <TabsTrigger value="categorias">Categorias</TabsTrigger>
            </TabsList>

            <TabsContent value="funil" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Conversão entre etapas</CardTitle>
                  <CardDescription>
                    A responsabilidade da operação termina na solicitação de fechamento
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    {
                      l: "Registrados",
                      v: funilAjustado.registrados,
                      pct: 100,
                      cor: "bg-muted-foreground",
                    },
                    {
                      l: "Solicitação de fechamento",
                      v: funilAjustado.solicitados,
                      pct: funilAjustado.taxaSolicitacao,
                      cor: "bg-primary",
                    },
                    {
                      l: "Fechamento efetivo",
                      v: funilAjustado.fechados,
                      pct:
                        funilAjustado.registrados > 0
                          ? (funilAjustado.fechados / funilAjustado.registrados) * 100
                          : 0,
                      cor: "bg-success",
                    },
                  ].map((e) => (
                    <div key={e.l}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{e.l}</span>
                        <span>
                          {n0(e.v)}{" "}
                          <span className="text-muted-foreground">({e.pct.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="h-6 bg-muted rounded overflow-hidden">
                        <div
                          className={`h-full ${e.cor}`}
                          style={{ width: `${Math.max(e.pct, 1)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-primary/5 border-l-2 border-primary">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">
                        Perna da operação
                      </div>
                      <div className="font-semibold text-primary text-xl">
                        {funilAjustado.taxaSolicitacao.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        registro → solicitação · mediana {lt.registroSolicitacao.mediana.toFixed(0)}{" "}
                        dias
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-success/5 border-l-2 border-success">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">
                        Perna do financeiro
                      </div>
                      <div className="font-semibold text-success text-xl">
                        {funilAjustado.taxaFechamento.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        solicitação → fechamento · mediana{" "}
                        {lt.solicitacaoFechamento.mediana.toFixed(0)} dias
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[
                  {
                    t: "Registro → Solicitação",
                    s: "Tempo sob responsabilidade da operação",
                    e: lt.registroSolicitacao,
                  },
                  {
                    t: "Solicitação → Fechamento",
                    s: "Tempo sob responsabilidade do financeiro",
                    e: lt.solicitacaoFechamento,
                  },
                ].map((b) => (
                  <Card key={b.t}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{b.t}</CardTitle>
                      <CardDescription>{b.s}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        {[
                          { l: "Mediana", v: b.e.mediana.toFixed(0) },
                          { l: "Média", v: b.e.media.toFixed(1) },
                          { l: "P90", v: b.e.p90.toFixed(0) },
                        ].map((x) => (
                          <div key={x.l} className="p-2 rounded bg-muted">
                            <div className="text-xs text-muted-foreground">{x.l}</div>
                            <div className="text-xl font-semibold">
                              {x.v}
                              <span className="text-xs font-normal text-muted-foreground ml-0.5">
                                d
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {n0(b.e.n)} processo(s) medido(s) · máximo {b.e.max} dias
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Idade dos pendentes de solicitação</CardTitle>
                  <CardDescription>
                    Mediana de {aging.estat.mediana.toFixed(0)} dias desde o registro
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={aging.faixas} margin={{ top: 8, right: 12, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => [n0(v), "Processos"]} />
                      <Bar dataKey="qtd" name="Processos" radius={[4, 4, 0, 0]}>
                        {aging.faixas.map((_, i) => (
                          <Cell key={i} fill={[C.s, C.p, C.w, C.w, C.d][i]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {(lt.inconsistencias.solicitacaoAntesRegistro > 0 ||
                lt.inconsistencias.fechamentoAntesSolicitacao > 0) && (
                <Card className="border-destructive">
                  <CardContent className="pt-4 flex gap-3">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <div className="font-medium mb-1">Inconsistências de data na origem</div>
                      <p className="text-muted-foreground">
                        {lt.inconsistencias.solicitacaoAntesRegistro > 0 &&
                          `${n0(lt.inconsistencias.solicitacaoAntesRegistro)} processo(s) com solicitação anterior ao registro. `}
                        {lt.inconsistencias.fechamentoAntesSolicitacao > 0 &&
                          `${n0(lt.inconsistencias.fechamentoAntesSolicitacao)} com fechamento anterior à solicitação. `}
                        Ficam fora do cálculo de prazo, mas vale corrigir no Sigraweb.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="evolucao" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Volume mensal por etapa</CardTitle>
                  <CardDescription>
                    Cada etapa é contada pela sua própria data. O descompasso entre as barras num
                    mesmo mês é esperado: o processo registrado no fim do mês só é solicitado no mês
                    seguinte.
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={evolucao.map((e) => ({ ...e, mes: fmtMes(e.mes) }))}
                      margin={{ top: 8, right: 12, left: -18 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => n0(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="registrados"
                        name="Registrados"
                        fill={C.m}
                        fillOpacity={0.45}
                        radius={[3, 3, 0, 0]}
                      />
                      <Bar
                        dataKey="solicitados"
                        name="Solicitados"
                        fill={C.p}
                        radius={[3, 3, 0, 0]}
                      />
                      <Bar dataKey="fechados" name="Fechados" fill={C.s} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Taxa de solicitação por mês</CardTitle>
                  <CardDescription>Solicitações ÷ registros do mesmo mês</CardDescription>
                </CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={evolucao.map((e) => ({
                        mes: fmtMes(e.mes),
                        taxa:
                          e.registrados > 0
                            ? Number(((e.solicitados / e.registrados) * 100).toFixed(1))
                            : 0,
                      }))}
                      margin={{ top: 8, right: 12, left: -18 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Line
                        type="monotone"
                        dataKey="taxa"
                        name="Taxa de solicitação"
                        stroke={C.p}
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="carteiras" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Desempenho por centro de custo</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Centro de custo</TableHead>
                        <TableHead className="text-right">Registrados</TableHead>
                        <TableHead className="text-right">Solicitados</TableHead>
                        <TableHead className="w-32">Taxa</TableHead>
                        <TableHead className="text-right">Fechados</TableHead>
                        <TableHead className="text-right">Pendentes</TableHead>
                        <TableHead className="text-right">Mediana R→S</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resumoCC.map((c) => {
                        const zero = c.solicitados === 0 && c.registrados >= 50;
                        return (
                          <TableRow key={c.centro_custo} className={zero ? "opacity-70" : ""}>
                            <TableCell className="font-medium">
                              {c.centro_custo}
                              {zero && (
                                <Badge variant="outline" className="ml-2 text-[10px]">
                                  fluxo próprio?
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{n0(c.registrados)}</TableCell>
                            <TableCell className="text-right">{n0(c.solicitados)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={Math.min(c.taxaSolicitacao, 100)}
                                  className="h-1.5 flex-1"
                                />
                                <span
                                  className={`text-xs font-medium w-11 text-right ${
                                    c.taxaSolicitacao >= 90
                                      ? "text-success"
                                      : c.taxaSolicitacao >= 60
                                        ? "text-warning"
                                        : "text-destructive"
                                  }`}
                                >
                                  {c.taxaSolicitacao.toFixed(0)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{n0(c.fechados)}</TableCell>
                            <TableCell className="text-right">{n0(c.pendentes)}</TableCell>
                            <TableCell className="text-right">
                              {c.medianaRegSol != null ? `${c.medianaRegSol.toFixed(0)}d` : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="gaps" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Pendentes
                    </div>
                    <div className="text-2xl font-semibold text-warning">
                      {n0(pendentes.length)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Justificados
                    </div>
                    <div className="text-2xl font-semibold text-success">
                      {n0(pendentes.length - pendentesSemJust.length)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Sem justificativa
                    </div>
                    <div className="text-2xl font-semibold text-destructive">
                      {n0(pendentesSemJust.length)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Cobertura
                    </div>
                    <div className="text-2xl font-semibold">
                      {pendentes.length > 0
                        ? (
                            ((pendentes.length - pendentesSemJust.length) / pendentes.length) *
                            100
                          ).toFixed(0)
                        : 0}
                      %
                    </div>
                  </CardContent>
                </Card>
              </div>

              {justs.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Justificativas por categoria</CardTitle>
                    <CardDescription>
                      O que está marcado como esperado não deve ser cobrado como falha da equipe
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {cats.map((cat) => {
                      const qtd = justs.filter((j) => j.categoria_id === cat.id).length;
                      if (qtd === 0) return null;
                      return (
                        <div key={cat.id} className="flex items-center gap-3 text-sm">
                          <Badge
                            className={`text-[10px] border-0 shrink-0 ${
                              cat.conta_como_gap
                                ? "bg-destructive/10 text-destructive"
                                : "bg-success/10 text-success"
                            }`}
                          >
                            {cat.conta_como_gap ? "gap" : "esperado"}
                          </Badge>
                          <span className="flex-1 truncate">{cat.nome}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {RESP_LABEL[cat.responsavel]}
                          </Badge>
                          <span className="font-medium w-10 text-right">{qtd}</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pendentes sem justificativa</CardTitle>
                  <CardDescription>
                    Mais antigos primeiro · exibindo até 50 de {n0(pendentesSemJust.length)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {pendentesSemJust.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">
                      Todos os pendentes têm justificativa registrada.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sigra</TableHead>
                          <TableHead>Centro de custo</TableHead>
                          <TableHead>DI</TableHead>
                          <TableHead>Registro</TableHead>
                          <TableHead className="text-right">Dias</TableHead>
                          {podeEditar && <TableHead className="w-12" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...pendentesSemJust]
                          .sort((a, b) =>
                            (a.data_registro ?? "").localeCompare(b.data_registro ?? ""),
                          )
                          .slice(0, 50)
                          .map((p) => {
                            const d = diasDesde(p.data_registro);
                            return (
                              <TableRow key={p.sigra}>
                                <TableCell className="font-mono text-xs">{p.sigra}</TableCell>
                                <TableCell className="text-xs">{p.centro_custo ?? "—"}</TableCell>
                                <TableCell className="font-mono text-xs">{p.di ?? "—"}</TableCell>
                                <TableCell className="text-xs">{fmtD(p.data_registro)}</TableCell>
                                <TableCell
                                  className={`text-right text-xs font-medium ${
                                    d > 60 ? "text-destructive" : d > 30 ? "text-warning" : ""
                                  }`}
                                >
                                  {d}
                                </TableCell>
                                {podeEditar && (
                                  <TableCell>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        setAlvoJust({ escopo: "processo", processo: p });
                                        setOpenJust(true);
                                      }}
                                    >
                                      <MessageSquarePlus className="h-3.5 w-3.5" />
                                    </Button>
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="categorias" className="space-y-4 mt-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm text-muted-foreground max-w-2xl">
                  A taxonomia é editável. O campo <strong>conta como gap</strong> separa falha de
                  execução de comportamento esperado do fluxo — é isso que sustenta o número levado
                  à diretoria.
                </p>
                {eUmDe(["gestor", "coordenador"]) && (
                  <Button size="sm" onClick={() => setOpenCat(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Nova categoria
                  </Button>
                )}
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Classificação</TableHead>
                        <TableHead className="text-right">Usos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cats.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {c.descricao ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {RESP_LABEL[c.responsavel]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-[10px] border-0 ${
                                c.conta_como_gap
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-success/10 text-success"
                              }`}
                            >
                              {c.conta_como_gap ? "conta como gap" : "esperado"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {justs.filter((j) => j.categoria_id === c.id).length}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog open={openJust} onOpenChange={setOpenJust}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {alvoJust?.escopo === "centro_custo"
                ? `Justificar carteira ${alvoJust.cc}`
                : `Justificar processo ${alvoJust?.processo?.sigra ?? ""}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {alvoJust?.escopo === "centro_custo" && (
              <p className="text-xs text-muted-foreground">
                A justificativa vale para todos os pendentes desta carteira.
              </p>
            )}
            <div>
              <Label>Categoria *</Label>
              <Select
                value={formJust.categoria_id}
                onValueChange={(v) => setFormJust((f) => ({ ...f, categoria_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {cats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} {c.conta_como_gap ? "· gap" : "· esperado"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Detalhamento</Label>
              <Textarea
                rows={3}
                value={formJust.justificativa}
                onChange={(e) => setFormJust((f) => ({ ...f, justificativa: e.target.value }))}
                placeholder="Contexto específico, se houver"
              />
            </div>
            <Button
              onClick={() => salvarJust.mutate()}
              disabled={salvarJust.isPending}
              className="w-full"
            >
              {salvarJust.isPending ? "Salvando..." : "Registrar justificativa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openCat} onOpenChange={setOpenCat}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova categoria de justificativa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input
                value={formCat.nome}
                onChange={(e) => setFormCat((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                rows={2}
                value={formCat.descricao}
                onChange={(e) => setFormCat((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsável</Label>
                <Select
                  value={formCat.responsavel}
                  onValueChange={(v) => setFormCat((f) => ({ ...f, responsavel: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RESP_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Classificação</Label>
                <Select
                  value={formCat.conta_como_gap}
                  onValueChange={(v) => setFormCat((f) => ({ ...f, conta_como_gap: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Conta como gap</SelectItem>
                    <SelectItem value="0">Comportamento esperado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={() => salvarCat.mutate()}
              disabled={salvarCat.isPending}
              className="w-full"
            >
              {salvarCat.isPending ? "Salvando..." : "Criar categoria"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
