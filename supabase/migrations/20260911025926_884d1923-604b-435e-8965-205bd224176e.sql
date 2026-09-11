
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  cargo text,
  role text not null default 'analista',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.equipes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  gestor_id uuid,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.membros_equipe (
  id uuid primary key default gen_random_uuid(),
  equipe_id uuid not null references public.equipes(id) on delete cascade,
  user_id uuid not null,
  ativo boolean not null default true,
  data_entrada date,
  created_at timestamptz not null default now(),
  unique (equipe_id, user_id)
);

create table public.atividades (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  tipo text not null default 'rotineira',
  owner_id uuid,
  equipe_id uuid references public.equipes(id) on delete set null,
  prioridade text not null default 'media',
  start_date date,
  due_date date,
  recorrencia text,
  status text not null default 'nao_iniciada',
  observacoes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ocorrencias_atividade (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  week_start date not null,
  week_end date,
  status text,
  resultado text,
  pontuacao numeric,
  justificativa text,
  created_at timestamptz not null default now(),
  unique (atividade_id, week_start)
);

create table public.metas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  valor_esperado numeric not null default 0,
  unidade text not null default 'quantidade',
  start_date date,
  end_date date,
  recorrencia text,
  status text not null default 'ativa',
  owner_id uuid,
  equipe_id uuid references public.equipes(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.resultados_meta (
  id uuid primary key default gen_random_uuid(),
  meta_id uuid not null references public.metas(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date,
  valor_esperado numeric not null default 0,
  valor_realizado numeric not null default 0,
  pct_atingimento numeric generated always as (
    case when valor_esperado = 0 then 0 else round((valor_realizado / valor_esperado) * 100, 2) end
  ) stored,
  resultado text,
  justificativa text,
  created_at timestamptz not null default now()
);

create table public.revisoes_semanais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  week_start date not null,
  week_end date not null,
  status text not null default 'pendente',
  pontuacao_geral numeric,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.checkins_gerenciais (
  id uuid primary key default gen_random_uuid(),
  gestor_id uuid not null,
  data date not null,
  frequencia text not null default 'semanal',
  status text not null default 'agendado',
  observacoes text,
  pauta_previa jsonb,
  participantes text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.checkin_gerencial_itens (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.checkins_gerenciais(id) on delete cascade,
  titulo text not null,
  tipo text not null default 'pauta',
  discussao text,
  decisao text,
  responsavel_id uuid,
  prazo date,
  status_acompanhamento text not null default 'aberto',
  created_at timestamptz not null default now()
);

create table public.projetos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  objetivo text,
  descricao text,
  responsavel_id uuid,
  equipe_id uuid references public.equipes(id) on delete set null,
  start_date date,
  due_date date,
  prioridade text not null default 'media',
  status text not null default 'nao_iniciado',
  progresso integer not null default 0,
  observacoes text,
  owner_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.projeto_atividades (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (projeto_id, atividade_id)
);

create table public.planos_desenvolvimento (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null,
  competencia text not null,
  objetivo text not null,
  indicador text,
  start_date date,
  due_date date,
  status text not null default 'nao_iniciado',
  progresso integer not null default 0,
  evidencias text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.atividades_desenvolvimento (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references public.planos_desenvolvimento(id) on delete cascade,
  titulo text not null,
  descricao text,
  due_date date,
  status text not null default 'nao_iniciada',
  progresso integer not null default 0,
  evidencia text,
  created_at timestamptz not null default now()
);

create table public.avaliacoes_pdi (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references public.planos_desenvolvimento(id) on delete cascade,
  data date not null default current_date,
  progresso integer not null default 0,
  avaliacao text not null,
  avaliador_id uuid,
  created_at timestamptz not null default now()
);

create table public.scorecard_ciclos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  periodo_inicio date not null,
  periodo_fim date not null,
  status text not null default 'rascunho',
  peso_produtividade numeric not null default 30,
  peso_qualidade numeric not null default 25,
  peso_confiabilidade numeric not null default 20,
  peso_multiplicacao numeric not null default 15,
  peso_iniciativa numeric not null default 10,
  criterio_publicado text,
  publicado_em timestamptz,
  fechado_em timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.scorecard_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references public.scorecard_ciclos(id) on delete cascade,
  colaborador_id uuid not null,
  nota_produtividade numeric,
  nota_qualidade numeric,
  nota_confiabilidade numeric,
  nota_multiplicacao numeric,
  nota_iniciativa numeric,
  origem_produtividade text not null default 'calculado',
  origem_qualidade text not null default 'calculado',
  origem_confiabilidade text not null default 'calculado',
  evidencia_multiplicacao text,
  evidencia_iniciativa text,
  justificativa_ajuste text,
  destaque boolean not null default false,
  motivo_destaque text,
  avaliador_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ciclo_id, colaborador_id)
);

create table public.scorecard_registros (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null,
  mes date not null,
  nota text not null,
  dimensao text not null default 'geral',
  tipo text not null default 'observacao',
  autor_id uuid,
  created_at timestamptz not null default now(),
  unique (colaborador_id, mes, dimensao)
);

create table public.registros_produtividade (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null,
  operacao text not null,
  mes date not null,
  volume_processos numeric not null default 0,
  fte numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.complexidade_bpmn (
  id uuid primary key default gen_random_uuid(),
  operacao text not null,
  processo text not null,
  peso numeric not null default 1,
  participacao numeric not null default 0,
  referencia text,
  ativo boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (operacao, processo)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','equipes','membros_equipe','atividades','ocorrencias_atividade','metas',
    'resultados_meta','revisoes_semanais','checkins_gerenciais','checkin_gerencial_itens',
    'projetos','projeto_atividades','planos_desenvolvimento','atividades_desenvolvimento',
    'avaliacoes_pdi','scorecard_ciclos','scorecard_avaliacoes','scorecard_registros',
    'registros_produtividade','complexidade_bpmn','audit_logs'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy auth_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
