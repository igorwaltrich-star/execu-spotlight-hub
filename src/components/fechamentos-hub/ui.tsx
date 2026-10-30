import type { ReactNode } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COR_FAIXA, n0, pct } from "./formato";

/** Variação com seta; `bomQuandoSobe` inverte as cores. */
export function Delta({
  v,
  bomQuandoSobe = false,
  sufixo = "",
}: {
  v: number | null | undefined;
  bomQuandoSobe?: boolean;
  sufixo?: string;
}) {
  if (v == null) return <span className="text-muted-foreground">–</span>;
  if (v === 0) return <span className="text-muted-foreground">sem mudança</span>;
  const bom = bomQuandoSobe ? v > 0 : v < 0;
  return (
    <span
      className={cn(
        "font-medium tabular-nums whitespace-nowrap",
        bom ? "text-success" : "text-destructive",
      )}
    >
      {v > 0 ? "▲" : "▼"} {n0(Math.abs(v))}
      {sufixo}
    </span>
  );
}

export function Kpi({
  rotulo,
  valor,
  detalhe,
  alerta,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  alerta?: boolean;
}) {
  return (
    <Card className={cn(alerta && "border-l-4 border-l-destructive")}>
      <CardContent className="pt-4 space-y-1">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{rotulo}</div>
        <div className={cn("text-2xl font-semibold tabular-nums", alerta && "text-destructive")}>
          {valor}
        </div>
        {detalhe && <div className="text-xs text-muted-foreground">{detalhe}</div>}
      </CardContent>
    </Card>
  );
}

export type Barra = { rotulo: string; valor: number; total?: number; cor?: string; nota?: string };

/** Barras horizontais com rótulo e valor; clicáveis quando `aoClicar` é passado. */
export function Barras({
  itens,
  aoClicar,
  ativo,
}: {
  itens: Barra[];
  aoClicar?: (rotulo: string) => void;
  ativo?: string;
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  if (!itens.length)
    return <p className="text-sm text-muted-foreground">Nada a mostrar nesta seleção.</p>;
  return (
    <div className="space-y-2">
      {itens.map((i) => {
        const conteudo = (
          <>
            <span
              className={cn(
                "truncate text-left",
                ativo === i.rotulo && "font-semibold text-primary",
              )}
              title={i.rotulo}
            >
              {i.rotulo}
            </span>
            <span className="h-3 rounded bg-muted overflow-hidden">
              <span
                className="block h-full rounded"
                style={{
                  width: `${(i.valor / max) * 100}%`,
                  background: i.cor ?? "var(--color-primary)",
                }}
              />
            </span>
            <span className="text-right tabular-nums whitespace-nowrap">
              {n0(i.valor)}{" "}
              <span className="text-muted-foreground text-xs">
                {i.nota ?? (i.total ? pct((i.valor / i.total) * 100) : "")}
              </span>
            </span>
          </>
        );
        const cls =
          "grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_5.5rem] gap-3 items-center text-sm w-full";
        return aoClicar ? (
          <button
            key={i.rotulo}
            type="button"
            className={cn(cls, "hover:bg-muted/50 rounded px-1 -mx-1")}
            onClick={() => aoClicar(i.rotulo)}
          >
            {conteudo}
          </button>
        ) : (
          <div key={i.rotulo} className={cls}>
            {conteudo}
          </div>
        );
      })}
    </div>
  );
}

/** Copia linhas como texto separado por tabulação, para colar no Excel ou num e-mail. */
export function BotaoCopiar({
  cabecalho,
  linhas,
  rotulo = "Copiar lista",
}: {
  cabecalho: string[];
  linhas: (string | number | null)[][];
  rotulo?: string;
}) {
  const copiar = async () => {
    const txt = [cabecalho, ...linhas]
      .map((l) => l.map((c) => String(c ?? "").replace(/\t|\n/g, " ")).join("\t"))
      .join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      toast.success(`${n0(linhas.length)} linhas copiadas. Cole no Excel ou no e-mail.`);
    } catch {
      toast.error("Não foi possível copiar. Copie as linhas direto da tabela.");
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={copiar} disabled={!linhas.length}>
      <Copy className="h-4 w-4 mr-1.5" />
      {rotulo}
    </Button>
  );
}

/** Barra empilhada pelas faixas de dias. */
export function Empilhada({
  valores,
  altura = "h-2.5",
  largura = "w-36",
  rotulos = false,
}: {
  valores: number[];
  altura?: string;
  largura?: string;
  rotulos?: boolean;
}) {
  const total = valores.reduce((s, v) => s + v, 0);
  return (
    <div className={cn("flex rounded overflow-hidden bg-muted", altura, largura)}>
      {total > 0 &&
        valores.map((v, i) =>
          v ? (
            <span
              key={i}
              className="flex items-center justify-center text-[10px] font-semibold text-background overflow-hidden"
              style={{ width: `${(v / total) * 100}%`, background: COR_FAIXA[i] }}
            >
              {rotulos && v / total > 0.07 ? n0(v) : ""}
            </span>
          ) : null,
        )}
    </div>
  );
}
