# Pedagogical Dimensions System - Implementation Documentation

## Overview

The Pedagogical Dimensions System transforms GoAtleta from author-anchored pedagogy to a **science-based, runtime-updatable system** that derives session design guidance from:

- **Student age** (developmental stage)
- **Class level** (skill proficiency: iniciação, formação, competitive)
- **Periodization phase** (training cycle: fundamentos, consolidação, especialização, competição)
- **Performance state** (optional: gap, trend, consistency)

The system is grounded in 2020+ motor learning science (Schmidt & Lee, Ecological Dynamics, Constraint-Led Approach) and allows configuration updates via JSON without code redeployment.

---

## Architecture

### Layered Approach

**Phase 1 (Base)**: Derive profile from age + level + phase
- Simple composition: age profile → apply level delta → apply phase delta
- No evaluation required; safe default for new students

**Phase 2 (Refinement)**: Adjust profile based on performance evaluation
- Evaluates gap level, trend, and consistency
- **Safety gate**: If sample confidence = "baixo", blocks all adjustments
- Tracks why each dimension changed (audit trail)

### Key Principles

1. **Metadata-first (v1)**: Dimensions inform decisions but don't yet drive automated choices. Coaches still select exercises manually.
2. **Science-backed**: Each dimension grounded in 2+ sources (2020+).
3. **Transparent**: All derivations logged with reasons for coaching feedback.
4. **Resilient**: Fallback config if JSON loading fails; app never crashes due to dimensions.
5. **Updatable**: JSON config versioned in git; changes reviewed, no code redeploy needed.

---

## Five Dimensions

### 1. Variability
**How much repetition vs. variation in practice conditions**

- **Baixa** (Blocked): Identical repetitions (e.g., 10 passes to target, same setup). For **motor planning** phase (initial learning).
- **Media** (Variable): Same task, different contexts (e.g., passes to different targets). For **consolidation**.
- **Alta** (Random): Diverse tasks and conditions (e.g., random pass sequences, game-like). For **transfer**.

**Source**: Schmidt & Lee (2020) - Contextual Interference Effect

---

### 2. Representativeness
**How closely practice matches real match conditions**

- **Baixa** (Isolated): Decontextualized drills (e.g., passing in a line). For **technique refinement**.
- **Media** (Semi-Realistic): Simplified scenarios (e.g., 2v2 with simplified scoring). For **transitional learning**.
- **Alta** (Game-Realistic): Match constraints present (e.g., full-court play, scoring rules, time pressure). For **transfer & competition**.

**Source**: Ecological Dynamics Approach (Davids et al., 2008+)

---

### 3. Decision-Making (Autonomy)
**How many strategic/tactical decisions learner makes**

- **Baixa** (Coach-Directed): Coach decides all (e.g., "pass to position 4"). For learners **focusing on execution**.
- **Media** (Guided Choices): Coach sets constraints; learner chooses within bounds (e.g., "pass to front row, your choice"). For **transitional autonomy**.
- **Alta** (High Autonomy): Learner decides all (e.g., "free play, any pass allowed"). For **competitive readiness**.

**Source**: Constraint-Led Approach (Renshaw et al., 2016+); Ecological Dynamics

---

### 4. Task Complexity
**Cognitive + motor demands of individual drills**

- **Baixa** (Simple): Single focal element (e.g., "pass technique only"). For **foundational technique**.
- **Media** (Moderate): 2–3 elements combined (e.g., "pass + movement + timing"). For **intermediate skill**.
- **Alta** (Complex): Multi-element sequences (e.g., "receive → plant → rotate → pass"). For **advanced skill**.

**Source**: Fitts & Posner (1967); Newell's Constraints Model (1986)

---

### 5. Feedback Frequency
**Rate + timing of coach feedback**

- **Baixa** (Low): Delayed, summary feedback (e.g., post-session debrief). For learners with **good self-monitoring**.
- **Media** (Moderate): Near real-time (e.g., post-drill summary). For **transitional feedback dependency**.
- **Alta** (High): Immediate per-rep feedback (e.g., "good pass!", per attempt). For **early learners or critical gaps**.

