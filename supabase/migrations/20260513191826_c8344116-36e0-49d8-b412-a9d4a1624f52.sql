CREATE TABLE public.oportunidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  categoria TEXT NOT NULL DEFAULT 'operacional',
  savings NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'identificada',
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.oportunidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_select ON public.oportunidades FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY own_insert ON public.oportunidades FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY own_update ON public.oportunidades FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY own_delete ON public.oportunidades FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER set_oportunidades_updated_at
BEFORE UPDATE ON public.oportunidades
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.oportunidades;