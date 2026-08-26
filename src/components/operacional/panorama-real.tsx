import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UNIDADES, metaProdUnidade, type UnidadeKey } from "@/lib/constants";
import { usePerfil } from "@/hooks/use-perfil";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from "recharts";
import { TrendingUp, Users, AlertTriangle, DollarSign, ClipboardCheck } from "lucide-react";

type Prod = {
  colaborador_id: string;
  operacao: string;
  mes: string;
  volume_processos: number;
  fte: number;
  produtividade: number;
};
type NC = {
  operacao: string;
  data_ocorrencia: string;
  custo_gerado: number;
  valor_recuperado?: number;
  status_financeiro: string;
};
type Custo = { operacao: string; mes_referencia: string; total: number };
type CheckIn = { operacao: string; data: string; status_geral: string };

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const label = (k: string) => UNIDADES.find((u) => u.key === k)?.label ?? k;

export function PanoramaReal() {
  const { eUmDe } = usePerfil();
  const podeVerCusto = eUmDe(["gestor", "coordenador"]);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const mesISO = mes + "-01";

  const { data: prod = [] } = useQuery({
    queryKey: ["pan_prod", mesISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registros_produtividade")
        .select("*")
        .eq("mes", mesISO);
      if (error) throw error;
      return (data ?? []) as Prod[];
    },
  });

  const { data: ncs = [] } = useQuery({
    queryKey: ["pan_nc", mes],
    queryFn: async () => {
      const ini = mesISO;
      const fim = new Date(new Date(mesISO).getFullYear(), new Date(mesISO).getMonth() + 1, 0)
        .toISOString()
        .slice(0, 10);
      const { data, error } = await supabase
        .from("nao_conformidades")
        .select("*")
        .gte("data_ocorrencia", ini)
        .lte("data_ocorrencia", fim);
      if (error) throw error;
      return (data ?? []) as NC[];
    },
  });

  const { data: custos = [] } = useQuery({
    queryKey: ["pan_custo", mesISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custo_pessoal_mensal")
        .select("operacao,mes_referencia,total")
        .eq("mes_referencia", mesISO);
      if (error) throw error;
      return (data ?? []) as Custo[];
    },
    enabled: podeVerCusto,
  });

  const { data: checkins = [] } = useQuery({
    queryKey: ["pan_checkin"],
    queryFn: async () => {
      const desde = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("checkins_operacionais")
        .select("operacao,data,status_geral")
        .gte("data", desde);
      if (error) throw error;
      return (data ?? []) as CheckIn[];
    },
  });

  /* ── agregação por operação ── */
  const porOperacao = useMemo(() => {
    return UNIDADES.map((u) => {
      const rs = prod.filter((r) => r.operacao === u.key);
      const fte = rs.reduce((s, r) => s + Number(r.fte ?? 0), 0);
      const volume = rs.reduce((s, r) => s + r.volume_processos, 0);
      const produtividade = fte > 0 ? volume / fte : 0;
      const meta = metaProdUnidade(u.key);
      const custo = custos
        .filter((c) => c.operacao === u.key)
        .reduce((s, c) => s + Number(c.total), 0);
      const ncCusto = ncs
        .filter((n) => n.operacao === u.key)
        .reduce((s, n) => s + Number(n.custo_gerado ?? 0), 0);
      return {
        key: u.key as UnidadeKey,
        label: u.label,
        pessoas: rs.length,
        fte,
        volume,
        produtividade,
        meta,
        pctMeta: meta > 0 ? (produtividade / meta) * 100 : 0,
        custo,
        custoPorProcesso: volume > 0 && custo > 0 ? custo / volume : 0,
        ncQtd: ncs.filter((n) => n.operacao === u.key).length,
        ncCusto,
      };
    }).filter((o) => o.pessoas > 0 || o.ncQtd > 0 || o.custo > 0);
  }, [prod, custos, ncs]);

  const totais = useMemo(() => {
    const fte = porOperacao.reduce((s, o) => s + o.fte, 0);
    const volume = porOperacao.reduce((s, o) => s + o.volume, 0);
    const custo = porOperacao.reduce((s, o) => s + o.custo, 0);
    const ncCusto = ncs.reduce((s, n) => s + Number(n.custo_gerado ?? 0), 0);
    const recuperado = ncs.reduce((s, n) => s + Number(n.valor_recuperado ?? 0), 0);
    return {
      fte,
      volume,
      pessoas: prod.length,
      produtividade: fte > 0 ? volume / fte : 0,
      custo,
      custoPorProcesso: volume > 0 && custo > 0 ? custo / volume : 0,
      ncQtd: ncs.length,
      ncAbertas: ncs.filter((n) => n.status_financeiro === "pendente").length,
      ncCusto,
      recuperado,
    };
  }, [porOperacao, ncs, prod]);

  /* ── check-ins da semana ── */
  const checkinResumo = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const doDia = checkins.filter((c) => c.data === hoje);
    return {
      hoje: doDia.length,
      criticos: checkins.filter((c) => c.status_geral === "critico").length,
      atencao: checkins.filter((c) => c.status_geral === "atencao").length,
      semRegistro: UNIDADES.filter((u) => !doDia.find((c) => c.operacao === u.key)).length,
    };
  }, [checkins]);

  const semDados = porOperacao.length === 0;

  const corPct = (p: number) =>
    p >= 100
      ? "var(--color-success)"
      : p >= 70
        ? "var(--color-warning)"
        : "var(--color-destructive)";
  const clsPct = (p: number) =>
    p >= 100 ? "text-success" : p >= 70 ? "text-warning" : "text-destructive";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Panorama do mês</h2>
          <p className="text-sm text-muted-foreground">
            Produtividade por pessoa, não conformidades e custo real
          </p>
        </div>
        <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-40" />
      </div>

      {semDados ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum dado registrado para{" "}
            {new Date(mesISO).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}.
            <br />
            Cadastre em <strong>Produtividade</strong>, <strong>Não Conformidades</strong> ou{" "}
            <strong>Custo Operacional</strong>.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div
            className={`grid grid-cols-2 gap-3 ${podeVerCusto ? "md:grid-cols-5" : "md:grid-cols-4"}`}
          >
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Volume
                  </span>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-semibold">
                  {totais.volume.toLocaleString("pt-BR")}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">processos</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">FTE</span>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-semibold">{totais.fte.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {totais.pessoas} registro(s)
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Produtividade
                  </span>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-semibold">{totais.produtividade.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">proc/FTE</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Não conf.
                  </span>
                  <AlertTriangle
                    className={`h-4 w-4 ${totais.ncAbertas > 0 ? "text-destructive" : "text-muted-foreground"}`}
                  />
                </div>
                <div
                  className={`text-2xl font-semibold ${totais.ncAbertas > 0 ? "text-destructive" : ""}`}
                >
                  {totais.ncQtd}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {fmtBRL(totais.ncCusto)} em custo
                </div>
              </CardContent>
            </Card>

            {podeVerCusto && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      Custo/proc.
                    </span>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold">
                    {totais.custoPorProcesso > 0 ? fmtBRL(totais.custoPorProcesso) : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {totais.custo > 0 ? fmtBRL(totais.custo) : "sem custo lançado"}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Check IN da semana */}
          {checkins.length > 0 && (
            <Card>
              <CardContent className="pt-4 flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Check IN — últimos 7 dias</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span>
                    <strong>{checkinResumo.hoje}</strong>{" "}
                    <span className="text-muted-foreground">registrados hoje</span>
                  </span>
                  {checkinResumo.atencao > 0 && (
                    <span className="text-warning">
                      <strong>{checkinResumo.atencao}</strong> em atenção
                    </span>
                  )}
                  {checkinResumo.criticos > 0 && (
                    <span className="text-destructive">
                      <strong>{checkinResumo.criticos}</strong> críticos
                    </span>
                  )}
                  {checkinResumo.semRegistro > 0 && (
                    <span className="text-muted-foreground">
                      <strong>{checkinResumo.semRegistro}</strong> operações sem registro hoje
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Produtividade vs meta */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Produtividade real vs meta</CardTitle>
              <CardDescription>Calculada com FTE proporcional — inclui rotation</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={porOperacao.filter((o) => o.pessoas > 0)}
                  margin={{ top: 8, right: 16, left: -20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number, n: string) => [v.toFixed(1), n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="produtividade"
                    name="Realizado"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={44}
                  >
                    {porOperacao
                      .filter((o) => o.pessoas > 0)
                      .map((o, i) => (
                        <Cell key={i} fill={corPct(o.pctMeta)} />
                      ))}
                  </Bar>
                  <Bar
                    dataKey="meta"
                    name="Meta"
                    fill="var(--color-muted-foreground)"
                    fillOpacity={0.25}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tabela por operação */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Detalhamento por operação</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {["Operação", "Pessoas", "FTE", "Volume", "Produt.", "% Meta", "Não conf."]
                        .concat(podeVerCusto ? ["Custo/proc."] : [])
                        .map((h) => (
                          <th
                            key={h}
                            className="text-left py-2 px-4 text-[10px] uppercase tracking-wide text-muted-foreground font-medium"
                          >
                            {h}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {porOperacao.map((o) => (
                      <tr key={o.key} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-4 font-medium">{o.label}</td>
                        <td className="py-2 px-4">{o.pessoas || "—"}</td>
                        <td className="py-2 px-4 font-mono text-xs">
                          {o.fte > 0 ? o.fte.toFixed(2) : "—"}
                        </td>
                        <td className="py-2 px-4">{o.volume || "—"}</td>
                        <td
                          className={`py-2 px-4 font-semibold ${o.pessoas > 0 ? clsPct(o.pctMeta) : ""}`}
                        >
                          {o.pessoas > 0 ? o.produtividade.toFixed(1) : "—"}
                        </td>
                        <td className="py-2 px-4">
                          {o.pessoas > 0 ? (
                            <div className="flex items-center gap-2">
                              <Progress value={Math.min(o.pctMeta, 100)} className="h-1.5 w-16" />
                              <span className={`text-xs font-medium ${clsPct(o.pctMeta)}`}>
                                {o.pctMeta.toFixed(0)}%
                              </span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2 px-4">
                          {o.ncQtd > 0 ? (
                            <Badge variant="destructive" className="text-[10px]">
                              {o.ncQtd} · {fmtBRL(o.ncCusto)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        {podeVerCusto && (
                          <td className="py-2 px-4">
                            {o.custoPorProcesso > 0 ? (
                              fmtBRL(o.custoPorProcesso)
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
