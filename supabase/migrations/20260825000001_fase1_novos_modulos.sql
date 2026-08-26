-- ═══════════════════════════════════════════════════════════
-- Fase 1 — Novos módulos: Produtividade, Alocação, NC, Custo,
--           Check IN Operacional, Check IN Gerencial, DHO base
-- ═══════════════════════════════════════════════════════════

-- ── Perfis estendidos (complementa auth.users) ──────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  cargo       text,
  role        text not null default 'analista'
              check (role in ('gestor','coordenador','supervisor','analista')),
  ativo       boolean not null default true,
  data_entrada date,
  data_saida   date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles_self" on public.profiles;
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id);
drop policy if exists "profiles_gestor" on public.profiles;
create policy "profiles_gestor" on public.profiles
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'gestor')
  );

-- ── Alocações / Rotation ────────────────────────────────────
create table if not exists public.alocacoes_periodo (
  id              uuid primary key default gen_random_uuid(),
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  operacao        text not null,
  mes             date not null,
  dias_na_operacao  numeric(5,2) not null check (dias_na_operacao > 0),
  dias_uteis_mes    integer not null check (dias_uteis_mes > 0),
  fte             numeric(6,4) generated always as (dias_na_operacao / dias_uteis_mes) stored,
  tipo            text not null default 'fixo' check (tipo in ('fixo','temporario')),
  motivo          text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  unique (colaborador_id, operacao, mes)
);
alter table public.alocacoes_periodo enable row level security;
drop policy if exists "alocacoes_auth" on public.alocacoes_periodo;
create policy "alocacoes_auth" on public.alocacoes_periodo for all using (auth.uid() is not null);

-- ── Registro de produtividade por pessoa ────────────────────
create table if not exists public.registros_produtividade (
  id              uuid primary key default gen_random_uuid(),
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  operacao        text not null,
  mes             date not null,
  volume_processos  integer not null check (volume_processos >= 0),
  dias_trabalhados  numeric(5,2) not null check (dias_trabalhados >= 0),
  dias_uteis_mes    integer not null check (dias_uteis_mes > 0),
  fte             numeric(6,4) generated always as (dias_trabalhados / dias_uteis_mes) stored,
  produtividade   numeric(10,4) generated always as (
    case when dias_trabalhados > 0 then volume_processos / (dias_trabalhados / dias_uteis_mes) else 0 end
  ) stored,
  observacoes     text,
  user_id         uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  unique (colaborador_id, operacao, mes)
);
alter table public.registros_produtividade enable row level security;
drop policy if exists "prod_auth" on public.registros_produtividade;
create policy "prod_auth" on public.registros_produtividade for all using (auth.uid() is not null);

-- ── Banco de horas ───────────────────────────────────────────
create table if not exists public.banco_horas (
  id              uuid primary key default gen_random_uuid(),
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  mes             date not null,
  horas_extras    numeric(8,2) not null default 0,
  horas_debito    numeric(8,2) not null default 0,
  saldo_acumulado numeric(8,2) not null default 0,
  observacoes     text,
  user_id         uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  unique (colaborador_id, mes)
);
alter table public.banco_horas enable row level security;
drop policy if exists "banco_horas_auth" on public.banco_horas;
create policy "banco_horas_auth" on public.banco_horas for all using (auth.uid() is not null);