**Source**: Schmidt & Lee (2020) - Guidance Hypothesis; Information Processing

**Confidence**: Media (feedback timing optimal varies by learner)

---

## Configuration Structure

File: `src/config/pedagogical-dimensions.json`

```json
{
  "version": "2026.04.07.1",
  "lastUpdated": "ISO-8601 timestamp",
  "dimensions": {
    "variability": { "baixa": {...}, "media": {...}, "alta": {...} },
    "representativeness": {...},
    "decisionMaking": {...},
    "taskComplexity": {...},
    "feedbackFrequency": {...}
  },
  "ageProfiles": {
    "8-11": { variability: "baixa", representativeness: "baixa", ... },
    "10-12": { variability: "media", ... },
    "12-14": { ... },
    "14+": { variability: "alta", ... }
  },
  "levelAdjustments": {
    "1": { deltaVariability: 0, deltaRepresentativeness: 0, ... },
    "2": { deltaVariability: 0.1, deltaRepresentativeness: 0.1, ... },
    "3": { deltaVariability: 0.2, ... }
  },
  "phaseModifiers": {
    "fundamentos": { deltaVariability: -0.1, ... },
    "consolidacao": { deltaVariability: 0, ... },
    "especializacao": { deltaVariability: 0.1, ... },
    "competicao": { deltaVariability: 0.2, ... }
  },
  "refinementRules": {
    "rules": [
      {
        "id": "critical-gap-low-consistency",
        "condition": "gap.level === 'critico' && consistencyScore < 50%",
        "adjustments": { "feedbackFrequency": "+1" }
      }
    ],
    "safetyGates": [
      {
        "id": "low-sample-confidence",
        "condition": "sampleConfidence === 'baixo'",
        "action": "BLOCK all adjustments; return baseProfile unmodified"
      }
    ]
  },
  "changeLogs": [...]
}
```

---

## Code Integration

### Module: `src/core/pedagogical-dimensions.ts`

**Exports**:

```typescript
export function deriveDimensionsProfile(
  input: DimensionDerivationInput,
  config: PedagogicalDimensionsConfig
): DimensionDerivationResult

export function refineDimensionsByEvaluation(
  baseProfile: PedagogicalDimensionsProfile,
  evaluation: SessionOutcomeEvaluation | null,
  config: PedagogicalDimensionsConfig
): RefinedDimensionsProfile

export function deriveDimensionsWithRefinement(
  input: DimensionDerivationInput,
  evaluation: SessionOutcomeEvaluation | null,
  config: PedagogicalDimensionsConfig
): DimensionDerivationResult

export function formatDimensionsProfile(
  profile: PedagogicalDimensionsProfile,
  label?: string
): string

export function formatRefinements(
  adjustments: RefinementReason[] | undefined
): string
```

### Bootstrap Integration

**File**: `src/bootstrap/bootstrap.ts`

At app startup:
1. Load JSON config from `src/config/pedagogical-dimensions.json`
2. Validate schema
3. Return in `BootstrapResult.pedagogicalConfig`
4. If loading fails, use hardcoded fallback + log to Sentry (non-critical)

**Context Hook**: `src/bootstrap/pedagogical-config-context.tsx`

```typescript
const config = usePedagogicalConfig();
if (config.isLoading) return <Loading />;
if (config.error) logWarning(config.error);
// Use config.config for dimensions derivation
```

### Session Builder Integration

**File**: `app/class/[id]/session.tsx` → `buildAutoPlanPedagogy()`

```typescript
// Early in function: derive base profile from age, level, phase
const dimensionsResult = deriveDimensionsProfile(
  { studentAge, classLevel, periodizationPhase, performanceState },
  pedagogicalConfig // passed as optional param
);

// After evaluation: refine profile
if (outcome) {
  dimensionsResult.refinedProfile = refineDimensionsByEvaluation(
    dimensionsResult.baseProfile,
    outcome,
    pedagogicalConfig
  );
}

// Return in pedagogy object:
return {
  ...existingFields,
  dimensions: {
    base: dimensionsResult.baseProfile,
    refined: dimensionsResult.refinedProfile,
    derivedAt: dimensionsResult.derivedAt,
    confidenceLevel: dimensionsResult.confidenceLevel,
  }
};
```

