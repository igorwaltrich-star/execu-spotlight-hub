CREATE TABLE public.financeiro_fechamento_importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_nome text NOT NULL,
  data_referencia timestamptz,
  importado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.financeiro_fechamento_importacoes TO authenticated;
GRANT ALL ON public.financeiro_fechamento_importacoes TO service_role;
ALTER TABLE public.financeiro_fechamento_importacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_fech_import_read" ON public.financeiro_fechamento_importacoes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "fin_fech_import_write" ON public.financeiro_fechamento_importacoes FOR INSERT TO authenticated WITH CHECK (public.tem_papel(ARRAY['gestor','coordenador','supervisor']));
CREATE POLICY "fin_fech_import_delete" ON public.financeiro_fechamento_importacoes FOR DELETE TO authenticated USING (public.tem_papel(ARRAY['gestor','coordenador']));

CREATE TABLE public.financeiro_fechamento_resumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid NOT NULL REFERENCES public.financeiro_fechamento_importacoes(id) ON DELETE CASCADE,
  centro_custo text NOT NULL,
  usa_fluxo boolean NOT NULL DEFAULT true,
  processos_di integer NOT NULL DEFAULT 0,
  com_pedido integer NOT NULL DEFAULT 0,
  percentual_pedido numeric NOT NULL DEFAULT 0,
  sem_pedido integer NOT NULL DEFAULT 0,
  ate_15 integer NOT NULL DEFAULT 0,
  de_15_30 integer NOT NULL DEFAULT 0,
  de_30_60 integer NOT NULL DEFAULT 0,
  de_60_90 integer NOT NULL DEFAULT 0,
  mais_90 integer NOT NULL DEFAULT 0,
  UNIQUE (importacao_id, centro_custo)
);
GRANT SELECT, INSERT, DELETE ON public.financeiro_fechamento_resumos TO authenticated;
GRANT ALL ON public.financeiro_fechamento_resumos TO service_role;
ALTER TABLE public.financeiro_fechamento_resumos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_fech_resumo_read" ON public.financeiro_fechamento_resumos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "fin_fech_resumo_write" ON public.financeiro_fechamento_resumos FOR INSERT TO authenticated WITH CHECK (public.tem_papel(ARRAY['gestor','coordenador','supervisor']));
CREATE POLICY "fin_fech_resumo_delete" ON public.financeiro_fechamento_resumos FOR DELETE TO authenticated USING (public.tem_papel(ARRAY['gestor','coordenador']));
CREATE INDEX fin_fech_resumo_importacao_idx ON public.financeiro_fechamento_resumos(importacao_id);

CREATE TABLE public.financeiro_fechamento_pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid NOT NULL REFERENCES public.financeiro_fechamento_importacoes(id) ON DELETE CASCADE,
  centro_custo text NOT NULL,
  processo text NOT NULL,
  cliente text,
  di_duimp text,
  data_registro date,
  dias_sem_pedido integer NOT NULL DEFAULT 0,
  faixa text,
  usa_fluxo boolean NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, DELETE ON public.financeiro_fechamento_pendencias TO authenticated;
GRANT ALL ON public.financeiro_fechamento_pendencias TO service_role;
ALTER TABLE public.financeiro_fechamento_pendencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_fech_pend_read" ON public.financeiro_fechamento_pendencias FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "fin_fech_pend_write" ON public.financeiro_fechamento_pendencias FOR INSERT TO authenticated WITH CHECK (public.tem_papel(ARRAY['gestor','coordenador','supervisor']));
CREATE POLICY "fin_fech_pend_delete" ON public.financeiro_fechamento_pendencias FOR DELETE TO authenticated USING (public.tem_papel(ARRAY['gestor','coordenador']));
CREATE INDEX fin_fech_pend_importacao_idx ON public.financeiro_fechamento_pendencias(importacao_id);
CREATE INDEX fin_fech_pend_centro_idx ON public.financeiro_fechamento_pendencias(centro_custo);