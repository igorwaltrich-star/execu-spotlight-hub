import * as XLSX from "xlsx";
import { dataIso, numero, texto } from "@/lib/fechamento-pendente";

/** Leitura e regras dos arquivos do Hub: frequência dos colaboradores e pendências de onboarding. */

export type LinhaColaborador = {
  colaborador: string;
  cargo: string | null;
  gestor: string | null;
  empresa: string | null;
  treinamento_concluidos: number;
  treinamentos_pendentes: string | null;
  nota: number | null;
  hub_dias_30: number;
  ultimo_acesso_hub: string | null;
  ultima_acao_processo: string | null;
  dashboard_dias_30: number;
  ultimo_acesso_dashboard: string | null;
};

export type LinhaOnboarding = {
  empresa: string;
  item: string;
  responsavel: string | null;
  desde: string | null;
};

function lerCsvObjetos(conteudo: string): Record<string, unknown>[] {
  const wb = XLSX.read(conteudo.replace(/^\uFEFF/, ""), { type: "string", FS: ";", raw: true });
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], {
    defval: "",
    raw: false,
  });
}

async function lerPlanilha(file: File): Promise<Record<string, unknown>[]> {
  if (/\.csv$/i.test(file.name)) return lerCsvObjetos(await file.text());
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], {
    defval: "",
    raw: false,
  });
}

const exigir = (linhas: Record<string, unknown>[], colunas: string[]) => {
  const faltando = colunas.filter((c) => !(linhas[0] && c in linhas[0]));
  if (faltando.length) throw new Error(`O arquivo não tem as colunas: ${faltando.join(", ")}.`);
};

/** O Excel converte "3/3" em "03/mar": as duas formas valem. */
export function modulosConcluidos(v: unknown): number {
  const m = texto(v).match(/^(\d+)\/(\d+|[a-zç]{3})$/i);
  return m ? Number(m[1]) : 0;
}

export async function lerFrequencia(file: File): Promise<LinhaColaborador[]> {
  const linhas = await lerPlanilha(file);
  exigir(linhas, [
    "Colaborador",
    "Empresa",
    "Treinamento",
    "Hub · dias com acesso (30 dias)",
    "Último acesso ao Hub",
  ]);
  const out = linhas
    .filter((r) => texto(r["Colaborador"]))
    .map((r) => {
      const nota = texto(r["Nota nos questionários"]);
      return {
        colaborador: texto(r["Colaborador"]),
        cargo: texto(r["Cargo"]) || null,
        gestor: texto(r["Gestor"]) || null,
        empresa: texto(r["Empresa"]) || null,
        treinamento_concluidos: modulosConcluidos(r["Treinamento"]),
        treinamentos_pendentes: texto(r["Treinamentos pendentes"]) || null,
        nota: nota ? numero(nota) : null,
        hub_dias_30: numero(r["Hub · dias com acesso (30 dias)"]),
        ultimo_acesso_hub: dataIso(r["Último acesso ao Hub"]),
        ultima_acao_processo: dataIso(r["Última ação em processo"]),
        dashboard_dias_30: numero(r["Dashboard · dias (30 dias)"]),
        ultimo_acesso_dashboard: dataIso(r["Último acesso ao dashboard"]),
      };
    });
  if (!out.length) throw new Error("Nenhum colaborador encontrado no arquivo.");
  return out;
}

export async function lerOnboarding(file: File): Promise<LinhaOnboarding[]> {
  const linhas = await lerPlanilha(file);
  exigir(linhas, ["Empresa", "O que falta"]);
  const out = linhas
    .filter((r) => texto(r["Empresa"]) && texto(r["O que falta"]))
    .map((r) => ({
      empresa: texto(r["Empresa"]),
      item: texto(r["O que falta"]),
      responsavel: texto(r["Com quem"]) || null,
      desde: dataIso(r["Desde"]),
    }));
  if (!out.length) throw new Error("Nenhum item de onboarding encontrado no arquivo.");
  return out;
}

/** Data de referência a partir do nome "…-AAAA-MM-DD.csv". */
export function dataDoNome(nome: string): string | null {
  const m = nome.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export const empresasDe = (empresa: string | null) =>
  texto(empresa)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export type SituacaoColab = "Crítico" | "Atenção" | "Em dia";
export type ColaboradorAvaliado = LinhaColaborador & {
  dias_sem_acesso: number | null;
  pendencias: string[];
  situacao: SituacaoColab;
};

const dias = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 864e5);

/**
 * Pendências: treinamento incompleto; nunca acessou ou mais de 7 dias sem acesso; menos de 10 dias
 * de uso em 30; nenhum uso de dashboard em 30 dias; nota abaixo de 80%.
 * Crítico: nunca acessou, mais de 14 dias sem acesso, ou nenhum módulo e menos de 10 dias de uso.
 * Os dias contam a partir do acesso mais recente do arquivo.
 */
export function avaliarColaboradores(linhas: LinhaColaborador[]): {
  referencia: string | null;
  pessoas: ColaboradorAvaliado[];
} {
  const referencia =
    linhas
      .map((l) => l.ultimo_acesso_hub)
      .filter(Boolean)
      .sort()
      .pop() ?? null;
  const pessoas = linhas.map((l) => {
    const sem = l.ultimo_acesso_hub && referencia ? dias(l.ultimo_acesso_hub, referencia) : null;
    const p: string[] = [];
    if (l.treinamento_concluidos < 3) p.push("Treinamento incompleto");
    if (sem === null) p.push("Nunca acessou o Hub");
    else if (sem > 7) p.push("Sem acesso há mais de 7 dias");
    if (sem !== null && l.hub_dias_30 < 10) p.push("Pouco uso do Hub");
    if (l.dashboard_dias_30 === 0) p.push("Sem uso de dashboard");
    if (l.nota !== null && l.nota < 80) p.push("Nota abaixo de 80%");
    const critico =
      sem === null || sem > 14 || (l.treinamento_concluidos === 0 && l.hub_dias_30 < 10);
    const situacao: SituacaoColab = critico ? "Crítico" : p.length ? "Atenção" : "Em dia";
    return { ...l, dias_sem_acesso: sem, pendencias: p, situacao };
  });
  return { referencia, pessoas };
}

export function diasEmAberto(desde: string | null, referencia: string | null): number | null {
  return desde && referencia ? dias(desde, referencia) : null;
}