### Model Extension

**File**: `src/core/models.ts` → `TrainingPlanPedagogy`

```typescript
export type TrainingPlanPedagogy = {
  // ... existing fields ...
  dimensions?: {
    base: PedagogicalDimensionsProfile;
    refined?: RefinedDimensionsProfile;
    derivedAt?: string;
    confidenceLevel?: "alta" | "media" | "baixa";
  };
};
```

---

## Usage Examples

### Example 1: Young Beginner (8 years, Level 1, Fundamentos phase)

**Input**:
```typescript
const input = {
  studentAge: 8,
  classLevel: 1,
  periodizationPhase: "fundamentos"
};
```

**Derivation**:
- Age 8 → "8-11" profile: baixa variability, baixa representativeness, baixa decisionMaking, baixa taskComplexity, **alta feedbackFrequency**
- Level 1: no delta
- Phase "fundamentos": slight decrease in variability/representativeness, increase feedback

**Result Profile**:
```
Variability: baixa (blocked practice)
Representativeness: baixa (isolated drills)
DecisionMaking: baixa (coach-directed)
TaskComplexity: baixa (single elements)
FeedbackFrequency: alta (frequent feedback)
```

**Coaching Interpretation**:
> Use blocked practice (same drill repeated). Focus on technique only, no game context. Coach directs all decisions ("pass to position 3"). Simple movements (e.g., basic pass). Provide feedback after each repetition.

---

### Example 2: Intermediate Student (12 years, Level 2, Consolidação)

**Input**:
```typescript
const input = {
  studentAge: 12,
  classLevel: 2,
  periodizationPhase: "consolidacao"
};
```

**Result Profile**:
```
Variability: media (variable practice)
Representativeness: media (semi-realistic)
DecisionMaking: media (guided choices)
TaskComplexity: media (2–3 elements)
FeedbackFrequency: media (post-drill summary)
```

**Coaching Interpretation**:
> Use variable practice (same skill, different targets/setups). Simplified match rules (2v2 zone). Player chooses pass target within coach-set options. Two-element sequences (e.g., receive + pass). Summary feedback after each drill.

---

### Example 3: Competitive Squad (15 years, Level 3, Especialização)

**Input**:
```typescript
const input = {
  studentAge: 15,
  classLevel: 3,
  periodizationPhase: "especializacao",
  performanceState: {
    gap: { level: "critico" },
    trend: "descendo",
    consistencyScore: 40,
    sampleConfidence: "medio"
  }
};
```

**Base Profile**:
```
Variability: alta (random practice)
Representativeness: alta (full-court, match rules)
DecisionMaking: alta (high autonomy)
TaskComplexity: alta (complex sequences)
FeedbackFrequency: baixa (delayed, summary)
```

**Refinement** (gap=critico + consistency < 50 + confidence=medio):
```
FeedbackFrequency: baixa → media (increase feedback to address critical gap)
```

**Refined Profile**:
```
FeedbackFrequency: media (more frequent than usual for recovery)
```

**Coaching Interpretation**:
> Random, game-realistic drills (full play with opponents). High autonomy (all decisions by players). Complex sequences. Normally low feedback (learner self-monitors), BUT given critical gap + declining trend, increase feedback frequency to support recovery.

---

## Testing

**Unit Tests**: `src/core/__tests__/pedagogical-dimensions.test.ts`

Covers:
- Profile derivation for each age band
- Level adjustments (deltas)
- Phase modifiers
- Refinement rules (gap, trend, consistency)
- Safety gates (low sample confidence)
- Edge cases (out-of-range ages, clamping)
- Formatting & error handling

**Run**:
```bash
npm test pedagogical-dimensions.test.ts
```

