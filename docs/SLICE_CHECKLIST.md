# SLICE IMPLEMENTATION CHECKLIST + QUICK REFERENCE

Use isto para acompanhamento durante cada slice.

---

## SLICE A1: UI Academia Básica ✅

**Goal:** Renderizar sessão resistida como tabela clara de exercícios.

### Deliverables

- [ ] **Componente:** `src/screens/session/components/SessionResistanceBlock.tsx`
  - Props mínimas: `resistancePlan`, `durationMin`
  - Renderiza tabela: exercício | séries | reps | intervalo | observações
  - Cadência mostrada se houver
  - Usa os nomes reais de `ResistanceTrainingPlan` e `ResistanceExercisePrescription`

- [ ] **Adapter:** `src/screens/session/components/get-resistance-plan-from-session-components.ts`
  - Extrai `SessionComponentAcademiaResistido` com segurança
  - Não inventa shape paralelo
  - Faz fallback para `estimatedDurationMin` se necessário

- [ ] **Refator mínima:** `app/class/[id]/session.tsx`
  - Só encaixa componente e adapter
  - Se `"academia"` + plano válido → render `SessionResistanceBlock`
  - Se `"quadra"` → render atual (zero mudança)
  - Fallback seguro se undefined ou plano ausente

- [ ] **Componente:** `src/screens/session/components/ExercisePrescriptionTable.tsx`
  - Tabela semântica (não planilha feia)
  - Colunas: nome | séries × reps | intervalo | notas
  - Responsive para mobile
  - Transferência em footer/nota

### Tests

- [ ] Teste: Academia + 5 exercícios renderiza
- [ ] Teste: Quadra renderiza como antes
- [ ] Teste: sessionEnvironment undefined → quadra default
- [ ] Teste: Mista com ambos os tipos
- [ ] Teste: sessão sem `sessionComponents` não quebra
- [ ] Teste: exercício sem `rest`/`cadence`/`transferTarget` não quebra

### Acceptance Criteria

- ✅ Academia renderiza tabela clara
- ✅ Quadra continua funcionando (zero regressão)
- ✅ Sessão mista não quebra
- ✅ Planos antigos continuam abrindo
- ✅ Dados parciais não quebram render
- ✅ UI legível em mobile
- ✅ Sem lógica de recomendação alterada

### Risks & Mitigation

| Risco | Mit |
|-------|-----|
| Dados ausentes em `resistancePlan` | Validar antes, usar defaults |
| Quebra layout do plano existente | Renderizar como bloco isolado |
| sessionEnvironment undefined | Fallback para quadra |

---

## SLICE A2: Contexto no Topo ✅

**Goal:** Topo da sessão mostra ambiente + foco físico + transferência.

### Deliverables

- [ ] **Componente:** `src/screens/session/components/SessionContextHeader.tsx`
  - Exibe: Ambiente | Foco Físico | Relação Semana | Transferência
  - Exemplo: "Academia — Potência de MMII — Sustenta quadra — Salto + bloqueio"
  - Badges/chips para cada atributo
  - Cores de acordo com tema

- [ ] **Componente:** `src/screens/session/components/SessionMixedStructure.tsx`
  - Se `sessionEnvironment === "mista"`:
    - Renderiza bloco academia + bloco quadra + ponte
    - Ponte textual: "Estabilidade de tronco para melhor bloqueio"
  - Visualmente discerníveis
  - Sem overlap

- [ ] **Refator:** `app/class/[id]/session.tsx`
  - Colocar `SessionContextHeader` no topo
  - Usar `sessionEnvironment + weeklyIntegratedContext` para dados
  - Passar `courtGymRelationship` como prop

### Tests

- [ ] Teste: Topo academia renderiza corretamente
- [ ] Teste: Topo quadra renderiza corretamente
- [ ] Teste: Topo mista mostra ponte clara
- [ ] Teste: Wording coerente para 5+ combinações

### Acceptance Criteria

- ✅ Topo mostra ambiente claro
- ✅ Transferência é legível
- ✅ Mista renderiza com ponte explícita
- ✅ Wording não é genérico

### Risks & Mitigation

| Risco | Mit |
|-------|-----|
| Muita lógica condicional | Extrair em componentes menores |
| Transferência mal reduzida | Usar template de frases |
| Layout quebra em mistas | Testar com 3+ mistas reais |

---

## SLICE B1: Gerador Escreve Contexto ✅

