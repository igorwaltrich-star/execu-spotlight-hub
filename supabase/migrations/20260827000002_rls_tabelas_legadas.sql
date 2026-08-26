-- ═══════════════════════════════════════════════════════════
-- Habilita RLS nas 18 tabelas legadas que estavam expostas.
--
-- Contexto: essas tabelas nasceram sem RLS. Sem ela, qualquer
-- pessoa com a chave anônima do projeto lê e escreve nelas via
-- API REST, mesmo sem passar pela interface.
--
-- Modelo de acesso: os dados são OPERACIONAIS E COMPARTILHADOS
-- pela equipe — o código nunca filtra por user_id, todos veem
-- os mesmos registros. Portanto a policy correta é "autenticado
-- acessa", não "dono acessa". Usar auth.uid() = user_id aqui
-- esconderia de cada pessoa tudo que ela não cadastrou e
-- quebraria as telas existentes.
--
-- Dados de pessoas (colaboradores, férias, matriz, navy seal)
-- ficam restritos à liderança, coerente com o controle de acesso
-- já aplicado a custo e banco de horas.
-- ═══════════════════════════════════════════════════════════

-- ── 1) Operacionais compartilhados: qualquer autenticado ─────
do $$
declare t text;
begin
  foreach t in array array[
    'operacional_mensal','sla_midea','sla_bosch',
    'gargalos','melhorias','plano_acao','config',
    'analises_performance','swot','ishikawa','pareto',
    'cinco_porques','cinco_w_dois_h'
  ] loop
    if exists (select 1 from information_schema.tables
               where table_schema='public' and table_name=t) then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "%s_auth" on public.%I', t, t);
      execute format(
        'create policy "%s_auth" on public.%I for all
           using (auth.uid() is not null)
           with check (auth.uid() is not null)', t, t);
    end if;
  end loop;
end $$;

-- ── 2) Dados de pessoas: leitura geral, escrita da liderança ─
-- Leitura precisa ser ampla porque os dashboards exibem nomes
-- de colaboradores para toda a equipe.
do $$
declare t text;
begin
  foreach t in array array[
    'colaboradores','controle_ferias','escala_home_office',
    'matriz_lideranca','navy_seal'
  ] loop
    if exists (select 1 from information_schema.tables
               where table_schema='public' and table_name=t) then
      execute format('alter table public.%I enable row level security', t);

      execute format('drop policy if exists "%s_read"  on public.%I', t, t);
      execute format('drop policy if exists "%s_write" on public.%I', t, t);

      execute format(
        'create policy "%s_read" on public.%I
           for select using (auth.uid() is not null)', t, t);

      execute format(
        'create policy "%s_write" on public.%I
           for all
           using (public.tem_papel(array[''gestor'',''coordenador'',''supervisor'']))
           with check (public.tem_papel(array[''gestor'',''coordenador'',''supervisor'']))', t, t);
    end if;
  end loop;
end $$;

-- ── 3) Verificação ───────────────────────────────────────────
-- Registra no log quais tabelas públicas seguem sem RLS.
do $$
declare r record; faltando text := '';
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    faltando := faltando || r.relname || ' ';
  end loop;

  if faltando <> '' then
    raise notice 'Tabelas ainda sem RLS: %', faltando;
  else
    raise notice 'Todas as tabelas publicas possuem RLS habilitado.';
  end if;
end $$;
