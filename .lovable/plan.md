# Remover o PDI por completo

## Resultado
- Retirar o PDI do menu lateral e excluir sua página.
- Remover do Dashboard Gestão todos os indicadores, alertas, consultas e textos ligados ao PDI.
- Manter o Dashboard focado em Equipes, Funcionários e Scorecard, inclusive a visão por colaborador.
- Remover menções ao PDI em insights automáticos.

## Dados removidos
- Excluir definitivamente os dados e estruturas exclusivas do PDI:
  - `pdi` e o tipo `pdi_status`;
  - `planos_desenvolvimento`;
  - `atividades_desenvolvimento`;
  - `avaliacoes_pdi`.
- Remover primeiro as tabelas dependentes e depois as tabelas principais.
- Atualizar as tipagens após a alteração.

## Compatibilidade
- Remover referências antigas ao Check IN Operacional que ainda afetam o Dashboard por Operação.
- Preservar Equipes, Funcionários, Scorecard e todos os demais módulos.

## Validação
- Confirmar que o PDI não aparece no menu nem possui página acessível.
- Confirmar que Dashboard Gestão, Scorecard, Insights e Dashboard por Operação abrem sem erros.
- Confirmar compilação íntegra e ausência das quatro tabelas no banco.

## Nota técnica
A exclusão física é destrutiva. Se a proteção do banco bloquear a remoção automática, o código será concluído e o script exato será disponibilizado para execução manual no editor do banco.