-- ── Não conformidades ────────────────────────────────────────
create table if not exists public.nao_conformidades (
  id                  uuid primary key default gen_random_uuid(),
  operacao            text not null,
  colaborador_id      uuid references public.colaboradores(id),
  tipo                text not null check (tipo in ('erro_digitacao','prazo_perdido','doc_incorreto','comunicacao','outro')),
  descricao           text not null,
  data_ocorrencia     date not null,
  -- referências do processo
  ref_pinho           text,
  ref_cliente         text,
  numero_oc           text,
  numero_processo     text,
  -- financeiro
  custo_gerado        numeric(12,2) not null default 0,
  reembolsavel        boolean not null default false,
  status_financeiro   text not null default 'nao_aplicavel'
                      check (status_financeiro in ('pendente','pago','nao_aplicavel')),
  forma_resolucao     text check (forma_resolucao in ('reembolso_cliente','servico_adicional','absorvido')),
  valor_recuperado    numeric(12,2),
  data_resolucao      date,
  -- controle
  user_id             uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.nao_conformidades enable row level security;
drop policy if exists "nc_auth" on public.nao_conformidades;
create policy "nc_auth" on public.nao_conformidades for all using (auth.uid() is not null);
create index on public.nao_conformidades (operacao, data_ocorrencia);

-- ── Custo pessoal mensal ─────────────────────────────────────
create table if not exists public.custo_pessoal_mensal (
  id                  uuid primary key default gen_random_uuid(),
  colaborador_id      uuid not null references public.colaboradores(id) on delete cascade,
  operacao            text not null,
  mes_referencia      date not null,
  tipo_contrato       text not null check (tipo_contrato in ('CLT','PJ','SALDO_LIVRE')),
  salario_bruto       numeric(12,2) not null default 0,
  inss                numeric(12,2) not null default 0,
  fgts                numeric(12,2) not null default 0,
  provisao_ferias     numeric(12,2) not null default 0,
  provisao_13         numeric(12,2) not null default 0,
  aviso_previo        numeric(12,2) not null default 0,
  beneficios          numeric(12,2) not null default 0,
  total               numeric(12,2) generated always as (
    salario_bruto + inss + fgts + provisao_ferias + provisao_13 + aviso_previo + beneficios
  ) stored,
  fonte               text not null default 'manual' check (fonte in ('excel_upload','manual')),
  user_id             uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  unique (colaborador_id, mes_referencia)
);
alter table public.custo_pessoal_mensal enable row level security;
drop policy if exists "custo_gestor" on public.custo_pessoal_mensal;
create policy "custo_gestor" on public.custo_pessoal_mensal for all using (auth.uid() is not null);

-- ── Check IN Operacional ─────────────────────────────────────
create table if not exists public.checkins_operacionais (
  id                uuid primary key default gen_random_uuid(),
  operacao          text not null,
  data              date not null,
  frequencia        text not null default 'diario' check (frequencia in ('diario','semanal')),
  responsavel_id    uuid references public.colaboradores(id),
  presentes         text[] not null default '{}',
  ausentes          text[] not null default '{}',
  volume_previsto   integer,
  volume_realizado  integer,
  status_geral      text not null default 'normal' check (status_geral in ('normal','atencao','critico')),
  pendencias        text,
  redistribuicoes   jsonb,
  nao_conformidade_id uuid references public.nao_conformidades(id),
  observacoes       text,
  user_id           uuid references auth.users(id),
  created_at        timestamptz not null default now()
);
alter table public.checkins_operacionais enable row level security;
drop policy if exists "checkin_op_auth" on public.checkins_operacionais;
create policy "checkin_op_auth" on public.checkins_operacionais for all using (auth.uid() is not null);
create index on public.checkins_operacionais (operacao, data);

-- ── Equipes (DHO) ────────────────────────────────────────────
create table if not exists public.equipes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  descricao   text,
  gestor_id   uuid references auth.users(id),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.equipes enable row level security;
drop policy if exists "equipes_auth" on public.equipes;
create policy "equipes_auth" on public.equipes for all using (auth.uid() is not null);

create table if not exists public.membros_equipe (
  id          uuid primary key default gen_random_uuid(),
  equipe_id   uuid not null references public.equipes(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  data_entrada date not null default current_date,
  data_saida   date,
  ativo        boolean not null default true,
  unique (equipe_id, user_id)
);
alter table public.membros_equipe enable row level security;
drop policy if exists "membros_auth" on public.membros_equipe;
create policy "membros_auth" on public.membros_equipe for all using (auth.uid() is not null);

-- ── Atividades (DHO) ─────────────────────────────────────────
create table if not exists public.atividades (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  descricao       text,
  tipo            text not null default 'rotineira'
                  check (tipo in ('rotineira','prazo','projeto','pdi')),
  owner_id        uuid references auth.users(id),
  equipe_id       uuid references public.equipes(id),
  prioridade      text not null default 'media'
                  check (prioridade in ('baixa','media','alta','critica')),
  start_date      date,
  due_date        date,
  recorrencia     text check (recorrencia in ('semanal','quinzenal','mensal','personalizada')),
  meta_valor      numeric(12,2),
  unidade         text,
  status          text not null default 'nao_iniciada'
                  check (status in ('nao_iniciada','em_andamento','concluida','atrasada','cancelada','bloqueada')),
  observacoes     text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.atividades enable row level security;
drop policy if exists "atividades_auth" on public.atividades;
create policy "atividades_auth" on public.atividades for all using (auth.uid() is not null);

-- ── Ocorrências de atividades (recorrentes) ──────────────────
create table if not exists public.ocorrencias_atividade (
  id                    uuid primary key default gen_random_uuid(),
  atividade_id          uuid not null references public.atividades(id) on delete cascade,
  week_start            date not null,
  week_end              date not null,
  status                text not null default 'pendente',
  resultado             text check (resultado in ('sucesso','atraso','desvios','nao_realizado','nao_aplicavel')),
  justificativa         text,
  pontuacao             numeric(5,2),
  feedback_gestor       text,
  revisado_por          uuid references auth.users(id),
  revisado_em           timestamptz,
  created_at            timestamptz not null default now()
);
alter table public.ocorrencias_atividade enable row level security;
drop policy if exists "ocorrencias_auth" on public.ocorrencias_atividade;
create policy "ocorrencias_auth" on public.ocorrencias_atividade for all using (auth.uid() is not null);

-- ── Metas (DHO) ──────────────────────────────────────────────
create table if not exists public.metas (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  descricao       text,
  owner_id        uuid references auth.users(id),
  equipe_id       uuid references public.equipes(id),
  valor_esperado  numeric(14,4) not null,
  unidade         text not null,
  start_date      date not null,
  end_date        date not null,
  recorrencia     text check (recorrencia in ('semanal','quinzenal','mensal')),
  status          text not null default 'ativa' check (status in ('ativa','concluida','cancelada')),
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.metas enable row level security;
drop policy if exists "metas_auth" on public.metas;
create policy "metas_auth" on public.metas for all using (auth.uid() is not null);

create table if not exists public.resultados_meta (
  id                    uuid primary key default gen_random_uuid(),
  meta_id               uuid not null references public.metas(id) on delete cascade,
  periodo_inicio        date not null,
  periodo_fim           date not null,
  valor_esperado        numeric(14,4) not null,
  valor_realizado       numeric(14,4) not null default 0,
  pct_atingimento       numeric(8,2) generated always as (
    case when valor_esperado > 0 then (valor_realizado / valor_esperado * 100) else 0 end
  ) stored,
  resultado             text check (resultado in ('atingida','parcial','nao_atingida')),
  justificativa         text,
  feedback_gestor       text,
  created_at            timestamptz not null default now()
);
alter table public.resultados_meta enable row level security;
drop policy if exists "resultados_auth" on public.resultados_meta;
create policy "resultados_auth" on public.resultados_meta for all using (auth.uid() is not null);

-- ── Revisões semanais (DHO) ──────────────────────────────────
create table if not exists public.revisoes_semanais (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  week_start      date not null,
  week_end        date not null,
  status          text not null default 'pendente' check (status in ('pendente','concluida','aprovada')),
  pontuacao_geral numeric(5,2),
  conclusao_gestor text,
  fechada_em      timestamptz,
  created_at      timestamptz not null default now(),
  unique (user_id, week_start)
);
alter table public.revisoes_semanais enable row level security;
drop policy if exists "revisoes_self" on public.revisoes_semanais;
create policy "revisoes_self" on public.revisoes_semanais for all using (auth.uid() = user_id);
drop policy if exists "revisoes_gestor" on public.revisoes_semanais;
create policy "revisoes_gestor" on public.revisoes_semanais for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('gestor','coordenador','supervisor'))
);

-- ── Feedbacks e elogios (DHO) ────────────────────────────────
create table if not exists public.feedbacks (
  id              uuid primary key default gen_random_uuid(),
  de_user_id      uuid references auth.users(id),
  para_user_id    uuid references auth.users(id),
  equipe_id       uuid references public.equipes(id),
  tipo            text not null check (tipo in ('elogio_cliente','feedback_positivo','destaque_operacao','meta_atingida','ponto_atencao')),
  descricao       text not null,
  data            date not null default current_date,
  fonte           text check (fonte in ('cliente','supervisor','diretoria','par')),
  visivel_equipe  boolean not null default false,
  created_at      timestamptz not null default now()
);
alter table public.feedbacks enable row level security;
drop policy if exists "feedbacks_auth" on public.feedbacks;
create policy "feedbacks_auth" on public.feedbacks for all using (auth.uid() is not null);

-- ── Check IN Gerencial (DHO) ─────────────────────────────────
create table if not exists public.checkins_gerenciais (
  id              uuid primary key default gen_random_uuid(),
  data            date not null,
  frequencia      text not null default 'semanal' check (frequencia in ('semanal','quinzenal','mensal')),
  status          text not null default 'agendado' check (status in ('agendado','realizado','cancelado','reagendado')),
  gestor_id       uuid not null references auth.users(id),
  participantes   uuid[] not null default '{}',
  pauta_previa    jsonb,
  observacoes     text,
  created_at      timestamptz not null default now()
);
alter table public.checkins_gerenciais enable row level security;
drop policy if exists "cg_auth" on public.checkins_gerenciais;
create policy "cg_auth" on public.checkins_gerenciais for all using (auth.uid() is not null);

create table if not exists public.checkin_gerencial_itens (
  id                    uuid primary key default gen_random_uuid(),
  checkin_id            uuid not null references public.checkins_gerenciais(id) on delete cascade,
  titulo                text not null,
  tipo                  text not null default 'pauta' check (tipo in ('pauta','encaminhamento','acompanhamento')),
  discussao             text,
  decisao               text,
  atividade_id          uuid references public.atividades(id),
  responsavel_id        uuid references auth.users(id),
  prazo                 date,
  status_acompanhamento text not null default 'aberto' check (status_acompanhamento in ('aberto','concluido','atrasado')),
  created_at            timestamptz not null default now()
);
alter table public.checkin_gerencial_itens enable row level security;
drop policy if exists "cgi_auth" on public.checkin_gerencial_itens;
create policy "cgi_auth" on public.checkin_gerencial_itens for all using (auth.uid() is not null);

-- ── Audit logs ───────────────────────────────────────────────
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id),
  entity_type text not null,
  entity_id   uuid,
  action      text not null,
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
drop policy if exists "audit_gestor" on public.audit_logs;
create policy "audit_gestor" on public.audit_logs for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('gestor','coordenador'))
);
