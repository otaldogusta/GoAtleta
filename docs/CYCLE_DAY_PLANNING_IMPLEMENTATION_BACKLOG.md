# Cycle Day Planning Implementation Backlog

## Goal

Execution checklist for the next implementation wave lives in [docs/CYCLE_DAY_PLANNING_PR_CHECKLIST.md](docs/CYCLE_DAY_PLANNING_PR_CHECKLIST.md).

Implement a resilient training-generation engine that:

- always generates a plan,
- degrades gracefully when historical data is missing,
- improves when partial or strong history exists,
- treats teacher edits as high-value local learning signals,
- avoids brittle dependence on perfect execution data.

The engine must support three real operating states:

1. no history,
2. partial or inconsistent history,
3. strong recent history corrected by the teacher.

## Current Reusable Building Blocks

The codebase already has useful foundations. The implementation should extend them instead of replacing them.

### Existing context and generation modules

- [src/screens/session/application/build-class-generation-context.ts](src/screens/session/application/build-class-generation-context.ts)
  - already derives `phaseIntent`, `weeklyLoadIntent`, `primarySkill`, `secondarySkill`, `progressionDimensionTarget`, `mustAvoidRepeating`, `mustProgressFrom`.
- [src/screens/session/application/build-pedagogical-input-from-context.ts](src/screens/session/application/build-pedagogical-input-from-context.ts)
  - already turns a generation context into a structured pedagogical package.
- [src/screens/periodization/resolve-periodization-screen-context.ts](src/screens/periodization/resolve-periodization-screen-context.ts)
  - already resolves active week and periodization context from cycle data.
- [src/screens/periodization/build-auto-week-plan.ts](src/screens/periodization/build-auto-week-plan.ts)
  - already centralizes week-plan creation for periodization.

### Existing persistence and learning signals

- [src/db/training.ts](src/db/training.ts)
  - training plan versioning fields already exist: `version`, `status`, `origin`, `inputHash`, `generatedAt`, `finalizedAt`, `parentPlanId`, `previousVersionId`, `pedagogy`.
- [src/core/models.ts](src/core/models.ts)
  - `TrainingPlan.pedagogy.override` already stores methodology override metadata.
- [src/db/training-sessions.ts](src/db/training-sessions.ts)
  - already models scheduled/applied training sessions and their attendance linkage.
- [src/core/override-learning.ts](src/core/override-learning.ts)
  - already implements conservative learning from teacher override behavior.
- [src/db/knowledge-base.ts](src/db/knowledge-base.ts)
  - already integrates override learning into methodology resolution.

## Recommended Module Placement

Do not place the new engine entirely under a screen-specific folder.

Use this split:

- pure planning logic in `src/core/cycle-day-planning/`
- orchestration and data-shaping adapters in `src/screens/session/application/`
- query helpers only when necessary in `src/db/`

This keeps the decision engine reusable by both session generation and later periodization workflows.

## Core Types To Add

Add these shared types first, preferably in [src/core/models.ts](src/core/models.ts) unless they become too noisy, in which case move them to `src/core/cycle-day-planning/types.ts` and re-export as needed.

### `HistoricalConfidence`

```ts
export type HistoricalConfidence = "none" | "low" | "medium" | "high";
```

### `SessionExecutionState`

```ts
export type SessionExecutionState =
  | "planned_only"
  | "applied_not_confirmed"
  | "teacher_edited"
  | "confirmed_executed"
  | "skipped"
  | "unknown";
```

### `RecentSessionSummary`

```ts
export type RecentSessionSummary = {
  sessionDate: string;
  wasPlanned: boolean;
  wasApplied: boolean;
  wasEditedByTeacher: boolean;
  wasConfirmedExecuted: boolean | null;
  executionState: SessionExecutionState;
  primarySkill?: string;
  progressionDimension?: string;
  dominantBlock?: string;
  fingerprint?: string;
  teacherOverrideWeight: "none" | "soft" | "strong";
};
```

### `CycleDayPlanningContext`

Use the proposed shape from product design, but align names with the current codebase where possible:

- prefer `developmentStage` over introducing another maturity label,
- prefer `phaseIntent` and `pedagogicalIntent` because they already exist,
- prefer `progressionDimension` or `progressionDimensionTarget` consistently across engine and UI.

### `SessionStrategy`

```ts
export type SessionStrategy = {
  primarySkill: string;
  secondarySkill?: string;
  progressionDimension: string;
  pedagogicalIntent: string;
  loadIntent: string;
  drillFamilies: string[];
  oppositionLevel: "low" | "medium" | "high";
  timePressureLevel: "low" | "medium" | "high";
  gameTransferLevel: "low" | "medium" | "high";
};
```

### `PlanFingerprint`

```ts
export type PlanFingerprint = {
  primarySkill: string;
  secondarySkill?: string;
  progressionDimension: string;
  dominantBlock?: string;
  drillFamilies: string[];
  loadIntent: string;
};
```

## Truth Hierarchy

The engine should always resolve conflicts in this order:

1. explicit teacher edit or override,
2. applied or confirmed plan state,
3. generated plan with no confirmation,
4. class identity plus cycle context.

