
CREATE TABLE public.indicadores_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  colaborador_id uuid NOT NULL,
  referencia text NOT NULL,
  nota_zmm numeric(5,2),
  sla_po numeric(5,2),
  sla_sotd numeric(5,2),
  sla_pre_alert numeric(5,2),
  sla_otd numeric(5,2),
  comportamental numeric(5,2),
  meta_individual numeric(5,2),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.indicadores_performance TO authenticated;
GRANT ALL ON public.indicadores_performance TO service_role;

ALTER TABLE public.indicadores_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_select ON public.indicadores_performance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY own_insert ON public.indicadores_performance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_update ON public.indicadores_performance FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_delete ON public.indicadores_performance FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_indicadores_performance
  BEFORE UPDATE ON public.indicadores_performance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
