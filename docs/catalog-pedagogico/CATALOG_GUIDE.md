# Guia do Catalogo Pedagogico

## Objetivo

Padronizar como novas familias e variantes entram no catalogo sem criar duplicacao, linguagem adulta indevida ou exercicios desalinhados da periodizacao.

## Estrutura base

O catalogo local usa familias pedagogicas, e nao exercicios isolados.

Tipos principais:

- `ActivityCatalogFamily`
- `ActivityCatalogVariant`
- `ActivityCatalogTaxonomy`
- `ActivityCatalogRecommendation`
- `ActivityCatalogSelectionReason`

Cada `ActivityCatalogFamily` agrupa uma intencao pedagogica reutilizavel. Cada `ActivityCatalogVariant` representa uma forma aplicavel dessa familia para determinada idade, dificuldade, fase do jogo e momento da aula.

## Taxonomia obrigatoria

Toda variante deve declarar `taxonomy` completa com:

- `skill`
- `gamePhase`
- `pedagogicalIntent`
- `complexity`
- `ageRange`
- `format`
- `environment`
- `cognitiveDemand`
- `physicalDemand`
- `recommendedPhase`
- `periodizationCompatibility`
- `progressionCompatibility`
- `loadCompatibility`
- `families`

Use `recommendedPhase`. Nao introduza `requiredPhase`, porque o mesmo exercicio pode funcionar em aquecimento, parte principal ou adaptacao dependendo do contexto.

## Compatibilidade de periodizacao

As variantes devem declarar compatibilidade explicita com uma ou mais fases:

- `exploracao_fundamentos`
- `estabilizacao_tecnica`
- `aceleracao_decisao`
- `transferencia_jogo`
- `pressao_competitiva`

A regra pedagogica e simples: um exercicio bom, mas desalinhado ao foco da semana, nao deve superar uma opcao tecnicamente coerente com o plano.

## Campos de execucao

Cada variante tambem deve conter informacoes suficientes para virar um `ActivityKnowledgePattern` operacional:

- `name`
- `players`
- `setup`
- `starter`
- `action`
- `rotation`
- `constraint`
- `scoring`
- `progression`
- `commonMistakes`
- `adaptations`
- `avoid`
- `materials`
- `space`

Esses campos existem para manter a atividade aplicavel em quadra, com organizacao, execucao, rotacao, criterio e adaptacao claros.

## Regras de modelagem

- Nome da familia deve expressar a intencao pedagogica, nao uma marca ou fonte externa.
- Variante deve ser original do GoAtleta.
- Nao usar texto comercial, nomes, descricoes ou links de VolleyballXL no codigo.
- Preferir familias reutilizaveis como continuidade, sideout, cobertura, recepcao, alvo, decisao ou transicao.
- Nao criar variante que dependa de fila longa ou professor alimentando todos os alunos.
- Para faixas fundamentais, usar linguagem concreta e curta; evitar linguagem clinica, adulta ou taticamente abstrata.
- Para forca preventiva integrada, manter a atividade como suporte pedagogico ao voleibol, nao como treino resistido paralelo.

## Como adicionar uma familia

1. Verificar se a intencao ja existe em outra familia.
2. Definir `id`, `name`, `summary` e `source: "goatleta_original"`.
3. Criar pelo menos uma variante completa.
4. Garantir que `families` contenha tags pedagogicas pesquisaveis.
5. Rodar os testes do catalogo.

## Como adicionar uma variante

1. Escolher a familia correta.
2. Declarar taxonomia completa.
3. Preencher campos de execucao sem texto generico.
4. Checar adequacao por idade, carga, ambiente e materiais.
5. Conferir se a variante nao duplica outra por skill, faixa, fase e nome.

## Checklist de revisao

- A variante tem taxonomia completa.
- A variante usa `recommendedPhase`, nao `requiredPhase`.
- A compatibilidade de periodizacao esta coerente com o objetivo.
- O texto e original do GoAtleta.
- O exercicio funciona sem fila longa.
- A linguagem respeita a faixa etaria.
- O mapeamento para o motor nao exige decisao manual extra.