**Functional Tests** (manual): Create training plans for 3 profiles (A: 8yo, B: 12yo, C: 16yo) and verify dimensions are correctly embedded in saved pedagogy JSON.

---

## Versioning & Updates

**Version Format**: `major.minor.date.patch` (e.g., `2026.04.07.1`)

**When to Update Config**:
1. Science paper published contradicting current understanding → revise dimension definitions
2. Coaching team feedback: "Our experience shows [dimension] should be [level] for [age + level + phase]"
3. Regional/federative guideline update
4. Performance data shows profile mismatch → tweak age/level/phase thresholds

**Update Process**:
1. Edit `src/config/pedagogical-dimensions.json`
2. Increment `version` field
3. Update `lastUpdated` timestamp
4. Add entry to `changeLogs` with motivation + reviewed by
5. Git commit with message: `chore: update pedagogical dimensions config v?.?.?.?`
6. No code redeploy needed (loaded at runtime)

**Audit Trail**:
- Git history tracks all changes
- Config version persisted with each training plan (in `pedagogy.dimensions.derivedAt`)
- Future: per-organization overrides persisted in DB (Phase 8+)

---

## Future Enhancements (Phase 8+)

### v2: Dimensions-Driven Exercise Selection
- Dimensions guide (not override) exercise recommendation list
- Filter drills by matching dimension profiles (e.g., "show me baixa variability drills")

### v3: Automatic Personalization
- Analytics dashboard: compare base vs. refined profiles
- Machine learning: detect override patterns → auto-adjust thresholds

### v4: Per-Organization Tuning
- Allow regions/federations to customize age/level/phase thresholds
- Persist org-specific config in DB; versioned & audited

### v5: AI-Assisted Calibration
- System suggests config tweak based on coaching feedback ("this profile didn't match our 10yo group")
- Coach reviews & approves before commit

---

## Troubleshooting

### Q: Config won't load?
**A**: Check JSON syntax in `src/config/pedagogical-dimensions.json`. App will use fallback (logged to Sentry). No crash.

### Q: Dimensions are all "muted" (always base, no refinement)?
**A**: Check that evaluation is being passed to `refineDimensionsByEvaluation()`. Verify `sampleConfidence !== "baixo"` (safety gate).

### Q: Why are dimensions visible but coaches don't see them in UI?
**A**: v1 is metadata-only. Training plan pedagogy JSON contains dimensions, but no UI display. Use Postman/API explorer to inspect `pedagogy.dimensions` in saved plans. Future UI (v2+) will show dimensions in session dashboard.

### Q: How do I test locally?
**A**: Run Jest tests (`npm test pedagogical-dimensions.test.ts`). Create training plan in dev env and inspect saved JSON: `training_plans.pedagogy.dimensions`.

---

## References

- **Schmidt, R. A., & Lee, T. D. (2020)**. *Motor Control and Learning*. 6th ed. Human Kinetics. *(Contextual Interference, Variability, Feedback)*
- **Davids, K., Button, C., & Bennett, S. (2008)**. *Dynamics of Skill Acquisition: A Constraints-Led Approach*. Human Kinetics. *(Ecological Dynamics)*
- **Renshaw, I., Davids, K., Newcombe, D., & Roberts, W. (2016)**. *The Constraints-Led Approach: Principles for Sports Coaching and Practice Design*. Routledge. *(Constraints, Decision-Making)*
- **Fitts, P. M., & Posner, M. I. (1967)**. *Human Performance*. Brooks/Cole. *(Motor Learning Stages)*
- **Newell, K. M. (1986)**. Constraints on the development of coordination. In M. G. Wade & H. T. A. Whiting (Eds.), *Motor Development in Children: Aspects of Coordination and Control*. Martinus Nijhoff. *(Task Constraints)*

---

## Contact & Support

For questions on the pedagogical dimensions system:
1. Check this document + tests for examples
2. Review config file comments (JSON `rationale` fields)
3. Check Sentry logs if loading fails
4. Engage coaching team for domain feedback on profiles

