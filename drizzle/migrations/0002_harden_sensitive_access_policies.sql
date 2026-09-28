DROP POLICY IF EXISTS "auth_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_gestor" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;

CREATE POLICY "profiles_read"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "profiles_update_self"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_admin_insert"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.tem_papel(ARRAY['gestor']));

CREATE POLICY "profiles_admin_update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.tem_papel(ARRAY['gestor']))
WITH CHECK (public.tem_papel(ARRAY['gestor']));

CREATE POLICY "profiles_admin_delete"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.tem_papel(ARRAY['gestor']));

CREATE OR REPLACE FUNCTION public.proteger_campos_privilegiados_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.ativo IS DISTINCT FROM OLD.ativo)
     AND NOT public.tem_papel(ARRAY['gestor']) THEN
    RAISE EXCEPTION 'Somente gestores podem alterar papel ou status do perfil'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_campos_privilegiados_profile() FROM PUBLIC;

DROP TRIGGER IF EXISTS proteger_campos_privilegiados_profile ON public.profiles;
CREATE TRIGGER proteger_campos_privilegiados_profile
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.proteger_campos_privilegiados_profile();

CREATE OR REPLACE FUNCTION public.fn_novo_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, role, ativo)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'nome', ''), split_part(NEW.email, '@', 1), 'Novo usuário'),
    'analista',
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_novo_usuario() FROM PUBLIC;

DROP POLICY IF EXISTS "auth_all" ON public.custo_pessoal_mensal;
DROP POLICY IF EXISTS "custo_gestor" ON public.custo_pessoal_mensal;
DROP POLICY IF EXISTS "custo_restrito" ON public.custo_pessoal_mensal;
CREATE POLICY "custo_restrito"
ON public.custo_pessoal_mensal
FOR ALL
TO authenticated
USING (public.tem_papel(ARRAY['gestor','coordenador']))
WITH CHECK (public.tem_papel(ARRAY['gestor','coordenador']));

DROP POLICY IF EXISTS "auth_all" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_gestor" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_leitura" ON public.audit_logs;
CREATE POLICY "audit_leitura"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.tem_papel(ARRAY['gestor','coordenador']));

REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

DROP POLICY IF EXISTS "auth_all" ON public.banco_horas;
DROP POLICY IF EXISTS "banco_horas_auth" ON public.banco_horas;
DROP POLICY IF EXISTS "banco_horas_lideranca" ON public.banco_horas;
CREATE POLICY "banco_horas_lideranca"
ON public.banco_horas
FOR ALL
TO authenticated
USING (public.tem_papel(ARRAY['gestor','coordenador','supervisor']))
WITH CHECK (public.tem_papel(ARRAY['gestor','coordenador','supervisor']));