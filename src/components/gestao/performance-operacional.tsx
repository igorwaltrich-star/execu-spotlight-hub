import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Sparkles,
  Loader2,
  FileText,
  AlertCircle,
  Lightbulb,
  CheckCircle2,
  X,
  FileSpreadsheet,
  FileType,
  TableIcon,
  Download,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { analyzePerformanceReport, type AnalyseResult } from "@/lib/performance-ia.functions";

type TipoArquivo = "sla_midea" | "sla_bosch" | "operacional";
type ArquivoItem = { file: File; tipo: TipoArquivo };

const ACCEPT = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "text/csv": [".csv"],
  "application/pdf": [".pdf"],
};

const MAX_CHARS_POR_ARQUIVO = 150_000;
const MAX_CHARS_POR_ABA = 60_000;

function formatDateBR(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const s = String(value).trim();
  if (!s || s === "-" || s.toLowerCase() === "n/a") return s;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (br) {
    const d = br[1].padStart(2, "0");
    const m = br[2].padStart(2, "0");
    const y = br[3].length === 4 ? br[3].slice(-2) : br[3];
    return `${d}/${m}/${y}`;
  }
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 59 && serial < 80000) {
      const ms = Math.round((serial - 25569) * 86400 * 1000);
      const dt = new Date(ms);
      if (!isNaN(dt.getTime())) return fmtDt(dt);
    }
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime()) && /\d{4}/.test(s)) return fmtDt(dt);
  return s;
}

function fmtDt(dt: Date): string {
  const d = String(dt.getUTCDate()).padStart(2, "0");
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const y = String(dt.getUTCFullYear()).slice(-2);
  return `${d}/${m}/${y}`;
}


function fileIcon(name: string) {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return <FileType className="h-4 w-4 text-destructive" />;
  if (n.endsWith(".csv")) return <FileText className="h-4 w-4 text-primary" />;
  return <FileSpreadsheet className="h-4 w-4 text-success" />;
}

function sheetToMarkdown(ws: XLSX.WorkSheet): string {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "" });
  if (rows.length === 0) return "";
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const lines: string[] = [];
  rows.forEach((r, idx) => {
    const cells: string[] = [];
    for (let i = 0; i < maxCols; i++) {
      const v = r[i];
      cells.push(v === null || v === undefined ? "" : String(v).replace(/\|/g, "/").replace(/\n/g, " ").trim());
    }
    lines.push(`| ${cells.join(" | ")} |`);
    if (idx === 0) lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
  });
  return lines.join("\n");
}

async function extractExcerpt(file: File): Promise<string | undefined> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith(".csv")) {
      const text = await file.text();
      return text.slice(0, MAX_CHARS_POR_ARQUIVO);
    }
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const parts: string[] = [];
      let total = 0;
      for (const sheetName of wb.SheetNames) {
        if (total >= MAX_CHARS_POR_ARQUIVO) break;
        const md = sheetToMarkdown(wb.Sheets[sheetName]);
        const restante = MAX_CHARS_POR_ARQUIVO - total;
        const slice = md.slice(0, Math.min(MAX_CHARS_POR_ABA, restante));
        parts.push(`## Aba: ${sheetName}\n${slice}`);
        total += slice.length;
      }
      return parts.join("\n\n");
    }
  } catch {
    return undefined;
  }
  return undefined;
}


