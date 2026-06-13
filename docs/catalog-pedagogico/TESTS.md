# Testes do Catalogo Pedagogico

## Objetivo

Garantir que o catalogo continue original, completo, auditavel e coerente com o motor de geracao.

## Comandos principais

```bash
npm test -- src/core/__tests__/activity-catalog.test.ts --runInBand
npm test -- src/core/__tests__/humanized-volleyball-lesson.test.ts --runInBand
npm test -- src/core/__tests__/build-auto-plan-for-cycle-day.test.ts --runInBand
npm run typecheck:core
```

Use `--runInBand` para as suites de core quando o ambiente local apresentar travamento em execucao paralela do Jest.

## Testes obrigatorios do catalogo

- Familias possuem variantes validas.
- Toda variante tem taxonomia completa.
- Nao ha texto com `volleyballxl`.
- Nao ha campo `requiredPhase` ou `required_phase`.
- Nao ha duplicacao grosseira por skill, idade, fase e nome.
- Auditoria retorna totais por habilidade, faixa etaria, intencao e compatibilidade de periodizacao.
- Anti-repeticao penaliza familias recentes.

## Testes obrigatorios do motor

- Periodizacao vem antes de preferencia generica por skill.
- Semana de passe ao alvo nao seleciona ataque ou bloqueio fora de contexto.
- Scouting fraco em recepcao favorece familias de passe e recepcao.
- Historico recente evita repetir a mesma familia.
- Faixas fundamentais nao recebem linguagem adulta ou clinica.

## Testes de integracao com auto-plan

- `activityCatalogRecommendations` e retornado com pelo menos uma recomendacao quando ha contexto suficiente.
- A primeira recomendacao tem skill coerente com `strategy.primarySkill`.
- Cada recomendacao traz `reasons`.
- `decisionTrace.schemaVersion` continua `1`.
- Scouting, feedback e historico continuam sendo registrados nos campos existentes.

## Verificacoes documentais

```bash
rg -n "<marcadores de citacao externa>|<ids de pesquisa>|<referencias a branch publica>|<lacunas de especificacao>" docs/catalog-pedagogico docs/README.md docs/expansao-catalogo-pedagogico.md
```

Resultado esperado: nenhum trecho relevante.

## Troubleshooting

Se o teste paralelo travar, rode a suite alvo com `--runInBand`.

Se um teste de passe acusar drift para levantamento, procure termos como `segundo contato`, `levantador` ou `distribuicao` em variantes cujo `skill` seja `passe`.

Se uma variante tecnicamente boa vencer uma variante alinhada a periodizacao, revise `periodizationCompatibility` e o peso de `scoreCatalogTaxonomy`.
