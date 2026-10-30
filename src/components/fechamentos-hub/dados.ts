import { supabase } from "@/integrations/supabase/client";
import {
  estimarResumos,
  lerArquivoFechamento,
  type LinhaPendencia,
  type LinhaResumo,
} from "@/lib/fechamento-pendente";
import {
  dataDoNome,
  lerFrequencia,
  lerOnboarding,
  type LinhaColaborador,
  type LinhaOnboarding,
} from "@/lib/hub-adesao";

export type Importacao = {
  id: string;
  arquivo_nome: string;
  data_referencia: string | null;
  created_at: string;
};

const PAGINA = 1000;

/** Lê todas as linhas de uma consulta, de 1.000 em 1.000 (limite do Supabase por chamada). */
async function todas<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await pagina(de, de + PAGINA - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGINA) return out;
  }
}

async function inserirLotes(tabela: string, linhas: object[]) {
  for (let i = 0; i < linhas.length; i += 500) {
    // tabela variável: o cliente tipado não aceita a união aqui
    const { error } = await (supabase.from as (t: string) => ReturnType<typeof supabase.from>)(
      tabela,
    ).insert(linhas.slice(i, i + 500) as never[]);
    if (error) throw error;
  }
}

// ── Fechamentos pendentes ────────────────────────────────────────────

export async function listarImportacoesFechamento(): Promise<Importacao[]> {
  const { data, error } = await supabase
    .from("financeiro_fechamento_importacoes")
    .select("id, arquivo_nome, data_referencia, created_at")
    .order("data_referencia", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return data ?? [];
}

export async function carregarResumos(importacaoId: string): Promise<LinhaResumo[]> {
  const { data, error } = await supabase
    .from("financeiro_fechamento_resumos")
    .select("*")
    .eq("importacao_id", importacaoId);
  if (error) throw error;
  return (data ?? []) as LinhaResumo[];
}

/** Processos de uma importação, só dos centros pedidos (a lista dos centros sem fluxo tem todas as DIs). */
export async function carregarPendencias(
  importacaoId: string,
  centros: string[],
): Promise<LinhaPendencia[]> {
  if (!centros.length) return [];
  return todas<LinhaPendencia>((de, ate) =>
    supabase
      .from("financeiro_fechamento_pendencias")
      .select(
        "centro_custo, processo, cliente, di_duimp, data_registro, dias_sem_pedido, faixa, usa_fluxo",
      )
      .eq("importacao_id", importacaoId)
      .in("centro_custo", centros)
      .order("id")
      .range(de, ate),
  );
}

export async function importarFechamento(file: File, usuarioId: string | undefined) {
  const leitura = await lerArquivoFechamento(file);
  let resumos = leitura.resumos;
  if (!resumos) {
    // CSV: estima o resumo a partir da base anterior mais recente
    const [anterior] = await listarImportacoesFechamento();
    if (!anterior)
      throw new Error(
        "O CSV não traz o resumo. Importe antes uma planilha .xlsx com a aba Resumo.",
      );
    const resAnt = await carregarResumos(anterior.id);
    const centrosFluxo = [
      ...new Set(leitura.pendencias.filter((p) => p.usa_fluxo).map((p) => p.centro_custo)),
    ];
    const pendAnt = await carregarPendencias(anterior.id, centrosFluxo);
    resumos = estimarResumos(leitura.pendencias, resAnt, pendAnt, anterior.data_referencia);
  }

  const { data: imp, error } = await supabase
    .from("financeiro_fechamento_importacoes")
    .insert({
      arquivo_nome: file.name,
      data_referencia: leitura.dataReferencia,
      importado_por: usuarioId,
    })
    .select("id")
    .single();
  if (error) throw error;
  try {
    await inserirLotes(
      "financeiro_fechamento_resumos",
      resumos.map((r) => ({ ...r, importacao_id: imp.id })),
    );
    await inserirLotes(
      "financeiro_fechamento_pendencias",
      leitura.pendencias.map((p) => ({ ...p, importacao_id: imp.id })),
    );
  } catch (e) {
    await supabase.from("financeiro_fechamento_importacoes").delete().eq("id", imp.id);
    throw e;
  }
  return {
    centros: resumos.length,
    processos: leitura.pendencias.length,
    estimado: leitura.formato === "csv",
  };
}

/** Importações feitas a partir de CSV têm o resumo estimado. */
export const resumoEstimado = (imp: Pick<Importacao, "arquivo_nome"> | null | undefined) =>
  !!imp && /\.csv$/i.test(imp.arquivo_nome);

// ── Hub ──────────────────────────────────────────────────────────────

/** Erro do PostgREST quando a migration das tabelas do Hub ainda não foi aplicada. */
export const tabelaAusente = (e: unknown) => {
  const m = String((e as { message?: string; code?: string })?.message ?? "");
  const c = String((e as { code?: string })?.code ?? "");
  return c === "42P01" || c === "PGRST205" || /does not exist|could not find the table/i.test(m);
};

export async function carregarFrequencia() {
  const { data: imps, error } = await supabase
    .from("hub_frequencia_importacoes")
    .select("id, arquivo_nome, data_referencia, created_at")
    .order("data_referencia", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const imp = imps?.[0];
  if (!imp) return null;
  const linhas = await todas<LinhaColaborador>((de, ate) =>
    supabase
      .from("hub_frequencia_colaboradores")
      .select("*")
      .eq("importacao_id", imp.id)
      .order("colaborador")
      .range(de, ate),
  );
  return { importacao: imp as Importacao, linhas };
}

export async function carregarOnboarding() {
  const { data: imps, error } = await supabase
    .from("hub_onboarding_importacoes")
    .select("id, arquivo_nome, data_referencia, created_at")
    .order("data_referencia", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const imp = imps?.[0];
  if (!imp) return null;
  const linhas = await todas<LinhaOnboarding>((de, ate) =>
    supabase
      .from("hub_onboarding_itens")
      .select("empresa, item, responsavel, desde")
      .eq("importacao_id", imp.id)
      .order("empresa")
      .range(de, ate),
  );
  return { importacao: imp as Importacao, linhas };
}

async function importarHub(
  file: File,
  usuarioId: string | undefined,
  tabelaImp: "hub_frequencia_importacoes" | "hub_onboarding_importacoes",
  tabelaLinhas: string,
  linhas: object[],
) {
  const { data: imp, error } = await supabase
    .from(tabelaImp)
    .insert({
      arquivo_nome: file.name,
      data_referencia: dataDoNome(file.name),
      importado_por: usuarioId,
    })
    .select("id")
    .single();
  if (error) throw error;
  try {
    await inserirLotes(
      tabelaLinhas,
      linhas.map((l) => ({ ...l, importacao_id: imp.id })),
    );
  } catch (e) {
    await supabase.from(tabelaImp).delete().eq("id", imp.id);
    throw e;
  }
  return linhas.length;
}

export async function importarFrequencia(file: File, usuarioId: string | undefined) {
  return importarHub(
    file,
    usuarioId,
    "hub_frequencia_importacoes",
    "hub_frequencia_colaboradores",
    await lerFrequencia(file),
  );
}

export async function importarOnboarding(file: File, usuarioId: string | undefined) {
  return importarHub(
    file,
    usuarioId,
    "hub_onboarding_importacoes",
    "hub_onboarding_itens",
    await lerOnboarding(file),
  );
}
