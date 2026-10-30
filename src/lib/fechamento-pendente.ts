import * as XLSX from "xlsx";

/** Leitura, estimativa e comparação das bases de fechamento pendente do Sigra. */

export const FAIXAS = [
  { key: "ate_15", label: "Até 15 dias" },
  { key: "de_15_30", label: "15 a 30 dias" },
  { key: "de_30_60", label: "30 a 60 dias" },
  { key: "de_60_90", label: "60 a 90 dias" },
  { key: "mais_90", label: "Mais de 90 dias" },
] as const;
export type FaixaKey = (typeof FAIXAS)[number]["key"];

export type LinhaResumo = {
  centro_custo: string;
  usa_fluxo: boolean;
  processos_di: number;
  com_pedido: number;
  percentual_pedido: number;
  sem_pedido: number;
} & Record<FaixaKey, number>;

export type LinhaPendencia = {
  centro_custo: string;
  processo: string;
  cliente: string | null;
  di_duimp: string | null;
  data_registro: string | null;
  dias_sem_pedido: number;
  faixa: string | null;
  usa_fluxo: boolean;
};

export type LeituraFechamento = {
  formato: "xlsx" | "csv";
  /** ISO com fuso de Brasília, ou null se o arquivo não informar */
  dataReferencia: string | null;
  /** O CSV não traz o resumo: ele é estimado a partir da base anterior */
  resumos: LinhaResumo[] | null;
  pendencias: LinhaPendencia[];
};

