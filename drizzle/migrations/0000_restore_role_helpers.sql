CREATE OR REPLACE FUNCTION public.meu_papel()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()), 'analista');
$$;

CREATE OR REPLACE FUNCTION public.tem_papel(papeis text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = ANY(papeis),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.meu_papel() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tem_papel(text[]) TO authenticated;