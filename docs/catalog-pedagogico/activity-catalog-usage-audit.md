# Activity Catalog Usage Audit

## Objetivo

A auditoria de uso e cobertura do Catalogo GoAtleta responde duas perguntas operacionais:

- o catalogo cobre bem os fundamentos, faixas e fases esperadas?
- quais variantes do catalogo aparecem em planos reais?

Ela serve para orientar proximas expansoes pedagogicas com dados derivados do sistema, nao para medir qualidade da aula, desempenho do professor ou sucesso pedagogico de uma atividade.

## Fontes

A auditoria usa somente fontes ja existentes:

- `ACTIVITY_CATALOG_FAMILIES`
- `ACTIVITY_CATALOG_VARIANTS`
- `TrainingPlan.pedagogy.blocks`
- `TrainingPlan.pedagogy.blocks.activities[].catalog`

O core nao busca Supabase, nao le sessao autenticada e nao cria persistencia propria. Quem precisar auditar uso deve carregar os planos fora do core e chamar:

```ts
const report = buildActivityCatalogAuditReport(trainingPlans);
```

## O que mede

- total de familias e variantes
- cobertura por fundamento
- cobertura por familia
- cobertura por idade/estagio
- cobertura por fase recomendada
- cobertura por complexidade
- lacunas criticas simples
- variantes usadas em `TrainingPlan`
- variantes nunca usadas nos planos informados
- uso por `variantId`, `familyId` e skill
- referencias desconhecidas ou antigas

## Fonte de verdade dos planos

`TrainingPlan.pedagogy.blocks` e a fonte primaria. Se `pedagogy.blocks` existir, a auditoria nao mistura `warmup`, `main` e `cooldown` legados.

Arrays legados entram apenas como fallback quando `pedagogy.blocks` estiver ausente. Esse fallback nao cria uso de catalogo, porque os arrays legados guardam apenas nomes.

## O que nao mede

- eventos de clique
- funil de produto
- analytics remoto
- desempenho do professor
- qualidade real da aula aplicada
- sucesso pedagogico da atividade
- dados de PDF
- `decisionTrace`

## Referencias desconhecidas

A auditoria nao deve quebrar com dados antigos. Quando encontra metadado de catalogo inconsistente, registra em `unknownCatalogReferences`:

- `invalidCatalogSource`
- `missingVariant`
- `missingFamily`

Isso permite revisar planos antigos ou variantes removidas sem interromper o app.

## Limites

Esta camada e derivada e local. Ela nao substitui o catalogo, nao altera planos e nao cria fonte paralela.

Para transformar esses dados em dashboard publico ou analytics remoto, criar uma branch separada depois de validar quais metricas realmente ajudam o time pedagogico.
