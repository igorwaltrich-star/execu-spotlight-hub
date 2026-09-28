/**
 * Motor de insights operacionais.
 *
 * Analisa os dados e produz diagnósticos priorizados: detecta tendências,
 * concentração de problemas, desvios de meta e correlações entre custo,
 * produtividade e não conformidades.
 *
 * É determinístico — mesma entrada produz sempre a mesma saída, sem
 * chamadas externas. Para um resumo em linguagem natural gerado por LLM,
 * ver `gerarResumoIA` em insights-ia.ts (requer configuração).
 */

import { UNIDADES, metaProdUnidade } from "@/lib/constants";

export type Severidade = "critico" | "atencao" | "positivo" | "info";

export type Insight = {
  id: string;
  severidade: Severidade;
  titulo: string;
  descricao: string;
  /** O que fazer a respeito */
  acao?: string;
  /** Números que sustentam o diagnóstico */
  evidencia?: string;
  categoria: "produtividade" | "qualidade" | "custo" | "pessoas" | "processo";
  /** peso para ordenação (maior = mais urgente) */
  peso: number;
};

export type DadosProd = {
  colaborador_id: string;
  operacao: string;
  mes: string;
  volume_processos: number;
  fte: number;
  produtividade: number;
};
export type DadosNC = {
  operacao: string;
  colaborador_id?: string;
  tipo: string;
  data_ocorrencia: string;
  custo_gerado: number;
  valor_recuperado?: number;
  status_financeiro: string;
  reembolsavel: boolean;
};
export type DadosCusto = { operacao: string; mes_referencia: string; total: number };
export type DadosBanco = { colaborador_id: string; mes: string; saldo_acumulado: number };

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const label = (k: string) => UNIDADES.find((u) => u.key === k)?.label ?? k;
const pct = (v: number) => `${v.toFixed(0)}%`;

const TIPO_NC: Record<string, string> = {
  erro_digitacao: "erro de digitação",
  prazo_perdido: "prazo perdido",
  doc_incorreto: "documento incorreto",
  comunicacao: "falha de comunicação",
  outro: "outros",
};

