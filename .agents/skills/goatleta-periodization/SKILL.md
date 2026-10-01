---
name: goatleta-periodization
description: Alterar planejamento anual, mensal, semanal e Aula do Dia do Go Atleta preservando ciclos, planos aplicados, histórico e decisões do professor.
---

# Periodização e Aula do Dia

Todos os caminhos são relativos à raiz. Antes de editar, rastrear o caso de uso pelos modelos reais; não impor a hierarquia macro/meso/micro como um novo schema.

## Pontos de entrada

- `src/core/models.ts`: contratos de turma, planejamento e execução; inclui modos `cycle_based` e `class_based_bootstrap`.
- `src/core/periodization.ts`, `periodization-policy.ts`, `periodization-load.ts` e `periodization-snapshots.ts`: regras e snapshots.
- `src/core/cycle-day-planning/`: contexto diário, âncora da aula, carga, histórico e overrides.
- `src/db/cycles.ts` e `src/db/periodization.ts`: ciclo, persistência, escopo e compatibilidade.
- `src/screens/periodization/` e `src/screens/session/`: apresentação dos fluxos.

## Decidir sem apagar contexto

Preservar o vínculo com ciclo e data, o perfil pedagógico vigente, as decisões explícitas do professor e o histórico realizado. Conferir o tratamento de datas e timezone organizacional; não converter datas civis inadvertidamente por UTC.

Quando houver ciclo válido, seguir o contexto de periodização. Preservar o bootstrap de turma já modelado quando não houver ciclo; não bloquear esse fluxo por uma regra genérica de que toda aula exige macro/mesociclo.

Distinguir geração proposta, aplicação confirmada, edição manual e execução. Mudança de perfil/contexto não autoriza reescrever planos existentes. Manter snapshots e overrides e explicar quais planos ficam desatualizados ou precisam de revisão. Feedback de aula pode informar planejamento futuro sem substituir o registro realizado.

Para arquivamento, inspecionar `archivePlanningCycle` e seus chamadores; preservar histórico e referências. Para PSE/carga, usar fórmulas e unidades do módulo, sem inventar prescrição clínica.

Reaproveitar testes de `src/core/__tests__/periodization-*`, `src/core/cycle-day-planning/__tests__/` e `src/db/__tests__/cycles-workspace-scope.test.ts`, escolhendo os afetados. Cobrir ciclo ausente/arquivado, data-limite, edição manual e organização quando relevantes. Aplicar a escada de validação canônica.
