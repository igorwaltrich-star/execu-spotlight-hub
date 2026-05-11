
# Dashboard de Performance Operacional — Diretoria

## Visão geral
App TanStack Start com 6 abas, dados persistidos no Lovable Cloud (Supabase), gráficos Recharts atualizados em tempo real. Acesso restrito por login (e-mail/senha) — apenas o proprietário tem acesso. Meta de produtividade fixa: **60 processos/pessoa**.

## Stack
- TanStack Start + React 19 + Tailwind v4 + Shadcn/UI
- Recharts (gráficos), react-hook-form + zod (forms)
- Lovable Cloud (Supabase) — Auth + Postgres + Realtime
- React Query para sincronização

## Autenticação (acesso único)
- Login por **e-mail + senha** via Supabase Auth
- Página `/login` pública; todas as demais rotas dentro de `_authenticated/`
- Sem signup público — você cria sua conta uma vez no primeiro acesso (ou eu provisiono via tela de signup oculta) e o restante fica bloqueado
- RLS em todas as tabelas: apenas linhas do `auth.uid()` proprietário são visíveis/editáveis
- Sem tabela `profiles` (não há dados de perfil — usuário único)
- Botão "Sair" no topo

## Estrutura de rotas
```
src/routes/
  __root.tsx
  login.tsx
  _authenticated.tsx              guard: redireciona p/ /login
  _authenticated/index.tsx        Dashboard Principal (apresentação)
  _authenticated/cadastro.tsx     Cadastro Operacional mensal
  _authenticated/sla-midea.tsx
  _authenticated/sla-bosch.tsx
  _authenticated/diagnostico.tsx  Gargalos e Riscos
  _authenticated/melhorias.tsx
  _authenticated/plano-acao.tsx
```

## Modelo de dados (Supabase)
Todas as tabelas têm `user_id uuid references auth.users` + RLS `user_id = auth.uid()`.
```
operacional_mensal (id, user_id, mes date, volume int, pessoas int,
                    produtividade generated = volume/pessoas)
sla_midea          (id, user_id, mes date, start_up, otcc, otd, sotd numeric)
sla_bosch          (id, user_id, mes date, dig_conf, start_up, otcc, desvios, pinho numeric)
gargalos           (id, user_id, item, impacto, risco enum[alto,medio,baixo])
melhorias          (id, user_id, titulo, descricao, tipo enum[atencao,oportunidade])
plano_acao         (id, user_id, iniciativa, responsavel, prazo date,
                    status enum[andamento,concluido,atrasado])
config             (id, user_id unique, fator_sazonalidade numeric default 0)
```

## Regras de negócio
- **Produtividade calculada** = volume / pessoas
- **Meta de produtividade = 60 processos/pessoa** (constante exibida em todos os gráficos como linha de referência; células < 60 destacadas em vermelho, ≥ 60 em verde)
- **Meta SLA = 95%** — valores < 95% destacados em vermelho
- **Projeção 2º semestre**: média móvel de Jan–Abr × (1 + fator_sazonalidade/100) por mês de Jul–Dez, ajustável via slider/input
- **Realtime**: subscription Supabase → invalida React Query → gráficos atualizam sem refresh

## Dashboard Principal (modo apresentação)
Slides verticais com snap-scroll, controles de navegação e fullscreen:
1. Capa + KPIs (volume total, produtividade média vs meta 60, % SLA geral)
2. Tendência de Volume (área Jan–Abr/26)
3. Produtividade mensal (barras com **linha de meta = 60**)
4. SLA Midea — radar com meta 95%
5. SLA BOSCH — radar/barras comparativas
6. Projeção 2º semestre (histórico + projetado, input de sazonalidade)
7. Gargalos e Riscos (cards por nível)
8. Plano de Ação (resumo por status)

## Design tokens (src/styles.css, oklch)
- `--primary` azul marinho
- `--secondary` cinza profissional
- `--accent` azul claro
- `--success` verde (acima da meta)
- `--destructive` vermelho (abaixo da meta)
- Tipografia: Inter

## Entregáveis (ordem de implementação)
1. Habilitar Lovable Cloud + Auth e-mail/senha
2. Migrations das 7 tabelas com RLS por `user_id`
3. Tokens de design + AppShell (sidebar 6 itens + header com logout)
4. `/login` + guard `_authenticated`
5. CRUD das 6 abas com forms validados
6. Dashboard apresentação com gráficos + meta 60 + projeção sazonal
7. Realtime subscriptions

Confirma para eu implementar?
