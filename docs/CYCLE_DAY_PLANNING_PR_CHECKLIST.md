# Cycle Day Planning PR Checklist

## Baseline

Validated baseline before this wave:

- PR 1 to PR 9 completed
- execution-state hardening is in place
- generation explanation exists in core
- session generation already emits breadcrumbs and perf metadata
- focused validation last known green: 7 suites, 31 tests

This checklist starts from that state and turns PR 10 to PR 18 into mergeable work packages.

## Validation Status

- 2026-04-12: focused automated validation for PR 10, PR 11, PR 12, PR 15, PR 17, and PR 18 is green.
- 2026-04-12: web bootstrap smoke succeeded on Expo web without fatal runtime errors during app startup.
- 2026-04-12: interactive end-to-end QA succeeded on Expo web for the 2x/week Turma 10-12 flow across periodization -> Aula do Dia -> edit -> remove -> regenerate.
- Manual QA for at least one 3x/week class in the periodization screen is still pending.

## Delivery Order

### Sprint 1

1. PR 10 - connect real cycle context to periodization generation
2. PR 11 - resolve session index in week
3. PR 12 - robust bootstrap for new classes

### Sprint 2

1. PR 15 - dominant block drives strategy
2. PR 16 - load, demand, and PSE modulate the session
3. PR 14 - anti-repetition by plan fingerprint

### Sprint 3

1. PR 13 - teacher edit becomes local operational learning
2. PR 17 - surface short coach explanation
3. PR 18 - close the periodization to session learning loop

## PR 10 - Real Cycle Context In Periodization Generation

### Goal

Make automatic periodization generation use the real cycle-day context as the actual driver of the generated session, not just generic class identity.

### Dependencies

- PR 8 stable
- PR 9 stable
- current session-side cycle-day pipeline available for reuse

### Files

- [app/periodization/index.tsx](app/periodization/index.tsx)
- [src/screens/periodization/hooks/useGeneratePlansMode.ts](src/screens/periodization/hooks/useGeneratePlansMode.ts)
- [src/screens/periodization/resolve-periodization-screen-context.ts](src/screens/periodization/resolve-periodization-screen-context.ts)
- new: `src/screens/periodization/application/build-cycle-day-planning-context.ts`
- new: `src/screens/periodization/application/build-auto-plan-for-cycle-day.ts`

### Checklist

- [x] Map periodization screen state into a cycle-day input contract reusable by generation.
- [x] Carry month, week, mesocycle, dominant block, planned load, demand index, target PSE, internal load, and `sessionIndexInWeek` into the adapter.
- [x] Reuse pure core planning modules instead of duplicating decision logic in periodization.
- [x] Ensure different columns in the same week can generate different session outputs.
- [x] Ensure different classes stop sharing the same generation skeleton when their cycle context differs.
- [x] Add focused tests for the periodization-side adapter.

### Done When

- different days in the same week produce different plans
- different classes no longer collapse to the same structure
- generation still works when there is no prior history

### Validation

- `npm run typecheck:core`
- focused Jest on new periodization adapter tests
- manual QA on at least one 2x/week and one 3x/week class in periodization screen

## PR 11 - Resolve Session Index In Week

### Goal

Turn weekly frequency into an explicit sequence of session roles so the engine knows whether it is planning session 1, 2, or 3 of the week.

### Dependencies

- PR 10 adapter shape defined

### Files

- new: `src/core/cycle-day-planning/resolve-session-index-in-week.ts`
- new: `src/core/__tests__/resolve-session-index-in-week.test.ts`
- `src/screens/periodization/application/build-cycle-day-planning-context.ts`
- `src/core/cycle-day-planning/build-cycle-day-planning-context.ts`

### Checklist

- [x] Resolve ordered training days from `daysOfWeek`.
- [x] Support frequency 1, 2, and 3+ without assuming contiguous weekdays.
- [x] Define explicit role expectations for session 1, session 2, and session 3.
- [x] Feed resolved `sessionIndexInWeek` into both periodization-side and session-side context builders.
- [x] Cover out-of-order weekday schedules and partial week edge cases in tests.

### Done When

- the system can reliably identify session 1, 2, or 3
- this changes strategy output in the same week
- same-week sessions stop generating identical strategies

### Validation

- `npm run typecheck:core`
- `npx jest src/core/__tests__/resolve-session-index-in-week.test.ts --runInBand`

## PR 12 - Robust Bootstrap For New Classes

### Goal

Guarantee coherent generation for new classes or weak-history classes without blocking on attendance, logs, or prior plans.

### Dependencies

- PR 10 and PR 11 in place or at least their context fields available