That hierarchy should be encoded in one place, not spread across the generator.

Recommended helper:

- `src/core/cycle-day-planning/resolve-truth-priority.ts`

## Implementation Phases

### PR 1. Shared Types and Confidence Resolver

#### Files

- [src/core/models.ts](src/core/models.ts)
- `src/core/cycle-day-planning/resolve-historical-confidence.ts`
- `src/core/__tests__/cycle-day-planning-confidence.test.ts`

#### Scope

- add `HistoricalConfidence`, `SessionExecutionState`, `RecentSessionSummary`, `CycleDayPlanningContext`, `SessionStrategy`, `PlanFingerprint`
- implement a pure resolver for confidence from recent evidence
- avoid any UI integration yet

#### Resolver Rules

- `none`: no recent plan or execution evidence
- `low`: generated plans exist but there is no strong evidence of execution
- `medium`: at least one recent applied or teacher-edited session exists
- `high`: multiple recent sessions have strong continuity signals

#### Definition of Done

- all new types compile cleanly
- confidence resolver has unit tests for `none`, `low`, `medium`, `high`
- no runtime behavior changed yet

### PR 2. Recent Session Summary Adapter

#### Files

- `src/screens/session/application/build-recent-session-summary.ts`
- optionally [src/db/training.ts](src/db/training.ts)
- optionally [src/db/training-sessions.ts](src/db/training-sessions.ts)
- `src/core/__tests__/build-recent-session-summary.test.ts`

#### Scope

- build a normalized recent-history view from existing `TrainingPlan`, plan versions, `inputHash`, `pedagogy.override`, and training-session evidence
- define how to infer `teacherOverrideWeight`
- define how to derive `executionState`

#### Inference Rules

- `teacher_edited` when a final or edited version diverges materially from the original auto-generated plan
- `planned_only` when only generated evidence exists
- `applied_not_confirmed` when a plan was attached to a scheduled session but no strong execution evidence exists
- `confirmed_executed` when session plus attendance or equivalent operational evidence exists
- `unknown` when evidence is incomplete or ambiguous

#### Definition of Done

- adapter returns summaries even if half the evidence is missing
- adapter never throws because of absent session linkage
- tests cover new class, partial history, strong history, and teacher-edited cases

### PR 3. Cycle Day Planning Context Builder

#### Files

- `src/core/cycle-day-planning/build-cycle-day-planning-context.ts`
 - optionally [src/screens/periodization/resolve-periodization-screen-context.ts](src/screens/periodization/resolve-periodization-screen-context.ts)
- optionally [src/screens/session/application/build-class-generation-context.ts](src/screens/session/application/build-class-generation-context.ts)
- `src/core/__tests__/build-cycle-day-planning-context.test.ts`

#### Scope

- combine class identity, cycle week, session index in week, recent summaries, confidence level, planned load, PSE, dominant block and materials
- reuse current logic from `build-class-generation-context.ts` instead of copying it
- make `build-class-generation-context.ts` a compatibility wrapper if needed

#### Important Rule

Session index in week must be explicit. The same week should not generate the same strategy for session 1 and session 3.

#### Definition of Done

- context is fully built for new classes with no history
- context differs across session positions in the same week
- recent history is present when available and empty when missing

### PR 4. Strategy Resolver

#### Files

- `src/core/cycle-day-planning/resolve-session-strategy-from-cycle-context.ts`
- `src/core/__tests__/resolve-session-strategy-from-cycle-context.test.ts`

#### Scope

- decide `primarySkill`, `secondarySkill`, `progressionDimension`, `pedagogicalIntent`, `loadIntent`, allowed families, forbidden families, opposition level, time pressure and game transfer level
- use `phaseIntent`, `dominantBlock`, `plannedLoad`, `targetPse`, `developmentStage`, `sessionIndexInWeek`, `historicalConfidence`

#### Strategy Rules

- base phase: more consistency, precision, low opposition
- development: more hybrid technical plus tactical progression
- pre-competitive: more decision making and pressure
- competitive: more transfer and game behavior, less pointless volume

#### Definition of Done

- different periods produce different strategy outputs for the same class identity
- frequency 2 and frequency 3 classes produce coherent weekly role splits
- tests cover base, development, pre-competitive and competitive scenarios

### PR 5. Auto Plan Orchestration

#### Files

- `src/screens/session/application/build-auto-plan-for-cycle-day.ts`
- [src/screens/session/application/build-pedagogical-input-from-context.ts](src/screens/session/application/build-pedagogical-input-from-context.ts)
- [app/class/[id]/session.tsx](app/class/[id]/session.tsx)
- `src/core/__tests__/build-auto-plan-for-cycle-day.test.ts`

#### Scope

- orchestrate context builder plus strategy plus pedagogical input builder
- keep `buildPedagogicalInputFromContext()` as the final adapter into `buildPedagogicalPlan()`
- switch the automatic generation path in session screen to the new orchestration

#### Definition of Done

- the existing session generation flow still works for classes with no history
- the new orchestration still produces valid `PedagogicalPlanPackage`
- no UI change required yet beyond using the new pipeline

