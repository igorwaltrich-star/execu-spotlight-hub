
DO $$ BEGIN
  CREATE TYPE public.unidade_carteira AS ENUM ('midea_sc','midea_am','midea_rs','midea_mg','bosch','bosch_hc');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.operacional_mensal
  ADD COLUMN IF NOT EXISTS unidade public.unidade_carteira NOT NULL DEFAULT 'midea_sc';

ALTER TABLE public.operacional_mensal DROP CONSTRAINT IF EXISTS operacional_mensal_user_id_mes_key;
ALTER TABLE public.operacional_mensal DROP CONSTRAINT IF EXISTS operacional_mensal_user_mes_unique;

ALTER TABLE public.operacional_mensal
  ADD CONSTRAINT operacional_mensal_user_mes_unidade_unique UNIQUE (user_id, mes, unidade);
