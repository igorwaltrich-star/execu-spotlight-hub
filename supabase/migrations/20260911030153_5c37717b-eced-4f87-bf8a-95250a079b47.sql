
alter table public.registros_produtividade
  add column user_id uuid,
  add column dias_trabalhados integer not null default 0,
  add column dias_uteis_mes integer not null default 22,
  add column observacoes text;

alter table public.registros_produtividade drop column fte;

alter table public.registros_produtividade
  add column fte numeric generated always as (
    case when dias_uteis_mes = 0 then 0
    else round(dias_trabalhados::numeric / dias_uteis_mes::numeric, 4) end
  ) stored,
  add column produtividade numeric generated always as (
    case when dias_trabalhados = 0 or dias_uteis_mes = 0 then 0
    else round(volume_processos / (dias_trabalhados::numeric / dias_uteis_mes::numeric), 2) end
  ) stored;
