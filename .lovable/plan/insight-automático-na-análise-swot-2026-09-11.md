# Insight automático na Análise SWOT

Adicionar, no quadro Análise SWOT (Gerenciamento Operacional → Ferramentas de Gestão), um botão "Gerar insight com IA" que lê os dados operacionais e financeiros já cadastrados no sistema e devolve uma leitura pronta.

## O que o usuário vai ver

- Um botão **Gerar insight com IA** no topo do quadro SWOT.
- Ao clicar, a IA analisa os últimos 12 meses de dados já cadastrados e devolve:
  - um **texto de diagnóstico** (resumo executivo com números: volume, produtividade, custo por processo, SLA, perdas por não conformidade);
  - os **quatro quadrantes preenchidos** (Forças, Fraquezas, Oportunidades, Ameaças), cada item citando o número que o sustenta.
- O resultado aparece já no formulário, podendo ser editado antes de salvar, e o diagnóstico fica visível junto da análise salva.
- Se não houver dados suficientes cadastrados, o botão avisa em vez de inventar conteúdo.

## Dados usados na análise

- Volume, pessoas e produtividade por operação e por mês.
- Custo de pessoal mensal por operação (total, encargos, benefícios).
- Não conformidades: quantidade, custo gerado e valor recuperado.
- SLA Midea (por unidade) e SLA Bosch (por planta) contra a meta de 90%.
- Oportunidades e riscos cadastrados (savings e custos extras).

## Detalhes técnicos

- Nova coluna `insight text` (nullable) em `public.swot`, via migration, para guardar o diagnóstico junto da análise. Nenhuma coluna existente é alterada.
- Novo server function `src/lib/swot-ia.functions.ts` (`createServerFn`, POST) que:
  - consulta as tabelas acima no servidor (últimos 12 meses), agrega por operação e mês;
  - chama o Lovable AI Gateway com `openai/gpt-6-astra` pela Responses API em modo streaming, consumindo no servidor (`await result.text`), com saída estruturada estrita: `{ insight, forcas[], fraquezas[], oportunidades[], ameacas[] }`;
  - trata 402/429 com mensagem clara na interface, sem retry em erro terminal.
- `src/components/gestao/ferramentas/swot.tsx`: adiciona o botão, estado de carregamento, preenchimento do formulário com o retorno, campo de diagnóstico e exibição do `insight` nos cards salvos.
- Regra de ouro respeitada: nenhuma funcionalidade, tela ou componente existente é removido ou alterado em comportamento; apenas adições.
