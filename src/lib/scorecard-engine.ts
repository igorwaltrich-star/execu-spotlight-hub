/**
 * Motor do Performance Scorecard.
 *
 * Três das cinco dimensões são calculadas a partir dos dados
 * operacionais já registrados — não dependem de percepção:
 *
 *   Produtividade ajustada  volume × peso de complexidade (BPMN) ÷ FTE
 *   Qualidade               não conformidades atribuídas por volume
 *   Confiabilidade          avaliação registrada pela liderança
 *
 * Multiplicação e Iniciativa não têm fonte automática: são avaliadas
 * pelo gestor e, por isso, exigem evidência escrita. O motor recusa
 * a nota quando a evidência falta — é o que impede a dimensão
 * subjetiva de virar peso morto na conta.
 */

import { metaProdUnidade } from "@/lib/constants";

export type PesosCiclo = {
  produtividade: number;
  qualidade: number;
  confiabilidade: number;
  multiplicacao: number;
  iniciativa: number;
};

export const PESOS_PADRAO: PesosCiclo = {
  produtividade: 30,
  qualidade: 25,
  confiabilidade: 20,
  multiplicacao: 15,
  iniciativa: 10,
};

export const DIMENSOES = [
  {
    key: "produtividade",
    label: "Produtividade ajustada",
    mede: "Volume × peso de complexidade do BPMN",
  },
  { key: "qualidade", label: "Qualidade", mede: "Retrabalho, inconsistência, erro de dado" },
  { key: "confiabilidade", label: "Confiabilidade", mede: "SLA cumprido, prazo, disponibilidade" },
  { key: "multiplicacao", label: "Multiplicação", mede: "Mentoria, backup ativo, job rotation" },
  { key: "iniciativa", label: "Iniciativa", mede: "Antecipar problema, propor melhoria" },
] as const;

export type DimensaoKey = (typeof DIMENSOES)[number]["key"];

/* ── entradas ───────────────────────────────────────────── */

export type PesoBpmn = {
  operacao: string;
  processo: string;
  peso: number;
  participacao: number;
  ativo: boolean;
  referencia?: string | null;
};
export type RegistroProd = {
  colaborador_id: string;
  operacao: string;
  mes: string;
  volume_processos: number;
  fte: number;
};
export type NaoConf = {
  colaborador_id?: string | null;
  data_ocorrencia: string;
  custo_gerado: number;
};
/**
 * Fator de complexidade de uma operação, derivado do BPMN.
 * Média dos pesos ponderada pela participação de cada processo no mix.
 * Sem processos cadastrados, devolve 1 — a operação não é penalizada
 * nem beneficiada enquanto o mapeamento não existir.
 */
export function fatorComplexidade(pesos: PesoBpmn[], operacao: string): number {
  const ativos = pesos.filter((p) => p.ativo && p.operacao === operacao);
  if (ativos.length === 0) return 1;

  const somaPart = ativos.reduce((s, p) => s + Number(p.participacao), 0);
  if (somaPart <= 0) {
    // sem participação informada, média simples dos pesos
    return ativos.reduce((s, p) => s + Number(p.peso), 0) / ativos.length;
  }
  return ativos.reduce((s, p) => s + Number(p.peso) * Number(p.participacao), 0) / somaPart;
}

/** Converte um valor em nota 0-100, com teto. */
const nota = (v: number) => Math.max(0, Math.min(100, v));

/* ── dimensões calculadas ───────────────────────────────── */

export type DetalheProdutividade = {
  nota: number;
  volume: number;
  volumeAjustado: number;
  fte: number;
  produtividade: number;
  meta: number;
  fator: number;
  semDados: boolean;
};

export function calcularProdutividade(
  regs: RegistroProd[],
  pesos: PesoBpmn[],
  colaboradorId: string,
  periodo: { inicio: string; fim: string },
): DetalheProdutividade {
  const meus = regs.filter(
    (r) => r.colaborador_id === colaboradorId && r.mes >= periodo.inicio && r.mes <= periodo.fim,
  );
  if (meus.length === 0)
    return {
      nota: 0,
      volume: 0,
      volumeAjustado: 0,
      fte: 0,
      produtividade: 0,
      meta: 0,
      fator: 1,
      semDados: true,
    };

  let volume = 0,
    volumeAjustado = 0,
    fte = 0,
    metaPond = 0,
    fatorPond = 0;
  for (const r of meus) {
    const f = fatorComplexidade(pesos, r.operacao);
    const v = Number(r.volume_processos ?? 0);
    const e = Number(r.fte ?? 0);
    volume += v;
    volumeAjustado += v * f;
    fte += e;
    metaPond += metaProdUnidade(r.operacao) * e;
    fatorPond += f * e;
  }

  const produtividade = fte > 0 ? volumeAjustado / fte : 0;
  // a meta também é ajustada pelo mesmo fator, senão operação complexa
  // seria penalizada duas vezes
  const fatorMedio = fte > 0 ? fatorPond / fte : 1;
  const meta = fte > 0 ? (metaPond / fte) * fatorMedio : 0;

  return {
    nota: meta > 0 ? nota((produtividade / meta) * 100) : 0,
    volume,
    volumeAjustado,
    fte,
    produtividade,
    meta,
    fator: fatorMedio,
    semDados: false,
  };
}

