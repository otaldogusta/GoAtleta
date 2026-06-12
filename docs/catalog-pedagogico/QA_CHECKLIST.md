# Checklist de QA e Criterios de Aceitacao

## Objetivo

Fornecer uma revisao humana curta para validar se o catalogo e as recomendacoes fazem sentido para professores.

## Perguntas obrigatorias

- Este exercicio faz sentido para esta turma agora?
- A idade da turma consegue entender a consigna?
- A atividade evita fila longa e gargalo no professor?
- O objetivo tecnico aparece na execucao, e nao so no titulo?
- A progressao esta coerente com a semana?
- A recomendacao explica por que foi escolhida?

## Criterios pedagogicos

- Forma de jogo adequada a idade.
- Linguagem concreta para faixas fundamentais.
- Intencao pedagogica visivel na tarefa.
- Progressao possivel sem trocar toda a organizacao.
- Participacao alta.
- Materiais realistas para quadra escolar ou clube.
- Carga fisica e cognitiva coerentes com a sessao.

## Gatilhos de reprovacao

- Texto copiado de fonte comercial.
- Uso de `volleyballxl` no catalogo executavel.
- `requiredPhase` em vez de `recommendedPhase`.
- Exercicio depende de uma fila unica.
- Crianças recebem linguagem adulta, clinica ou excessivamente tatica.
- Atividade contradiz o foco da periodizacao.
- Recomendacao nao traz motivo legivel.

## QA tecnico

- `activity-catalog.test.ts` passa.
- `humanized-volleyball-lesson.test.ts` passa.
- `build-auto-plan-for-cycle-day.test.ts` passa.
- `typecheck:core` passa.
- `decisionTrace.schemaVersion` segue `1`.
- Nenhuma migration nova foi criada.
- Nenhum arquivo de UI foi alterado nesta etapa documental.

## Resultado da rodada

Uma rodada de QA deve classificar o pacote como:

- aprovado;
- aprovado com ajuste textual;
- reprovado por modelagem;
- reprovado por risco pedagogico.

Quando houver reprovacao, corrija primeiro a familia ou taxonomia. Ajustar apenas o texto final do exercicio costuma mascarar o problema real.