### Files

- [src/core/cycle-day-planning/resolve-historical-confidence.ts](src/core/cycle-day-planning/resolve-historical-confidence.ts)
- [src/core/cycle-day-planning/build-cycle-day-planning-context.ts](src/core/cycle-day-planning/build-cycle-day-planning-context.ts)
- [src/screens/session/application/build-recent-session-summary.ts](src/screens/session/application/build-recent-session-summary.ts)
- tests around confidence and context bootstrap behavior

### Checklist

- [x] Keep `historicalConfidence` authoritative for bootstrap behavior.
- [x] Ensure `none` routes generation fully through cycle plus class context.
- [x] Avoid any code path that requires attendance or confirmation to generate.
- [x] Preserve degraded confidence when evidence is partial instead of collapsing to failure.
- [x] Ensure explanation text clearly says when generation used bootstrap.
- [x] Add tests for new class, partial evidence, and weak operational evidence cases.

### Done When

- a new class generates normally
- missing history never breaks the pipeline
- explanation clearly differentiates bootstrap from stronger history modes

### Validation

- `npm run typecheck:core`
- focused Jest on confidence, context, and recent-summary tests

## PR 15 - Dominant Block Drives Strategy

### Goal

Make dominant block a true strategic input instead of descriptive text.

### Dependencies

- Sprint 1 context fields stable

### Files

- [src/core/cycle-day-planning/resolve-session-strategy-from-cycle-context.ts](src/core/cycle-day-planning/resolve-session-strategy-from-cycle-context.ts)
- new: `src/core/cycle-day-planning/resolve-block-dominant-strategy.ts`
- tests for block-to-strategy mapping
- [src/core/cycle-day-planning/format-generation-explanation.ts](src/core/cycle-day-planning/format-generation-explanation.ts)

### Checklist

- [x] Define explicit mappings from dominant block to skill and progression biases.
- [x] Encode at least technical base, offensive organization, and game application patterns.
- [x] Merge block influence with phase intent instead of replacing the macro cycle.
- [x] Surface dominant-block influence in generation explanation metadata.
- [x] Add tests proving block changes the resulting strategy under similar phase conditions.

### Done When

- dominant block materially changes the session strategy
- plans stop feeling generic when phase is similar but block differs
- explanation identifies the block effect

### Validation

- `npm run typecheck:core`
- focused Jest on strategy resolver tests

## PR 16 - Planned Load, Demand, And PSE As Real Modulators

### Goal

Make planned load, demand, and target PSE alter density, pressure, and transfer level in a measurable way.

### Dependencies

- PR 15 stable enough to avoid conflicting heuristics

### Files

- new: `src/core/cycle-day-planning/resolve-load-modulation.ts`
- [src/core/cycle-day-planning/resolve-session-strategy-from-cycle-context.ts](src/core/cycle-day-planning/resolve-session-strategy-from-cycle-context.ts)
- [src/screens/session/application/build-auto-plan-for-cycle-day.ts](src/screens/session/application/build-auto-plan-for-cycle-day.ts)
- tests for load modulation

### Checklist

- [x] Convert planned load, demand, and target PSE into a normalized load signal.
- [x] Make low load reduce density, opposition, and pressure.
- [x] Make medium load produce hybrid technical-tactical behavior.
- [x] Make high load increase continuity, pressure, and game transfer.
- [x] Ensure the same skill generates different strategy outputs under low vs high load.
- [x] Add tests proving modulation changes real outputs, not just metadata.

### Done When

- load cells materially change the generated session
- PSE is no longer only descriptive text
- same skill plus different load creates different sessions

### Validation

- `npm run typecheck:core`
- focused Jest on load resolver and strategy resolver tests

## PR 14 - Anti-Repetition By Plan Fingerprint

### Goal

Reduce dumb repetition without breaking cycle continuity.

### Dependencies

- PR 15 and PR 16 stable enough to define richer fingerprints

### Files

- [src/core/cycle-day-planning/apply-plan-guards.ts](src/core/cycle-day-planning/apply-plan-guards.ts)
- [src/core/cycle-day-planning/build-plan-fingerprint.ts](src/core/cycle-day-planning/build-plan-fingerprint.ts)
- [src/screens/session/application/build-auto-plan-for-cycle-day.ts](src/screens/session/application/build-auto-plan-for-cycle-day.ts)
- tests for repetition guards

### Checklist

- [x] Confirm fingerprint includes primary skill, secondary skill, progression dimension, dominant block, drill families, and load intent.
- [x] Force controlled variation when recent fingerprint matches exactly.
- [x] Add fallback variation when block and primary skill repeat but progression or families can still rotate.
- [x] Preserve cycle intent when varying plans.
- [x] Add regression tests for same-class repetition and cross-session repetition within the same week.

