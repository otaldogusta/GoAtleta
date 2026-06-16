# Activity Catalog Insights

## Objetivo

Transformar a auditoria do Catalogo GoAtleta em sinais internos e acionaveis para evolucao pedagogica do catalogo.

Os insights ajudam a responder perguntas como:

- qual habilidade esta com baixa cobertura;
- qual habilidade tem cobertura, mas quase nao aparece nos planos;
- quais variantes precisam ser revisadas antes de novas expansoes;
- se ha referencias antigas ou inconsistentes em planos existentes;
- se o uso esta muito concentrado em uma unica habilidade.

## Fontes

A camada de insights recebe apenas `ActivityCatalogAuditReport`.

Esse relatorio ja deriva de:

- `ACTIVITY_CATALOG_FAMILIES`;
- `ACTIVITY_CATALOG_VARIANTS`;
- `TrainingPlan.pedagogy.blocks.activities[].catalog`;
- arrays legados apenas como fallback seguro quando `pedagogy.blocks` nao existe.

## O que gera

`buildActivityCatalogInsights(auditReport)` retorna um `ActivityCatalogInsightReport` com:

- lacunas de cobertura;
- lacunas de uso;
- variantes nunca usadas;
- referencias desconhecidas;
- concentracao excessiva de uso;
- insight global de linha de base quando ainda nao ha uso do catalogo.

Cada insight possui:

- prioridade: `high`, `medium` ou `low`;
- categoria;
- titulo em linguagem de produto;
- mensagem;
- evidencias;
- acoes sugeridas.

## Regras principais

- Referencias desconhecidas geram prioridade alta.
- Skills com 0 ou 1 variante geram lacuna alta.
- Skills com 2 variantes geram lacuna media.
- Skills com 3 ou mais variantes nao geram lacuna de cobertura.
- Skills com cobertura saudavel e zero uso geram lacuna de uso.
- Variantes nunca usadas sao agrupadas por habilidade.
- Quando nao ha uso nenhum, o painel mostra apenas uma linha de base e nao explode uma lista de variantes sem uso.
- Concentracao de uso aparece apenas quando ha pelo menos 5 usos auditados.

## O que nao faz

Esta camada nao:

- chama IA ou LLM;
- busca Supabase;
- cria analytics remoto;
- registra eventos de clique;
- salva metricas;
- altera planos;
- altera `TrainingPlan.pedagogy.blocks`;
- altera `decisionTrace`;
- altera o catalogo automaticamente;
- mede qualidade pedagogica real da aula.

## Limites

Os insights sao heuristicas deterministicas. Eles indicam sinais para revisao, nao verdades absolutas.

O painel deve ser usado como ferramenta interna de decisao: ajuda a priorizar proximas branches de catalogo, revisao de visibilidade, revisao de scoring e limpeza de referencias antigas.
