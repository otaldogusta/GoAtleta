# Periodização e contexto pedagógico

Base inspecionada: `d5120cff`, em 05/10/2026. Descreve a implementação local do
Go Atleta; estado remoto e eficácia pedagógica não são certificados por esta leitura.

## Responsabilidade e fluxo

Configurar ciclos da turma, traduzir objetivo e perfil em semanas/dias, modular
carga e gerar propostas coerentes com calendário, histórico e restrições.
O domínio calcula políticas e contexto; aplicação coordena planos e persistência;
as telas apresentam revisão, edição e confirmação do professor.

## Onde começar

| Arquivo | Responsabilidade |
| --- | --- |
| [periodization/index.tsx](../../../app/periodization/index.tsx) | Entrada da experiência de periodização. |
| [UnifiedPlanningWorkspace](../../../src/screens/periodization/UnifiedPlanningWorkspace.tsx) | Seleção e apresentação mensal/semanal/diária. |
| [PeriodizationManagerSheet](../../../src/screens/periodization/PeriodizationManagerSheet.tsx) | Configuração de ciclo e diagnóstico. |
| [cycles.ts](../../../src/db/cycles.ts) | Ciclos ativos/arquivados e escopo de organização. |
| [periodization.ts](../../../src/db/periodization.ts) | Planos semanais, perfil competitivo e exceções de calendário. |
| [periodization-policy.ts](../../../src/core/periodization-policy.ts) | Configuração válida, formatos de jogo e curvas de carga. |
| [periodization-generator.ts](../../../src/core/periodization-generator.ts) | Geração do ciclo. |
| [planning-cycle-window.ts](../../../src/core/planning-cycle-window.ts) | Janela anual/parcial e rótulo do ciclo. |
| [build-auto-plan-for-cycle-day.ts](../../../src/screens/periodization/application/build-auto-plan-for-cycle-day.ts) | Orquestração do plano do dia. |
| [cycle-day-planning](../../../src/core/cycle-day-planning/) | Prontidão, histórico, estratégia, guardas e traço de decisão. |
| [session-planning-context-contract.ts](../../../src/core/session-planning-context-contract.ts) | Parser versionado e compatibilidade do contexto compartilhado. |

## Contratos a preservar

- Toda escrita semanal requer `cycleId`; ausência é erro acionável. Compatibilidade
  com backend antigo não autoriza remover o vínculo dos novos planos.
- `getOrCreateInitialActivePlanningCycle` não recria um ciclo do ano que o professor
  arquivou. Arquivamento filtra organização; ativação de outro ciclo é deliberada.
- Existir registro técnico de ciclo não significa periodização configurada:
  usar `isClassPeriodizationConfigured` e seus critérios pedagógicos.
- Política tem `schemaVersion: 1`, limites normalizados e diagnóstico compatível.
  Formato de jogo e altura da rede não equivalem a domínio técnico ou intensidade.
- A janela usa datas locais de calendário. No ano atual a regra prefere janeiro
  a dezembro; em outro ano pode respeitar início parcial da turma.
- Contexto identifica turma, data, faixa etária e fundamento; o parser distingue
  `current`, `legacy` e `invalid`. Preservar snapshots e avisos de compatibilidade.
- Apoio documental inclui origem, revisão/hash, escopo e evidência; contrato
  `read_only` não se transforma em autorização de escrita pedagógica.
- Histórico ausente ou parcial não é execução confirmada. Regras de prontidão,
  modulação de carga e ajustes do professor continuam no domínio existente.

## Decisões atuais e histórico

O perfil canônico da turma alimenta geração mensal/semanal/diária; consultar
[turmas e planejamento](turmas-planejamento.md) quando mexer em perfil ou versões.
O [backlog de Cycle Day Planning](../../../docs/archive/cycle-day-planning/BACKLOG_AND_PR_CHECKLIST.md)
é histórico de implementação, não lista de funcionalidades por ativar.
O [guia pedagógico](../../../docs/pedagogy/README.md) documenta fundamentos e revisão
humana; presets e geradores no repositório não comprovam resultado pedagógico real.
O [assistente contextual](../../../docs/operations/planning-assistant-local.md)
é orientativo nesse fluxo e conserva seleção/fontes do pedido original.

## Validação seletiva

Testes localizados, para executar quando o respectivo contrato mudar:

- [escopo dos ciclos](../../../src/db/__tests__/cycles-workspace-scope.test.ts),
  [fallback de escrita](../../../src/db/__tests__/periodization-cycle-write-fallback.test.ts) e
  [política](../../../src/core/__tests__/periodization-policy.test.ts).
- [contexto versionado](../../../src/core/__tests__/session-planning-context-contract.test.ts),
  [prontidão](../../../src/core/__tests__/resolve-class-readiness-state.test.ts) e
  [coerência longitudinal](../../../src/screens/periodization/__tests__/weekly-session-longitudinal-coherence.test.ts).
- [salvamento semanal](../../../src/screens/periodization/__tests__/save-week-plan.test.ts) e
  [próximo ciclo](../../../src/screens/periodization/application/__tests__/next-cycle-draft.test.ts).

Aplicar a [escada de validação](../../../docs/operations/validation-ladder.md);
persistência/navegação pede org-scope e smoke autenticado com ciclo e data corretos.
Esta rodada verificou fontes e caminhos; não executou testes funcionais nem ativou ciclos.
