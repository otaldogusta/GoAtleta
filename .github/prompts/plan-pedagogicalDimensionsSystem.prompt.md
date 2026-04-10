# Plan: Pedagogical Dimensions System (Science-Based, Updatable)

## TL;DR

Transform GoAtleta from author-anchored pedagogy to a **dimensions-based decision system** that:
- Derives from current scientific consensus (2020+), not fixed author frameworks
- Gets guidance from age, level, phase, performance state
- Stores rules + parameters in versioned JSON config (editability, no code redeploy for updates)
- Keeps code logic clean (only dimensions mapper + refinement)
- Integrates gradually (new layer consumes existing evaluation, zero breaking changes)

This solves the "static plans" problem by making the system scientifically coherent and runtime-updatable.

---

## Steps

### **Phase 1: Design Pedagogical Dimensions Matrix** (Model-first)

1. **Define the 5 dimensions + ranges** (*independent start*)
   - For each dimension (variability, representativeness, decisionMaking, taskComplexity, feedbackFrequency):
     - Define 3 discrete levels (baixa/media/alta or alta/media/baixa per dimension)
     - Write one-line definition + scientific basis (2020+ paper + consensus view)
     - Example for `variability`: "baixa" = blocked practice (initial skill acquisition), "alta" = random/variable (transfer/generalization)

2. **Create derivation logic — TWO-STAGE approach** (CRITICAL ADJUSTMENT) ⚠️
   - **Stage 1 (BASE)**: `f(age, level, phase) → baseProfile` (NO performance state)
     - Simpler, easier to maintain, science-driven
     - 4 age profiles + 3 level adjustments + 3 phase modifiers (composed, not mapped)
   - **Stage 2 (REFINEMENT)**: `f(baseProfile, evaluation) → refinedProfile`
     - Gap/trend/consistency refine base profile dynamically
     - **Safety gate**: If sampleConfidence = "baixo", BLOCK adjustments (return baseProfile)
   - Why 2 stages? Prevents matrix explosion, cleaner logic, maintainable and testable

3. **Validate scientific grounding**
   - Each dimension rules should cite 2–3 sources (Schmidt & Lee 2020, ecological dynamics, constraint-led approach, etc.)
   - Mark confidence levels (alta/media/baixa based on consensus strength)
   - Store source metadata for future updates

4. **Create example dimension profiles** (for testing & narrative)
   - Profile A: 8–11 iniciação students
   - Profile B: 10–12 formação students
   - Profile C: 14+ competitive squad
   - Show how profiles differ = proof system isn't one-size-fits-all

**Deliverable**: TypeScript type `PedagogicalDimensionsProfile` + derivation rules document

---

### **Phase 2: Build Config + Knowledge Base Layer** (Config schema design)

1. **Design JSON schema — COMPOSITION MODEL** (*depends on Phase 1*) ⚠️ REVISED FOR SIMPLICITY
   - **Key insight**: Don't create one giant derivationMatrix. Instead, compose from 3 separate lookups.
   - Structure:
     ```json
     {
       "version": "2026.04.07.1",
       "lastUpdated": "ISO timestamp",
       "dimensions": {...all definitions...},
       "ageProfiles": {
         "8-11": {variability: "baixa", representativeness: "media", ...},
         "10-12": {variability: "media", representativeness: "media", ...},
         "12-14": {variability: "media", representativeness: "alta", ...},
         "14+": {variability: "alta", representativeness: "alta", ...}
       },
       "levelAdjustments": {
         "1": {deltaVariability: 0, deltaTask: 0},
         "2": {deltaVariability: 0.1, deltaTask: 0.15},
         "3": {deltaVariability: 0.2, deltaTask: 0.25}
       },
       "phaseModifiers": {
         "consolidacao": {deltaFeedback: 0.1},
         "especializacao": {deltaTask: 0.15},
         "competicao": {deltaRepresentativeness: 0.2}
       },
       "refinementRules": [
         {condition: "gap.level === 'critico' && consistency < 50%", adjustment: {deltaFeedback: 0.2}},
         {condition: "trend === 'subindo' && consistency > 80%", adjustment: {deltaRepresentativeness: 0.1}},
         {condition: "sampleConfidence === 'baixo'", adjustment: "BLOCK"}
       ]
     }
     ```
   - Compose logic: `profile = merge(ageProfile[age], levelAdjustments[level], phaseModifiers[phase])`
   - Refinement: Apply rules if sampleConfidence >= "medio"
   - Version + changelog for auditability

