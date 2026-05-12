ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS tempo integer NOT NULL DEFAULT 30;

ALTER TABLE public.colaboradores
  ADD CONSTRAINT colaboradores_tempo_chk CHECK (tempo >= 0 AND tempo <= 31);

ALTER TABLE public.colaboradores DROP COLUMN IF EXISTS fte;

ALTER TABLE public.colaboradores
  ADD COLUMN fte numeric
  GENERATED ALWAYS AS (GREATEST(0, (tempo - ausencias))::numeric / 30) STORED;