export const texto = (v: unknown) => String(v ?? "").trim();
export const numero = (v: unknown) => {
  if (typeof v === "number") return v;
  const n = Number(texto(v).replace(/\./g, "").replace(",", ".").replace("%", ""));
  return Number.isFinite(n) ? n : 0;
};
export const dataIso = (v: unknown) => {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const m = texto(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
};

export function faixaDe(p: Pick<LinhaPendencia, "faixa" | "dias_sem_pedido">): FaixaKey {
  const i = FAIXAS.findIndex((f) => f.label.toLowerCase() === texto(p.faixa).toLowerCase());
  if (i >= 0) return FAIXAS[i].key;
  const d = p.dias_sem_pedido;
  return d > 90
    ? "mais_90"
    : d >= 60
      ? "de_60_90"
      : d >= 30
        ? "de_30_60"
        : d >= 15
          ? "de_15_30"
          : "ate_15";
}

export const chavePendencia = (p: Pick<LinhaPendencia, "centro_custo" | "processo" | "di_duimp">) =>
  `${p.centro_custo}|${p.processo}|${p.di_duimp ?? ""}`;

const pad = (n: number) => String(n).padStart(2, "0");

function lerXlsx(buf: ArrayBuffer): LeituraFechamento {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const resumoWs = wb.Sheets["Resumo"];
  const pendWs = wb.Sheets["Sem fechamento"];
  const foraWs = wb.Sheets["Centros sem o fluxo"];
  if (!resumoWs || !pendWs || !foraWs)
    throw new Error(
      'A planilha precisa conter as abas "Resumo", "Sem fechamento" e "Centros sem o fluxo".',
    );

  const linhas = XLSX.utils.sheet_to_json<unknown[]>(resumoWs, { header: 1, defval: "" });
  const cab = linhas.findIndex((r) => texto(r[0]).toLowerCase() === "centro de custo");
  if (cab < 0) throw new Error("Cabeçalho do resumo não encontrado.");
  const ref = texto(linhas[1]?.[0]).match(/(\d{2})\/(\d{2})\/(\d{4})(?:,\s*(\d{2}):(\d{2}))?/);
  const dataReferencia = ref
    ? `${ref[3]}-${ref[2]}-${ref[1]}T${ref[4] ?? "00"}:${ref[5] ?? "00"}:00-03:00`
    : null;

  const resumos: LinhaResumo[] = linhas
    .slice(cab + 1)
    .filter((r) => texto(r[0]) && texto(r[0]).toLowerCase() !== "total")
    .map((r) => ({
      centro_custo: texto(r[0]),
      usa_fluxo: texto(r[1]).toLowerCase() !== "não",
      processos_di: numero(r[2]),
      com_pedido: numero(r[3]),
      percentual_pedido: numero(r[4]) <= 1 ? numero(r[4]) * 100 : numero(r[4]),
      sem_pedido: numero(r[5]),
      ate_15: numero(r[6]),
      de_15_30: numero(r[7]),
      de_30_60: numero(r[8]),
      de_60_90: numero(r[9]),
      mais_90: numero(r[10]),
    }));
  if (resumos.length === 0) throw new Error("Nenhum centro de custo encontrado no resumo.");

  const ler = (ws: XLSX.WorkSheet, usaFluxo: boolean): LinhaPendencia[] =>
    XLSX.utils
      .sheet_to_json<unknown[]>(ws, { header: 1, defval: "" })
      .slice(1)
      .filter((r) => texto(r[0]) && texto(r[1]))
      .map((r) => ({
        centro_custo: texto(r[0]),
        processo: texto(r[1]),
        cliente: texto(r[2]) || null,
        di_duimp: texto(r[3]) || null,
        data_registro: dataIso(r[4]),
        dias_sem_pedido: numero(r[5]),
        faixa: texto(r[6]) || null,
        usa_fluxo: usaFluxo,
      }));

  return {
    formato: "xlsx",
    dataReferencia,
    resumos,
    pendencias: [...ler(pendWs, true), ...ler(foraWs, false)],
  };
}

/** CSV "fechamento-pendente-AAAA-MM-DD.csv": separado por ;, uma linha por processo, sem resumo. */
function lerCsv(conteudo: string, nome: string, modificado: number): LeituraFechamento {
  const wb = XLSX.read(conteudo.replace(/^\uFEFF/, ""), { type: "string", FS: ";", raw: true });
  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], {
    defval: "",
  });
  const col = (r: Record<string, unknown>, nomeCol: string) => r[nomeCol];
  const obrigatorias = [
    "Centro de custo",
    "Processo",
    "DI/DUIMP",
    "Dias sem pedir fechamento",
    "Centro usa o fluxo",
  ];
  const faltando = obrigatorias.filter((c) => !(linhas[0] && c in linhas[0]));
  if (faltando.length) throw new Error(`O CSV não tem as colunas: ${faltando.join(", ")}.`);

  const pendencias: LinhaPendencia[] = linhas
    .filter((r) => texto(col(r, "Centro de custo")) && texto(col(r, "Processo")))
    .map((r) => ({
      centro_custo: texto(col(r, "Centro de custo")),
      processo: texto(col(r, "Processo")),
      cliente: texto(col(r, "Cliente")) || null,
      di_duimp: texto(col(r, "DI/DUIMP")) || null,
      data_registro: dataIso(col(r, "Data de registro")),
      dias_sem_pedido: numero(col(r, "Dias sem pedir fechamento")),
      faixa: texto(col(r, "Faixa")) || null,
      usa_fluxo: texto(col(r, "Centro usa o fluxo")).toLowerCase() === "sim",
    }));
  if (pendencias.length === 0) throw new Error("Nenhum processo encontrado no CSV.");

  // data do nome do arquivo; o horário vem da última alteração quando é do mesmo dia
  const m = nome.match(/(\d{4})-(\d{2})-(\d{2})/);
  let dataReferencia: string | null = null;
  if (m) {
    const mod = new Date(modificado - 3 * 3600e3); // horário de Brasília
    const mesmoDia = mod.toISOString().slice(0, 10) === `${m[1]}-${m[2]}-${m[3]}`;
    const hora = mesmoDia ? `${pad(mod.getUTCHours())}:${pad(mod.getUTCMinutes())}` : "00:00";
    dataReferencia = `${m[1]}-${m[2]}-${m[3]}T${hora}:00-03:00`;
  }
  return { formato: "csv", dataReferencia, resumos: null, pendencias };
}

export async function lerArquivoFechamento(file: File): Promise<LeituraFechamento> {
  if (/\.csv$/i.test(file.name)) return lerCsv(await file.text(), file.name, file.lastModified);
  return lerXlsx(await file.arrayBuffer());
}

export function contarFaixas(linhas: LinhaPendencia[]): Record<FaixaKey, number> {
  const c = { ate_15: 0, de_15_30: 0, de_30_60: 0, de_60_90: 0, mais_90: 0 };
  linhas.forEach((p) => c[faixaDe(p)]++);
  return c;
}

/**
 * Estima o resumo de uma base em CSV a partir da base anterior.
 * - Centro com fluxo: processo que saiu da lista = pedido feito; que entrou = DI nova,
 *   exceto DI registrada até 7 dias antes da base anterior, que conta como pedido reaberto.
 * - Centro sem fluxo lista todas as DIs: o total é a lista e a adesão fica abaixo de 20%.
 * - Centro que volta a usar o fluxo: com pedido = DIs menos pendentes.
 */
