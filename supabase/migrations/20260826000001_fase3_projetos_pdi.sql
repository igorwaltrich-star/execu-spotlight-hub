-- ═══════════════════════════════════════════════════════════
-- Fase 3A — Projetos + PDI estruturado
-- Obs.: a tabela legada public.pdi (meta/prazo/status) permanece
--       intacta e segue em uso na aba Gerenciamento Operacional.
-- ═══════════════════════════════════════════════════════════

-- ── Projetos ─────────────────────────────────────────────────
create table if not exists public.projetos (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  objetivo      text,
  descricao     text,
  owner_id      uuid references auth.users(id),
  responsavel_id uuid references public.colaboradores(id),
  equipe_id     uuid references public.equipes(id),
  start_date    date,
  due_date      date,
  prioridade    text not null default 'media'
                check (prioridade in ('baixa','media','alta','critica')),
  status        text not null default 'nao_iniciado'
                check (status in ('nao_iniciado','em_andamento','concluido','atrasado','pausado','cancelado')),
  progresso     integer not null default 0 check (progresso between 0 and 100),
  observacoes   text,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.projetos enable row level security;
drop policy if exists "projetos_auth" on public.projetos;
create policy "projetos_auth" on public.projetos for all using (auth.uid() is not null);
create index if not exists projetos_status_idx on public.projetos (status, due_date);

-- Vínculo atividade → projeto (sem alterar a tabela atividades)
create table if not exists public.projeto_atividades (
  id           uuid primary key default gen_random_uuid(),
  projeto_id   uuid not null references public.projetos(id) on delete cascade,
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (projeto_id, atividade_id)
);
alter table public.projeto_atividades enable row level security;
drop policy if exists "projeto_ativ_auth" on public.projeto_atividades;
create policy "projeto_ativ_auth" on public.projeto_atividades for all using (auth.uid() is not null);

-- Vínculo meta → projeto
create table if not exists public.projeto_metas (
  id         uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  meta_id    uuid not null references public.metas(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (projeto_id, meta_id)
);
alter table public.projeto_metas enable row level security;
drop policy if exists "projeto_metas_auth" on public.projeto_metas;
create policy "projeto_metas_auth" on public.projeto_metas for all using (auth.uid() is not null);

-- ── PDI estruturado ──────────────────────────────────────────
create table if not exists public.planos_desenvolvimento (
  id              uuid primary key default gen_random_uuid(),
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  competencia     text not null,
  objetivo        text not null,
  indicador       text,
  start_date      date,
  due_date        date,
  status          text not null default 'nao_iniciado'
                  check (status in ('nao_iniciado','em_andamento','concluido','atrasado','cancelado')),
  progresso       integer not null default 0 check (progresso between 0 and 100),
  evidencias      text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.planos_desenvolvimento enable row level security;
drop policy if exists "pdi_plano_auth" on public.planos_desenvolvimento;
create policy "pdi_plano_auth" on public.planos_desenvolvimento for all using (auth.uid() is not null);
create index if not exists pdi_plano_colab_idx on public.planos_desenvolvimento (colaborador_id, status);

create table if not exists public.atividades_desenvolvimento (
  id          uuid primary key default gen_random_uuid(),
  plano_id    uuid not null references public.planos_desenvolvimento(id) on delete cascade,
  titulo      text not null,
  descricao   text,
  due_date    date,
  status      text not null default 'nao_iniciada'
              check (status in ('nao_iniciada','em_andamento','concluida','atrasada','cancelada')),
  progresso   integer not null default 0 check (progresso between 0 and 100),
  evidencia   text,
  created_at  timestamptz not null default now()
);
alter table public.atividades_desenvolvimento enable row level security;
drop policy if exists "pdi_ativ_auth" on public.atividades_desenvolvimento;
create policy "pdi_ativ_auth" on public.atividades_desenvolvimento for all using (auth.uid() is not null);

-- Avaliações periódicas do PDI
create table if not exists public.avaliacoes_pdi (
  id          uuid primary key default gen_random_uuid(),
  plano_id    uuid not null references public.planos_desenvolvimento(id) on delete cascade,
  data        date not null default current_date,
  progresso   integer not null default 0 check (progresso between 0 and 100),
  avaliacao   text not null,
  avaliador_id uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
alter table public.avaliacoes_pdi enable row level security;
drop policy if exists "pdi_aval_auth" on public.avaliacoes_pdi;
create policy "pdi_aval_auth" on public.avaliacoes_pdi for all using (auth.uid() is not null);
