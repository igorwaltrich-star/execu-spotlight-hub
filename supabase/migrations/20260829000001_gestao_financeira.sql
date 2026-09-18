-- ═══════════════════════════════════════════════════════════
-- Gestão Financeira — funil Registro → Solicitação → Fechamento
--
-- A base é a planilha KPI_Acompanhamento exportada do Sigraweb.
-- Guardamos o processo com as três datas do funil e as dimensões
-- usadas para cortar a análise. A chave é o código Sigra.
-- ═══════════════════════════════════════════════════════════

create table if not exists public.financeiro_processos (
  id                  uuid primary key default gen_random_uuid(),
  sigra               text not null unique,
  codigo              text,
  centro_custo        text,
  modal               text,
  di                  text,
  importador          text,
  canal_rfb           text,

  data_registro       date,
  data_solicitacao    date,
  data_fechamento     date,

  -- lead times calculados no banco, para não depender do cliente
  dias_reg_sol        integer generated always as (
                        case when data_registro is not null and data_solicitacao is not null
                        then data_solicitacao - data_registro end) stored,
  dias_sol_fec        integer generated always as (
                        case when data_solicitacao is not null and data_fechamento is not null
                        then data_fechamento - data_solicitacao end) stored,

  importado_em        timestamptz not null default now(),
  importado_por       uuid references auth.users(id),
  atualizado_em       timestamptz not null default now()
);
alter table public.financeiro_processos enable row level security;
drop policy if exists "fin_proc_read"  on public.financeiro_processos;
drop policy if exists "fin_proc_write" on public.financeiro_processos;
create policy "fin_proc_read" on public.financeiro_processos
  for select using (auth.uid() is not null);
create policy "fin_proc_write" on public.financeiro_processos
  for all
  using (public.tem_papel(array['gestor','coordenador','supervisor']))
  with check (public.tem_papel(array['gestor','coordenador','supervisor']));

create index if not exists fin_proc_reg_idx on public.financeiro_processos (data_registro);
create index if not exists fin_proc_cc_idx  on public.financeiro_processos (centro_custo);

-- ── Categorias de justificativa ──────────────────────────────
-- Editáveis: a taxonomia é construída com a operação, não fixa
-- no código. `conta_como_gap` separa o que é falha real do que
-- é comportamento esperado do fluxo.
create table if not exists public.financeiro_categorias (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null unique,
  descricao      text,
  conta_como_gap boolean not null default true,
  responsavel    text not null default 'operacao'
                 check (responsavel in ('operacao','cliente','financeiro','aduana','sistema')),
  ordem          integer not null default 0,
  ativo          boolean not null default true,
  created_at     timestamptz not null default now()
);
alter table public.financeiro_categorias enable row level security;
drop policy if exists "fin_cat_read"  on public.financeiro_categorias;
drop policy if exists "fin_cat_write" on public.financeiro_categorias;
create policy "fin_cat_read" on public.financeiro_categorias
  for select using (auth.uid() is not null);
create policy "fin_cat_write" on public.financeiro_categorias
  for all
  using (public.tem_papel(array['gestor','coordenador']))
  with check (public.tem_papel(array['gestor','coordenador']));

-- ── Justificativas de não solicitação ────────────────────────
create table if not exists public.financeiro_justificativas (
  id             uuid primary key default gen_random_uuid(),
  processo_id    uuid references public.financeiro_processos(id) on delete cascade,
  -- justificativa pode ser aplicada a um lote inteiro (ex.: centro de custo)
  escopo         text not null default 'processo'
                 check (escopo in ('processo','centro_custo')),
  centro_custo   text,
  categoria_id   uuid not null references public.financeiro_categorias(id),
  justificativa  text,
  autor_id       uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  constraint alvo_definido check (
    (escopo = 'processo'     and processo_id is not null) or
    (escopo = 'centro_custo' and centro_custo is not null)
  )
);
alter table public.financeiro_justificativas enable row level security;
drop policy if exists "fin_just_read"  on public.financeiro_justificativas;
drop policy if exists "fin_just_write" on public.financeiro_justificativas;
create policy "fin_just_read" on public.financeiro_justificativas
  for select using (auth.uid() is not null);
create policy "fin_just_write" on public.financeiro_justificativas
  for all
  using (public.tem_papel(array['gestor','coordenador','supervisor']))
  with check (public.tem_papel(array['gestor','coordenador','supervisor']));

create index if not exists fin_just_proc_idx on public.financeiro_justificativas (processo_id);
create index if not exists fin_just_cc_idx   on public.financeiro_justificativas (centro_custo);

-- ── Proposta inicial de categorias ───────────────────────────
-- Ponto de partida a ajustar com a operação. `conta_como_gap =
-- false` marca o que não deve ser cobrado como falha da equipe.
insert into public.financeiro_categorias (nome, descricao, conta_como_gap, responsavel, ordem)
values
  ('Cliente com fluxo próprio',      'Conta não utiliza solicitação de fechamento no Sigraweb', false, 'cliente',    1),
  ('Dentro do prazo normal',         'Registro recente, ainda dentro da janela esperada',        false, 'operacao',   2),
  ('Aguardando numerário',           'Pendente de recurso para seguir com o fechamento',         false, 'financeiro', 3),
  ('Aguardando documento do cliente','Falta documentação sob responsabilidade do importador',    false, 'cliente',    4),
  ('Pendência aduaneira',            'Processo retido, em exigência ou canal de conferência',    false, 'aduana',     5),
  ('Divergência de custo',           'Valor em apuração antes de solicitar o fechamento',        true,  'operacao',   6),
  ('Falha de lançamento',            'Solicitação não registrada por erro ou esquecimento',      true,  'operacao',   7),
  ('Processo cancelado',             'Cancelado, substituído ou duplicado',                      false, 'sistema',    8),
  ('Outro',                          'Exige descrição livre',                                    true,  'operacao',   9)
on conflict (nome) do nothing;
