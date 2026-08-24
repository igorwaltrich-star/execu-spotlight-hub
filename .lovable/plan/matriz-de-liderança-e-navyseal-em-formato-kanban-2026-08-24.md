# Matriz de Liderança e NavySeal em formato Kanban

Transformar as duas abas em quadros Kanban onde **todos os colaboradores cadastrados já aparecem automaticamente** em um quadro, e a classificação é feita apenas arrastando o card para a coluna desejada.

## Como vai funcionar

- Ao abrir a aba, todo colaborador cadastrado aparece como um card.
  - Quem já tem classificação salva aparece na coluna correspondente.
  - Quem ainda não tem é posicionado automaticamente na coluna padrão:
    - Matriz de Liderança: "Zona de Desenvolvimento"
    - NavySeal: "B-Player"
- Arrastar um card para outra coluna salva a classificação na hora (cria o registro se ainda não existir, atualiza se já existir). Toast de confirmação e atualização em tempo real como hoje.
- Cada coluna mostra o contador de colaboradores e destaca visualmente quando um card está sendo arrastado sobre ela.
- Observações continuam existindo: clicar no card abre o diálogo atual para editar observação e classificação (útil em telas de toque).
- Em telas pequenas, as colunas rolam horizontalmente; o diálogo continua sendo a alternativa ao arrastar.

## Layout dos quadros

```text
Matriz de Liderança (4 colunas)
[ Alta Performance ] [ Zona de Desenvolvimento ] [ Zona de Risco ] [ Zona de Desalinhamento ]

NavySeal (3 colunas)
[ A-Player ] [ B-Player ] [ C-Player ]
```

## Detalhes técnicos

- Arquivos alterados: `src/components/gestao/matriz-lideranca.tsx` e `src/components/gestao/navy-seal.tsx`. Nenhuma outra tela é tocada.
- Drag and drop com a API nativa do HTML5 (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) — sem nova dependência.
- Os cards vêm de `useColaboradores()` combinados com as linhas existentes de `matriz_lideranca` / `navy_seal`; colaborador sem linha é tratado como "não classificado" na coluna padrão (sem gravar nada no banco até o primeiro arraste).
- Ao soltar: `insert` (com `user_id`) quando não há registro, `update` quando há. Sem mudanças de schema, RLS ou migrations.
- Botão excluir passa a ser "remover classificação" no card (volta para a coluna padrão), mantendo a mutação de delete atual.
