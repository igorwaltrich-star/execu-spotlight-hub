DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tgname, relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relname = ANY (ARRAY['checkins_operacionais','checkins_gerenciais','checkin_gerencial_itens','atividades','ocorrencias_atividade','metas','resultados_meta','revisoes_semanais','projetos','projeto_atividades'])
  LOOP EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.tgname, r.relname); END LOOP;
END $$;
DROP FUNCTION IF EXISTS public.fn_notif_atividade() CASCADE;
DROP FUNCTION IF EXISTS public.fn_notif_meta() CASCADE;
DROP FUNCTION IF EXISTS public.fn_notif_resultado() CASCADE;
DROP FUNCTION IF EXISTS public.fn_notif_encaminhamento() CASCADE;
DROP TABLE IF EXISTS public.projeto_atividades;
DROP TABLE IF EXISTS public.checkin_gerencial_itens;
DROP TABLE IF EXISTS public.ocorrencias_atividade;
DROP TABLE IF EXISTS public.resultados_meta;
DROP TABLE IF EXISTS public.revisoes_semanais;
DROP TABLE IF EXISTS public.checkins_gerenciais;
DROP TABLE IF EXISTS public.checkins_operacionais;
DROP TABLE IF EXISTS public.projetos;
DROP TABLE IF EXISTS public.metas;
DROP TABLE IF EXISTS public.atividades;
COMMENT ON FUNCTION public.fn_audit() IS 'Auditoria genérica preservada para os módulos ativos.';
