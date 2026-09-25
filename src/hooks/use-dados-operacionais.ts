import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UNIDADES, metaProdUnidade, type UnidadeKey } from "@/lib/constants";

/**
 * Fonte única dos indicadores operacionais.
 *
 * Duas bases convivem por decisão do projeto:
 *   operacional_mensal      — histórico por unidade/mês (Cadastro Operacional)
 *   registros_produtividade — lançamento por pessoa, com FTE proporcional
 *
 * Onde as duas cobrem o mesmo mês e unidade, o registro por pessoa
 * prevalece: é mais granular e permite atribuir contribuição individual.
 * Isso evita dupla contagem sem descartar o histórico.
 */

export type OpMensal = {
  unidade: UnidadeKey;
  mes: string;
  volume: number;
  pessoas: number;
};
export type RegProd = {
  colaborador_id: string;
  operacao: string;
  mes: string;
  volume_processos: number;
  fte: number;
  produtividade: number;
  dias_trabalhados: number;
};
export type CustoMensal = {
  colaborador_id: string;
  operacao: string;
  mes_referencia: string;
  total: number;
};
export type NaoConf = {
  operacao: string;
  colaborador_id?: string | null;
  data_ocorrencia: string;
  custo_gerado: number;
  valor_recuperado?: number | null;
  status_financeiro: string;
};

export type IndicadorOperacao = {
  key: UnidadeKey;
  label: string;
  grupo: string;
  volume: number;
  pessoas: number; // headcount (máximo do período)
  fte: number; // equivalente jornada completa
  produtividade: number; // volume / fte
  meta: number;
  pctMeta: number;
  custo: number;
  custoPorProcesso: number;
  ncQtd: number;
  ncCusto: number;
  /** de onde veio o volume: por pessoa, histórico ou ambos */
  fonte: "pessoa" | "historico" | "misto" | "sem_dados";
};

const mesISO = (m: string) => (m.length === 7 ? `${m}-01` : m);

