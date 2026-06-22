## Objetivo
Habilitar SLA Bosch com cadastro/métricas por planta (21F0, 6854, W275), renomeando indicadores e adicionando KPIs operacionais mostrados na imagem. Dashboard principal passa a ter 3 gráficos (um por planta), no mesmo padrão do Midea.

## 1. Banco — migration em `sla_bosch`
- Adicionar coluna `planta text not null` com valores permitidos `21F0 | 6854 | W275`.
- Adicionar colunas numéricas para os KPIs extras (todas `numeric not null default 0`):
  - `proc_aereos`, `proc_maritimos`, `proc_canal_verde`, `proc_canal_vermelho` (contagens)
  - `tm_dig_conf_h` (tempo médio Dig/Conf em horas)
  - `tm_registro_dias` (tempo médio Registro, dias)
  - `tm_liberacao_dias` (tempo médio Liberação Transporte, dias)
- Trocar unique key: de `(user_id, mes)` para `(user_id, mes, planta)`.
- Indicadores existentes (`dig_conf`, `start_up`, `otcc`, `desvios`, `pinho`) permanecem — apenas relabelados na UI:
  - `dig_conf` → "Digitação/Conferência"
  - `start_up` → "Registro DI/DUIMP"
  - `otcc` → "Liberação Transporte"
  - `pinho` → "Pinho"
  - `desvios` → "Desvios"
- RLS já existente continua válida (escopo por `user_id`). GRANTs continuam os mesmos.

## 2. Constantes (`src/lib/constants.ts`)
- Adicionar `BOSCH_PLANTAS = [{ key: "21F0", label: "21F0" }, { key: "6854", label: "6854" }, { key: "W275", label: "W275" }]`.

## 3. Cadastro (`src/routes/_authenticated/sla-bosch.tsx`)
Substituir o placeholder por `<SlaView ...>` usando `table="sla_bosch"`, passando:
- `unidadeOptions = BOSCH_PLANTAS` (reutiliza o seletor de operação do `SlaView`, mas rotulado "Planta")
- `fields`: os 5 indicadores percentuais + 7 KPIs operacionais com os novos labels.

Pequeno ajuste no `SlaView` (`src/components/sla-view.tsx`):
- Aceitar prop opcional `unidadeLabel` (default "Operação") para renderizar "Planta" no formulário/tabela.
- Demais comportamentos (upsert, delete, realtime, comparação com `META_SLA = 90`) ficam iguais; o `onConflict` já usa `user_id,mes,unidade` quando há `unidadeOptions`, então mapeamos `planta` para a coluna `unidade`… **importante:** como a coluna no banco se chama `planta`, ajustar o `SlaView` para usar um prop `unidadeColumn` (default `"unidade"`) e passar `"planta"` no Bosch. Isso evita renomear a coluna no Midea.

## 4. Dashboard principal (`src/routes/_authenticated/index.tsx`)
- Query de `sla_bosch` passa a trazer também `planta` e os novos campos.
- Slide de SLA Bosch: substituir o gráfico único por **3 gráficos horizontais** (um para cada planta), no mesmo formato do SLA Midea — barras horizontais por indicador com linha vermelha tracejada em `META_SLA = 90`.
  - Cada card mostra o nome da planta + SLA médio dos 5 indicadores percentuais daquela planta no mês filtrado (ou média do período, se "Todos").
- KPI top-level "SLA Bosch" passa a ser a média geral das 3 plantas (mesma lógica atual, só recalculada sobre o universo filtrado).
- Filtros (mês global / mês local Bosch) continuam funcionando — os 3 gráficos respeitam o mesmo filtro.

## 5. Validação
- `bunx tsc --noEmit` limpo após migration + regeneração de tipos.
- Cadastrar uma linha em cada planta no preview; conferir que:
  - aparece na tabela do cadastro com a coluna "Planta",
  - os 3 cards no dashboard mostram os valores corretos,
  - a linha de meta 90% aparece em todos.

## Fora do escopo
- Visualização dedicada dos KPIs operacionais (Processos Aéreos, Tempo Médio, etc.) no dashboard — por enquanto só são armazenados/exibidos na tela de cadastro. Se quiser cards desses indicadores no dashboard, fazemos numa próxima rodada.