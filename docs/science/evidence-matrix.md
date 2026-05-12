# Evidence Matrix do GoAtleta

A Evidence Matrix registra regras importantes do GoAtleta com tipo, confianca,
contexto de aplicacao, racional, limites e fontes.

Ela nao e UI e ainda nao altera a periodizacao, a Aula do Dia ou o scouting.
O objetivo e preparar rastreabilidade para snapshots futuros.

## Tipos de regra

- `scientific_principle`: principio cientifico geral.
- `evidence_informed`: regra orientada por evidencia, mas dependente de contexto.
- `operational_heuristic`: heuristica de produto/operacao para reduzir erro.
- `safety_guard`: limite de seguranca.
- `product_decision`: decisao de produto ou autoridade do professor.

## Fontes e revisao

O GoAtleta nao deve inventar referencia bibliografica.

Quando uma fonte ainda nao tiver revisao formal, ela deve usar:

- `type: "pending_reference"`
- `reviewRequired: true`

Fontes internas tambem podem ter `reviewRequired: true` quando ainda precisam ser
ligadas a referencias formais.

## Uso futuro

Proximos passos recomendados:

- adicionar `evidenceRuleIds` em `ScoutingImpact`;
- adicionar `evidenceRuleIds` em `TeamPlanningContext`;
- salvar `EvidenceTrace` nos snapshots de geracao;
- mostrar evidencias na periodizacao em "Por que esta semana mudou?".

## EvidenceTrace nas decisoes

`EvidenceTrace` e o formato minimo para ligar uma decisao a regras da matriz:

- `evidenceRuleIds`: regras aplicadas;
- `evidenceSummary`: resumo legivel de cada regra;
- `confidence`: confianca das regras usadas.

Uso atual:

- `ScoutingImpact` gerado automaticamente pode carregar `evidenceTrace`;
- `generationContextSnapshotJson.scoutingImpact.evidenceTrace` guarda as regras
  usadas na adaptacao semanal por scouting.
- a tela de periodizacao interpreta esse snapshot e mostra o bloco
  "Por que esta semana mudou?" quando houver rastreabilidade de scouting.

Essa UI nao mostra JSON nem ids internos para o professor. Ela resolve os ids pela
Evidence Matrix, exibe sinais usados, focos adicionados, ajuste de carga quando
houver e a base aplicada com tipo de regra e confianca.

## WeekDecisionReport

`WeekDecisionReport` e uma camada intermediaria entre motor e UI/PDF. Ele nao cria
novas regras cientificas. Ele apenas agrega:

- contexto competitivo;
- intervencoes do professor;
- sinais de scouting;
- foco/carga do plano semanal;
- `EvidenceTrace`;
- preservacao de override manual.

Essa agregacao evita que telas futuras precisem remontar justificativas de forma
solta ou inventar evidencias. A fonte continua sendo a Evidence Matrix e os
snapshots ja gravados pelo motor.
