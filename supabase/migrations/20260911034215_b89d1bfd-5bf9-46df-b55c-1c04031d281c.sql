CREATE TABLE IF NOT EXISTS public.riscos_operacionais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT 'operacional',
  operacao text NOT NULL DEFAULT '',
  colaborador_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  origem text NOT NULL DEFAULT 'manual',
  probabilidade integer NOT NULL DEFAULT 3 CHECK (probabilidade BETWEEN 1 AND 5),
  impacto integer NOT NULL DEFAULT 3 CHECK (impacto BETWEEN 1 AND 5),
  severidade integer GENERATED ALWAYS AS (probabilidade * impacto) STORED,
  status text NOT NULL DEFAULT 'identificado',
  responsavel text NOT NULL DEFAULT '',
  plano_acao text NOT NULL DEFAULT '',
  prazo date,
  data_identificacao date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.riscos_operacionais TO authenticated;
GRANT ALL ON public.riscos_operacionais TO service_role;

ALTER TABLE public.riscos_operacionais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados gerenciam riscos operacionais" ON public.riscos_operacionais;
CREATE POLICY "Autenticados gerenciam riscos operacionais"
ON public.riscos_operacionais FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_riscos_operacionais_colab ON public.riscos_operacionais(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_riscos_operacionais_status ON public.riscos_operacionais(status);

CREATE OR REPLACE FUNCTION public.set_updated_at_riscos()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_riscos_operacionais_updated_at ON public.riscos_operacionais;
CREATE TRIGGER update_riscos_operacionais_updated_at
BEFORE UPDATE ON public.riscos_operacionais
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_riscos();