export const META_PRODUTIVIDADE = 60;

/** Metas individuais de produtividade por unidade (processos/pessoa) — Projeção 2026 */
export const META_PRODUTIVIDADE_UNIDADE: Record<string, number> = {
  bosch:      86,
  midea_sc:   74,
  midea_rs:   74,
  midea_am:   69,
  volkswagen: 111,
  perkins:     93,
  brp:         60,
  hyundai:     60,
  gwm:         60,
};

/** Retorna a meta de produtividade para uma unidade específica, com fallback para a meta padrão */
export function metaProdUnidade(unidade: string): number {
  return META_PRODUTIVIDADE_UNIDADE[unidade] ?? META_PRODUTIVIDADE;
}

export const META_SLA = 90;

export const MESES_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function fmtMes(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${MESES_PT[date.getUTCMonth()]}/${String(date.getUTCFullYear()).slice(2)}`;
}

export type UnidadeGrupo = "midea" | "bosch" | "outros";

export type UnidadeKey =
  | "midea_sc" | "midea_am" | "midea_rs"
  | "bosch"
  | "volkswagen" | "perkins" | "brp" | "hyundai" | "gwm";

export const UNIDADES: { key: UnidadeKey; label: string; grupo: UnidadeGrupo }[] = [
  { key: "midea_sc",   label: "Midea SC",   grupo: "midea" },
  { key: "midea_am",   label: "Midea AM",   grupo: "midea" },
  { key: "midea_rs",   label: "Midea RS",   grupo: "midea" },
  { key: "bosch",      label: "Bosch",      grupo: "bosch" },
  { key: "volkswagen", label: "Volkswagen", grupo: "outros" },
  { key: "perkins",    label: "Perkins",    grupo: "outros" },
  { key: "brp",        label: "BRP",        grupo: "outros" },
  { key: "hyundai",    label: "Hyundai",    grupo: "outros" },
  { key: "gwm",        label: "GWM",        grupo: "outros" },
];

export const UNIDADE_LABEL: Record<UnidadeKey, string> = Object.fromEntries(
  UNIDADES.map((u) => [u.key, u.label]),
) as Record<UnidadeKey, string>;

export type BoschPlantaKey = "21F0" | "6854" | "W275";
export const BOSCH_PLANTAS: { key: BoschPlantaKey; label: string }[] = [
  { key: "21F0", label: "21F0" },
  { key: "6854", label: "6854" },
  { key: "W275", label: "W275" },
];
