import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { AlertTriangle, BarChart3, Clock3, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Resumo = {
  id?: string;
  importacao_id: string;
  centro_custo: string;
  usa_fluxo: boolean;
  processos_di: number;
  com_pedido: number;
  percentual_pedido: number;
  sem_pedido: number;
  ate_15: number;
  de_15_30: number;
  de_30_60: number;
  de_60_90: number;
  mais_90: number;
};

type Pendencia = {
  importacao_id: string;
  centro_custo: string;
  processo: string;
  cliente: string | null;
  di_duimp: string | null;
  data_registro: string | null;
  dias_sem_pedido: number;
  faixa: string | null;
  usa_fluxo: boolean;
};

const n0 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const texto = (v: unknown) => String(v ?? "").trim();
const numero = (v: unknown) => {
  if (typeof v === "number") return v;
  const limpo = texto(v).replace(/\./g, "").replace(",", ".").replace("%", "");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
};
const dataIso = (v: unknown) => {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const m = texto(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
};

export function FechamentoPendenteSummary({ podeEditar }: { podeEditar: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["fin_fechamento_pendente"],
    queryFn: async () => {
      const { data: imports, error: importError } = await supabase
        .from("financeiro_fechamento_importacoes")
        .select("id, arquivo_nome, data_referencia, created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      if (importError) throw importError;
      const atual = imports?.[0];
      if (!atual) return null;
      const [{ data: resumos, error: resumoError }, { data: pendencias, error: pendError }] =
        await Promise.all([
          supabase.from("financeiro_fechamento_resumos").select("*").eq("importacao_id", atual.id),
          supabase
            .from("financeiro_fechamento_pendencias")
            .select("*")
            .eq("importacao_id", atual.id)
            .eq("usa_fluxo", true)
            .order("dias_sem_pedido", { ascending: false })
            .limit(100),
        ]);
      if (resumoError) throw resumoError;
      if (pendError) throw pendError;
      return { atual, resumos: (resumos ?? []) as Resumo[], pendencias: (pendencias ?? []) as Pendencia[] };
    },
  });

  const importar = async (file: File) => {
    setImportando(true);
    let importacaoId: string | null = null;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const resumoWs = wb.Sheets["Resumo"];
      const pendWs = wb.Sheets["Sem fechamento"];
      const foraWs = wb.Sheets["Centros sem o fluxo"];
      if (!resumoWs || !pendWs || !foraWs)
        throw new Error('A planilha precisa conter as abas "Resumo", "Sem fechamento" e "Centros sem o fluxo".');

      const resumoLinhas = XLSX.utils.sheet_to_json<unknown[]>(resumoWs, { header: 1, defval: "" });
      const cabecalho = resumoLinhas.findIndex((r) => texto(r[0]).toLowerCase() === "centro de custo");
      if (cabecalho < 0) throw new Error("Cabeçalho do resumo não encontrado.");
      const refTexto = texto(resumoLinhas[1]?.[0]);
      const ref = refTexto.match(/(\d{2})\/(\d{2})\/(\d{4})(?:,\s*(\d{2}):(\d{2}))?/);
      const dataReferencia = ref
        ? `${ref[3]}-${ref[2]}-${ref[1]}T${ref[4] ?? "00"}:${ref[5] ?? "00"}:00-03:00`
        : null;

      const { data: novaImportacao, error: importError } = await supabase
        .from("financeiro_fechamento_importacoes")
        .insert({ arquivo_nome: file.name, data_referencia: dataReferencia, importado_por: user?.id })
        .select("id")
        .single();
      if (importError) throw importError;
      importacaoId = novaImportacao.id;

      const resumos: Resumo[] = resumoLinhas
        .slice(cabecalho + 1)
        .filter((r) => texto(r[0]) && texto(r[0]).toLowerCase() !== "total")
        .map((r) => ({
          importacao_id: novaImportacao.id,
          centro_custo: texto(r[0]),
          usa_fluxo: texto(r[1]).toLowerCase() !== "não",
          processos_di: numero(r[2]),
          com_pedido: numero(r[3]),
          percentual_pedido: numero(r[4]) <= 1 ? numero(r[4]) * 100 : numero(r[4]),
          sem_pedido: numero(r[5]),
          ate_15: numero(r[6]),
          de_15_30: numero(r[7]),
          de_30_60: numero(r[8]),
          de_60_90: numero(r[9]),
          mais_90: numero(r[10]),
        }));
      if (resumos.length === 0) throw new Error("Nenhum centro de custo encontrado no resumo.");

      const lerPendencias = (ws: XLSX.WorkSheet, usaFluxo: boolean): Pendencia[] =>
        XLSX.utils
          .sheet_to_json<unknown[]>(ws, { header: 1, defval: "" })
          .slice(1)
          .filter((r) => texto(r[0]) && texto(r[1]))
          .map((r) => ({
            importacao_id: novaImportacao.id,
            centro_custo: texto(r[0]),
            processo: texto(r[1]),
            cliente: texto(r[2]) || null,
            di_duimp: texto(r[3]) || null,
            data_registro: dataIso(r[4]),
            dias_sem_pedido: numero(r[5]),
            faixa: texto(r[6]) || null,
            usa_fluxo: usaFluxo,
          }));

      const pendencias = [...lerPendencias(pendWs, true), ...lerPendencias(foraWs, false)];
      const inserirLotes = async (tabela: "financeiro_fechamento_resumos" | "financeiro_fechamento_pendencias", linhas: Resumo[] | Pendencia[]) => {
        for (let i = 0; i < linhas.length; i += 500) {
          const { error } = await supabase.from(tabela).insert(linhas.slice(i, i + 500) as never[]);
          if (error) throw error;
        }
      };
      await inserirLotes("financeiro_fechamento_resumos", resumos);
      await inserirLotes("financeiro_fechamento_pendencias", pendencias);
      await qc.invalidateQueries({ queryKey: ["fin_fechamento_pendente"] });
      toast.success(`${n0(resumos.length)} centros e ${n0(pendencias.length)} pendências importados`);
    } catch (e) {
      if (importacaoId) await supabase.from("financeiro_fechamento_importacoes").delete().eq("id", importacaoId);
      toast.error(e instanceof Error ? e.message : "Falha ao importar a planilha");
    } finally {
      setImportando(false);
    }
  };

  const gerencial = useMemo(() => {
    const base = data?.resumos.filter((r) => r.usa_fluxo) ?? [];
    const soma = (campo: keyof Resumo) => base.reduce((s, r) => s + Number(r[campo] ?? 0), 0);
    const processos = soma("processos_di");
    const pedidos = soma("com_pedido");
    const pendentes = soma("sem_pedido");
    const mais90 = soma("mais_90");
    const taxa = processos > 0 ? (pedidos / processos) * 100 : 0;
    const riscos = [...base].sort((a, b) => b.sem_pedido - a.sem_pedido);
    const top3 = riscos.slice(0, 3).reduce((s, r) => s + r.sem_pedido, 0);
    return { base, processos, pedidos, pendentes, mais90, taxa, riscos, concentracao: pendentes ? (top3 / pendentes) * 100 : 0 };
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Fechamentos pendentes</h2>
          <p className="text-sm text-muted-foreground">Visão gerencial do relatório consolidado do Sigra</p>
        </div>
        {podeEditar && (
          <>
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={importando}>
              <Upload className="h-4 w-4 mr-1.5" />{importando ? "Importando..." : "Importar fechamentos pendentes"}
            </Button>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ""; }} />
          </>
        )}
      </div>

      {!data ? (
        <Card><CardContent className="py-10 text-center"><FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" /><p className="font-medium">{isLoading ? "Carregando..." : "Nenhum consolidado importado"}</p><p className="text-sm text-muted-foreground">Use a planilha com as abas Resumo, Sem fechamento e Centros sem o fluxo.</p></CardContent></Card>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Última posição</Badge>
            <span>{data.atual.data_referencia ? new Date(data.atual.data_referencia).toLocaleString("pt-BR") : new Date(data.atual.created_at).toLocaleString("pt-BR")}</span>
            <span>· {data.atual.arquivo_nome}</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              ["Processos com DI", n0(gerencial.processos), "base que usa o fluxo"],
              ["Com pedido", n0(gerencial.pedidos), `${gerencial.taxa.toFixed(1)}% de cobertura`],
              ["Sem pedido", n0(gerencial.pendentes), "pendência operacional"],
              ["Mais de 90 dias", n0(gerencial.mais90), "prioridade crítica"],
              ["Concentração Top 3", `${gerencial.concentracao.toFixed(1)}%`, "dos pendentes"],
            ].map(([label, value, detail]) => (
              <Card key={label}><CardContent className="pt-4"><div className="text-xs text-muted-foreground uppercase">{label}</div><div className="text-2xl font-semibold mt-1">{value}</div><div className="text-xs text-muted-foreground">{detail}</div></CardContent></Card>
            ))}
          </div>
          <Card className="border-l-4 border-l-warning">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Resumo gerencial</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>A cobertura de pedidos está em <strong>{gerencial.taxa.toFixed(1)}%</strong>. Restam <strong>{n0(gerencial.pendentes)}</strong> processos sem pedido nos centros que utilizam o fluxo.</p>
              <p><strong>{n0(gerencial.mais90)}</strong> pendências superam 90 dias. Os três maiores estoques concentram <strong>{gerencial.concentracao.toFixed(1)}%</strong> do total e devem liderar o plano de recuperação.</p>
              <p className="text-muted-foreground">Centros marcados como “não usam o fluxo” ficam fora destes indicadores para evitar distorção.</p>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Prioridades por centro</CardTitle><CardDescription>Maiores volumes sem pedido de fechamento</CardDescription></CardHeader>
              <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Centro</TableHead><TableHead className="text-right">Sem pedido</TableHead><TableHead className="text-right">+90 dias</TableHead><TableHead className="w-32">Cobertura</TableHead></TableRow></TableHeader><TableBody>
                {gerencial.riscos.slice(0, 10).map((r) => <TableRow key={r.centro_custo}><TableCell className="font-medium">{r.centro_custo}</TableCell><TableCell className="text-right">{n0(r.sem_pedido)}</TableCell><TableCell className="text-right">{n0(r.mais_90)}</TableCell><TableCell><div className="flex items-center gap-2"><Progress value={Math.min(r.percentual_pedido, 100)} className="h-1.5" /><span className="text-xs w-10 text-right">{r.percentual_pedido.toFixed(0)}%</span></div></TableCell></TableRow>)}
              </TableBody></Table></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock3 className="h-4 w-4" />Pendências mais antigas</CardTitle><CardDescription>Processos dos centros que usam o fluxo</CardDescription></CardHeader>
              <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Centro</TableHead><TableHead>Processo</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Dias</TableHead></TableRow></TableHeader><TableBody>
                {data.pendencias.slice(0, 10).map((p) => <TableRow key={`${p.centro_custo}-${p.processo}-${p.di_duimp}`}><TableCell className="text-xs">{p.centro_custo}</TableCell><TableCell className="font-mono text-xs">{p.processo}</TableCell><TableCell className="text-xs max-w-40 truncate">{p.cliente ?? "—"}</TableCell><TableCell className="text-right font-medium text-destructive">{p.dias_sem_pedido}</TableCell></TableRow>)}
              </TableBody></Table></CardContent>
            </Card>
          </div>
          {gerencial.mais90 > 0 && <div className="flex gap-2 items-center text-sm text-warning"><AlertTriangle className="h-4 w-4" />Há estoque crítico acima de 90 dias que exige acompanhamento imediato.</div>}
        </>
      )}
    </div>
  );
}