2. **Plan config file location + loading**
   - Location: `src/config/pedagogical-dimensions.json` (committed to repo)
   - Format: JSON (TypeScript tooling superior to YAML for schema validation)
   - Load strategy: Bootstrap loader in `src/bootstrap/bootstrap.ts`
   - Fallback: Hardcoded defaults if file missing (resilience)

3. **Plan bootstrap integration** (*executes in Phase 5*)
   - Add loader function in `src/bootstrap/bootstrap.ts`
   - Load + validate JSON against schema
   - Cache in memory (performance)
   - Expose via context hook `usePedagogicalConfig()` (no prop drilling)
   - Report load errors to Sentry

4. **Version control strategy**
   - Each config update increments version field (semver-like: major.minor.date.patch)
   - Store changes in git (complete audit trail)
   - Leave comment in JSON why each dimension/rule was tuned
   - Future (Phase 7+): Allow per-school overrides persisted in DB

**Deliverable**: JSON schema + example config file + bootstrap loader skeleton

---

### **Phase 3: Implement Dimensions Mapper Logic** (Decision layer)

1. **Create new module `src/core/pedagogical-dimensions.ts`** (*depends on Phase 1 + 2*)
   - Export function: `deriveDimensionsProfile(age, studentLevel, periodizationPhase, performanceState, config) → PedagogicalDimensionsProfile`
     - Match input to derivation matrix rows (exact match, then fuzzy fallback)
     - Return matched profile or apply default fallback
     - Log derivation choice (for debugging + future auto-calibration)
     - Pure function, no side effects

   - Export function: `refineDimensionsByEvaluation(baseProfile, evaluation, config) → RefinedProfile`
     - Input: pedagogical-evaluation.ts output {gap, trend, consistency, velocity, sampleConfidence}
     - **SAFETY GATE (ESSENTIAL)**: If sampleConfidence = "baixo" → return baseProfile unmodified, BLOCK adjustments
     - Logic (only if sampleConfidence >= "medio"):
       - IF gap.level = "critico" AND consistencyScore < 50% → increase feedbackFrequency
       - IF trend = "subindo" AND consistencyScore > 80% → increase representativeness
     - Output: RefinedProfile with adjustments[] array (tracks why each field was tweaked)
     - Non-breaking: evaluation logic stays pristine, dimensions are contextual metadata

2. **Add TypeScript types**
   - `PedagogicalDimensionsProfile` (shape of dimension values)
   - `RefinementReason` (tracks why a dimension was adjusted, e.g., "high gap detected")
   - `DimensionsConfig` (JSON schema as TS type, enables autocomplete + validation)

3. **Test logic independently** (*executes Phase 6*)
   - ~15 unit tests:
     - Basic derivations (age 8 + nivel 1 → low complexity, high feedback)
     - Evaluation refinements (gap critico should trigger feedback frequency bump)
     - Edge cases (missing config → fallback to defaults)
     - Config loading failures → graceful error
   - All tests pass before integration

**Deliverable**: pedagogical-dimensions.ts module + types + test suite

---

### **Phase 4: Extend TrainingPlanPedagogy Model** (*depends on Phase 1 + 3*)

1. **Modify `src/core/models.ts`** (TrainingPlanPedagogy type)
   - Add optional field: `dimensions?: { base: PedagogicalDimensionsProfile; refined?: PedagogicalDimensionsProfile; adjustments?: RefinementReason[] }`
   - Simpler structure: base + refined + reason array (better for analytics)
   - Rationale: Dimensions are metadata, not core decision (gradual adoption)
   - Zero breaking changes to existing pedagogy fields
   - Dimensions persist in JSON blob via training.ts unchanged

**Deliverable**: models.ts updated (3 lines), TypeScript validates

---

### **Phase 5: Integrate into buildAutoPlanPedagogy** (*depends on Phase 3 + 4*)

