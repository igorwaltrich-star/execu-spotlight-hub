-- Pendências Hub: frequência dos colaboradores e pendências de onboarding.
-- Cada importação é um snapshot imutável do arquivo enviado, como nos fechamentos pendentes.

create table if not exists public.hub_frequencia_importacoes (
  id              uuid primary key default gen_random_uuid(),
  arquivo_nome    text not null,
  data_referencia date,
  importado_por   uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table if not exists public.hub_frequencia_colaboradores (
  id                       uuid primary key default gen_random_uuid(),
  importacao_id            uuid not null references public.hub_frequencia_importacoes(id) on delete cascade,
  colaborador              text not null,
  cargo                    text,
  gestor                   text,
  empresa                  text,
  treinamento_concluidos   integer not null default 0,
  treinamentos_pendentes   text,
  nota                     numeric,
  hub_dias_30              integer not null default 0,
  ultimo_acesso_hub        date,
  ultima_acao_processo     date,
  dashboard_dias_30        integer not null default 0,
  ultimo_acesso_dashboard  date
);
create index if not exists hub_freq_colab_importacao_idx on public.hub_frequencia_colaboradores(importacao_id);

create table if not exists public.hub_onboarding_importacoes (
  id              uuid primary key default gen_random_uuid(),
  arquivo_nome    text not null,
  data_referencia date,
  importado_por   uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table if not exists public.hub_onboarding_itens (
  id             uuid primary key default gen_random_uuid(),
  importacao_id  uuid not null references public.hub_onboarding_importacoes(id) on delete cascade,
  empresa        text not null,
  item           text not null,
  responsavel    text,
  desde          date
);
create index if not exists hub_onb_itens_importacao_idx on public.hub_onboarding_itens(importacao_id);

-- Os dados citam colaboradores pelo nome: leitura e escrita só para gestor, coordenador e supervisor,
-- os mesmos papéis que veem a página.
alter table public.hub_frequencia_importacoes   enable row level security;
alter table public.hub_frequencia_colaboradores enable row level security;
alter table public.hub_onboarding_importacoes   enable row level security;
alter table public.hub_onboarding_itens         enable row level security;

drop policy if exists "hub_freq_imp_all"   on public.hub_frequencia_importacoes;
drop policy if exists "hub_freq_colab_all" on public.hub_frequencia_colaboradores;
drop policy if exists "hub_onb_imp_all"    on public.hub_onboarding_importacoes;
drop policy if exists "hub_onb_itens_all"  on public.hub_onboarding_itens;

create policy "hub_freq_imp_all" on public.hub_frequencia_importacoes for all
  using (public.tem_papel(array['gestor','coordenador','supervisor']))
  with check (public.tem_papel(array['gestor','coordenador','supervisor']));
create policy "hub_freq_colab_all" on public.hub_frequencia_colaboradores for all
  using (public.tem_papel(array['gestor','coordenador','supervisor']))
  with check (public.tem_papel(array['gestor','coordenador','supervisor']));
create policy "hub_onb_imp_all" on public.hub_onboarding_importacoes for all
  using (public.tem_papel(array['gestor','coordenador','supervisor']))
  with check (public.tem_papel(array['gestor','coordenador','supervisor']));
create policy "hub_onb_itens_all" on public.hub_onboarding_itens for all
  using (public.tem_papel(array['gestor','coordenador','supervisor']))
  with check (public.tem_papel(array['gestor','coordenador','supervisor']));
