
create table public.alocacoes_periodo (
  id uuid primary key default gen_random_uuid(),
  created_by uuid,
  colaborador_id uuid not null,
  operacao text not null,
  mes date not null,
  dias_na_operacao integer not null default 0,
  dias_uteis_mes integer not null default 22,
  fte numeric generated always as (
    case when dias_uteis_mes = 0 then 0
    else round(dias_na_operacao::numeric / dias_uteis_mes::numeric, 4) end
  ) stored,
  tipo text not null default 'temporario',
  motivo text,
  created_at timestamptz not null default now(),
  unique (colaborador_id, operacao, mes)
);

create table public.banco_horas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  colaborador_id uuid not null,
  mes date not null,
  horas_extras numeric not null default 0,
  horas_debito numeric not null default 0,
  saldo_acumulado numeric not null default 0,
  observacoes text,
  created_at timestamptz not null default now(),
  unique (colaborador_id, mes)
);

create table public.checkins_operacionais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  operacao text not null,
  data date not null,
  frequencia text not null default 'diario',
  responsavel_id uuid,
  presentes text[] not null default '{}',
  ausentes text[] not null default '{}',
  volume_previsto integer,
  volume_realizado integer,
  status_geral text not null default 'normal',
  pendencias text,
  observacoes text,
  created_at timestamptz not null default now()
);

create table public.custo_pessoal_mensal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  colaborador_id uuid not null,
  operacao text not null,
  mes_referencia date not null,
  tipo_contrato text not null default 'CLT',
  fonte text not null default 'manual',
  salario_bruto numeric not null default 0,
  inss numeric not null default 0,
  fgts numeric not null default 0,
  provisao_ferias numeric not null default 0,
  provisao_13 numeric not null default 0,
  aviso_previo numeric not null default 0,
  beneficios numeric not null default 0,
  total numeric generated always as (
    salario_bruto + inss + fgts + provisao_ferias + provisao_13 + aviso_previo + beneficios
  ) stored,
  created_at timestamptz not null default now(),
  unique (colaborador_id, mes_referencia)
);

create table public.nao_conformidades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  operacao text not null,
  colaborador_id uuid,
  tipo text not null default 'outro',
  descricao text not null,
  data_ocorrencia date not null default current_date,
  ref_pinho text,
  ref_cliente text,
  numero_oc text,
  numero_processo text,
  custo_gerado numeric not null default 0,
  reembolsavel boolean not null default false,
  status_financeiro text not null default 'nao_aplicavel',
  forma_resolucao text,
  valor_recuperado numeric default 0,
  data_resolucao date,
  created_at timestamptz not null default now()
);

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tipo text not null,
  titulo text not null,
  mensagem text,
  link text,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array[
    'alocacoes_periodo','banco_horas','checkins_operacionais','custo_pessoal_mensal','nao_conformidades'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy auth_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

grant select, insert, update, delete on public.notificacoes to authenticated;
grant all on public.notificacoes to service_role;
alter table public.notificacoes enable row level security;
create policy own_notificacoes on public.notificacoes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