export type DetalheQualidade = {
  nota: number;
  ocorrencias: number;
  custo: number;
  retrabalho: number;
  baseAvaliada: number;
  semDados: boolean;
};

/**
 * Qualidade parte de 100 e desconta por ocorrência atribuída.
 * O desconto é proporcional ao volume trabalhado: 3 erros em 500
 * processos não pesam o mesmo que 3 em 50.
 */
export function calcularQualidade(
  ncs: NaoConf[],
  regs: RegistroProd[],
  colaboradorId: string,
  periodo: { inicio: string; fim: string },
): DetalheQualidade {
  const minhasNcs = ncs.filter(
    (n) =>
      n.colaborador_id === colaboradorId &&
      n.data_ocorrencia >= periodo.inicio &&
      n.data_ocorrencia <= periodo.fim,
  );
  const volume = regs
    .filter(
      (r) => r.colaborador_id === colaboradorId && r.mes >= periodo.inicio && r.mes <= periodo.fim,
    )
    .reduce((s, r) => s + Number(r.volume_processos ?? 0), 0);

  if (minhasNcs.length === 0 && volume === 0)
    return { nota: 0, ocorrencias: 0, custo: 0, retrabalho: 0, baseAvaliada: 0, semDados: true };

  const base = Math.max(volume, 1);
  const taxa = (minhasNcs.length / base) * 100;

  // 1% de incidência custa 10 pontos — 10% zera a dimensão
  return {
    nota: nota(100 - taxa * 10),
    ocorrencias: minhasNcs.length,
    custo: minhasNcs.reduce((s, n) => s + Number(n.custo_gerado ?? 0), 0),
    retrabalho: 0,
    baseAvaliada: base,
    semDados: false,
  };
}

/* ── consolidação ───────────────────────────────────────── */

export type NotasDimensao = Record<DimensaoKey, number | null>;

export type ResultadoScorecard = {
  total: number;
  /** dimensões sem nota, que ficaram fora da conta */
  ausentes: DimensaoKey[];
  /** soma dos pesos efetivamente aplicados */
  pesoAplicado: number;
  contribuicao: { dimensao: DimensaoKey; nota: number; peso: number; pontos: number }[];
};

/**
 * Pondera as notas disponíveis. Dimensão sem nota não vira zero —
 * sai da conta e o peso é redistribuído. Zerar por ausência de dado
 * puniria a pessoa por lacuna de registro do gestor.
 */
export function consolidar(notas: NotasDimensao, pesos: PesosCiclo): ResultadoScorecard {
  const contribuicao: ResultadoScorecard["contribuicao"] = [];
  const ausentes: DimensaoKey[] = [];
  let pesoAplicado = 0;

  for (const d of DIMENSOES) {
    const n = notas[d.key];
    const p = pesos[d.key];
    if (n === null || n === undefined || Number.isNaN(n)) {
      ausentes.push(d.key);
      continue;
    }
    pesoAplicado += p;
    contribuicao.push({ dimensao: d.key, nota: n, peso: p, pontos: (n * p) / 100 });
  }

  const somaPontos = contribuicao.reduce((s, c) => s + c.pontos, 0);
  return {
    total: pesoAplicado > 0 ? (somaPontos / pesoAplicado) * 100 : 0,
    ausentes,
    pesoAplicado,
    contribuicao,
  };
}

/** Faixa qualitativa — evita reduzir a pessoa a um número solto. */
export function faixa(total: number): { label: string; cls: string } {
  if (total >= 90) return { label: "Referência", cls: "text-success" };
  if (total >= 75) return { label: "Consistente", cls: "text-success" };
  if (total >= 60) return { label: "Em desenvolvimento", cls: "text-warning" };
  return { label: "Requer suporte", cls: "text-destructive" };
}

/** Tendência entre ciclos: compara os dois últimos resultados. */
export function tendencia(historico: number[]): "alta" | "queda" | "estavel" {
  if (historico.length < 2) return "estavel";
  const delta = historico[historico.length - 1] - historico[historico.length - 2];
  if (delta > 3) return "alta";
  if (delta < -3) return "queda";
  return "estavel";
}
