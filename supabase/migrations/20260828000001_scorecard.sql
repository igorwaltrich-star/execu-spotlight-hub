-- ═══════════════════════════════════════════════════════════
-- Performance Scorecard — 5 dimensões
--
-- Três princípios estruturais, refletidos no schema:
--   1. Complexidade vem do BPMN → tabela própria de pesos por
--      processo, com participação no mix. Não há campo de
--      "percepção do gestor" no cálculo de produtividade.
--   2. Registro contínuo → uma nota curta por pessoa por mês,
--      com unique (colaborador, mes) para forçar a cadência.
--   3. Critério publicado antes do ciclo → o ciclo guarda os
--      pesos vigentes e só aceita avaliação depois de publicado.
-- ═══════════════════════════════════════════════════════════

-- ── Complexidade vinda do BPMN ───────────────────────────────
create table if not exists public.complexidade_bpmn (
  id            uuid primary key default gen_random_uuid(),
  operacao      text not null,
  processo      text not null,
  peso          numeric(5,2) not null check (peso > 0),
  participacao  numeric(5,2) not null default 0
                check (participacao between 0 and 100),
  referencia    text,
  ativo         boolean not null default true,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (operacao, processo)
);
alter table public.complexidade_bpmn enable row level security;
drop policy if exists "bpmn_read"  on public.complexidade_bpmn;
drop policy if exists "bpmn_write" on public.complexidade_bpmn;
create policy "bpmn_read" on public.complexidade_bpmn
  for select using (auth.uid() is not null);
create policy "bpmn_write" on public.complexidade_bpmn
  for all
  using (public.tem_papel(array['gestor','coordenador']))
  with check (public.tem_papel(array['gestor','coordenador']));

-- ── Ciclos de avaliação ──────────────────────────────────────
create table if not exists public.scorecard_ciclos (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  periodo_inicio    date not null,
  periodo_fim       date not null,
  status            text not null default 'rascunho'
                    check (status in ('rascunho','publicado','fechado')),
  -- pesos congelados no momento da publicação
  peso_produtividade numeric(5,2) not null default 30,
  peso_qualidade     numeric(5,2) not null default 25,
  peso_confiabilidade numeric(5,2) not null default 20,
  peso_multiplicacao numeric(5,2) not null default 15,
  peso_iniciativa    numeric(5,2) not null default 10,
  criterio_publicado text,
  publicado_em       timestamptz,
  fechado_em         timestamptz,
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  constraint pesos_somam_cem check (
    peso_produtividade + peso_qualidade + peso_confiabilidade
    + peso_multiplicacao + peso_iniciativa = 100
  )
);
alter table public.scorecard_ciclos enable row level security;
drop policy if exists "ciclo_read"  on public.scorecard_ciclos;
drop policy if exists "ciclo_write" on public.scorecard_ciclos;
-- todos leem o critério publicado; rascunho só a liderança
create policy "ciclo_read" on public.scorecard_ciclos
  for select using (
    status <> 'rascunho' or public.tem_papel(array['gestor','coordenador'])
  );
create policy "ciclo_write" on public.scorecard_ciclos
  for all
  using (public.tem_papel(array['gestor','coordenador']))
  with check (public.tem_papel(array['gestor','coordenador']));

-- ── Registro contínuo: uma nota por pessoa por mês ───────────
create table if not exists public.scorecard_registros (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  mes            date not null,
  nota           text not null,
  dimensao       text check (dimensao in (
                   'produtividade','qualidade','confiabilidade',
                   'multiplicacao','iniciativa','geral')),
  tipo           text not null default 'observacao'
                 check (tipo in ('observacao','destaque','atencao')),
  autor_id       uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  unique (colaborador_id, mes, dimensao)
);
alter table public.scorecard_registros enable row level security;
drop policy if exists "registro_lideranca" on public.scorecard_registros;
create policy "registro_lideranca" on public.scorecard_registros
  for all
  using (public.tem_papel(array['gestor','coordenador','supervisor']))
  with check (public.tem_papel(array['gestor','coordenador','supervisor']));

-- ── Avaliações do ciclo ──────────────────────────────────────
-- Produtividade, qualidade e confiabilidade são calculadas dos
-- dados operacionais. Multiplicação e iniciativa exigem
-- evidência escrita — não há nota sem justificativa.
create table if not exists public.scorecard_avaliacoes (
  id                    uuid primary key default gen_random_uuid(),
  ciclo_id              uuid not null references public.scorecard_ciclos(id) on delete cascade,
  colaborador_id        uuid not null references public.colaboradores(id) on delete cascade,

  nota_produtividade    numeric(5,2) check (nota_produtividade between 0 and 100),
  nota_qualidade        numeric(5,2) check (nota_qualidade between 0 and 100),
  nota_confiabilidade   numeric(5,2) check (nota_confiabilidade between 0 and 100),
  nota_multiplicacao    numeric(5,2) check (nota_multiplicacao between 0 and 100),
  nota_iniciativa       numeric(5,2) check (nota_iniciativa between 0 and 100),

  -- de onde veio cada nota: calculado dos dados ou ajustado
  origem_produtividade  text not null default 'calculado'
                        check (origem_produtividade in ('calculado','ajustado')),
  origem_qualidade      text not null default 'calculado'
                        check (origem_qualidade in ('calculado','ajustado')),
  origem_confiabilidade text not null default 'calculado'
                        check (origem_confiabilidade in ('calculado','ajustado')),

  evidencia_multiplicacao text,
  evidencia_iniciativa    text,
  justificativa_ajuste    text,

  destaque              boolean not null default false,
  motivo_destaque       text,

  avaliador_id          uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (ciclo_id, colaborador_id)
);
alter table public.scorecard_avaliacoes enable row level security;
drop policy if exists "aval_lideranca" on public.scorecard_avaliacoes;
create policy "aval_lideranca" on public.scorecard_avaliacoes
  for all
  using (public.tem_papel(array['gestor','coordenador','supervisor']))
  with check (public.tem_papel(array['gestor','coordenador','supervisor']));

create index if not exists scorecard_aval_ciclo_idx
  on public.scorecard_avaliacoes (ciclo_id, colaborador_id);
create index if not exists scorecard_reg_colab_idx
  on public.scorecard_registros (colaborador_id, mes desc);
