-- Bosch SLA por planta + KPIs operacionais
ALTER TABLE public.sla_bosch
  ADD COLUMN IF NOT EXISTS planta text,
  ADD COLUMN IF NOT EXISTS proc_aereos numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proc_maritimos numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proc_canal_verde numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proc_canal_vermelho numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tm_dig_conf_h numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tm_registro_dias numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tm_liberacao_dias numeric NOT NULL DEFAULT 0;

-- Define default planta para linhas existentes e torna NOT NULL com CHECK
UPDATE public.sla_bosch SET planta = '21F0' WHERE planta IS NULL;
ALTER TABLE public.sla_bosch ALTER COLUMN planta SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sla_bosch_planta_check'
  ) THEN
    ALTER TABLE public.sla_bosch
      ADD CONSTRAINT sla_bosch_planta_check CHECK (planta IN ('21F0','6854','W275'));
  END IF;
END $$;

-- Atualiza unique constraint: (user_id, mes) -> (user_id, mes, planta)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sla_bosch_user_id_mes_key') THEN
    ALTER TABLE public.sla_bosch DROP CONSTRAINT sla_bosch_user_id_mes_key;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sla_bosch_user_id_mes_planta_key'
  ) THEN
    ALTER TABLE public.sla_bosch
      ADD CONSTRAINT sla_bosch_user_id_mes_planta_key UNIQUE (user_id, mes, planta);
  END IF;
END $$;