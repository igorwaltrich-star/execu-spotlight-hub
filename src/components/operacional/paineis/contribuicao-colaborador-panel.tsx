import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UNIDADES, metaProdUnidade, fmtMes } from "@/lib/constants";
import { useColaboradores } from "@/components/gestao/use-colaboradores";
import {
  NAVY_CLASS,
  NAVY_LABEL,
  brl,
  mesKey,
  num,
  useNaoConformidades,
  useNavySealTags,
  useRegistrosProdutividade,
} from "./use-paineis-data";

const labelUnidade = (k: string) => UNIDADES.find((u) => u.key === k)?.label ?? k;

export function ContribuicaoColaboradorPanel() {
  const { data: regs = [] } = useRegistrosProdutividade();
  const { data: colabs = [] } = useColaboradores();
  const { data: ncs = [] } = useNaoConformidades();
  const { data: navy = [] } = useNavySealTags();
  const [mes, setMes] = useState("todos");
  const [operacao, setOperacao] = useState("todas");

  const meses = useMemo(() => [...new Set(regs.map((r) => mesKey(r.mes)))].sort().reverse(), [regs]);
  const operacoes = useMemo(() => [...new Set(regs.map((r) => r.operacao))].sort(), [regs]);

  const navyPorColab = useMemo(() => new Map(navy.map((n) => [n.colaborador_id, n.tag])), [navy]);
  const nomePorColab = useMemo(() => new Map(colabs.map((c) => [c.id, c])), [colabs]);

  const linhas = useMemo(() => {
    const filt = regs.filter(
      (r) => (mes === "todos" || mesKey(r.mes) === mes) && (operacao === "todas" || r.operacao === operacao),
    );
    const ncFilt = ncs.filter((n) => (mes === "todos" || mesKey(n.data_ocorrencia) === mes));

    const ncPorColab = new Map<string, { qtd: number; custo: number }>();
    for (const n of ncFilt) {
      if (!n.colaborador_id) continue;
      const cur = ncPorColab.get(n.colaborador_id) ?? { qtd: 0, custo: 0 };
      cur.qtd += 1;
      cur.custo += Number(n.custo_gerado ?? 0);
      ncPorColab.set(n.colaborador_id, cur);
    }

    const m = new Map<string, { volume: number; fte: number; n: number; ops: Set<string> }>();
    for (const r of filt) {
      const cur = m.get(r.colaborador_id) ?? { volume: 0, fte: 0, n: 0, ops: new Set<string>() };
      cur.volume += Number(r.volume_processos ?? 0);
      cur.fte += Number(r.fte ?? 0);
      cur.n += 1;
      cur.ops.add(r.operacao);
      m.set(r.colaborador_id, cur);
    }

    const total = [...m.values()].reduce((s, v) => s + v.volume, 0);

    return [...m.entries()]
      .map(([id, v]) => {
        const colab = nomePorColab.get(id);
        const fteMedio = v.n ? v.fte / v.n : 0;
        const prod = fteMedio > 0 ? v.volume / v.n / fteMedio : 0;
        const ops = [...v.ops];
        const meta = ops.length === 1 ? metaProdUnidade(ops[0]) : 0;
        const nc = ncPorColab.get(id) ?? { qtd: 0, custo: 0 };
        return {
          id,
          nome: colab?.nome ?? "Colaborador removido",
          cargo: colab?.cargo ?? "",
          operacoes: ops.map(labelUnidade).join(", "),
          volume: v.volume,
          fte: fteMedio,
          prod,
          meta,
          share: total > 0 ? (v.volume / total) * 100 : 0,
          ncQtd: nc.qtd,
          ncCusto: nc.custo,
          tag: navyPorColab.get(id) ?? null,
        };
      })
      .sort((a, b) => b.volume - a.volume);
  }, [regs, ncs, mes, operacao, nomePorColab, navyPorColab]);

  const top = linhas.slice(0, 10).map((l) => ({ nome: l.nome.split(" ")[0], volume: l.volume }));
  const totalVolume = linhas.reduce((s, l) => s + l.volume, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Período</span>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os meses</SelectItem>
            {meses.map((m) => <SelectItem key={m} value={m}>{fmtMes(`${m}-01`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">Operação</span>
        <Select value={operacao} onValueChange={setOperacao}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {operacoes.map((o) => <SelectItem key={o} value={o}>{labelUnidade(o)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 por volume processado</CardTitle>
          <CardDescription>Total do período: {num(totalVolume, 0)} processos</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {top.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem registros de produtividade no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} margin={{ bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="nome" interval={0} angle={-45} textAnchor="end" height={60} fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: number) => num(v, 0)} />
                <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contribuição por colaborador</CardTitle>
          <CardDescription>Volume, produtividade, participação no total e qualidade</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {linhas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem registros de produtividade no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Operações</TableHead>
                  <TableHead>NavySeal</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">FTE médio</TableHead>
                  <TableHead className="text-right">Produtividade</TableHead>
                  <TableHead className="text-right">Participação</TableHead>
                  <TableHead className="text-right">NCs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">{l.nome}</div>
                      {l.cargo && <div className="text-xs text-muted-foreground">{l.cargo}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{l.operacoes}</TableCell>
                    <TableCell>
                      {l.tag ? (
                        <Badge className={NAVY_CLASS[l.tag]}>{NAVY_LABEL[l.tag]}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{num(l.volume, 0)}</TableCell>
                    <TableCell className="text-right">{num(l.fte, 2)}</TableCell>
                    <TableCell className="text-right">
                      {num(l.prod)}
                      {l.meta > 0 && <span className="text-xs text-muted-foreground"> / {l.meta}</span>}
                    </TableCell>
                    <TableCell className="text-right">{num(l.share)}%</TableCell>
                    <TableCell className="text-right">
                      {l.ncQtd}
                      {l.ncCusto > 0 && <span className="text-muted-foreground"> ({brl(l.ncCusto)})</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