export function gerarInsights(params: {
  prodAtual: DadosProd[];
  prodAnterior: DadosProd[];
  ncs: DadosNC[];
  ncsAnterior: DadosNC[];
  custos: DadosCusto[];
  custosAnterior: DadosCusto[];
  bancoHoras: DadosBanco[];
  nomeColaborador: (id: string) => string;
  podeVerCusto: boolean;
}): Insight[] {
  const {
    prodAtual,
    prodAnterior,
    ncs,
    ncsAnterior,
    custos,
    custosAnterior,
    bancoHoras,
    nomeColaborador,
    podeVerCusto,
  } = params;
  const out: Insight[] = [];

  /* ── agregação por operação ── */
  const ops = UNIDADES.map((u) => {
    const rs = prodAtual.filter((r) => r.operacao === u.key);
    const rsAnt = prodAnterior.filter((r) => r.operacao === u.key);
    const fte = rs.reduce((s, r) => s + Number(r.fte ?? 0), 0);
    const fteAnt = rsAnt.reduce((s, r) => s + Number(r.fte ?? 0), 0);
    const vol = rs.reduce((s, r) => s + r.volume_processos, 0);
    const volAnt = rsAnt.reduce((s, r) => s + r.volume_processos, 0);
    const prod = fte > 0 ? vol / fte : 0;
    const prodAnt = fteAnt > 0 ? volAnt / fteAnt : 0;
    const meta = metaProdUnidade(u.key);
    const custo = custos
      .filter((c) => c.operacao === u.key)
      .reduce((s, c) => s + Number(c.total), 0);
    const custoAnt = custosAnterior
      .filter((c) => c.operacao === u.key)
      .reduce((s, c) => s + Number(c.total), 0);
    const ncsOp = ncs.filter((n) => n.operacao === u.key);
    return {
      key: u.key,
      label: u.label,
      pessoas: rs.length,
      fte,
      vol,
      prod,
      prodAnt,
      meta,
      pctMeta: meta > 0 ? (prod / meta) * 100 : 0,
      pctMetaAnt: meta > 0 && prodAnt > 0 ? (prodAnt / meta) * 100 : 0,
      delta: prodAnt > 0 ? prod - prodAnt : 0,
      custo,
      custoAnt,
      custoProc: vol > 0 && custo > 0 ? custo / vol : 0,
      custoProcAnt: volAnt > 0 && custoAnt > 0 ? custoAnt / volAnt : 0,
      ncQtd: ncsOp.length,
      ncCusto: ncsOp.reduce((s, n) => s + Number(n.custo_gerado ?? 0), 0),
    };
  }).filter((o) => o.pessoas > 0 || o.ncQtd > 0 || o.custo > 0);

  const comProd = ops.filter((o) => o.pessoas > 0);

  /* ═══ PRODUTIVIDADE ═══ */

  // Operações abaixo da meta
  const abaixo = comProd.filter((o) => o.pctMeta < 70).sort((a, b) => a.pctMeta - b.pctMeta);
  abaixo.forEach((o) => {
    const gap = o.meta - o.prod;
    const proc = Math.round(gap * o.fte);
    out.push({
      id: `prod-baixa-${o.key}`,
      severidade: o.pctMeta < 50 ? "critico" : "atencao",
      categoria: "produtividade",
      titulo: `${o.label} está a ${pct(o.pctMeta)} da meta`,
      descricao: `Produtividade de ${o.prod.toFixed(1)} contra meta de ${o.meta}. Com o FTE atual de ${o.fte.toFixed(1)}, isso representa cerca de ${proc} processos a menos no mês.`,
      evidencia: `${o.vol} processos · ${o.fte.toFixed(1)} FTE · gap de ${gap.toFixed(1)} proc/pessoa`,
      acao:
        o.ncQtd > 0
          ? `Verificar se as ${o.ncQtd} não conformidades da operação estão consumindo capacidade em retrabalho.`
          : `Investigar se a meta de ${o.meta} está calibrada para a complexidade atual da carteira.`,
      peso: o.pctMeta < 50 ? 95 : 75,
    });
  });

  // Queda relevante vs mês anterior
  comProd
    .filter((o) => o.prodAnt > 0 && o.delta < -5)
    .forEach((o) => {
      out.push({
        id: `prod-queda-${o.key}`,
        severidade: "atencao",
        categoria: "produtividade",
        titulo: `${o.label} caiu ${Math.abs(o.delta).toFixed(1)} pontos de produtividade`,
        descricao: `Passou de ${o.prodAnt.toFixed(1)} para ${o.prod.toFixed(1)} proc/FTE em relação ao mês anterior.`,
        evidencia: `${pct(o.pctMetaAnt)} → ${pct(o.pctMeta)} da meta`,
        acao: "Comparar volume recebido e composição da equipe entre os dois meses antes de concluir que é performance.",
        peso: 70 + Math.min(Math.abs(o.delta), 20),
      });
    });

  // Melhora relevante
  comProd
    .filter((o) => o.prodAnt > 0 && o.delta > 5)
    .forEach((o) => {
      out.push({
        id: `prod-alta-${o.key}`,
        severidade: "positivo",
        categoria: "produtividade",
        titulo: `${o.label} evoluiu ${o.delta.toFixed(1)} pontos`,
        descricao: `Produtividade subiu de ${o.prodAnt.toFixed(1)} para ${o.prod.toFixed(1)} proc/FTE.`,
        evidencia: `${pct(o.pctMeta)} da meta`,
        acao: "Identificar o que mudou e verificar se é replicável nas demais operações.",
        peso: 40,
      });
    });

  // Dispersão dentro da mesma operação
  comProd
    .filter((o) => o.pessoas >= 3)
    .forEach((o) => {
      const rs = prodAtual.filter((r) => r.operacao === o.key && Number(r.fte) > 0);
      if (rs.length < 3) return;
      const prods = rs.map((r) => Number(r.produtividade)).sort((a, b) => a - b);
      const menor = prods[0],
        maior = prods[prods.length - 1];
      if (menor <= 0) return;
      const razao = maior / menor;
      if (razao >= 2) {
        const pior = rs.find((r) => Number(r.produtividade) === menor);
        const melhor = rs.find((r) => Number(r.produtividade) === maior);
        out.push({
          id: `prod-dispersao-${o.key}`,
          severidade: "atencao",
          categoria: "pessoas",
          titulo: `${o.label} tem dispersão alta entre analistas`,
          descricao: `O maior desempenho é ${razao.toFixed(1)}x o menor dentro da mesma operação, o que sugere diferença de método ou de complexidade na distribuição de processos.`,
          evidencia: `${melhor ? nomeColaborador(melhor.colaborador_id) : "—"}: ${maior.toFixed(1)} · ${pior ? nomeColaborador(pior.colaborador_id) : "—"}: ${menor.toFixed(1)}`,
          acao: "Antes de tratar como performance, checar se a carteira está distribuída de forma equivalente.",
          peso: 65,
        });
      }
    });

  /* ═══ QUALIDADE / NÃO CONFORMIDADES ═══ */

  if (ncs.length > 0) {
    const custoTotal = ncs.reduce((s, n) => s + Number(n.custo_gerado ?? 0), 0);
    const recuperado = ncs.reduce((s, n) => s + Number(n.valor_recuperado ?? 0), 0);
    const pendentes = ncs.filter((n) => n.status_financeiro === "pendente");
    const naoRecuperado = custoTotal - recuperado;

    // Concentração por tipo
    const porTipo = new Map<string, number>();
    ncs.forEach((n) => porTipo.set(n.tipo, (porTipo.get(n.tipo) ?? 0) + 1));
    const [tipoTop, qtdTop] = Array.from(porTipo.entries()).sort((a, b) => b[1] - a[1])[0] ?? [
      "",
      0,
    ];
    if (qtdTop / ncs.length >= 0.4 && ncs.length >= 3) {
      out.push({
        id: "nc-concentracao-tipo",
        severidade: "atencao",
        categoria: "qualidade",
        titulo: `${pct((qtdTop / ncs.length) * 100)} das ocorrências são do mesmo tipo`,
        descricao: `${qtdTop} de ${ncs.length} não conformidades são "${TIPO_NC[tipoTop] ?? tipoTop}". Concentração desse nível costuma indicar causa sistêmica, não erro pontual.`,
        acao: "Mapear o ponto do fluxo onde esse tipo se origina — provavelmente há um controle faltando ali.",
        peso: 80,
      });
    }

    // Concentração por operação
    const porOp = new Map<string, number>();
    ncs.forEach((n) => porOp.set(n.operacao, (porOp.get(n.operacao) ?? 0) + 1));
    const [opTop, qtdOpTop] = Array.from(porOp.entries()).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    if (qtdOpTop / ncs.length >= 0.5 && ncs.length >= 3) {
      out.push({
        id: "nc-concentracao-op",
        severidade: "critico",
        categoria: "qualidade",
        titulo: `${label(opTop)} concentra ${pct((qtdOpTop / ncs.length) * 100)} das não conformidades`,
        descricao: `${qtdOpTop} de ${ncs.length} ocorrências do período vieram de uma única operação.`,
        evidencia:
          fmtBRL(
            ncs
              .filter((n) => n.operacao === opTop)
              .reduce((s, n) => s + Number(n.custo_gerado ?? 0), 0),
          ) + " em custo gerado",
        acao: "Priorizar diagnóstico nessa operação antes de ações gerais.",
        peso: 90,
      });
    }

    // Custo não recuperado
    if (naoRecuperado > 0 && custoTotal > 0) {
      const pctRec = (recuperado / custoTotal) * 100;
      out.push({
        id: "nc-recuperacao",
        severidade: pctRec < 30 ? "critico" : pctRec < 70 ? "atencao" : "positivo",
        categoria: "custo",
        titulo: `${fmtBRL(naoRecuperado)} de prejuízo ainda não recuperado`,
        descricao: `De ${fmtBRL(custoTotal)} em custo gerado por não conformidades, ${fmtBRL(recuperado)} foi recuperado (${pct(pctRec)}).`,
        evidencia: `${pendentes.length} ocorrência(s) com status financeiro pendente`,
        acao:
          pendentes.length > 0
            ? "Revisar as pendentes e definir se são reembolsáveis ou devem ser absorvidas."
            : undefined,
        peso: pctRec < 30 ? 88 : 60,
      });
    }

    // Variação vs mês anterior
    if (ncsAnterior.length > 0) {
      const varPct = ((ncs.length - ncsAnterior.length) / ncsAnterior.length) * 100;
      if (Math.abs(varPct) >= 30) {
        out.push({
          id: "nc-variacao",
          severidade: varPct > 0 ? "atencao" : "positivo",
          categoria: "qualidade",
          titulo:
            varPct > 0
              ? `Não conformidades subiram ${pct(varPct)} no mês`
              : `Não conformidades caíram ${pct(Math.abs(varPct))} no mês`,
          descricao: `${ncsAnterior.length} ocorrência(s) no mês anterior contra ${ncs.length} agora.`,
          peso: varPct > 0 ? 78 : 45,
        });
      }
    }

    // Reincidência por colaborador
    const porColab = new Map<string, number>();
    ncs
      .filter((n) => n.colaborador_id)
      .forEach((n) => porColab.set(n.colaborador_id!, (porColab.get(n.colaborador_id!) ?? 0) + 1));
    Array.from(porColab.entries())
      .filter(([, q]) => q >= 3)
      .forEach(([cid, q]) => {
        out.push({
          id: `nc-reincidencia-${cid}`,
          severidade: "atencao",
          categoria: "pessoas",
          titulo: `${nomeColaborador(cid)} com ${q} ocorrências no período`,
          descricao:
            "Reincidência nesse volume geralmente aponta lacuna de treinamento ou sobrecarga, não descuido.",
          acao: "Vale uma conversa individual antes de qualquer registro formal e definir um acompanhamento se houver lacuna técnica.",
          peso: 72,
        });
      });
  }

  /* ═══ CUSTO ═══ */

  if (podeVerCusto) {
    const custoTotal = custos.reduce((s, c) => s + Number(c.total), 0);
    const custoTotalAnt = custosAnterior.reduce((s, c) => s + Number(c.total), 0);
    const volTotal = comProd.reduce((s, o) => s + o.vol, 0);
    const volTotalAnt = prodAnterior.reduce((s, r) => s + r.volume_processos, 0);

    if (custoTotal > 0 && custoTotalAnt > 0) {
      const varCusto = ((custoTotal - custoTotalAnt) / custoTotalAnt) * 100;
      const cpp = volTotal > 0 ? custoTotal / volTotal : 0;
      const cppAnt = volTotalAnt > 0 ? custoTotalAnt / volTotalAnt : 0;

      if (cpp > 0 && cppAnt > 0) {
        const varCpp = ((cpp - cppAnt) / cppAnt) * 100;
        if (Math.abs(varCpp) >= 8) {
          out.push({
            id: "custo-por-processo",
            severidade: varCpp > 0 ? "atencao" : "positivo",
            categoria: "custo",
            titulo:
              varCpp > 0
                ? `Custo por processo subiu ${pct(varCpp)}`
                : `Custo por processo caiu ${pct(Math.abs(varCpp))}`,
            descricao:
              `De ${fmtBRL(cppAnt)} para ${fmtBRL(cpp)} por processo. ` +
              (varCusto > 0 && varCpp > varCusto
                ? "A folha cresceu, mas o volume não acompanhou na mesma proporção."
                : varCusto <= 0 && varCpp > 0
                  ? "A folha não aumentou — a alta vem da queda de volume."
                  : "Movimento acompanha a variação de folha."),
            evidencia: `Folha ${varCusto >= 0 ? "+" : ""}${pct(varCusto)} · volume ${volTotalAnt > 0 ? (volTotal >= volTotalAnt ? "+" : "") + pct(((volTotal - volTotalAnt) / volTotalAnt) * 100) : "—"}`,
            peso: varCpp > 0 ? 82 : 42,
          });
        }
      }
    }

    // Operação mais cara por processo
    const comCpp = ops.filter((o) => o.custoProc > 0);
    if (comCpp.length >= 2) {
      const maisCara = comCpp.sort((a, b) => b.custoProc - a.custoProc)[0];
      const maisBarata = comCpp[comCpp.length - 1];
      if (maisCara.custoProc / maisBarata.custoProc >= 1.5) {
        out.push({
          id: "custo-dispersao-op",
          severidade: "info",
          categoria: "custo",
          titulo: `${maisCara.label} custa ${(maisCara.custoProc / maisBarata.custoProc).toFixed(1)}x mais por processo`,
          descricao: `${fmtBRL(maisCara.custoProc)} por processo contra ${fmtBRL(maisBarata.custoProc)} em ${maisBarata.label}.`,
          acao: "Diferença pode ser legítima (complexidade, senioridade da equipe) — vale confirmar antes de tratar como ineficiência.",
          peso: 55,
        });
      }
    }
  }

  /* ═══ BANCO DE HORAS ═══ */

  if (bancoHoras.length > 0) {
    const saldoTotal = bancoHoras.reduce((s, b) => s + Number(b.saldo_acumulado), 0);
    const positivos = bancoHoras.filter((b) => Number(b.saldo_acumulado) > 20);
    if (positivos.length > 0) {
      out.push({
        id: "banco-horas-alto",
        severidade: "atencao",
        categoria: "pessoas",
        titulo: `${positivos.length} colaborador(es) com saldo acima de 20h`,
        descricao: `Saldo consolidado da equipe: ${saldoTotal >= 0 ? "+" : ""}${saldoTotal.toFixed(0)}h. Acúmulo alto costuma indicar dimensionamento apertado, não esforço extra pontual.`,
        evidencia: positivos
          .slice(0, 3)
          .map(
            (b) =>
              `${nomeColaborador(b.colaborador_id)}: +${Number(b.saldo_acumulado).toFixed(0)}h`,
          )
          .join(" · "),
        acao: "Avaliar compensação ou revisão de headcount antes que vire passivo.",
        peso: 68,
      });
    }
  }

  /* ═══ CORRELAÇÃO: NC x PRODUTIVIDADE ═══ */
  const comAmbos = ops.filter((o) => o.pessoas > 0 && o.ncQtd > 0);
  comAmbos
    .filter((o) => o.pctMeta < 85 && o.ncQtd >= 2)
    .forEach((o) => {
      out.push({
        id: `corr-nc-prod-${o.key}`,
        severidade: "info",
        categoria: "processo",
        titulo: `${o.label}: baixa produtividade coincide com ${o.ncQtd} não conformidades`,
        descricao: `A operação está a ${pct(o.pctMeta)} da meta e concentra ${o.ncQtd} ocorrência(s). Retrabalho costuma explicar parte do gap de produtividade.`,
        acao: "Verificar quanto tempo a equipe gastou corrigindo essas ocorrências.",
        peso: 66,
      });
    });

  /* ── sem dados ── */
  if (out.length === 0) {
    out.push({
      id: "sem-sinal",
      severidade: "positivo",
      categoria: "processo",
      titulo: "Nenhum desvio relevante identificado",
      descricao:
        comProd.length === 0
          ? "Ainda não há dados suficientes no período para gerar diagnóstico. Cadastre produtividade, não conformidades e custo."
          : "Os indicadores do período estão dentro do esperado, sem concentrações ou quedas que mereçam atenção imediata.",
      peso: 10,
    });
  }

  return out.sort((a, b) => b.peso - a.peso);
}

/** Sumário executivo em texto corrido, derivado dos insights. */
export function resumoExecutivo(insights: Insight[]): string {
  const crit = insights.filter((i) => i.severidade === "critico");
  const aten = insights.filter((i) => i.severidade === "atencao");
  const pos = insights.filter((i) => i.severidade === "positivo");

  if (insights.length === 1 && insights[0].id === "sem-sinal") return insights[0].descricao;

  const partes: string[] = [];
  if (crit.length > 0) partes.push(`${crit.length} ponto(s) crítico(s) exigindo ação imediata`);
  if (aten.length > 0) partes.push(`${aten.length} ponto(s) de atenção`);
  if (pos.length > 0) partes.push(`${pos.length} evolução(ões) positiva(s)`);

  const cabeca = partes.length > 0 ? `O período apresenta ${partes.join(", ")}.` : "";
  const foco = crit[0] ?? aten[0];
  const detalhe = foco ? ` A prioridade é: ${foco.titulo.toLowerCase()}.` : "";
  return cabeca + detalhe;
}
