
-- Operacional mensal
create table public.operacional_mensal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mes date not null,
  volume integer not null default 0,
  pessoas integer not null default 1 check (pessoas > 0),
  produtividade numeric generated always as (volume::numeric / nullif(pessoas,0)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, mes)
);

create table public.sla_midea (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mes date not null,
  start_up numeric not null default 0,
  otcc numeric not null default 0,
  otd numeric not null default 0,
  sotd numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, mes)
);

create table public.sla_bosch (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mes date not null,
  dig_conf numeric not null default 0,
  start_up numeric not null default 0,
  otcc numeric not null default 0,
  desvios numeric not null default 0,
  pinho numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, mes)
);

create type public.risco_nivel as enum ('alto','medio','baixo');
create type public.melhoria_tipo as enum ('atencao','oportunidade');
create type public.acao_status as enum ('andamento','concluido','atrasado');

create table public.gargalos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item text not null,
  impacto text not null default '',
  risco public.risco_nivel not null default 'medio',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.melhorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  descricao text not null default '',
  tipo public.melhoria_tipo not null default 'oportunidade',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plano_acao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  iniciativa text not null,
  responsavel text not null default '',
  prazo date,
  status public.acao_status not null default 'andamento',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  fator_sazonalidade numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$ declare t text;
begin
  for t in select unnest(array['operacional_mensal','sla_midea','sla_bosch','gargalos','melhorias','plano_acao','config'])
  loop
    execute format('create trigger trg_%I_updated before update on public.%I for each row execute function public.set_updated_at();', t, t);
  end loop;
end $$;

-- Enable RLS + policies
do $$ declare t text;
begin
  for t in select unnest(array['operacional_mensal','sla_midea','sla_bosch','gargalos','melhorias','plano_acao','config'])
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($f$create policy "own_select" on public.%I for select to authenticated using (user_id = auth.uid());$f$, t);
    execute format($f$create policy "own_insert" on public.%I for insert to authenticated with check (user_id = auth.uid());$f$, t);
    execute format($f$create policy "own_update" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());$f$, t);
    execute format($f$create policy "own_delete" on public.%I for delete to authenticated using (user_id = auth.uid());$f$, t);
    execute format('alter publication supabase_realtime add table public.%I;', t);
    execute format('alter table public.%I replica identity full;', t);
  end loop;
end $$;
