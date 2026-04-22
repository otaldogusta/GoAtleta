# Roadmap GoAtleta

Documento vivo de execucao do produto.

Norte atual:

- a inteligencia existe para melhorar a geracao
- a periodizacao precisa ser perceptivel no plano
- QA observa e orienta leitura interna, mas nao controla o motor
- professor continua como autoridade final

## Prioridade por trilha

### Trilha A — Nucleo do produto

Prioridade maxima.

Foco:

- gerador de plano
- periodizacao
- coerencia semana -> sessao -> tarefa -> fechamento

### Trilha B — Inteligencia observacional

Prioridade media.

Foco:

- warnings e leitura macro do ciclo
- recommendation como apoio ao plano
- evidence como memoria observacional

### Trilha C — QA avancado

Prioridade controlada.

Foco:

- mostrar o que ajuda a calibrar o gerador
- evitar inflacao de cards ou arquitetura paralela

## Backlog Executivo

## Bloco 1 — Valor direto no produto

### 1. Reforcar papel da sessao na geracao

Prioridade: P0

Objetivo:

- deixar explicito se a sessao e exploracao, consolidacao, pressao, transferencia ou sintese

Arquivos-alvo:

- app/periodization/index.tsx
- src/core/
- src/screens/periodization/
- eventuais builders de plano semanal e de sessao

Ganhos esperados:

- menos sensacao de plano generico
- identidade semanal mais clara
- leitura mais rapida pelo professor

Risco:

- reforcar texto sem reforcar estrutura real da sessao

DoD:

- titulo, objetivo, bloco principal e fechamento comunicam o papel da sessao
- diferenca perceptivel entre sessoes da mesma semana

### 2. Reforcar progressao trimestral perceptivel

Prioridade: P0

Objetivo:

- fazer o professor sentir no plano a diferenca entre inicio, meio e fechamento do trimestre

Arquivos-alvo:

- src/core/periodization.ts
- src/core/sessionGenerator.ts
- app/periodization/

Ganhos esperados:

- periodizacao deixa de ser invisivel
- tarefas, restricoes e wording passam a refletir o momento do ciclo

Risco:

- mudar apenas wording e manter comportamento real muito parecido

DoD:

- fechamento trimestral fica perceptivel no objetivo, na tarefa e no fechamento
- ha contraste claro entre semanas de inicio e de fechamento

### 3. Reforcar fechamento trimestral perceptivel

Prioridade: P0

Objetivo:

- dar cara real de fechamento a semanas de sintese e aplicacao

Arquivos-alvo:

- src/core/periodization.ts
- src/screens/periodization/application/
- app/periodization/

Ganhos esperados:

- professor entende quando a semana esta fechando um ciclo
- coerencia entre closing type e plano entregue

Risco:

- fechamento virar cosmetico ou repetitivo

DoD:

- closing type afeta tarefa dominante, criterio de exito e linguagem final

### 4. Anti-repeticao funcional real

Prioridade: P0

Objetivo:

- impedir plano reciclado com troca cosmetica de texto

Arquivos-alvo:

- src/core/sessionGenerator.ts
- src/core/
- data/imports/

Ganhos esperados:

- variacao com coerencia
- fingerprints mais uteis
- menos repeticao de familias de tarefa

Risco:

- aumentar variedade sem manter progressao pedagogica

DoD:

- repeticao consecutiva injustificada cai
- contraste funcional entre semanas aumenta sem perder eixo

## Bloco 2 — Governanca do nucleo

### 5. Check de alinhamento entre plano gerado e recommendation

Prioridade: P1

Objetivo:

- recommendation deixar de parecer comentario paralelo

Arquivos-alvo:

- src/db/observability-summaries.ts
- src/screens/periodization/hooks/usePeriodizationDerivedState.ts
- src/screens/periodization/WeekTab.tsx
- app/periodization/index.tsx

Ganhos esperados:

- mais confianca no sistema
- recommendation passa a parecer leitura do plano real

Risco:

- produzir score bonito sem efeito pratico de leitura

DoD:

- QA indica quando o plano, o eixo dominante e a recommendation convergem ou divergem

### 6. Eixo dominante do periodo como driver interno mais forte

Prioridade: P1

Objetivo:

- usar a leitura macro do eixo para reforcar tema semanal e decisao dominante de geracao

Arquivos-alvo:

- src/core/periodization.ts
- src/core/sessionGenerator.ts
- src/db/observability-summaries.ts

Ganhos esperados:

- o plano passa a cheirar ao eixo dominante
- menos drift entre leitura observacional e comportamento do gerador

Risco:

- antecipar controle do motor cedo demais

DoD:

- eixo dominante informa framing interno de geracao sem bloquear recommendation valida

### 7. Acute vs structural como leitura macro do ciclo

Prioridade: P1

Objetivo:

- distinguir ruido recente de padrao cronico

Arquivos-alvo:

- src/db/observability-summaries.ts
- src/screens/periodization/WeekTab.tsx

Ganhos esperados:

- menos reacao precipitada
- leitura de ciclo mais madura

Risco:

- janela curta e media mal calibradas para turmas com pouco historico

DoD:

- QA consegue mostrar se o problema atual e agudo ou estrutural

## Bloco 3 — QA como apoio

### 8. Digest final por turma

Prioridade: P2

Status:

- concluido na Fase 3.7

Objetivo:

- resumir a turma em uma leitura curta e util para calibracao interna

### 9. Persistence + early warning

Prioridade: P2

Status:

- concluido na Fase 3.6

Objetivo:

- detectar instabilidade macro sem intervir automaticamente

### 10. Timeline e transicao de eixo

Prioridade: P2

Status:

- concluido na Fase 3.5

Objetivo:

- dar contexto temporal para a leitura macro da turma

## O que fica congelado por enquanto

- learning adaptativo que altera o builder automaticamente
- calibration forte por confidence
- cohorts sofisticados por contexto
- inteligencia organizacional
- multimodalidade avancada
- qualquer camada que esconda recommendation
- qualquer camada que faca QA controlar o motor

## Plano pratico de 30 dias

### Semana 1

- reforcar papel da sessao
- revisar titulos, objetivos e blocos
- reduzir sensacao de plano generico

### Semana 2

- reforcar progressao trimestral perceptivel
- reforcar fechamento trimestral
- aumentar contraste entre momentos do ciclo

### Semana 3

- implementar anti-repeticao funcional
- fechar check de alinhamento eixo x plano x recommendation

### Semana 4

- usar digest e warnings como calibracao interna
- consolidar leitura acute vs structural
- evitar abrir novas frentes meta-arquiteturais
