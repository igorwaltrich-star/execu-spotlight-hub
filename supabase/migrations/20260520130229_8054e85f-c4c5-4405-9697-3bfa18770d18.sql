
-- Enums
CREATE TYPE public.home_office_status AS ENUM ('ativo', 'pausado');
CREATE TYPE public.matriz_lideranca_tag AS ENUM ('alta_performance', 'zona_desenvolvimento', 'zona_risco', 'zona_desalinhamento');
CREATE TYPE public.navy_seal_tag AS ENUM ('a_player', 'b_player', 'c_player');
CREATE TYPE public.pdi_status AS ENUM ('nao_iniciado', 'em_andamento', 'concluido', 'atrasado');

-- Helper to apply standard RLS + trigger
-- colaboradores
CREATE TABLE public.colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  cargo text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.escala_home_office (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  colaborador_id uuid NOT NULL,
  dias_semana text[] NOT NULL DEFAULT '{}',
  status public.home_office_status NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.controle_ferias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  colaborador_id uuid NOT NULL,
  periodo_inicio date,
  periodo_fim date,
  previsao_saida date,
  retorno date,
  saldo_dias integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.matriz_lideranca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  colaborador_id uuid NOT NULL,
  tag public.matriz_lideranca_tag NOT NULL DEFAULT 'zona_desenvolvimento',
  observacoes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.navy_seal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  colaborador_id uuid NOT NULL,
  tag public.navy_seal_tag NOT NULL DEFAULT 'b_player',
  observacoes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pdi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  colaborador_id uuid NOT NULL,
  meta text NOT NULL,
  prazo date,
  status public.pdi_status NOT NULL DEFAULT 'nao_iniciado',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.analises_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL DEFAULT '',
  arquivos jsonb NOT NULL DEFAULT '[]'::jsonb,
  resumo text NOT NULL DEFAULT '',
  pontos_criticos jsonb NOT NULL DEFAULT '[]'::jsonb,
  oportunidades jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ishikawa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  efeito text NOT NULL DEFAULT '',
  metodo text[] NOT NULL DEFAULT '{}',
  maquina text[] NOT NULL DEFAULT '{}',
  mao_obra text[] NOT NULL DEFAULT '{}',
  materiais text[] NOT NULL DEFAULT '{}',
  medida text[] NOT NULL DEFAULT '{}',
  meio_ambiente text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pareto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL DEFAULT '',
  causa text NOT NULL,
  frequencia numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cinco_porques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  problema text NOT NULL DEFAULT '',
  por_que_1 text NOT NULL DEFAULT '',
  por_que_2 text NOT NULL DEFAULT '',
  por_que_3 text NOT NULL DEFAULT '',
  por_que_4 text NOT NULL DEFAULT '',
  por_que_5 text NOT NULL DEFAULT '',
  causa_raiz text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cinco_w_dois_h (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  what text NOT NULL DEFAULT '',
  why text NOT NULL DEFAULT '',
  "where" text NOT NULL DEFAULT '',
  who text NOT NULL DEFAULT '',
  "when" date,
  how text NOT NULL DEFAULT '',
  how_much numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.swot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL DEFAULT '',
  forcas text[] NOT NULL DEFAULT '{}',
  fraquezas text[] NOT NULL DEFAULT '{}',
  oportunidades text[] NOT NULL DEFAULT '{}',
  ameacas text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS + policies + triggers for all tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'colaboradores','escala_home_office','controle_ferias','matriz_lideranca',
    'navy_seal','pdi','analises_performance','ishikawa','pareto','cinco_porques',
    'cinco_w_dois_h','swot'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY own_select ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY own_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY own_update ON public.%I FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY own_delete ON public.%I FOR DELETE TO authenticated USING (user_id = auth.uid())', t);
    EXECUTE format('CREATE TRIGGER set_updated_at_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;
