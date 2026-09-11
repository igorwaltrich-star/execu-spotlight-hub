import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UNIDADES, metaProdUnidade, META_PRODUTIVIDADE, fmtMes } from "@/lib/constants";
import {
  brl,
  mesKey,
  num,
  useCustoPessoal,
  useNaoConformidades,
  useOperacionalMensal,
} from "./use-paineis-data";

const labelUnidade = (k: string) => UNIDADES.find((u) => u.key === k)?.label ?? k;

function Kpi({
  titulo,
  valor,
  detalhe,
  tom = "default",
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  tom?: "default" | "success" | "warning" | "destructive";
}) {
  const cor =
    tom === "success"
      ? "text-success"
      : tom === "warning"
        ? "text-warning"
        : tom === "destructive"
          ? "text-destructive"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <p className={`text-2xl font-semibold mt-1 ${cor}`}>{valor}</p>
        {detalhe && <p className="text-xs text-muted-foreground mt-1">{detalhe}</p>}
      </CardContent>
    </Card>
  );
}

export function IndicadoresPanel() {
  const { data: op = [] } = useOperacionalMensal();
  const { data: custos = [] } = useCustoPessoal();
  const { data: ncs = [] } = useNaoConformidades();
  const [mes, setMes] = useState("todos");

  const meses = useMemo(
    () => [...new Set(op.map((r) => mesKey(r.mes)))].sort().reverse(),
    [op],
  );

  const opFilt = mes === "todos" ? op : op.filter((r) => mesKey(r.mes) === mes);
  const custoFilt = mes === "todos" ? custos : custos.filter((c) => mesKey(c.mes_referencia) === mes);
  const ncFilt = mes === "todos" ? ncs : ncs.filter((n) => mesKey(n.data_ocorrencia) === mes);

  const volume = opFilt.reduce((s, r) => s + Number(r.volume ?? 0), 0);
  const custoTotal = custoFilt.reduce((s, r) => s + Number(r.total ?? 0), 0);
  const ncCusto = ncFilt.reduce((s, r) => s + Number(r.custo_gerado ?? 0), 0);
  const ncRecuperado = ncFilt.reduce((s, r) => s + Number(r.valor_recuperado ?? 0), 0);

  // pessoas: no acumulado usa o último mês disponível
  const ultimoMes = mes === "todos" ? meses[0] : mes;
  const pessoas = op
    .filter((r) => mesKey(r.mes) === ultimoMes)
    .reduce((s, r) => s + Number(r.pessoas ?? 0), 0);

  const porUnidade = useMemo(() => {
    const m = new Map<string, { volume: number; pessoas: number; meses: number }>();
    for (const r of opFilt) {
      const cur = m.get(r.unidade) ?? { volume: 0, pessoas: 0, meses: 0 };
      cur.volume += Number(r.volume ?? 0);
      cur.pessoas += Number(r.pessoas ?? 0);
      cur.meses += 1;
      m.set(r.unidade, cur);
    }
    return [...m.entries()]
      .map(([k, v]) => {
        const pessoasMedia = v.meses ? v.pessoas / v.meses : 0;
        const prod = pessoasMedia > 0 ? v.volume / v.meses / pessoasMedia : 0;
        return {
          unidade: labelUnidade(k),
          key: k,
          volume: v.volume,
          produtividade: Number(prod.toFixed(1)),
          meta: metaProdUnidade(k),
        };
      })
      .sort((a, b) => b.volume - a.volume);
  }, [opFilt]);

  const serieMensal = useMemo(() => {
    const m = new Map<string, { volume: number; pessoas: number }>();
    for (const r of op) {
      const k = mesKey(r.mes);
      const cur = m.get(k) ?? { volume: 0, pessoas: 0 };
      cur.volume += Number(r.volume ?? 0);
      cur.pessoas += Number(r.pessoas ?? 0);
      m.set(k, cur);
    }
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([k, v]) => ({
        mes: fmtMes(`${k}-01`),
        volume: v.volume,
        produtividade: v.pessoas > 0 ? Number((v.volume / v.pessoas).toFixed(1)) : 0,
      }));
  }, [op]);

  const prodMedia = pessoas > 0 && ultimoMes
    ? op
        .filter((r) => mesKey(r.mes) === ultimoMes)
        .reduce((s, r) => s + Number(r.volume ?? 0), 0) / pessoas
    : 0;

  const custoPorProcesso = volume > 0 ? custoTotal / volume : 0;

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi titulo="Volume de processos" valor={num(volume, 0)} detalhe={mes === "todos" ? "acumulado" : fmtMes(`${mes}-01`)} />
        <Kpi titulo="Pessoas (último mês)" valor={num(pessoas, 0)} detalhe={ultimoMes ? fmtMes(`${ultimoMes}-01`) : "-"} />
        <Kpi
          titulo="Produtividade média"
          valor={num(prodMedia)}
          detalhe={`meta geral ${META_PRODUTIVIDADE}`}
          tom={prodMedia >= META_PRODUTIVIDADE ? "success" : "warning"}
        />
        <Kpi titulo="Custo por processo" valor={custoPorProcesso > 0 ? brl(custoPorProcesso) : "-"} detalhe={brl(custoTotal)} />
        <Kpi
          titulo="Perdas por não conformidade"
          valor={brl(ncCusto)}
          detalhe={`${ncFilt.length} ocorrências • ${brl(ncRecuperado)} recuperado`}
          tom={ncCusto > 0 ? "destructive" : "success"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Volume por operação</CardTitle>
            <CardDescription>Processos no período selecionado</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {porUnidade.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porUnidade} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="unidade" interval={0} angle={-45} textAnchor="end" height={60} fontSize={11} />
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
            <CardTitle className="text-base">Evolução mensal</CardTitle>
            <CardDescription>Volume total e produtividade por pessoa (12 meses)</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {serieMensal.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados cadastrados.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serieMensal} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" interval={0} angle={-45} textAnchor="end" height={60} fontSize={11} />
                  <YAxis yAxisId="l" fontSize={11} />
                  <YAxis yAxisId="r" orientation="right" fontSize={11} />
                  <Tooltip />
                  <Line yAxisId="l" type="monotone" dataKey="volume" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Volume" />
                  <Line yAxisId="r" type="monotone" dataKey="produtividade" stroke="hsl(var(--success))" strokeWidth={2} dot={false} name="Produtividade" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Produtividade x meta por operação</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {porUnidade.length === 0 && <p className="text-sm text-muted-foreground">Sem dados no período.</p>}
          {porUnidade.map((u) => {
            const ating = u.meta > 0 ? (u.produtividade / u.meta) * 100 : 0;
            return (
              <Badge
                key={u.key}
                className={
                  ating >= 100
                    ? "bg-success text-success-foreground"
                    : ating >= 85
                      ? "bg-warning text-warning-foreground"
                      : "bg-destructive text-destructive-foreground"
                }
              >
                {u.unidade}: {num(u.produtividade)} / {u.meta} ({num(ating, 0)}%)
              </Badge>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