1. **Modify `buildAutoPlanPedagogy()` in `app/class/[id]/session.tsx`** (*around line 907*)
   - Early in function: Call `deriveDimensionsProfile(studentAge, classLevel, classPhase, performanceState, config)`
   - After evaluation: Call `refineDimensionsByEvaluation(profile, evaluation, config)`
   - Embed dimensions in returned pedagogy:
     ```ts
     pedagogy = {
       ...existingFields,
       adaptation: {...},
       dimensions: { baseProfile, refined, derivationTrace }
     }
     ```
   - **Crucial**: Dimensions are informational only; decision logic unchanged (coaches don't see UI difference)
   - Telemetry override flow stays identical

2. **Test integration** (*executes Phase 6*)
   - Create training plans for Profile A (8–11 iniciação), B (10–12 formação), C (14+ competitivo)
   - Verify dimension profiles are populated correctly
   - Verify dimensions persist in saved training_plans JSON in Supabase

**Deliverable**: session.tsx modified + integration tests pass

---

### **Phase 6: Bootstrap Config Loading** (*depends on Phase 2 + 5*)

1. **Finalize config loader in `src/bootstrap/bootstrap.ts`**
   - Load pedagogical-dimensions.json at app startup
   - Validate JSON schema (report errors to Sentry, don't crash)
   - Cache in memory for performance
   - Expose via `usePedagogicalConfig()` hook (optional context provider in _layout.tsx)

2. **Test bootstrap**
   - App starts with valid config (no errors)
   - App starts with missing config (fallback hardcoded, warning logged)
   - App starts with invalid config (validation error logged, fallback used)

**Deliverable**: Bootstrap complete + e2e app start test passes

---

### **Phase 7: Comprehensive Testing & Documentation** (Closing & verification)

1. **Test suite** (*combines unit + integration*)
   - Functional tests: Dimensions derivation across all student types (8–18 age range, level 1–3)
     - Example: class level 1, age 10, fundamentos phase → expect variability=baixa, representativeness=media
   - Evaluation refinement tests: Gap critico + low consistency → expect feedbackFrequency boost
   - Edge cases: Missing config, invalid data, no history (low confidence)
   - Performance: Config loading + dimension derivation < 100ms total
   - Regression: Existing override telemetry still works unchanged

2. **Document design decisions**
   - Why 5 dimensions (user-provided + scientific alignment)
   - Why JSON config (vs DB, vs inline) → auditability + editability without redeploy
   - Why gradual integration (learn in background, zero UX disruption)
   - Versioning policy: semver + changelog in config
   - How to update responsibly: change config file, increment version, commit to git

3. **Create knowledge worker documentation** (for coaches/coordinators, Phase 8+)
   - What dimensions are (non-technical intro)
   - Why system adapts per age/level (science, no "author X says" language)
   - How to interpret dimension recommendations in dashboard (future)

4. **Pro forma sunset plan** (document future, Phase 8+)
   - Current pedagogy fields stay untouched for backwards compatibility
   - v2: Dimension profiles guide exercise selection (replaces static methodology KB)
   - v3: Automatic per-team personalization (learn override patterns → adjust thresholds)

---

## Relevant Files

**To create**:
- `src/core/pedagogical-dimensions.ts` — derivation + refinement functions + types
- `src/config/pedagogical-dimensions.json` — dimensions matrix + derivation rules (versioned)
- `src/core/__tests__/pedagogical-dimensions.test.ts` — unit + integration tests

**To modify**:
- `app/class/[id]/session.tsx` (line ~907) — `buildAutoPlanPedagogy()` calls `deriveDimensionsProfile()` + `refineDimensionsByEvaluation()`
- `src/core/models.ts` (line ~252) — extend `TrainingPlanPedagogy` type with `dimensions?` field
- `src/bootstrap/bootstrap.ts` — add config loader + context provider (optional)
- `app/_layout.tsx` — wrap with optional `PedagogicalConfigProvider`

**Unchanged (preserving robustness)**:
- `src/core/pedagogical-evaluation.ts` — evaluation logic stays stable + testable
- `src/db/training.ts` — persistence already handles JSON pedagogy
- Session override telemetry / decision tracking — continues unchanged

---

## Verification

**Phase completion gates**:

1. **Phase 1 gate**:
   - 5 dimensions fully defined with scientific basis ✓
   - Example profiles for age 8, 12, 16 ✓
   - All sources documented + confidence levels ✓

2. **Phase 2 gate**:
   - JSON schema designed + example config valid ✓
   - Bootstrap loader skeleton complete ✓

3. **Phase 3 gate**:
   - `deriveDimensionsProfile()` compiles + all unit tests pass ✓
   - `refineDimensionsByEvaluation()` passes edge case tests ✓

4. **Phase 5 gate**:
   - `npm run lint` passes (TypeScript strict) ✓
   - App compiles without errors ✓
   - Session creation still works (no regressions) ✓

5. **Phase 6 gate**:
   - App starts successfully, config loaded ✓
   - Fallback logic works (missing config doesn't crash) ✓

6. **Phase 7 gate**:
   - Unit test suite: ≥20 tests, all passing ✓
   - Integration test: Create sessions for profiles A, B, C; dimensions embedded correctly ✓
   - Regression test: Override UI still works unchanged ✓
   - Manual validation: Coach creates session, dimensions in saved JSON ✓

---

## Decisions

1. **Model-first design** (Phase 1 before Phase 2+3): Reduces rework, forces thinking before coding

2. **Gradual integration** (no UI change in v1): Dimensions metadata only, coaches see no difference. Allows system learning in background.

3. **Hybrid KB strategy** (user specified):
   - Logic (derivation, refinement) in TypeScript code (fast, testable, IDE support)
   - Configuration (dimension ranges, derivation matrix) in JSON (updatable without redeploy, git-versioned)
   - Rationale: Science updates = config JSON edits, not software deploys

4. **Preserve pedagogical-evaluation.ts**: Already robust + well-tested. Dimensions sits beside it (analysis ≠ decision context).

5. **JSON over YAML**: Better TypeScript tooling, JSON Schema standard, easier validation

6. **Fallback defaults required**: If config missing, hardcoded defaults kick in (resilience > brittleness)

7. **No database refactor in v1**: Config stays in repo (git versioning). DB-persisted per-school overrides deferred to Phase 8+.

8. **Discrete dimension levels (low/med/high)** not numeric (0–100): Simpler reasoning, aligned with Portuguese pedagogy language. Numeric can follow during calibration.

---

## Scope Reduction for v1 (CRITICAL - FOLLOW THIS) ⚠️

**Do NOT implement in v1:**
- Multi-condition giant matrix (use composition instead)
- UI exposure of dimensions (metadata-only)
- Exercise automation (validate dimensions first)

**DO implement in v1:**
- ✓ 5 dimensions with 3 discrete levels each
- ✓ 4 age profiles (8–11, 10–12, 12–14, 14+)
- ✓ 3 level adjustments (delta adjustments per level 1/2/3)
- ✓ 3 phase modifiers (consolidacao, especializacao, competicao)
- ✓ 5 refinement rules (gap/trend/confidence-based)
- ✓ Safety gate (sampleConfidence = "baixo" blocks adjustment)

**Result**: ~40 lines of JSON config, simple composition logic, easily testable and maintainable

---

## Further Considerations

1. **How to keep JSON maintainable?**
   - Composition model (ageProfiles + levelAdjustments + phaseModifiers) scales better than single giant matrix
   - Add comments in JSON explaining each rule + source
   - Version on each change (git audit trail)

2. **When to expose dimensions to coaches?**
   - v1: Metadata only, invisible in session UI (correct)
   - v2+ (Phase 8+): Metrics dashboard showing derivation + confidence levels
   - Do NOT show in training plan UI yet (no value until system influences decisions)

3. **Should dimensions feed exercise selection?**
   - v1: Guidance metadata only (coaches still select drills manually)
   - v2+ (Phase 9+): Dimensions → influence exercise recommendation or automatic filtering
   - First validate that base/refined profiles match observed coaching patterns

---

## Most Important Phrase (Remember This)

> "First make the system think correctly. Then show it to the user."

👉 Dimensions are correct ONLY when base profiles match what coaches actually need.
