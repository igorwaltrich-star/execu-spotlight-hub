export const n0 = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? "–" : v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export const pct = (v: number | null | undefined, casas = 0) =>
  v == null || Number.isNaN(v)
    ? "–"
    : `${v.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas })}%`;

export const dataBr = (iso: string | null | undefined, comHora = false) => {
  if (!iso) return "–";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return comHora
    ? d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : d.toLocaleDateString("pt-BR");
};

/** Cores das faixas de dias sem pedido, da mais nova à mais antiga. */
export const COR_FAIXA = [
  "color-mix(in oklab, var(--color-muted-foreground) 45%, transparent)",
  "var(--color-muted-foreground)",
  "color-mix(in oklab, var(--color-warning) 65%, transparent)",
  "var(--color-warning)",
  "var(--color-destructive)",
];