**Goal:** Garantir que cada `ClassPlan` salva `weeklyIntegratedContextJson` de forma consistente e que esse contexto é consumível pela UI.

### Deliverables

- [ ] **Refator:** `src/core/session-generator/build-auto-week-plan.ts`
  - Confirmar o que já existe antes de adicionar nova lógica
  - Chamar `resolveTeamTrainingContext()` para a turma
  - Chamar `buildWeeklyIntegratedContext()` com dados da semana
  - Salvar JSON em `ClassPlan.weeklyIntegratedContextJson`

- [ ] **Refator:** `src/core/session-generator/build-auto-plan-for-cycle-day.ts`
  - Receber `teamContext` como param
  - Receber `weeklyIntegratedContext` como param
  - Chamar `resolveSessionEnvironment()` → `sessionEnvironment`
  - Criar `SessionComponent` com ResistanceTrainingPlan se academia
  - Salvar em `DailyLessonPlan.sessionEnvironment`
  - Salvar em `DailyLessonPlan.sessionComponents`

- [ ] **DB:** `src/db/sqlite.ts`
  - Verificar que `class_plans.weeklyIntegratedContextJson` existe
  - Verificar que `daily_lesson_plans.sessionEnvironment` existe
  - Verificar que `daily_lesson_plans.sessionComponents` existe (se novo)
  - Migrations aplicadas

- [ ] **Parser:** Garantir que `weeklyIntegratedContextJson` é parseado com defaults
  ```typescript
  const context = JSON.parse(classplan.weeklyIntegratedContextJson || '{}');
  return {
    weeklyPhysicalEmphasis: context.weeklyPhysicalEmphasis ?? "manutencao",
    courtGymRelationship: context.courtGymRelationship ?? "quadra_dominante",
    // ... etc
  }
  ```

### Tests

- [ ] Teste: Turma quadra_apenas → JSON com courtGymRelationship "quadra_dominante"
- [ ] Teste: Turma academia_integrada → JSON com gym sessions corretas
- [ ] Teste: DailyLessonPlan com sessionEnvironment "academia"
- [ ] Teste: SessionComponent criado com plano resistido
- [ ] Teste: 10+ turmas reais geradas, sem erro
- [ ] Teste: Planos quadra antigos carregam sem quebra
- [ ] Teste: UI consegue consumir contexto salvo sem duplicar lógica

### Acceptance Criteria

- ✅ ClassPlan tem weeklyIntegratedContextJson preenchido
- ✅ DailyLessonPlan tem sessionEnvironment + sessionComponents
- ✅ SessionComponent tem ResistanceTrainingPlan quando academia
- ✅ Contexto salvo é legível e útil para a UI
- ✅ Testes verdes em gerador
- ✅ Zero regressão em planos quadra existentes

### Risks & Mitigation

| Risco | Mit |
|-------|-----|
| Motor quebra planos antigos | Defaults em parsing, teste rollback |
| JSON vazio → erro | Fallback com valores padrão |
| Gerador fica lento | Profile perf agora, monitor deploy |
| SessionComponent missing | Validar antes de salvar |

---

## SLICE B2: Énfase Física Dirige Template ✅

**Goal:** `weeklyPhysicalEmphasis` influencia escolha de template + transferência.

### Deliverables

- [ ] **Refator:** `src/core/resistance/resistance-templates.ts`
  - `resolveResistanceTemplate(goal, profile, weeklyPhysicalEmphasis)` adiciona param
  - Template A ("forca_base"): foco força base, 4-5 exercícios fixos
  - Template B ("potencia_atletica"): MMII, explosividade, salto/bloqueio
  - Template C ("prevencao_recuperacao"): estabilidade, prevenção
  - Template D ("resistencia_especifica"): resistência muscular
  - Template E ("ativacao_funcional"): ativação leve

- [ ] **Refator:** `src/core/resistance/resolve-session-environment.ts`
  - `buildWeeklyIntegratedContext()` agora retorna emphasis corrigida
  - CourtGymRelationship influencia wording
  - TransferTarget explícito no plano

- [ ] **Refator:** `build-auto-plan-for-cycle-day.ts`
  - Passar `weeklyPhysicalEmphasis` ao seletor de template
  - Garantir que wording é coerente com énfase
  - Transferência é explícita ("salto de ataque e bloqueio", não genérica)

### Tests

