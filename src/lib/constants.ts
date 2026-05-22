export const META_PRODUTIVIDADE = 60;
export const META_SLA = 95;

export const MESES_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export function fmtMes(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${MESES_PT[date.getUTCMonth()]}/${String(date.getUTCFullYear()).slice(2)}`;
}

export type UnidadeKey = "midea_sc" | "midea_am" | "midea_rs" | "midea_mg" | "bosch" | "bosch_hc";

export const UNIDADES: { key: UnidadeKey; label: string; grupo: "midea" | "bosch" }[] = [
  { key: "midea_sc", label: "Midea SC", grupo: "midea" },
  { key: "midea_am", label: "Midea AM", grupo: "midea" },
  { key: "midea_rs", label: "Midea RS", grupo: "midea" },
  { key: "midea_mg", label: "Midea MG", grupo: "midea" },
  { key: "bosch", label: "Bosch", grupo: "bosch" },
  { key: "bosch_hc", label: "Bosch HC", grupo: "bosch" },
];

export const UNIDADE_LABEL: Record<UnidadeKey, string> = Object.fromEntries(
  UNIDADES.map((u) => [u.key, u.label]),
) as Record<UnidadeKey, string>;
