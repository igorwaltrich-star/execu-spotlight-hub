import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UNIDADES, metaProdUnidade, fmtMes } from "@/lib/constants";
import {
  brl,
  mesKey,
  num,
  useCustoPessoal,
  useNaoConformidades,
  useOperacionalMensal,
} from "./use-paineis-data";

const labelUnidade = (k: string) => UNIDADES.find((u) => u.key === k)?.label ?? k;

function notaBadge(score: number) {
  if (score >= 85) return { label: "Excelente", cls: "bg-success text-success-foreground" };
  if (score >= 70) return { label: "Bom", cls: "bg-primary text-primary-foreground" };
  if (score >= 50) return { label: "Atenção", cls: "bg-warning text-warning-foreground" };
  return { label: "Crítico", cls: "bg-destructive text-destructive-foreground" };
}

export function ScorecardOperacaoPanel() {
  const { data: op = [] } = useOperacionalMensal();
  const { data: custos = [] } = useCustoPessoal();
  const { data: ncs = [] } = useNaoConformidades();
  const [mes, setMes] = useState("todos");

  const meses = useMemo(() => [...new Set(op.map((r) => mesKey(r.mes)))].sort().reverse(), [op]);

  const linhas = useMemo(() => {
    const opFilt = mes === "todos" ? op : op.filter((r) => mesKey(r.mes) === mes);
    const custoFilt = mes === "todos" ? custos : custos.filter((c) => mesKey(c.mes_referencia) === mes);
    const ncFilt = mes === "todos" ? ncs : ncs.filter((n) => mesKey(n.data_ocorrencia) === mes);

    const m = new Map<string, { volume: number; pessoas: number; meses: number }>();
    for (const r of opFilt) {
      const cur = m.get(r.unidade) ?? { volume: 0, pessoas: 0, meses: 0 };
      cur.volume += Number(r.volume ?? 0);
      cur.pessoas += Number(r.pessoas ?? 0);
      cur.meses += 1;
      m.set(r.unidade, cur);
    }

    const custoPorOp = new Map<string, number>();
    for (const c of custoFilt) {
      custoPorOp.set(c.operacao, (custoPorOp.get(c.operacao) ?? 0) + Number(c.total ?? 0));
    }

    const ncPorOp = new Map<string, { qtd: number; custo: number }>();
    for (const n of ncFilt) {
      const cur = ncPorOp.get(n.operacao) ?? { qtd: 0, custo: 0 };
      cur.qtd += 1;
      cur.custo += Number(n.custo_gerado ?? 0);
      ncPorOp.set(n.operacao, cur);
    }

    return [...m.entries()]
      .map(([key, v]) => {
        const pessoasMedia = v.meses ? v.pessoas / v.meses : 0;
        const prod = pessoasMedia > 0 ? v.volume / v.meses / pessoasMedia : 0;
        const meta = metaProdUnidade(key);
        const atingimento = meta > 0 ? (prod / meta) * 100 : 0;
        const custo = custoPorOp.get(key) ?? 0;
        const custoProc = v.volume > 0 ? custo / v.volume : 0;
        const nc = ncPorOp.get(key) ?? { qtd: 0, custo: 0 };
        const taxaNC = v.volume > 0 ? (nc.qtd / v.volume) * 1000 : 0; // ocorrências por mil processos

        // score: 70% atingimento de produtividade + 30% qualidade (penaliza NC/mil)
        const notaProd = Math.max(0, Math.min(120, atingimento));
        const notaQual = Math.max(0, 100 - taxaNC * 20);
        const score = Math.round(notaProd * 0.7 + notaQual * 0.3);

        return {
          key,
          unidade: labelUnidade(key),
          volume: v.volume,
          pessoas: pessoasMedia,
          prod,
          meta,
          atingimento,
          custo,
          custoProc,
          ncQtd: nc.qtd,
          ncCusto: nc.custo,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [op, custos, ncs, mes]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Período</span>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os meses</SelectItem>
            {meses.map((m) => (
              <SelectItem key={m} value={m}>{fmtMes(`${m}-01`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scorecard por operação</CardTitle>
          <CardDescription>
            Nota = 70% do atingimento da meta de produtividade + 30% de qualidade (ocorrências por mil processos)
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {linhas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados operacionais no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operação</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Pessoas</TableHead>
                  <TableHead className="text-right">Produtividade</TableHead>
                  <TableHead className="text-right">Meta</TableHead>
                  <TableHead className="text-right">Atingimento</TableHead>
                  <TableHead className="text-right">Custo/processo</TableHead>
                  <TableHead className="text-right">NCs</TableHead>
                  <TableHead className="text-right">Nota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => {
                  const b = notaBadge(l.score);
                  return (
                    <TableRow key={l.key}>
                      <TableCell className="font-medium">{l.unidade}</TableCell>
                      <TableCell className="text-right">{num(l.volume, 0)}</TableCell>
                      <TableCell className="text-right">{num(l.pessoas)}</TableCell>
                      <TableCell className="text-right">{num(l.prod)}</TableCell>
                      <TableCell className="text-right">{l.meta}</TableCell>
                      <TableCell className="text-right">{num(l.atingimento, 0)}%</TableCell>
                      <TableCell className="text-right">{l.custoProc > 0 ? brl(l.custoProc) : "-"}</TableCell>
                      <TableCell className="text-right">
                        {l.ncQtd} {l.ncCusto > 0 && <span className="text-muted-foreground">({brl(l.ncCusto)})</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={b.cls}>{l.score} • {b.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
