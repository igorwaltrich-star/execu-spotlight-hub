CREATE TABLE public.colaboradores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  unidade public.unidade_carteira NOT NULL,
  mes DATE NOT NULL,
  ausencias INTEGER NOT NULL DEFAULT 0 CHECK (ausencias >= 0 AND ausencias <= 30),
  fte NUMERIC GENERATED ALWAYS AS (((30 - ausencias)::numeric) / 30) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_colab_user_unidade_mes ON public.colaboradores(user_id, unidade, mes);

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_select ON public.colaboradores FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY own_insert ON public.colaboradores FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY own_update ON public.colaboradores FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY own_delete ON public.colaboradores FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER colaboradores_set_updated_at
  BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.colaboradores;