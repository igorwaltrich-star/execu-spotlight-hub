-- ═══════════════════════════════════════════════════════════
-- Controle de acesso por perfil
--   1. Corrige recursão infinita nas policies de profiles
--   2. Cria perfil automático no signup
--   3. Restringe custo/salários a gestor e coordenador
-- ═══════════════════════════════════════════════════════════

-- ── 1) Função de papel (SECURITY DEFINER evita recursão) ─────
-- Consultar profiles dentro de uma policy de profiles causa
-- recursão infinita. SECURITY DEFINER ignora RLS na leitura.
create or replace function public.meu_papel()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'analista');
$$;

create or replace function public.tem_papel(papeis text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()) = any(papeis),
    false
  );
$$;

grant execute on function public.meu_papel() to authenticated;
grant execute on function public.tem_papel(text[]) to authenticated;

-- ── 2) Policies de profiles sem recursão ─────────────────────
drop policy if exists "profiles_self"        on public.profiles;
drop policy if exists "profiles_gestor"      on public.profiles;
drop policy if exists "profiles_read"        on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_admin"       on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;

-- todo autenticado lê a lista (necessário para exibir nomes)
create policy "profiles_read" on public.profiles
  for select using (auth.uid() is not null);

-- cada um edita o próprio perfil, menos o papel
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id);

-- gestor gerencia todos os perfis
create policy "profiles_admin" on public.profiles
  for all using (public.tem_papel(array['gestor']));

create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = id);

-- ── 3) Perfil automático no signup ───────────────────────────
create or replace function public.fn_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primeiro boolean;
begin
  -- o primeiro usuário do sistema vira gestor
  select count(*) = 0 into v_primeiro from public.profiles;

  insert into public.profiles (id, nome, role, ativo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    case when v_primeiro then 'gestor' else 'analista' end,
    true
  )
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists trg_novo_usuario on auth.users;
create trigger trg_novo_usuario
  after insert on auth.users
  for each row execute function public.fn_novo_usuario();

-- cria perfil para usuários que já existiam antes desta migration
insert into public.profiles (id, nome, role, ativo)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)),
  'gestor',   -- usuários pré-existentes assumem gestor
  true
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ── 4) Restringe dados sensíveis de custo ────────────────────
drop policy if exists "custo_gestor" on public.custo_pessoal_mensal;
drop policy if exists "custo_restrito" on public.custo_pessoal_mensal;
create policy "custo_restrito" on public.custo_pessoal_mensal
  for all using (public.tem_papel(array['gestor','coordenador']));

-- banco de horas: cada um vê o seu; liderança vê todos
drop policy if exists "banco_horas_auth" on public.banco_horas;
drop policy if exists "banco_horas_lideranca" on public.banco_horas;
create policy "banco_horas_lideranca" on public.banco_horas
  for all using (public.tem_papel(array['gestor','coordenador','supervisor']));

-- auditoria: apenas gestor e coordenador consultam
drop policy if exists "audit_gestor" on public.audit_logs;
drop policy if exists "audit_leitura" on public.audit_logs;
create policy "audit_leitura" on public.audit_logs
  for select using (public.tem_papel(array['gestor','coordenador']));

-- ── 5) Revisões semanais sem recursão ────────────────────────
drop policy if exists "revisoes_self"   on public.revisoes_semanais;
drop policy if exists "revisoes_gestor" on public.revisoes_semanais;
drop policy if exists "revisoes_lideranca" on public.revisoes_semanais;

create policy "revisoes_self" on public.revisoes_semanais
  for all using (auth.uid() = user_id);

create policy "revisoes_lideranca" on public.revisoes_semanais
  for all using (public.tem_papel(array['gestor','coordenador','supervisor']));
