# Exemplos de Catalogo e Snippets

## Objetivo

Mostrar exemplos compactos de como o catalogo local deve ser lido e expandido.

## Familias iniciais

O catalogo local ja trabalha com familias originais do GoAtleta, como:

- continuidade com tres contatos;
- troca continua com tarefa dupla;
- sideout de saque e recepcao;
- defesa e cobertura fora de sistema;
- ataque em transicao para zona livre;
- forca preventiva integrada.

Essas familias cobrem idades, dificuldades e intencoes diferentes sem duplicar exercicios soltos.

## Exemplo de variante

```ts
{
  id: "catalog-sideout-drill-recepcao",
  taxonomy: {
    skill: "passe",
    gamePhase: "saque_recepcao",
    pedagogicalIntent: "technical_adjustment",
    complexity: "moderada",
    ageRange: ["transition", "formation"],
    format: "cooperacao",
    environment: "quadra",
    cognitiveDemand: "media",
    physicalDemand: "media",
    recommendedPhase: "main",
    periodizationCompatibility: ["estabilizacao_tecnica", "aceleracao_decisao"],
    progressionCompatibility: ["precisao", "tomada_decisao"],
    loadCompatibility: ["moderado"],
    families: ["sideout", "recepcao", "alvo_zona"],
  },
  name: "Recepcao para organizar sideout",
}
```

## Exemplo de mapeamento

```ts
const catalogVariantToKnowledgePattern = (
  variant: ActivityCatalogVariant
): ActivityKnowledgePattern => ({
  id: variant.id,
  skill: variant.taxonomy.skill,
  stage: variant.taxonomy.recommendedPhase,
  ageStages: variant.taxonomy.ageRange,
  families: variant.taxonomy.families,
  periodizationFit: variant.periodizationFit,
  name: variant.name,
  players: variant.players,
  setup: variant.setup,
  starter: variant.starter,
  action: variant.action,
  rotation: variant.rotation,
  constraint: variant.constraint,
  scoring: variant.scoring,
  progression: variant.progression,
  commonMistakes: variant.commonMistakes,
  adaptations: variant.adaptations,
  avoid: variant.avoid,
  materials: variant.materials,
  space: variant.space,
  catalogTaxonomy: variant.taxonomy,
});
```

## Exemplo de recomendacao explicavel

```ts
const recommendations = recommendActivityCatalogVariants({
  primarySkill: strategy.primarySkill,
  secondarySkill: strategy.secondarySkill,
  ageStage,
  phaseIntent: cycleContext.phaseIntent,
  progressionDimension: strategy.progressionDimension,
  pedagogicalIntent: strategy.pedagogicalIntent,
  loadIntent: strategy.loadIntent,
  recentActivityFamilies,
  materials: cycleContext.materials,
  recentDifficulties,
});
```

O resultado esperado e uma lista de `ActivityCatalogRecommendation`, com `variant`, `score` e `reasons`.

## Exemplo de auditoria

```ts
const audit = auditActivityCatalog();

console.log(audit.bySkill);
console.log(audit.byAgeRange);
console.log(audit.byPedagogicalIntent);
console.log(audit.byPeriodizationCompatibility);
console.log(audit.gaps);
```

Use a auditoria antes de expandir muito o catalogo. Ela ajuda a revelar excesso de uma habilidade e lacunas por idade, intencao ou fase.

## Snippet para o indice

Adicionar em `docs/README.md`, na secao "Produto e pedagogia":

```md
| Catalogo pedagogico operacional | [catalog-pedagogico/README.md](catalog-pedagogico/README.md) |
```
