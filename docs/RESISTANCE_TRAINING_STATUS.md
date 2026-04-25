# Resistance Training Integration — Status

Estado consolidado da primeira fase da integração quadra + academia.

---

## Status atual

Frente implementada e funcional na base atual:

- renderização de sessão resistida na tela da aula
- header de contexto integrado da semana
- persistência de `weeklyIntegratedContextJson`
- persistência de `sessionEnvironment`, `sessionPrimaryComponent` e `sessionComponents`
- fallback seguro para planos antigos ou incompletos
- guard de elegibilidade para evitar academia formal em contexto inadequado
- especialização de template por ênfase física semanal e relação quadra × academia
- sinais QA observacionais no pipeline existente de observability

Em termos de produto, a academia deixou de ser só suporte arquitetural e passou a aparecer como parte do microciclo.

---

## O que já está implementado

### UI da sessão

- `SessionResistanceBlock` renderiza a sessão resistida com base nos tipos reais de `models.ts`
- `SessionContextHeader` mostra:
  - ambiente
  - foco físico
  - relação com a semana
  - transferência esperada
- a tela de sessão prefere dado persistido e usa preview apenas como fallback

### Persistência e leitura

- `ClassPlan.weeklyIntegratedContextJson` é salvo no semanal
- `DailyLessonPlan.sessionEnvironment` é salvo no diário
- `DailyLessonPlan.sessionPrimaryComponent` é salvo no diário
- `DailyLessonPlan.sessionComponents` é salvo no diário
- a UI consome dado persistido primeiro

### Guardrails pedagógicos

- academia disponível não implica academia prioritária
- voleibol iniciante/jovem não recebe academia formal automaticamente
- para iniciantes, o sistema mantém a semana como `quadra_dominante`
- quando a academia aparece em contexto inicial, ela entra como apoio motor/preventivo, não como foco principal

### Especialização do resistido

- `weeklyPhysicalEmphasis` influencia o template
- `courtGymRelationship` também influencia o template
- semanas com relações diferentes deixam de parecer a mesma ficha com nome diferente
- `transferTarget` e wording ficaram mais conectados ao papel da academia no microciclo

### QA observacional

O pipeline semanal de observability agora detecta também:

- `resistance_interference_risk`
- `resistance_transfer_weak`
- `resistance_balance_gap`

Esses sinais:

- não alteram geração
- não bloqueiam plano
- não recalibram academia automaticamente
- servem só como leitura QA da coerência quadra × academia

---

## O que está protegido pelo guard

Casos protegidos na implementação atual:

- turma `07-09` iniciante com academia disponível continua em `quadra`
- contexto jovem/iniciante não vira `academia_prioritaria`
- preview e persistência respeitam a mesma regra
- sessão antiga sem `sessionComponents` não quebra
- JSON semanal ausente ou inválido não quebra a tela

Frase-guia já refletida no motor:

`Academia disponível != academia prioritária`

---

## O que o QA observa hoje

### Interferência

Sinaliza quando a semana combina:

- treino resistido formal pesado de membros inferiores/potência
- alta demanda de salto na quadra

Leitura esperada:

`Confira se a recuperação e a distribuição da carga entre sessões está adequada.`

### Transferência fraca

Sinaliza quando a sessão resistida formal não mostra `transferTarget` explícito.

Leitura esperada:

`Vale deixar claro qual ação de jogo a academia pretende sustentar.`

### Equilíbrio estrutural

Sinaliza quando a semana fica muito concentrada em membros inferiores/potência sem apoio preventivo/core.

Leitura esperada:

`Verifique se há estabilidade e suporte estrutural suficientes na semana.`

---

## O que não fazemos ainda

Fora do escopo atual:

- editor completo de musculação
- biblioteca grande de exercícios
- recomendação que recalibra academia automaticamente
- `%1RM`, carga avançada, VBT ou prescrição avançada de S&C
- sistema de recommendation corretivo sobre os sinais QA
- planejamento de academia como app paralelo à quadra

---

## Próximos passos opcionais

### R9 — ajuste manual leve da sessão resistida

Próxima fase com melhor relação valor/risco:

- trocar exercício por alternativa segura
- ajustar séries, reps ou intervalo
- adicionar observação manual
- manter o template base e a lógica do microciclo

Não abrir isso como editor gigante de academia.

### Higiene técnica

Pendências pequenas, sem urgência funcional:

- limpar warnings antigos de `array-type` em `models.ts`
- manter testes de observability e resistência rodando como regressão da frente

---

## Resumo executivo

A primeira fase da integração resistida está fechada.

Hoje o app:

- representa academia como parte da semana
- mostra a sessão resistida como produto
- contextualiza a sessão no microciclo
- protege iniciantes de decisões agressivas
- especializa melhor o template formal
- observa coerência quadra × academia sem intervir no plano

O próximo passo, se houver nova fase, deve ser ergonomia de ajuste manual e não expansão indiscriminada do motor.
