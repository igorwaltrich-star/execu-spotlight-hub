DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='indicadores_performance' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.indicadores_performance', p.policyname);
  END LOOP;
END$$;

CREATE POLICY "own_select" ON public.indicadores_performance FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON public.indicadores_performance FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON public.indicadores_performance FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_delete" ON public.indicadores_performance FOR DELETE TO authenticated USING (auth.uid() = user_id);