- [ ] Teste: weeklyPhysicalEmphasis "forca_base" → Template A
- [ ] Teste: weeklyPhysicalEmphasis "potencia_atletica" → Template B
- [ ] Teste: weeklyPhysicalEmphasis "prevencao" → Template C
- [ ] Teste: Transferência é explícita (não "melhora força")
- [ ] Teste: QA manual de 3-5 planos (coerência wording)

### Acceptance Criteria

- ✅ Énfase semanal influencia template
- ✅ Template escolhido é apropriado
- ✅ Transferência explícita ("salto", "bloqueio", "passe")
- ✅ Wording não é genérico
- ✅ QA humano validou 3-5 exemplos

### Risks & Mitigation

| Risco | Mit |
|-------|-----|
| Template ruim → plano ruim | QA rigoroso antes de deploy |
| Transferência fraca | Template com transferência clara |
| Over-customization | Manter templates A-E fixos |

---

## SLICE C1: Sinais QA Observacionais ✅

**Goal:** Sistema vê interferência/transferência (sem auto-recalibragem).

### Deliverables

- [ ] **Novo arquivo:** `src/core/recommendation/gym-court-observables.ts`
  - `observeGymCourtInterference()`: academia pesada em semana densa de salto
  - `observeTransferenceAlignment()`: foco físico sem suporte técnico-tático
  - `observeStructuralBalance()`: pouca prevenção, excesso empurrar
  - Retorna array de `{ signal, severity, reason }`

- [ ] **UI (QA-facing):** `src/ui/QA/ResistanceIntegrationPanel.tsx` (NOVO)
  - Mostra sinais de interferência/transferência
  - Wording educacional ("considere monitorar...")
  - Zero impacto no plano gerado

- [ ] **Integração:** `src/core/recommendation/recommendation-context.ts`
  - Adicionar `gymCourtSignals` ao contexto
  - Chamar `observeGymCourtInterference()` etc. durante recomendação
  - Populatepara QA panel

### Tests

- [ ] Teste: Academia potência + quadra alta em salto → sinal de interferência
- [ ] Teste: Academia MMII sem salto em quadra → sinal de transferência fraca
- [ ] Teste: Pouca prevenção → sinal de desbalanceamento
- [ ] Teste: Dados ausentes → fallback gracioso

### Acceptance Criteria

- ✅ Sinais QA aparecem em panel
- ✅ Wording é educacional, não alarmista
- ✅ Zero impacto no plano gerado
- ✅ Nenhuma auto-recalibragem
- ✅ Recomendação não quebra

### Risks & Mitigation

| Risco | Mit |
|-------|-----|
| Recomendação quebra se dados ausentes | Fallback, tests unitários |
| Sinais geram ruído | Severity levels, threshold |
| False positives | Tuning com dados reais |

---

## GLOBAL ACCEPTANCE (END OF ALL SLICES)

- ✅ Academia renderiza com tabela clara
- ✅ Topo mostra ambiente + foco + transferência
- ✅ Gerador escreve weeklyIntegratedContext
- ✅ Énfase física dirige template
- ✅ Sinais QA observam coerência
- ✅ Quadra continua funcionando (zero regressão)
- ✅ Nenhuma auto-intervenção
- ✅ Treinador entende função da academia na semana

---

## QUICK REFERENCE: KEY FUNCTIONS

```
Sempre chamar:
  resolveTeamTrainingContext(classGroup)
    → TeamTrainingContext { hasGymAccess, model, profile }

  buildWeeklyIntegratedContext({ teamContext, weeklySessions, emphasis })
    → WeeklyIntegratedTrainingContext { relationship, emphasis, risk }

  resolveSessionEnvironment({ teamContext, weeklySessions, sessionIndex })
    → SessionEnvironment ("quadra" | "academia" | "mista")

  resolveResistanceTemplate(goal, profile, emphasis)
    → ResistanceTrainingPlan (template A-E)

Salvar sempre:
  classplan.weeklyIntegratedContextJson = JSON.stringify(context)
  dailylesson.sessionEnvironment = env
  dailylesson.sessionComponents = [...]
```

---

## FILES TO MONITOR FOR REGRESSION

```
🔴 RISCO MÁXIMO:
  app/class/[id]/session.tsx
  src/core/session-generator/build-auto-week-plan.ts
  
🟡 RISCO MÉDIO:
  src/core/models.ts
  src/db/sqlite.ts
  
🟢 RISCO BAIXO:
  src/screens/session/components/
  src/core/resistance/
```

---

**Version:** 1.0  
**Last Updated:** 23/04/2026  
**Status:** Ready for implementation
