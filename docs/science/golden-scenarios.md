# Golden Scenarios do GoAtleta

Golden Scenarios sao cenarios esportivos completos usados para validar se o
GoAtleta toma decisoes coerentes no conjunto, nao apenas se uma funcao isolada
passa em teste unitario.

Eles combinam:

- contexto da turma;
- calendario competitivo;
- intervencoes do professor;
- scouting recente;
- carga planejada;
- Evidence Matrix;
- preservacao de override manual.

## Como rodar

```bash
npm run test:science-scenarios
```

## Cenarios iniciais

### El Cartel pos-amistoso: recepcao e cobertura

Valida se um amistoso recente com recepcao sob pressao e cobertura falha gera
foco em recepcao contextualizada e cobertura/transicao, sem aumentar carga.

### El Cartel pre-amistoso com intervencao tatica

Valida se um jogo em 24h e uma intervencao tatica recente geram modo pre-jogo,
reducao/manutencao conservadora da carga, foco em organizacao coletiva e
comunicacao, e restricoes contra fadiga excessiva.

### Turma 07-09 sem trava de carga baixa

Valida se uma turma infantil usa idade como teto de seguranca, permitindo carga
moderada controlada em semana de desenvolvimento, sem gerar carga alta como
padrao.

### Scouting com amostra pequena

Valida se poucas acoes isoladas nao geram impacto forte nem sequestram o foco da
semana.

### Plano manual preservado com scouting

Valida se um plano editado pelo professor nao e sobrescrito por scouting recente,
mas ainda recebe rastreabilidade como recomendacao.

## Como adicionar novos cenarios

Adicione um item em `src/core/scenarios/golden-scenarios.ts` com:

- `id`, `label` e `description` claros;
- entradas reais ou plausiveis de quadra;
- expectativas explicitas;
- `expectedEvidenceRuleIds` existentes na Evidence Matrix.

Nao invente fonte bibliografica no cenario. Se uma regra exigir base nova, ela
deve entrar primeiro na Evidence Matrix com `reviewRequired: true` quando a fonte
ainda nao estiver revisada.

## Diferenca para teste unitario

Teste unitario responde se uma funcao local funciona.

Golden Scenario responde se o sistema inteiro tomou uma decisao que um treinador
aceitaria para aquele contexto.

## DecisionReport

Os Golden Scenarios validam comportamento. O `WeekDecisionReport` consolida a
explicacao desse comportamento em um objeto futuro-ready para UI e PDF.

Ele nao e uma nova regra e nao substitui a Evidence Matrix. Ele agrega contexto,
scouting, intervencoes, foco/carga e `EvidenceTrace` para que telas como
Periodizacao, Aula do Dia e relatorios possam explicar a decisao sem recalcular
nem inventar justificativas.
