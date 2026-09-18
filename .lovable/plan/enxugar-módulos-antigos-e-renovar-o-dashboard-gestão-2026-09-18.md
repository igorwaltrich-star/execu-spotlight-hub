# Enxugar módulos antigos e renovar o Dashboard Gestão

## Objetivo
Manter o **Dashboard Gestão** focado apenas em **Equipes, Funcionários, Scorecard e PDI**, removendo definitivamente páginas, consultas e estruturas das abas já retiradas do menu.

## Dashboard Gestão
- Substituir os indicadores atuais de atividades, metas, revisões e check-ins por dados das quatro áreas mantidas.
- Exibir visão consolidada com:
  - total de colaboradores, equipes ativas, distribuição por equipe/área e acessos ativos;
  - ciclo mais recente do Scorecard, avaliações concluídas, média geral, destaques e desempenho por dimensão;
  - PDIs por status, progresso médio, prazos vencidos/próximos e atividades de desenvolvimento pendentes;
  - ranking/resumo por colaborador combinando equipe, Scorecard e evolução do PDI quando houver dados.
- Manter filtro por equipe e estados vazios claros quando ainda não houver avaliações ou PDIs cadastrados.

## Remoção definitiva das abas antigas
Excluir as rotas e telas de:
- Check IN Operacional;
- Minha Semana;
- Atividades;
- Revisão Semanal;
- Metas;
- Check IN Gerencial;
- Projetos;
- Relatórios.

Excluir do banco, com seus dados e vínculos, as estruturas exclusivas desses módulos:
- `checkins_operacionais`;
- `checkins_gerenciais` e `checkin_gerencial_itens`;
- `atividades` e `ocorrencias_atividade`;
- `metas` e `resultados_meta`;
- `revisoes_semanais`;
- `projetos` e `projeto_atividades`.

A conferência atual encontrou **zero registros** nessas tabelas. Relatórios não possui tabela própria.

## Ajustes de dependências
- Refatorar o Scorecard para calcular e apresentar resultados apenas com suas próprias tabelas, registros de produtividade e dados operacionais mantidos, eliminando dependências de atividades e revisões.
- Remover de Insights e Panorama Real qualquer leitura de Check IN Operacional, preservando os demais indicadores dessas telas.
- Remover notificações, links, gatilhos e referências de código ligados às páginas excluídas.
- Preservar integralmente Equipes, Funcionários, Scorecard, PDI e suas tabelas.

## Técnica e segurança
- Aplicar uma migration destrutiva e explícita, removendo dependências antes das tabelas principais.
- Atualizar as tipagens do banco após a remoção.
- Garantir que nenhuma rota, consulta ou navegação continue apontando para as estruturas eliminadas.

## Validação
- Validar o Dashboard Gestão com dados e estados vazios das quatro áreas mantidas.
- Validar criação, edição e leitura em Equipes, Funcionários, Scorecard e PDI.
- Validar Insights e Panorama Real sem Check IN Operacional.
- Confirmar navegação sem links antigos, ausência de erros e compilação íntegra.
