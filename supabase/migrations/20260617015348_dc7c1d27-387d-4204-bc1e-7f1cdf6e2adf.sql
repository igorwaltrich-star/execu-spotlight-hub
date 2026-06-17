
ALTER TABLE public.sla_midea ADD COLUMN IF NOT EXISTS unidade text;
ALTER TABLE public.sla_midea DROP CONSTRAINT IF EXISTS sla_midea_user_id_mes_key;
CREATE UNIQUE INDEX IF NOT EXISTS sla_midea_user_mes_unidade_key
  ON public.sla_midea (user_id, mes, unidade);
