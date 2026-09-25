CREATE TABLE IF NOT EXISTS public.financeiro_processos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sigra text NOT NULL UNIQUE,
  codigo text,
  centro_custo text,
  modal text,
  di text,
  importador text,
  canal_rfb text,
  data_registro date,
  data_solicitacao date,
  data_fechamento date,
  dias_reg_sol integer GENERATED ALWAYS AS (CASE WHEN data_registro IS NOT NULL AND data_solicitacao IS NOT NULL THEN data_solicitacao - data_registro END) STORED,
  dias_sol_fec integer GENERATED ALWAYS AS (CASE WHEN data_solicitacao IS NOT NULL AND data_fechamento IS NOT NULL THEN data_fechamento - data_solicitacao END) STORED,
  importado_em timestamptz NOT NULL DEFAULT now(),
  importado_por uuid REFERENCES auth.users(id),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_processos TO authenticated;
GRANT ALL ON public.financeiro_processos TO service_role;
ALTER TABLE public.financeiro_processos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_proc_read" ON public.financeiro_processos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "fin_proc_write" ON public.financeiro_processos FOR ALL TO authenticated USING (public.tem_papel(ARRAY['gestor','coordenador','supervisor'])) WITH CHECK (public.tem_papel(ARRAY['gestor','coordenador','supervisor']));
CREATE INDEX IF NOT EXISTS fin_proc_reg_idx ON public.financeiro_processos (data_registro);
CREATE INDEX IF NOT EXISTS fin_proc_cc_idx ON public.financeiro_processos (centro_custo);

CREATE TABLE IF NOT EXISTS public.financeiro_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  conta_como_gap boolean NOT NULL DEFAULT true,
  responsavel text NOT NULL DEFAULT 'operacao' CHECK (responsavel IN ('operacao','cliente','financeiro','aduana','sistema')),
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_categorias TO authenticated;
GRANT ALL ON public.financeiro_categorias TO service_role;
ALTER TABLE public.financeiro_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_cat_read" ON public.financeiro_categorias FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "fin_cat_write" ON public.financeiro_categorias FOR ALL TO authenticated USING (public.tem_papel(ARRAY['gestor','coordenador'])) WITH CHECK (public.tem_papel(ARRAY['gestor','coordenador']));

CREATE TABLE IF NOT EXISTS public.financeiro_justificativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES public.financeiro_processos(id) ON DELETE CASCADE,
  escopo text NOT NULL DEFAULT 'processo' CHECK (escopo IN ('processo','centro_custo')),
  centro_custo text,
  categoria_id uuid NOT NULL REFERENCES public.financeiro_categorias(id),
  justificativa text,
  autor_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alvo_definido CHECK ((escopo = 'processo' AND processo_id IS NOT NULL) OR (escopo = 'centro_custo' AND centro_custo IS NOT NULL))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_justificativas TO authenticated;
GRANT ALL ON public.financeiro_justificativas TO service_role;
ALTER TABLE public.financeiro_justificativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_just_read" ON public.financeiro_justificativas FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "fin_just_write" ON public.financeiro_justificativas FOR ALL TO authenticated USING (public.tem_papel(ARRAY['gestor','coordenador','supervisor'])) WITH CHECK (public.tem_papel(ARRAY['gestor','coordenador','supervisor']));
CREATE INDEX IF NOT EXISTS fin_just_proc_idx ON public.financeiro_justificativas (processo_id);
CREATE INDEX IF NOT EXISTS fin_just_cc_idx ON public.financeiro_justificativas (centro_custo);