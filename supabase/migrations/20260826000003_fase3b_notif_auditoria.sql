-- ═══════════════════════════════════════════════════════════
-- Fase 3B — Notificações internas + Auditoria automática
-- ═══════════════════════════════════════════════════════════

-- ── Notificações ─────────────────────────────────────────────
create table if not exists public.notificacoes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  tipo        text not null check (tipo in (
                'atividade_atribuida','meta_atribuida','prazo_proximo','atrasado',
                'revisao_pendente','feedback_recebido','meta_atingida','meta_nao_atingida',
                'encaminhamento','projeto','pdi','geral')),
  titulo      text not null,
  mensagem    text,
  link        text,
  lida        boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.notificacoes enable row level security;
drop policy if exists "notif_self" on public.notificacoes;
create policy "notif_self" on public.notificacoes for all using (auth.uid() = user_id);
create index if not exists notif_user_idx on public.notificacoes (user_id, lida, created_at desc);

-- ── Auditoria automática ─────────────────────────────────────
-- Registra INSERT/UPDATE/DELETE nas tabelas de negócio.
create or replace function public.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_old jsonb;
  v_new jsonb;
  v_id uuid;
begin
  if (tg_op = 'INSERT') then
    v_action := 'create'; v_new := to_jsonb(new); v_id := new.id;
  elsif (tg_op = 'UPDATE') then
    v_action := 'update'; v_old := to_jsonb(old); v_new := to_jsonb(new); v_id := new.id;
    -- ignora updates que não mudaram nada de fato
    if v_old = v_new then return new; end if;
  else
    v_action := 'delete'; v_old := to_jsonb(old); v_id := old.id;
  end if;

  insert into public.audit_logs (user_id, entity_type, entity_id, action, old_value, new_value)
  values (auth.uid(), tg_table_name, v_id, v_action, v_old, v_new);

  if (tg_op = 'DELETE') then return old; else return new; end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'atividades','metas','resultados_meta','projetos','planos_desenvolvimento',
    'atividades_desenvolvimento','nao_conformidades','registros_produtividade',
    'alocacoes_periodo','custo_pessoal_mensal','checkins_operacionais',
    'checkins_gerenciais','checkin_gerencial_itens','revisoes_semanais',
    'equipes','membros_equipe'
  ] loop
    if exists (select 1 from information_schema.tables
               where table_schema='public' and table_name=t) then
      execute format('drop trigger if exists trg_audit_%1$s on public.%1$I', t);
      execute format(
        'create trigger trg_audit_%1$s after insert or update or delete on public.%1$I
         for each row execute function public.fn_audit()', t);
    end if;
  end loop;
end $$;

-- ── Notificação: atividade atribuída ─────────────────────────
create or replace function public.fn_notif_atividade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is not null and new.owner_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into public.notificacoes (user_id, tipo, titulo, mensagem, link)
    values (new.owner_id, 'atividade_atribuida',
            'Nova atividade atribuída',
            new.titulo, '/atividades');
  end if;
  return new;
end $$;

drop trigger if exists trg_notif_atividade on public.atividades;
create trigger trg_notif_atividade
  after insert on public.atividades
  for each row execute function public.fn_notif_atividade();

-- ── Notificação: meta atribuída ──────────────────────────────
create or replace function public.fn_notif_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is not null and new.owner_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into public.notificacoes (user_id, tipo, titulo, mensagem, link)
    values (new.owner_id, 'meta_atribuida', 'Nova meta atribuída', new.titulo, '/metas');
  end if;
  return new;
end $$;

drop trigger if exists trg_notif_meta on public.metas;
create trigger trg_notif_meta
  after insert on public.metas
  for each row execute function public.fn_notif_meta();

-- ── Notificação: resultado de meta registrado ────────────────
create or replace function public.fn_notif_resultado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_owner uuid; v_titulo text;
begin
  select owner_id, titulo into v_owner, v_titulo from public.metas where id = new.meta_id;
  if v_owner is not null then
    insert into public.notificacoes (user_id, tipo, titulo, mensagem, link)
    values (
      v_owner,
      case when new.pct_atingimento >= 100 then 'meta_atingida' else 'meta_nao_atingida' end,
      case when new.pct_atingimento >= 100 then 'Meta atingida' else 'Meta abaixo do esperado' end,
      v_titulo || ' — ' || round(new.pct_atingimento)::text || '%',
      '/metas');
  end if;
  return new;
end $$;

drop trigger if exists trg_notif_resultado on public.resultados_meta;
create trigger trg_notif_resultado
  after insert on public.resultados_meta
  for each row execute function public.fn_notif_resultado();

-- ── Notificação: encaminhamento do Check IN Gerencial ────────
create or replace function public.fn_notif_encaminhamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'encaminhamento' and new.responsavel_id is not null then
    insert into public.notificacoes (user_id, tipo, titulo, mensagem, link)
    values (new.responsavel_id, 'encaminhamento', 'Novo encaminhamento',
            new.titulo || coalesce(' — prazo ' || to_char(new.prazo, 'DD/MM'), ''),
            '/checkin-gerencial');
  end if;
  return new;
end $$;

drop trigger if exists trg_notif_encaminhamento on public.checkin_gerencial_itens;
create trigger trg_notif_encaminhamento
  after insert on public.checkin_gerencial_itens
  for each row execute function public.fn_notif_encaminhamento();

-- ── Permite que os triggers gravem em audit_logs ─────────────
-- A policy original só cobria SELECT, o que bloquearia os INSERTs
-- feitos pelas triggers no contexto do usuário autenticado.
drop policy if exists "audit_insert" on public.audit_logs;
drop policy if exists "audit_insert" on public.audit_logs;
create policy "audit_insert" on public.audit_logs
  for insert with check (auth.uid() is not null);