### PR 6. Fingerprint and Plan Guards

#### Files

- `src/core/cycle-day-planning/build-plan-fingerprint.ts`
- `src/core/cycle-day-planning/apply-plan-guards.ts`
- [src/core/training-plan-factory.ts](src/core/training-plan-factory.ts)
- `src/core/__tests__/apply-plan-guards.test.ts`

#### Scope

- formalize fingerprint creation from skill, progression, drill families, dominant block and load intent
- compare candidate fingerprint against recent summaries and recent plan hashes
- force controlled variation when repetition is too high

#### Guard Rules

- do not fully repeat the last one or two sessions unless confidence is `none`
- allow continuity without exact structural duplication
- preserve cycle intent while varying secondary skill, drill family or progression dimension when needed

#### Definition of Done

- repeated recent fingerprints trigger a variation
- variation does not violate dominant block or load intent
- guard logic is pure and unit tested

### PR 7. Teacher Override Influence

#### Files

- `src/core/cycle-day-planning/resolve-teacher-override-weight.ts`
- [src/core/override-learning.ts](src/core/override-learning.ts)
- [src/db/knowledge-base.ts](src/db/knowledge-base.ts)
- `src/core/__tests__/teacher-override-weight.test.ts`

#### Scope

- extend the existing methodology-level override learning into day-planning strategy influence
- weight recent local teacher edits for one to three future generations
- keep the effect conservative and class-scoped

#### Important Constraint

Teacher override should influence the next decisions, not redefine the macro phase of the class.

#### Definition of Done

- strong overrides measurably influence short-term strategy ranking
- low-signal or rare overrides do not distort the cycle
- the behavior remains class-scoped and conservative

### PR 8. Execution-State Hardening

#### Files

- `src/screens/session/application/build-recent-session-summary.ts`
- [src/db/training-sessions.ts](src/db/training-sessions.ts)
- [src/db/session.ts](src/db/session.ts)
- [src/db/students.ts](src/db/students.ts)

#### Scope

- improve how execution evidence is recognized from attendance, linked plan usage, and session synchronization
- make missing attendance reduce confidence, not block generation

#### Definition of Done

- absent attendance no longer breaks continuity generation
- missing confirmation degrades confidence but still allows planning
- strong operational evidence upgrades confidence automatically

### PR 9. Observability and Explainability

#### Files

- [app/class/[id]/session.tsx](app/class/[id]/session.tsx)
- [src/observability/breadcrumbs.ts](src/observability/breadcrumbs.ts)
- [src/observability/perf.ts](src/observability/perf.ts)
- optionally `src/core/cycle-day-planning/format-generation-explanation.ts`

#### Scope

- log why a plan was generated the way it was
- surface `historicalConfidence`, strategy choice, guard activations and override influence in debugging metadata
- optionally expose a short coach-readable explanation later

#### Definition of Done

- the generator can explain the chosen strategy in logs
- QA can inspect whether the engine used bootstrap, partial history or strong history

## Recommended New Files

### Pure logic

- `src/core/cycle-day-planning/resolve-historical-confidence.ts`
- `src/core/cycle-day-planning/build-cycle-day-planning-context.ts`
- `src/core/cycle-day-planning/resolve-session-strategy-from-cycle-context.ts`
- `src/core/cycle-day-planning/build-plan-fingerprint.ts`
- `src/core/cycle-day-planning/apply-plan-guards.ts`
- `src/core/cycle-day-planning/resolve-teacher-override-weight.ts`

### Application orchestration

- `src/screens/session/application/build-recent-session-summary.ts`
- `src/screens/session/application/build-auto-plan-for-cycle-day.ts`

### Tests

- `src/core/__tests__/cycle-day-planning-confidence.test.ts`
- `src/core/__tests__/build-cycle-day-planning-context.test.ts`
- `src/core/__tests__/resolve-session-strategy-from-cycle-context.test.ts`
- `src/core/__tests__/apply-plan-guards.test.ts`
- `src/core/__tests__/teacher-override-weight.test.ts`

## Rollout Order

Recommended sequence:

1. PR 1
2. PR 2
3. PR 3
4. PR 4
5. PR 5
6. PR 6
7. PR 7
8. PR 8
9. PR 9

Do not invert PR 2 and PR 3. The context builder should consume a normalized recent-session summary, not raw training rows.

## First Vertical Slice

If implementation needs to start with a smaller mergeable slice, use this order:

1. PR 1: types plus confidence
2. PR 2: recent session summary
3. PR 3: cycle day context builder
4. wire the session generator to use bootstrap plus confidence, but without override learning yet

That delivers immediate value:

- new classes generate cleanly,
- partial history no longer behaves like missing history,
- weekly session position begins to matter.

## System Ready Checklist

The engine is considered ready when all conditions are true:

- new classes generate normally with no history,
- partial history influences but never blocks generation,
- different sessions in the same week produce different strategies,
- recent teacher correction influences the next generations conservatively,
- repeated fingerprints are reduced,
- missing attendance or confirmation reduces confidence instead of crashing continuity,
- logs can explain whether generation used bootstrap, partial history or strong history.