export function useDadosOperacionais(mes?: string, podeVerCusto = true) {
  const filtroMes = mes ? mesISO(mes) : null;

  const { data: opMensal = [], isLoading: l1 } = useQuery({
    queryKey: ["dados_op_mensal", filtroMes],
    queryFn: async () => {
      let q = supabase.from("operacional_mensal").select("unidade,mes,volume,pessoas");
      if (filtroMes) q = q.eq("mes", filtroMes);
      const { data, error } = await q.order("mes");
      if (error) throw error;
      return (data ?? []) as OpMensal[];
    },
  });

  const { data: regProd = [], isLoading: l2 } = useQuery({
    queryKey: ["dados_op_prod", filtroMes],
    queryFn: async () => {
      let q = supabase
        .from("registros_produtividade")
        .select("colaborador_id,operacao,mes,volume_processos,fte,produtividade,dias_trabalhados");
      if (filtroMes) q = q.eq("mes", filtroMes);
      const { data, error } = await q.order("mes");
      if (error) throw error;
      return (data ?? []) as RegProd[];
    },
  });

  const { data: custos = [], isLoading: l3 } = useQuery({
    queryKey: ["dados_op_custo", filtroMes],
    queryFn: async () => {
      let q = supabase
        .from("custo_pessoal_mensal")
        .select("colaborador_id,operacao,mes_referencia,total");
      if (filtroMes) q = q.eq("mes_referencia", filtroMes);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CustoMensal[];
    },
    enabled: podeVerCusto,
  });

  const { data: ncs = [], isLoading: l4 } = useQuery({
    queryKey: ["dados_op_nc", filtroMes],
    queryFn: async () => {
      let q = supabase
        .from("nao_conformidades")
        .select(
          "operacao,colaborador_id,data_ocorrencia,custo_gerado,valor_recuperado,status_financeiro",
        );
      if (filtroMes) {
        const fim = new Date(
          new Date(filtroMes).getFullYear(),
          new Date(filtroMes).getMonth() + 1,
          0,
        )
          .toISOString()
          .slice(0, 10);
        q = q.gte("data_ocorrencia", filtroMes).lte("data_ocorrencia", fim);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as NaoConf[];
    },
  });

  /** Indicadores consolidados por operação, sem dupla contagem. */
  const porOperacao = useMemo<IndicadorOperacao[]>(() => {
    return UNIDADES.map((u) => {
      const rp = regProd.filter((r) => r.operacao === u.key);
      const om = opMensal.filter((r) => r.unidade === u.key);

      // meses cobertos pelo lançamento por pessoa
      const mesesPessoa = new Set(rp.map((r) => r.mes.slice(0, 7)));
      // histórico só entra nos meses que o registro por pessoa não cobre
      const omComplementar = om.filter((r) => !mesesPessoa.has(r.mes.slice(0, 7)));

      const volPessoa = rp.reduce((s, r) => s + Number(r.volume_processos ?? 0), 0);
      const ftePessoa = rp.reduce((s, r) => s + Number(r.fte ?? 0), 0);
      const volHist = omComplementar.reduce((s, r) => s + Number(r.volume ?? 0), 0);
      // no histórico, "pessoas" é headcount do mês — vira FTE cheio
      const fteHist = omComplementar.reduce((s, r) => s + Number(r.pessoas ?? 0), 0);

      const volume = volPessoa + volHist;
      const fte = ftePessoa + fteHist;

      // headcount: pessoas distintas no registro individual, ou o máximo do histórico
      const pessoasDistintas = new Set(rp.map((r) => r.colaborador_id)).size;
      const maxHist = om.reduce((m, r) => Math.max(m, Number(r.pessoas ?? 0)), 0);
      const pessoas = pessoasDistintas > 0 ? pessoasDistintas : maxHist;

      const custo = custos
        .filter((c) => c.operacao === u.key)
        .reduce((s, c) => s + Number(c.total ?? 0), 0);
      const ncsOp = ncs.filter((n) => n.operacao === u.key);

      const produtividade = fte > 0 ? volume / fte : 0;
      const meta = metaProdUnidade(u.key);

      const fonte: IndicadorOperacao["fonte"] =
        volPessoa > 0 && volHist > 0
          ? "misto"
          : volPessoa > 0
            ? "pessoa"
            : volHist > 0
              ? "historico"
              : "sem_dados";

      return {
        key: u.key,
        label: u.label,
        grupo: u.grupo,
        volume,
        pessoas,
        fte,
        produtividade,
        meta,
        pctMeta: meta > 0 ? (produtividade / meta) * 100 : 0,
        custo,
        custoPorProcesso: volume > 0 && custo > 0 ? custo / volume : 0,
        ncQtd: ncsOp.length,
        ncCusto: ncsOp.reduce((s, n) => s + Number(n.custo_gerado ?? 0), 0),
        fonte,
      };
    });
  }, [opMensal, regProd, custos, ncs]);

  const comDados = useMemo(
    () => porOperacao.filter((o) => o.fonte !== "sem_dados" || o.custo > 0 || o.ncQtd > 0),
    [porOperacao],
  );

  const totais = useMemo(() => {
    const volume = comDados.reduce((s, o) => s + o.volume, 0);
    const fte = comDados.reduce((s, o) => s + o.fte, 0);
    const custo = comDados.reduce((s, o) => s + o.custo, 0);
    const pessoas = comDados.reduce((s, o) => s + o.pessoas, 0);
    const metaPond = comDados.reduce((s, o) => s + o.meta * o.fte, 0);
    return {
      volume,
      fte,
      pessoas,
      custo,
      produtividade: fte > 0 ? volume / fte : 0,
      metaMedia: fte > 0 ? metaPond / fte : 0,
      custoPorProcesso: volume > 0 && custo > 0 ? custo / volume : 0,
      ncQtd: comDados.reduce((s, o) => s + o.ncQtd, 0),
      ncCusto: comDados.reduce((s, o) => s + o.ncCusto, 0),
      operacoesAtivas: comDados.length,
    };
  }, [comDados]);

  /** Série mensal consolidada, para gráficos de evolução. */
  const evolucao = useMemo(() => {
    const mapa = new Map<string, { mes: string; volume: number; fte: number; custo: number }>();
    const get = (m: string) => {
      const k = m.slice(0, 7);
      if (!mapa.has(k)) mapa.set(k, { mes: k, volume: 0, fte: 0, custo: 0 });
      return mapa.get(k)!;
    };
    const mesesPessoa = new Set(regProd.map((r) => `${r.operacao}|${r.mes.slice(0, 7)}`));
    for (const r of regProd) {
      const e = get(r.mes);
      e.volume += Number(r.volume_processos ?? 0);
      e.fte += Number(r.fte ?? 0);
    }
    for (const r of opMensal) {
      if (mesesPessoa.has(`${r.unidade}|${r.mes.slice(0, 7)}`)) continue;
      const e = get(r.mes);
      e.volume += Number(r.volume ?? 0);
      e.fte += Number(r.pessoas ?? 0);
    }
    for (const c of custos) get(c.mes_referencia).custo += Number(c.total ?? 0);
    return [...mapa.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((e) => ({
        ...e,
        produtividade: e.fte > 0 ? Number((e.volume / e.fte).toFixed(1)) : 0,
        custoPorProcesso: e.volume > 0 && e.custo > 0 ? Number((e.custo / e.volume).toFixed(2)) : 0,
      }));
  }, [regProd, opMensal, custos]);

  /** Contribuição individual dentro de uma operação. */
  const contribuicaoPorColaborador = useMemo(() => {
    const porOp = new Map<
      string,
      { colaborador_id: string; volume: number; fte: number; ncs: number }[]
    >();
    for (const r of regProd) {
      const arr = porOp.get(r.operacao) ?? [];
      const ex = arr.find((x) => x.colaborador_id === r.colaborador_id);
      if (ex) {
        ex.volume += Number(r.volume_processos ?? 0);
        ex.fte += Number(r.fte ?? 0);
      } else
        arr.push({
          colaborador_id: r.colaborador_id,
          volume: Number(r.volume_processos ?? 0),
          fte: Number(r.fte ?? 0),
          ncs: 0,
        });
      porOp.set(r.operacao, arr);
    }
    for (const n of ncs) {
      if (!n.colaborador_id) continue;
      const arr = porOp.get(n.operacao);
      const p = arr?.find((x) => x.colaborador_id === n.colaborador_id);
      if (p) p.ncs += 1;
    }
    return porOp;
  }, [regProd, ncs]);

  return {
    porOperacao,
    comDados,
    totais,
    evolucao,
    contribuicaoPorColaborador,
    bruto: { opMensal, regProd, custos, ncs },
    carregando: l1 || l2 || l3 || l4,
    temDados: comDados.length > 0,
  };
}
