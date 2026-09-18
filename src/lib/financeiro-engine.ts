/**
 * Funil financeiro: Registro → Solicitação de Fechamento → Fechamento.
 *
 * A fronteira de responsabilidade da operação termina na solicitação.
 * Por isso as métricas separam explicitamente as duas pernas:
 *   Registro → Solicitação  = desempenho da operação
 *   Solicitação → Fechamento = desempenho do financeiro
 */

export type ProcessoFin = {
  id?: string;
  sigra: string;
  codigo?: string | null;
  centro_custo?: string | null;
  modal?: string | null;
  di?: string | null;
  importador?: string | null;
  canal_rfb?: string | null;
  data_registro?: string | null;
  data_solicitacao?: string | null;
  data_fechamento?: string | null;
};

/**
 * Converte data do Sigraweb.
 *
 * A exportação traz texto "DD/MM/AAAA HH:MM", não data do Excel.
 * Há ainda um defeito recorrente na origem: anos digitados com dois
 * dígitos chegam como 0026 em vez de 2026. Sem essa correção o
 * lead time estoura em centenas de milhares de dias.
 */
export function parseDataSigra(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : toISO(v);

  const bruto = String(v).trim();
  if (!bruto || bruto === "-" || bruto.toLowerCase() === "none") return null;

  const soData = bruto.split(" ")[0];

  const br = soData.match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,4})$/);
  if (br) {
    let ano = Number(br[3]);
    if (ano < 100)
      ano += 2000; // 26 -> 2026
    else if (ano < 1900) ano += 2000; // 0026 -> 2026
    const d = new Date(Date.UTC(ano, Number(br[2]) - 1, Number(br[1])));
    return isNaN(d.getTime()) ? null : toISO(d);
  }

  const iso = soData.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return soData;

  return null;
}

const toISO = (d: Date) => d.toISOString().slice(0, 10);
const dias = (a: string, b: string) =>
  Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);

export type Etapa = "registrado" | "solicitado" | "fechado";

export function etapaDe(p: ProcessoFin): Etapa | null {
  if (p.data_fechamento) return "fechado";
  if (p.data_solicitacao) return "solicitado";
  if (p.data_registro) return "registrado";
  return null;
}

export type Funil = {
  registrados: number;
  solicitados: number;
  fechados: number;
  pendentesSolicitacao: number;
  aguardandoFechamento: number;
  taxaSolicitacao: number; // solicitados / registrados
  taxaFechamento: number; // fechados / solicitados
};

export function calcularFunil(procs: ProcessoFin[]): Funil {
  const registrados = procs.filter((p) => p.data_registro).length;
  const solicitados = procs.filter((p) => p.data_solicitacao).length;
  const fechados = procs.filter((p) => p.data_fechamento).length;
  return {
    registrados,
    solicitados,
    fechados,
    pendentesSolicitacao: registrados - solicitados,
    aguardandoFechamento: solicitados - fechados,
    taxaSolicitacao: registrados > 0 ? (solicitados / registrados) * 100 : 0,
    taxaFechamento: solicitados > 0 ? (fechados / solicitados) * 100 : 0,
  };
}

export type Estatistica = {
  n: number;
  media: number;
  mediana: number;
  p90: number;
  min: number;
  max: number;
  negativos: number;
};

/** Mediana e p90 resistem a outliers; a média sozinha engana. */
export function estatisticas(valores: number[]): Estatistica {
  if (valores.length === 0)
    return { n: 0, media: 0, mediana: 0, p90: 0, min: 0, max: 0, negativos: 0 };
  const s = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(s.length / 2);
  return {
    n: s.length,
    media: s.reduce((a, b) => a + b, 0) / s.length,
    mediana: s.length % 2 ? s[meio] : (s[meio - 1] + s[meio]) / 2,
    p90: s[Math.min(Math.floor(s.length * 0.9), s.length - 1)],
    min: s[0],
    max: s[s.length - 1],
    negativos: s.filter((x) => x < 0).length,
  };
}

