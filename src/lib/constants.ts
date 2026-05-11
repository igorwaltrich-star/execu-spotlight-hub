export const META_PRODUTIVIDADE = 60;
export const META_SLA = 95;

export const MESES_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function fmtMes(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${MESES_PT[date.getUTCMonth()]}/${String(date.getUTCFullYear()).slice(2)}`;
}
