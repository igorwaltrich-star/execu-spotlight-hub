
## Objetivo

Adicionar módulo NOVO e ISOLADO **Gerenciamento Operacional**, sem alterar rotas/componentes/tabelas existentes. Apenas pontos de toque:

1. `src/components/app-shell.tsx` → append 1 item no array `NAV`.
2. Migration nova no Supabase (apenas CREATE, nenhum ALTER em tabelas existentes).
3. `bun add react-dropzone` (dep nova).

Todo o resto = arquivos novos.

---

## 1. Rotas e estrutura de arquivos (novos)

```text
src/routes/_authenticated/
  gerenciamento-operacional.tsx          ← Tabs principais (7 abas)

src/components/gestao/
  performance-operacional.tsx            ← Upload + IA (mock)
  escala-home-office.tsx
  controle-ferias.tsx
  matriz-lideranca.tsx
  navy-seal.tsx
  pdi.tsx
  ferramentas-gestao.tsx                 ← Tabs verticais
  ferramentas/
    ishikawa.tsx
    pareto.tsx
    cinco-porques.tsx
    cinco-w-dois-h.tsx
    swot.tsx

src/lib/
  performance-ia.functions.ts            ← server fn mock (setTimeout 3s)
```

Item no menu: `{ to: "/gerenciamento-operacional", label: "Gerenciamento Operacional", icon: Briefcase }`, inserido após "Oportunidades e Riscos". Nada existente é tocado.

---

## 2. Aba 1 — Performance Operacional (Upload + IA)

- Drag-and-drop com `react-dropzone` aceitando `.xlsx`, `.csv`, `.pdf` (até 10MB). Lista de arquivos aceitos com remover.
- Botão **"Analisar com IA"** dispara estado `analyzing` → spinner (`Loader2`) + texto "Analisando dados e gerando insights...".
- Backend: `analyzePerformanceReport` (createServerFn POST) que hoje retorna mock após `await new Promise(r => setTimeout(r, 3000))`. Estrutura de retorno preparada para futura troca pela Edge Function `analyze-performance-report`:

```ts
{
  resumo: string,
  pontosCriticos: { titulo: string; descricao: string; severidade: "alta"|"media" }[],
  oportunidades: { titulo: string; descricao: string; acao: string }[],
}
```

- Layout de resultados em 3 Cards verticais:
  - **Resumo Executivo** (texto corrido, ícone `FileText`).
  - **Pontos Críticos / Gargalos** — lista com `AlertCircle` vermelho (`text-destructive`), Badge de severidade.
  - **Oportunidades e Plano de Ação** — lista com `Lightbulb`/`CheckCircle2` (`text-success`/`text-primary`).
- Persistência opcional: salvar cada análise em `analises_performance` (ver migração) para histórico.

Observação: por enquanto NÃO criar Edge Function nem chamar OpenAI — apenas o mock no server fn, conforme pedido.

---

## 3. Demais abas (CRUD shadcn + Supabase)

Cada uma: `Card` + `Table` + `Dialog` de cadastro/edição + `useQuery`/`useMutation` no padrão de `cadastro-oportunidades.tsx`.

- **Escala Home Office**: Colaborador, Dias da Semana (multi-select Seg–Sex), Status (Ativo/Pausado, Badge).
- **Controle de Férias**: Colaborador, Período Aquisitivo (início/fim), Previsão Saída, Retorno, Saldo de Dias.
- **Matriz de Liderança**: Grid de cards (ou tabela) com Badge classificatória — cores via tokens: Alta perf→success, Zona desenvolvimento→primary, Zona risco→warning, Zona desalinhamento→destructive.
- **NavySeal**: idem com A→success, B→secondary, C→destructive.
- **PDI**: Colaborador, Meta, Prazo, Status (não iniciado/em andamento/concluído/atrasado).

---

## 4. Aba "Ferramentas de Gestão"

`Tabs` em `orientation="vertical"` (lista à esquerda, conteúdo à direita):

