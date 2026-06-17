
ALTER TABLE public.indicadores_performance
  ADD COLUMN IF NOT EXISTS uep numeric,
  ADD COLUMN IF NOT EXISTS ppax numeric;

ALTER TABLE public.plano_acao
  ADD COLUMN IF NOT EXISTS objetivo text,
  ADD COLUMN IF NOT EXISTS meta text;
