GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custo_pessoal_mensal TO authenticated;
GRANT ALL ON public.custo_pessoal_mensal TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.banco_horas TO authenticated;
GRANT ALL ON public.banco_horas TO service_role;

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

DROP TRIGGER IF EXISTS trg_novo_usuario ON auth.users;
CREATE TRIGGER trg_novo_usuario
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.fn_novo_usuario();