- **Ishikawa**: campo Efeito + 6 textareas categorizadas (Método, Máquina, Mão-de-obra, Materiais, Medida, Meio Ambiente), cada uma armazenada como `text[]`.
- **Pareto**: tabela editável (Causa, Frequência). Espaço com placeholder "Gráfico 80/20" (futuro Recharts) — sem implementar gráfico agora, só o slot preparado.
- **5 Porquês**: Problema + 5 inputs encadeados + Causa Raiz.
- **5W2H**: Tabela com colunas What, Why, Where, When (date), Who, How, How Much (numeric).
- **SWOT**: Grid 2x2 (`grid-cols-2 gap-4`), cada quadrante = Card colorido suave com lista editável.

---

## 5. Banco de Dados (migration única)

Padrão para todas: `id uuid pk`, `user_id uuid not null`, `created_at`, `updated_at`, RLS habilitada + 4 policies `own_*` com `user_id = auth.uid()`, trigger `set_updated_at` (função já existe).

Enums novos (sufixados para não colidir):
- `home_office_status` (`ativo`, `pausado`)
- `matriz_lideranca_tag` (`alta_performance`, `zona_desenvolvimento`, `zona_risco`, `zona_desalinhamento`)
- `navy_seal_tag` (`a_player`, `b_player`, `c_player`)
- `pdi_status` (`nao_iniciado`, `em_andamento`, `concluido`, `atrasado`)

Tabelas:

| Tabela | Campos de domínio |
|---|---|
| `colaboradores` | nome, cargo, area |
| `escala_home_office` | colaborador_id, dias_semana text[], status |
| `controle_ferias` | colaborador_id, periodo_inicio, periodo_fim, previsao_saida, retorno, saldo_dias int |
| `matriz_lideranca` | colaborador_id, tag, observacoes |
| `navy_seal` | colaborador_id, tag, observacoes |
| `pdi` | colaborador_id, meta, prazo, status |
| `analises_performance` | titulo, arquivos jsonb, resumo, pontos_criticos jsonb, oportunidades jsonb |
| `ishikawa` | efeito, metodo text[], maquina text[], mao_obra text[], materiais text[], medida text[], meio_ambiente text[] |
| `pareto` | titulo, causa, frequencia numeric |
| `cinco_porques` | problema, por_que_1..5, causa_raiz |
| `cinco_w_dois_h` | what, why, where, who, when date, how, how_much numeric |
| `swot` | titulo, forcas text[], fraquezas text[], oportunidades text[], ameacas text[] |

`colaborador_id` uuid simples (sem FK), seguindo padrão atual.

---

## 6. UI / Design

- 100% shadcn/ui: `Tabs`, `Card`, `Table`, `Badge`, `Dialog`, `Input`, `Select`, `Textarea`, `Button`, `Form`, `Loader2`.
- Reutiliza tokens semânticos existentes (`--success`, `--warning`, `--destructive`, `--primary`, `--muted`). Nenhuma alteração em `styles.css`.
- Lucide para ícones: `Briefcase`, `Upload`, `Sparkles`, `AlertCircle`, `Lightbulb`, `CheckCircle2`, `Target`, `Users`, `Calendar`, `Award`.

---

## 7. Garantias de não-regressão

- Zero edição em rotas/dashboards/componentes existentes (exceto append no `app-shell.tsx`).
- Zero alteração em tabelas/enums existentes.
- `routeTree.gen.ts` regenera automaticamente.
- Nenhuma migração mexe em `auth`, `storage`, `realtime`.

---

## 8. Ordem de execução

1. Migration Supabase (aguardar aprovação).
2. `bun add react-dropzone`.
3. Server fn mock `performance-ia.functions.ts`.
4. Componentes em `src/components/gestao/**`.
5. Rota `gerenciamento-operacional.tsx`.
6. Append no `app-shell.tsx`.
7. Verificar build.
