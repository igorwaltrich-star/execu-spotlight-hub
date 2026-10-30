-- O supervisor importa bases do Sigra, mas não podia apagar a importação quando a gravação
-- falhava no meio, deixando um snapshot incompleto. Ele passa a poder apagar só a própria
-- importação, na primeira hora; resumos e processos saem em cascata.
CREATE POLICY "fin_fech_import_undo_own" ON public.financeiro_fechamento_importacoes FOR DELETE TO authenticated USING (public.tem_papel(ARRAY['supervisor']) AND importado_por = auth.uid() AND created_at > now() - interval '1 hour');