const STATUS_LABEL: Record<"ok" | "atencao" | "critico", { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-success/15 text-success border-success/30" },
  atencao: { label: "Atenção", cls: "bg-warning/15 text-warning border-warning/30" },
  critico: { label: "Crítico", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export function PerformanceOperacional() {
  const [items, setItems] = useState<ArquivoItem[]>([]);
  const [contexto, setContexto] = useState("");
  const [metaPadrao, setMetaPadrao] = useState<number>(95);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyseResult | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    setItems((prev) =>
      [...prev, ...accepted.map((f) => ({ file: f, tipo: "operacional" as TipoArquivo }))].slice(0, 10),
    );
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: 10 * 1024 * 1024,
    onDropRejected: () => toast.error("Arquivo inválido ou maior que 10MB"),
  });

  const handleAnalyze = async () => {
    if (items.length === 0) {
      toast.error("Adicione pelo menos um arquivo");
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const filesPayload = await Promise.all(
        items.map(async (it) => ({
          name: it.file.name,
          size: it.file.size,
          tipo: it.tipo,
          excerpt: await extractExcerpt(it.file),
        })),
      );
      const data = await analyzePerformanceReport({
        data: {
          files: filesPayload,
          contexto: contexto.trim() || undefined,
          metaPadrao,
        },
      });
      setResult(data);
      toast.success("Análise concluída");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na análise");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Análise Inteligente de Performance
          </CardTitle>
          <CardDescription>
            Envie relatórios operacionais (.xlsx, .csv, .pdf) e classifique cada arquivo por tipo de
            SLA. A IA aplica o checklist completo de validações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">
              {isDragActive
                ? "Solte os arquivos aqui"
                : "Arraste arquivos ou clique para selecionar"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              .xlsx, .csv, .pdf · até 10 arquivos · máx 10MB cada
            </p>
          </div>

          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((it, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-md border bg-muted/30 gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {fileIcon(it.file.name)}
                    <span className="text-sm truncate">{it.file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(it.file.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                  <Select
                    value={it.tipo}
                    onValueChange={(v) =>
                      setItems((prev) =>
                        prev.map((p, j) => (j === i ? { ...p, tipo: v as TipoArquivo } : p)),
                      )
                    }
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sla_midea">SLA Midea</SelectItem>
                      <SelectItem value="sla_bosch">SLA Bosch</SelectItem>
                      <SelectItem value="operacional">Operacional</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-4">
            <div className="space-y-2">
              <Label htmlFor="meta-padrao">Meta padrão (%)</Label>
              <Input
                id="meta-padrao"
                type="number"
                min={0}
                max={100}
                value={metaPadrao}
                onChange={(e) => setMetaPadrao(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contexto-ia">Contexto adicional (opcional)</Label>
              <Textarea
                id="contexto-ia"
                placeholder="Ex.: Foco em SLA OTCC dos últimos 60 dias, unidades Midea SC e RS..."
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </div>
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={analyzing || items.length === 0}
            size="lg"
            className="w-full"
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analisando dados e gerando insights...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Analisar com IA
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Resumo Executivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {result.resumo}
              </p>
            </CardContent>
          </Card>

          {result.validacoesSLA && result.validacoesSLA.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Validações de SLA
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const v = result.validacoesSLA!;
                      const aoa = [
                        ["Indicador", "Unidade", "Meta", "Valor Médio", "Melhor Mês", "Pior Mês", "Status", "Justificativa"],
                        ...v.map((x) => [
                          x.indicador,
                          x.unidade ?? "",
                          x.meta,
                          x.valorMedio,
                          x.melhorMes ?? "",
                          x.piorMes ?? "",
                          STATUS_LABEL[x.status].label,
                          x.justificativa,
                        ]),
                      ];
                      const ws = XLSX.utils.aoa_to_sheet(aoa);
                      ws["!cols"] = [12, 14, 8, 12, 14, 14, 10, 60].map((w) => ({ wch: w }));
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Validações SLA");
                      const ts = new Date().toISOString().slice(0, 10);
                      XLSX.writeFile(wb, `validacoes-sla-${ts}.xlsx`);
                      toast.success("Validações exportadas");
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicador</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Meta</TableHead>
                        <TableHead>Médio</TableHead>
                        <TableHead>Melhor</TableHead>
                        <TableHead>Pior</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="min-w-[280px]">Justificativa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.validacoesSLA.map((v, i) => {
                        const s = STATUS_LABEL[v.status];
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{v.indicador}</TableCell>
                            <TableCell className="text-sm">{v.unidade ?? "-"}</TableCell>
                            <TableCell className="text-sm">{v.meta}</TableCell>
                            <TableCell className="text-sm font-medium">{v.valorMedio}</TableCell>
                            <TableCell className="text-sm">{v.melhorMes ?? "-"}</TableCell>
                            <TableCell className="text-sm">{v.piorMes ?? "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={s.cls}>
                                {s.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {v.justificativa}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Pontos Críticos / Gargalos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.pontosCriticos.map((p, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-md border bg-destructive/5">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm">{p.titulo}</h4>
                      <Badge variant={p.severidade === "alta" ? "destructive" : "secondary"}>
                        {p.severidade === "alta" ? "Alta" : "Média"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{p.descricao}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {result.desempenhoAnalistas && result.desempenhoAnalistas.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Desempenho por Analista
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const d = result.desempenhoAnalistas!;
                      const aoa = [
                        ["Analista", "Total Processos", "SLA Atendidos", "SLA Vencidos", "% SLA", "Campos em Branco", "Backlogs", "Score", "Status", "Observação"],
                        ...d.map((x) => [
                          x.analista,
                          x.totalProcessos,
                          x.slaAtendidos,
                          x.slaVencidos,
                          x.percentualSLA,
                          x.camposEmBranco,
                          x.backlogs,
                          x.scorePerformance,
                          STATUS_LABEL[x.status].label,
                          x.observacao,
                        ]),
                      ];
                      const ws = XLSX.utils.aoa_to_sheet(aoa);
                      ws["!cols"] = [22, 12, 14, 14, 8, 14, 32, 10, 10, 60].map((w) => ({ wch: w }));
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Desempenho Analistas");
                      const ts = new Date().toISOString().slice(0, 10);
                      XLSX.writeFile(wb, `desempenho-analistas-${ts}.xlsx`);
                      toast.success("Desempenho exportado");
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Analista</TableHead>
                        <TableHead className="text-right">Processos</TableHead>
                        <TableHead>SLA Atendidos</TableHead>
                        <TableHead>SLA Vencidos</TableHead>
                        <TableHead className="text-right">% SLA</TableHead>
                        <TableHead className="text-right">Campos em Branco</TableHead>
                        <TableHead>Backlogs</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="min-w-[260px]">Observação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.desempenhoAnalistas.map((d, i) => {
                        const s = STATUS_LABEL[d.status];
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{d.analista}</TableCell>
                            <TableCell className="text-right text-sm">{d.totalProcessos}</TableCell>
                            <TableCell className="text-sm text-success">{d.slaAtendidos}</TableCell>
                            <TableCell className="text-sm text-destructive">{d.slaVencidos}</TableCell>
                            <TableCell className="text-right text-sm font-medium">{d.percentualSLA}</TableCell>
                            <TableCell className="text-right text-sm">{d.camposEmBranco}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{d.backlogs}</TableCell>
                            <TableCell className="text-right text-sm font-semibold">{d.scorePerformance}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={s.cls}>{s.label}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{d.observacao}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {result.embarquesCriticos && result.embarquesCriticos.linhas.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <TableIcon className="h-5 w-5 text-destructive" />
                      Embarques Sinalizados como Críticos
                    </CardTitle>
                    {result.embarquesCriticos.observacao && (
                      <CardDescription>{result.embarquesCriticos.observacao}</CardDescription>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const { colunas, linhas } = result.embarquesCriticos!;
                      const wb = XLSX.utils.book_new();

                      const buildSheet = (rows: string[][]) => {
                        const ws = XLSX.utils.aoa_to_sheet([colunas, ...rows]);
                        ws["!cols"] = colunas.map((c, idx) => ({
                          wch: Math.max(
                            12,
                            Math.min(
                              45,
                              Math.max(c.length, ...rows.map((l) => (l[idx] ?? "").length)) + 2,
                            ),
                          ),
                        }));
                        return ws;
                      };

                      // Aba consolidada
                      XLSX.utils.book_append_sheet(wb, buildSheet(linhas), "Todos");

                      // Detecta coluna de analista
                      const analistaIdx = colunas.findIndex((c) =>
                        /analista|respons|usu[áa]rio|owner|operador|comprador|buyer|pic/i.test(c),
                      );

                      if (analistaIdx >= 0) {
                        const grupos = new Map<string, string[][]>();
                        for (const linha of linhas) {
                          const nome = (linha[analistaIdx] ?? "").trim() || "Não atribuído";
                          if (!grupos.has(nome)) grupos.set(nome, []);
                          grupos.get(nome)!.push(linha);
                        }
                        // Resumo por analista
                        const resumo = [
                          ["Analista", "Total de Pendências"],
                          ...Array.from(grupos.entries())
                            .sort((a, b) => b[1].length - a[1].length)
                            .map(([nome, rows]) => [nome, String(rows.length)]),
                        ];
                        const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
                        wsResumo["!cols"] = [{ wch: 35 }, { wch: 22 }];
                        XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Analistas");

                        // Uma aba por analista (nome sanitizado, max 31 chars)
                        const usados = new Set<string>(["Todos", "Resumo Analistas"]);
                        for (const [nome, rows] of grupos.entries()) {
                          let base = nome.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Sem Nome";
                          let nomeAba = base;
                          let n = 2;
                          while (usados.has(nomeAba)) nomeAba = `${base.slice(0, 28)} ${n++}`;
                          usados.add(nomeAba);
                          XLSX.utils.book_append_sheet(wb, buildSheet(rows), nomeAba);
                        }
                      }

                      const ts = new Date().toISOString().slice(0, 10);
                      XLSX.writeFile(wb, `embarques-criticos-${ts}.xlsx`);
                      toast.success("Tabela exportada com pendências por analista");
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {result.embarquesCriticos.colunas.map((c, i) => (
                          <TableHead key={i}>{c}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.embarquesCriticos.linhas.map((linha, i) => (
                        <TableRow key={i}>
                          {linha.map((cel, j) => {
                            const header = result.embarquesCriticos!.colunas[j] ?? "";
                            const isDateCol = /prazo|realizad|data|dt\b|embarque|sla/i.test(
                              header,
                            );
                            return (
                              <TableCell key={j} className="text-sm">
                                {isDateCol ? formatDateBR(cel) : cel}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-success" />
                Oportunidades e Plano de Ação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.oportunidades.map((o, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-md border bg-success/5">
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <h4 className="font-medium text-sm">{o.titulo}</h4>
                    <p className="text-sm text-muted-foreground">{o.descricao}</p>
                    <p className="text-sm">
                      <span className="font-medium text-primary">Ação: </span>
                      <span className="text-muted-foreground">{o.acao}</span>
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
