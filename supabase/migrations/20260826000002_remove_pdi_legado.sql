-- ═══════════════════════════════════════════════════════════
-- Remove o PDI legado (public.pdi), migrando o conteúdo
-- existente para o PDI estruturado (planos_desenvolvimento).
-- ═══════════════════════════════════════════════════════════

-- 1) Migra registros do PDI legado, se a tabela ainda existir.
--    Cada registro antigo (meta + prazo + status) vira um plano
--    estruturado, usando a meta como competência e objetivo.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'pdi'
  ) then
    insert into public.planos_desenvolvimento
      (colaborador_id, competencia, objetivo, due_date, status, progresso, evidencias, created_by, created_at)
    select
      p.colaborador_id,
      left(p.meta, 200)                                   as competencia,
      p.meta                                              as objetivo,
      p.prazo                                             as due_date,
      case p.status::text
        when 'nao_iniciado' then 'nao_iniciado'
        when 'em_andamento' then 'em_andamento'
        when 'concluido'    then 'concluido'
        when 'atrasado'     then 'atrasado'
        else 'nao_iniciado'
      end                                                 as status,
      case p.status::text when 'concluido' then 100 else 0 end as progresso,
      'Migrado do PDI legado.'                            as evidencias,
      p.user_id                                           as created_by,
      p.created_at
    from public.pdi p
    where exists (select 1 from public.colaboradores c where c.id = p.colaborador_id)
      and not exists (
        select 1 from public.planos_desenvolvimento pd
        where pd.colaborador_id = p.colaborador_id
          and pd.objetivo = p.meta
      );
  end if;
end $$;

-- 2) Remove a tabela legada e o enum que só ela usava.
drop table if exists public.pdi;
drop type if exists public.pdi_status;