export function estimarResumos(
  atual: LinhaPendencia[],
  anteriorResumos: LinhaResumo[],
  anteriorPendencias: LinhaPendencia[],
  anteriorData: string | null,
): LinhaResumo[] {
  const chavesAnt = new Set(anteriorPendencias.map(chavePendencia));
  const chavesAtu = new Set(atual.map(chavePendencia));
  const limite = anteriorData
    ? new Date(new Date(anteriorData).getTime() - 7 * 864e5).toISOString().slice(0, 10)
    : null;
  const porCentro = new Map<string, LinhaPendencia[]>();
  atual.forEach((p) =>
    porCentro.set(p.centro_custo, [...(porCentro.get(p.centro_custo) ?? []), p]),
  );

  return [...porCentro.entries()].map(([centro, linhas]) => {
    const usaFluxo = linhas.some((p) => p.usa_fluxo);
    const sem = linhas.length;
    const ant = anteriorResumos.find((r) => r.centro_custo === centro);
    const entram = linhas.filter((p) => !chavesAnt.has(chavePendencia(p)));
    const reab = limite
      ? entram.filter((p) => p.data_registro && p.data_registro < limite).length
      : 0;
    const sai = anteriorPendencias.filter(
      (p) => p.centro_custo === centro && !chavesAtu.has(chavePendencia(p)),
    ).length;
    let di: number;
    let com: number;
    if (!ant) {
      di = sem;
      com = 0;
    } else if (!usaFluxo) {
      di = sem;
      com = Math.min(ant.com_pedido, Math.max(0, Math.ceil(sem * 0.2) - 1));
    } else if (!ant.usa_fluxo) {
      di = ant.processos_di + entram.length;
      com = Math.max(0, di - sem);
    } else {
      di = ant.processos_di + entram.length - reab;
      com = Math.max(0, ant.com_pedido + sai - reab);
    }
    return {
      centro_custo: centro,
      usa_fluxo: usaFluxo,
      processos_di: di,
      com_pedido: com,
      percentual_pedido: di > 0 ? (com / di) * 100 : 0,
      sem_pedido: sem,
      ...contarFaixas(linhas),
    };
  });
}

export type ComparacaoCentro = {
  centro: string;
  usa_fluxo: boolean;
  atual: LinhaResumo | null;
  anterior: LinhaResumo | null;
  delta_sem: number | null;
  delta_90: number | null;
  /** só calculados quando as duas listas de processos do centro foram carregadas */
  entraram: number | null;
  sairam: number | null;
};

export function compararCentros(
  atual: LinhaResumo[],
  anterior: LinhaResumo[] | null,
  pendAtual: LinhaPendencia[] | null,
  pendAnterior: LinhaPendencia[] | null,
  centrosComLista: Set<string>,
): ComparacaoCentro[] {
  const centros = [
    ...new Set([
      ...atual.map((r) => r.centro_custo),
      ...(anterior ?? []).map((r) => r.centro_custo),
    ]),
  ];
  const kA = new Set((pendAtual ?? []).map(chavePendencia));
  const kP = new Set((pendAnterior ?? []).map(chavePendencia));
  return centros.map((centro) => {
    const a = atual.find((r) => r.centro_custo === centro) ?? null;
    const p = anterior?.find((r) => r.centro_custo === centro) ?? null;
    const temLista = !!pendAtual && !!pendAnterior && centrosComLista.has(centro);
    return {
      centro,
      usa_fluxo: a?.usa_fluxo ?? p?.usa_fluxo ?? false,
      atual: a,
      anterior: p,
      delta_sem: anterior ? (a?.sem_pedido ?? 0) - (p?.sem_pedido ?? 0) : null,
      delta_90: anterior ? (a?.mais_90 ?? 0) - (p?.mais_90 ?? 0) : null,
      entraram: temLista
        ? pendAtual!.filter((x) => x.centro_custo === centro && !kP.has(chavePendencia(x))).length
        : null,
      sairam: temLista
        ? pendAnterior!.filter((x) => x.centro_custo === centro && !kA.has(chavePendencia(x)))
            .length
        : null,
    };
  });
}

export type Situacao = "critico" | "atencao" | "ok" | "sem_fluxo";
export function situacaoCentro(r: LinhaResumo | null): Situacao {
  if (!r) return "ok";
  if (!r.usa_fluxo) return "sem_fluxo";
  if (r.mais_90 >= 20 || (r.processos_di > 0 && r.percentual_pedido < 80)) return "critico";
  if (r.mais_90 + r.de_60_90 > 0) return "atencao";
  return "ok";
}
