import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { toast } from "sonner";
import { analyzePerformanceReport, type AnalyseResult } from "@/lib/performance-ia.functions";

const ACCEPT = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "text/csv": [".csv"],
  "application/pdf": [".pdf"],
};

function fileIcon(name: string) {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return <FileType className="h-4 w-4 text-destructive" />;
  if (n.endsWith(".csv")) return <FileText className="h-4 w-4 text-primary" />;
  return <FileSpreadsheet className="h-4 w-4 text-success" />;
}

async function extractExcerpt(file: File): Promise<string | undefined> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith(".csv")) {
      const text = await file.text();
      return text.slice(0, 8000);
    }
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const parts: string[] = [];
      for (const sheetName of wb.SheetNames.slice(0, 3)) {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
        parts.push(`# Aba: ${sheetName}\n${csv.slice(0, 4000)}`);
      }
      return parts.join("\n\n").slice(0, 12000);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function PerformanceOperacional() {
  const [files, setFiles] = useState<File[]>([]);
  const [contexto, setContexto] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyseResult | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [...prev, ...accepted].slice(0, 10));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: 10 * 1024 * 1024,
    onDropRejected: () => toast.error("Arquivo inválido ou maior que 10MB"),
  });

  const handleAnalyze = async () => {
    if (files.length === 0) {
      toast.error("Adicione pelo menos um arquivo");
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const filesPayload = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          size: f.size,
          excerpt: await extractExcerpt(f),
        })),
      );
      const data = await analyzePerformanceReport({
        data: { files: filesPayload, contexto: contexto.trim() || undefined },
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
            Envie relatórios operacionais (.xlsx, .csv, .pdf) para receber insights, gargalos e
            plano de ação gerados por IA.
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

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-md border bg-muted/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {fileIcon(f.name)}
                    <span className="text-sm truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

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

          <Button
            onClick={handleAnalyze}
            disabled={analyzing || files.length === 0}
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
              <p className="text-sm leading-relaxed text-muted-foreground">{result.resumo}</p>
            </CardContent>
          </Card>

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
