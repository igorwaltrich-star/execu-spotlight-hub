import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

/** Uma coluna da planilha modelo. */
export type CampoPlanilha = {
  /** Cabeçalho exibido na planilha */
  coluna: string;
  /** Valor de exemplo na linha de amostra */
  exemplo?: string | number;
  /** Marca como obrigatório na validação padrão */
  obrigatorio?: boolean;
  /** Largura da coluna no Excel */
  largura?: number;
};

/** Resultado do mapeamento de uma linha. */
export type ResultadoLinha =
  | { ok: true; registro: Record<string, unknown> }
  | { ok: false; erro: string };

type Props = {
  /** Nome do arquivo modelo, sem extensão */
  nomeArquivo: string;
  /** Nome da aba dentro do Excel */
  nomeAba?: string;
  /** Tabela de destino no Supabase */
  tabela: string;
  /** Colunas do modelo */
  campos: CampoPlanilha[];
  /**
   * Converte uma linha já normalizada (chaves em minúsculo, sem acento
   * e com _ no lugar de espaço) no registro a ser gravado.
   * Devolver `{ ok: false, erro }` rejeita a linha e mostra o motivo.
   */
  montarRegistro: (linha: Record<string, string>) => ResultadoLinha;
  /** Colunas usadas para upsert. Sem isso, faz insert simples. */
  onConflict?: string;
  /** Chaves do react-query a invalidar após importar */
  invalidar: string[];
  /** Texto de ajuda exibido no diálogo de erros */
  ajuda?: string;
  /** Some com os botões quando o usuário não pode escrever */
  desabilitado?: boolean;
};

/** Normaliza cabeçalho: "Ref. Cliente" -> "ref_cliente" */
const normalizar = (k: string) =>
  k
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "_");

export function ImportarPlanilha({
  nomeArquivo,
  nomeAba = "Dados",
  tabela,
  campos,
  montarRegistro,
  onConflict,
  invalidar,
  ajuda,
  desabilitado,
}: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [erros, setErros] = useState<{ linha: number; erro: string }[]>([]);
  const [openErros, setOpenErros] = useState(false);
  const [resumo, setResumo] = useState<{ total: number; gravados: number } | null>(null);

  const baixarModelo = () => {
    const exemplo: Record<string, string | number> = {};
    campos.forEach((c) => {
      exemplo[c.coluna] = c.exemplo ?? "";
    });

    const ws = XLSX.utils.json_to_sheet([exemplo]);
    ws["!cols"] = campos.map((c) => ({ wch: c.largura ?? Math.max(c.coluna.length + 4, 14) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, nomeAba);

    // Aba com as instruções de preenchimento
    const instrucoes = campos.map((c) => ({
      Coluna: c.coluna,
      Obrigatório: c.obrigatorio ? "Sim" : "Não",
      Exemplo: String(c.exemplo ?? ""),
    }));
    const wsI = XLSX.utils.json_to_sheet(instrucoes);
    wsI["!cols"] = [{ wch: 26 }, { wch: 14 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsI, "Instruções");

    XLSX.writeFile(wb, `modelo-${nomeArquivo}.xlsx`);
    toast.success("Modelo baixado");
  };

  const importar = async (file: File) => {
    setImportando(true);
    setErros([]);
    setResumo(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      // usa a primeira aba que não seja a de instruções
      const nomeDados =
        wb.SheetNames.find((n) => normalizar(n) !== "instrucoes") ?? wb.SheetNames[0];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[nomeDados], {
        defval: "",
      });

      if (json.length === 0) {
        toast.error("A planilha está vazia");
        return;
      }

      const registros: Record<string, unknown>[] = [];
      const falhas: { linha: number; erro: string }[] = [];

      json.forEach((bruta, i) => {
        const linha: Record<string, string> = {};
        Object.entries(bruta).forEach(([k, v]) => {
          linha[normalizar(k)] = String(v ?? "").trim();
        });

        // ignora linhas totalmente vazias
        if (Object.values(linha).every((v) => v === "")) return;

        // obrigatórios declarados no modelo
        const faltando = campos
          .filter((c) => c.obrigatorio && !linha[normalizar(c.coluna)])
          .map((c) => c.coluna);
        if (faltando.length > 0) {
          falhas.push({ linha: i + 2, erro: `Faltando: ${faltando.join(", ")}` });
          return;
        }

        const r = montarRegistro(linha);
        if (r.ok) registros.push(r.registro);
        else falhas.push({ linha: i + 2, erro: r.erro });
      });

      if (registros.length > 0) {
        const q = supabase.from(tabela);
        const { error } = onConflict
          ? await q.upsert(registros as never[], { onConflict })
          : await q.insert(registros as never[]);
        if (error) throw error;
        invalidar.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      }

      setResumo({ total: registros.length + falhas.length, gravados: registros.length });
      setErros(falhas);

      if (falhas.length > 0) {
        setOpenErros(true);
        toast.warning(`${registros.length} importado(s), ${falhas.length} com erro`);
      } else {
        toast.success(`${registros.length} registro(s) importado(s)`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar planilha");
    } finally {
      setImportando(false);
    }
  };

  if (desabilitado) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={baixarModelo}>
        <Download className="h-4 w-4 mr-1.5" />
        Modelo
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={importando}
      >
        <Upload className="h-4 w-4 mr-1.5" />
        {importando ? "Importando..." : "Importar"}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importar(f);
          e.target.value = "";
        }}
      />

      <Dialog open={openErros} onOpenChange={setOpenErros}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Linhas não importadas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {resumo && (
              <div className="flex gap-2">
                <Badge className="bg-success/10 text-success border-0">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {resumo.gravados} importada(s)
                </Badge>
                <Badge className="bg-destructive/10 text-destructive border-0">
                  {erros.length} com erro
                </Badge>
              </div>
            )}
            {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
            <div className="max-h-72 overflow-y-auto space-y-1">
              {erros.map((e, i) => (
                <div key={i} className="text-sm flex gap-2 p-2 rounded border">
                  <span className="text-muted-foreground shrink-0">Linha {e.linha}</span>
                  <span>{e.erro}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              As linhas válidas já foram gravadas. Corrija as listadas acima e importe novamente
              apenas elas.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Converte "2026-08" ou "08/2026" em "2026-08-01". Devolve null se inválido. */
export function parseMes(v: string): string | null {
  const s = v.trim();
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{2})\/(\d{4})$/);
  if (br) return `${br[2]}-${br[1]}-01`;
  return null;
}

/** Converte "2026-08-15" ou "15/08/2026" em "2026-08-15". Devolve null se inválido. */
export function parseData(v: string): string | null {
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

/**
 * Converte texto em número aceitando os dois formatos.
 *
 * Com vírgula, assume padrão brasileiro: ponto é milhar, vírgula é decimal
 * ("1.250,50" -> 1250.5). Sem vírgula, o ponto só vira milhar quando o
 * número tem o formato clássico de agrupamento ("1.250" -> 1250);
 * caso contrário é decimal ("22.5" -> 22.5).
 */
export function parseNum(v: string): number {
  const s = (v ?? "").toString().trim();
  if (!s) return 0;

  let limpo: string;
  if (s.includes(",")) {
    limpo = s.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    limpo = s.replace(/\./g, "");
  } else {
    limpo = s;
  }

  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

/** Busca por nome, ignorando caixa e acentos. */
export function buscarPorNome<T extends { id: string; nome: string }>(
  lista: T[],
  nome: string,
): T | undefined {
  const alvo = normalizar(nome);
  return lista.find((x) => normalizar(x.nome) === alvo);
}