/** Lead times das duas pernas, ignorando valores negativos no cálculo. */
export function leadTimes(procs: ProcessoFin[]) {
  const regSol: number[] = [];
  const solFec: number[] = [];
  for (const p of procs) {
    if (p.data_registro && p.data_solicitacao)
      regSol.push(dias(p.data_registro, p.data_solicitacao));
    if (p.data_solicitacao && p.data_fechamento)
      solFec.push(dias(p.data_solicitacao, p.data_fechamento));
  }
  return {
    registroSolicitacao: estatisticas(regSol.filter((d) => d >= 0)),
    solicitacaoFechamento: estatisticas(solFec.filter((d) => d >= 0)),
    inconsistencias: {
      solicitacaoAntesRegistro: regSol.filter((d) => d < 0).length,
      fechamentoAntesSolicitacao: solFec.filter((d) => d < 0).length,
    },
  };
}

/** Idade dos processos registrados que ainda não têm solicitação. */
export function agingPendentes(procs: ProcessoFin[], hoje = new Date()) {
  const ref = toISO(hoje);
  const faixas = [
    { label: "0-15 dias", min: 0, max: 15, qtd: 0 },
    { label: "16-30 dias", min: 16, max: 30, qtd: 0 },
    { label: "31-60 dias", min: 31, max: 60, qtd: 0 },
    { label: "61-90 dias", min: 61, max: 90, qtd: 0 },
    { label: "> 90 dias", min: 91, max: Infinity, qtd: 0 },
  ];
  const idades: number[] = [];
  for (const p of procs) {
    if (!p.data_registro || p.data_solicitacao) continue;
    const d = dias(p.data_registro, ref);
    if (d < 0) continue;
    idades.push(d);
    const f = faixas.find((x) => d >= x.min && d <= x.max);
    if (f) f.qtd++;
  }
  return { faixas, estat: estatisticas(idades) };
}

/** Evolução mensal das três etapas, pela data de cada evento. */
export function evolucaoMensal(procs: ProcessoFin[]) {
  const mapa = new Map<
    string,
    { mes: string; registrados: number; solicitados: number; fechados: number }
  >();
  const get = (m: string) => {
    if (!mapa.has(m)) mapa.set(m, { mes: m, registrados: 0, solicitados: 0, fechados: 0 });
    return mapa.get(m)!;
  };
  for (const p of procs) {
    if (p.data_registro) get(p.data_registro.slice(0, 7)).registrados++;
    if (p.data_solicitacao) get(p.data_solicitacao.slice(0, 7)).solicitados++;
    if (p.data_fechamento) get(p.data_fechamento.slice(0, 7)).fechados++;
  }
  return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

export type ResumoCC = {
  centro_custo: string;
  registrados: number;
  solicitados: number;
  fechados: number;
  taxaSolicitacao: number;
  taxaFechamento: number;
  pendentes: number;
  medianaRegSol: number | null;
};

/** Corte por centro de custo — é aqui que a concentração aparece. */
export function porCentroCusto(procs: ProcessoFin[]): ResumoCC[] {
  const mapa = new Map<string, ProcessoFin[]>();
  for (const p of procs) {
    const cc = p.centro_custo || "(sem centro de custo)";
    const arr = mapa.get(cc) ?? [];
    arr.push(p);
    mapa.set(cc, arr);
  }
  return [...mapa.entries()]
    .map(([cc, lista]) => {
      const f = calcularFunil(lista);
      const lt = leadTimes(lista);
      return {
        centro_custo: cc,
        registrados: f.registrados,
        solicitados: f.solicitados,
        fechados: f.fechados,
        taxaSolicitacao: f.taxaSolicitacao,
        taxaFechamento: f.taxaFechamento,
        pendentes: f.pendentesSolicitacao,
        medianaRegSol: lt.registroSolicitacao.n > 0 ? lt.registroSolicitacao.mediana : null,
      };
    })
    .sort((a, b) => b.registrados - a.registrados);
}

/**
 * Contas sem nenhuma solicitação registrada.
 *
 * Volume alto com zero solicitação quase nunca é falha de execução —
 * é conta que opera por outro fluxo. Separar isso muda completamente
 * a leitura da taxa global.
 */
export function contasSemSolicitacao(resumo: ResumoCC[], minimo = 50): ResumoCC[] {
  return resumo.filter((r) => r.solicitados === 0 && r.registrados >= minimo);
}

/** Recalcula o funil excluindo os centros de custo informados. */
export function funilExcluindo(procs: ProcessoFin[], excluir: string[]): Funil {
  const set = new Set(excluir);
  return calcularFunil(procs.filter((p) => !set.has(p.centro_custo || "(sem centro de custo)")));
}