### Done When

- repetition drops across classes and across days of the same class
- continuity is preserved without cloning the same plan

### Validation

- `npm run typecheck:core`
- focused Jest on plan guards and auto-plan tests

## PR 13 - Teacher Edit As Operational Learning

### Goal

Use teacher edits as a high-value local learning signal that influences the next one to three generations without hijacking the cycle.

### Dependencies

- PR 14 stable, so learned adjustments are not masked by dumb repetition

### Files

- [src/core/cycle-day-planning/resolve-teacher-override-weight.ts](src/core/cycle-day-planning/resolve-teacher-override-weight.ts)
- [src/screens/session/application/build-recent-session-summary.ts](src/screens/session/application/build-recent-session-summary.ts)
- [src/screens/session/application/build-auto-plan-for-cycle-day.ts](src/screens/session/application/build-auto-plan-for-cycle-day.ts)
- [src/core/cycle-day-planning/resolve-session-strategy-from-cycle-context.ts](src/core/cycle-day-planning/resolve-session-strategy-from-cycle-context.ts)
- tests for override weighting

### Checklist

- [x] Distinguish small, medium, and strong edits.
- [x] Let strong edits influence one to three upcoming generations.
- [x] Keep soft edits conservative.
- [x] Preserve macro phase and dominant block as higher-order constraints.
- [x] Extend tests to prove the app learns while staying class-scoped and conservative.

### Done When

- teacher edits influence future generations
- one-off edits do not distort the cycle
- the teacher can feel that the app learned something local

### Validation

- `npm run typecheck:core`
- focused Jest on teacher override and auto-plan tests

## PR 17 - Surface Short Coach Explanation

### Goal

Expose a short, coach-readable explanation so generation is auditable and not perceived as random.

### Dependencies

- PR 13 stable enough to explain override effects coherently

### Files

- [src/core/cycle-day-planning/format-generation-explanation.ts](src/core/cycle-day-planning/format-generation-explanation.ts)
- [app/class/[id]/session.tsx](app/class/[id]/session.tsx)
- optionally periodization preview UI if a compact surface exists

### Checklist

- [x] Keep `coachSummary` short and readable.
- [x] Include phase, session-in-week, primary skill, why that focus, bootstrap vs historical mode, and override influence when present.
- [x] Surface the explanation in a non-intrusive UI location.
- [x] Preserve current breadcrumbs and debug metadata.
- [x] Add a lightweight UI assertion or snapshot test if the area already has test coverage.

### Done When

- the coach can understand why the plan was generated that way
- the feature reduces the feeling of randomness
- debug metadata and coach-facing explanation stay consistent

### Validation

- `npm run typecheck:core`
- UI smoke check on session screen

## PR 18 - Close The Periodization To Session Learning Loop

### Goal

Ensure the plan generated from the cycle arrives coherently in the session screen and returns operational learning to future generations.

### Dependencies

- PR 10 through PR 17 stable enough to create a full loop

### Files

- [app/periodization/index.tsx](app/periodization/index.tsx)
- [app/class/[id]/session.tsx](app/class/[id]/session.tsx)
- [src/screens/session/application/build-recent-session-summary.ts](src/screens/session/application/build-recent-session-summary.ts)
- [src/screens/session/application/build-auto-plan-for-cycle-day.ts](src/screens/session/application/build-auto-plan-for-cycle-day.ts)
- any DB helpers needed to persist linkage between generated cycle plan and applied session plan

### Checklist

- [x] Make the periodization-generated plan consumable by Aula do Dia without losing cycle-day metadata.
- [x] Persist whether the plan was applied, edited, or only suggested.
- [x] Persist available operational evidence without requiring perfect attendance data.
- [x] Feed that evidence back into the next generation via recent-session summary.
- [x] Add end-to-end QA coverage for generate -> apply -> edit -> regenerate flow.

### Done When

- periodization generates
- Aula do Dia consumes
- teacher edits are captured
- the next generation reuses that learning

### Validation

- `npm run typecheck:core`
- focused Jest on recent-summary and auto-plan tests
- manual end-to-end QA across periodization and session screens

## Success Gates

The wave is complete when all of these are true:

- new classes generate coherent plans from cycle context alone
- different days in the same week generate different sessions
- different classes stop receiving cloned plans
- missing attendance or confirmation never blocks generation
- teacher edits influence future plans conservatively
- anti-repetition reduces cloned plans without breaking progression
- coach-facing explanation makes sense and matches debug metadata
