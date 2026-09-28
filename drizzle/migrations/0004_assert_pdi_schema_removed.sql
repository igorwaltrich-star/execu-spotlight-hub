DO $$
BEGIN
  IF to_regclass('public.pdi') IS NOT NULL
     OR to_regclass('public.planos_desenvolvimento') IS NOT NULL
     OR to_regclass('public.atividades_desenvolvimento') IS NOT NULL
     OR to_regclass('public.avaliacoes_pdi') IS NOT NULL THEN
    RAISE EXCEPTION 'A estrutura legada do PDI ainda existe';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'pdi_status'
  ) THEN
    RAISE EXCEPTION 'O tipo legado public.pdi_status ainda existe';
  END IF;
END;
$$;