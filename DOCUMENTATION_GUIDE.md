# 📚 DOCUMENTAÇÃO GUIDE — GoAtleta

**Status:** ✅ Clean & Organized
**Total MDs:** 8 (essenciais apenas)
**Last Update:** 2026-02-18

---

## Decision Authority (Fase 2.1)

Canonical chain for pedagogical sovereignty:

1. Trimestre orienta direcao.
2. Semana define intencao.
3. Sessao define execucao.
4. Guards impoem limites.
5. QA observa.
6. Recommendation sugere.
7. Professor decide.

Reference module: `src/core/decision-authority/`

## Weekly Authority in Observability (Fase 2.2)

The weekly authority contract is observability-aware.

- week defines intention
- session defines execution
- authority checks validate whether execution stayed inside the weekly role envelope
- QA surfaces authority violations
- this does not change generation behavior

Reference builder: `src/screens/periodization/application/build-weekly-observability-summary.ts`

## Weekly Stability (Fase 2.3)

Weekly stability is an aggregated observability result.

It considers:

- drift signals
- weekly authority violations
- severity weighting

This affects QA prioritization and unstable-week detection,
but does not affect generation behavior.

## Observability Insights (Fase 2.4)

Observability insights are prioritized internal interpretations built from:

- stability
- authority
- drift frequency
- recent windows
- quarter concentration

They are QA-facing only.
They do not alter generation behavior.
They do not auto-apply recommendations.

## Recommendation Engine (Fase 2.5)

Recommendations are internal, explainable, and suggestion-only.

They are built from:

- stability
- authority
- drift
- insights

They:

- do not change generation
- do not auto-apply fixes
- do not override teacher decisions

## Recommendation Decision Trail (Fase 2.6)

Recommendations can now be recorded as auditable teacher decisions.

The trail stores:

- accepted or rejected status
- optional reason type and note
- recommendation evidence snapshot
- class, cycle, plan, and week context

This layer:

- does not auto-apply recommendations
- does not alter the generation engine
- preserves teacher sovereignty as the final authority
- turns QA recommendations into explicit operational memory

## Recommendation Evidence Layer (Fase 2.7)

The evidence layer compares recommendation decisions with the observability
state of the following weeks.

It helps answer:

- did stability improve?
- did authority recover?
- was there enough evidence?

It does not auto-update generation behavior.

## Recommendation Family Aggregates (Fase 2.8)

Recommendation families can now be aggregated by class history.

This tracks:

- suggested
- accepted
- rejected
- improved
- worsened
- insufficient evidence

This produces observational confidence only.
It still does not auto-change generation behavior.

## Ranking Modulation by Observational Confidence (Fase 2.9)

Internal recommendations now keep the same generation source, but QA reading priority is modulated.

Ranking score model:

- base priority: high=30, medium=20, low=10
- confidence bonus: high=+5, medium=+2, low=+0
- final score: base + bonus

Behavioral constraints maintained:

- no motor change
- no automatic intervention
- no hiding low-confidence recommendations
- only reading order and ranking reason badges are affected

## Confidence-Informed Recommendation Framing (Fase 3.0)

Observational confidence can now inform recommendation framing.

This may label a recommendation as:

- favorable history
- inconclusive history
- unfavorable history

This does not suppress or auto-apply recommendations.
It only informs internal QA interpretation.

## Confidence-Informed Recommendation Wording (Fase 3.1)

Recommendation framing now influences internal QA wording.

Possible tones:

- reinforced
- neutral
- cautious

This does not hide recommendations.
This does not alter generation behavior.
This only changes internal interpretation and presentation.

## Recommendation Problem Families (Fase 3.2)

Recommendations now carry a problem-family annotation.

Examples:

- weekly alignment
- technical isolation
- load progression
- game transfer
- quarter closing
- repetition control

This improves internal QA interpretation and wording consistency.
It does not change generation behavior.

## Dominant Family QA Summary (Fase 3.3)

Internal QA now also computes a cohort summary by problem family.

Summary outputs include:

- dominant family label
- recommendation count per family
- high-priority count per family
- cautious-tone count per family

Behavioral constraints maintained:

- recommendation-level visibility is preserved
- no recommendation is hidden or auto-resolved
- no engine-control side effects are introduced
- this is additive QA interpretation only

## Dominant Problem Axis Summary (Fase 3.4)

The QA layer can now summarize the class by dominant problem axis.

It identifies:

- dominant family
- secondary family (when relevant)
- observed tension: reinforcing, competing, or isolated

Behavioral constraints maintained:

- no change to recommendation generation logic
- no automatic intervention
- no recommendation suppression
- QA interpretation only

## Problem Family Timeline and Axis Transition (Fase 3.5)

The QA layer can now inspect the recent timeline of dominant problem families.

It identifies:

- dominant family by week
- stable axis
- axis shift
- axis rotation

Behavioral constraints maintained:

- no change to recommendation generation logic
- no automatic intervention
- no recommendation suppression
- QA interpretation only

## Axis Persistence and Early Warning (Fase 3.6)

The QA layer can now detect when axis rotation becomes a persistent instability pattern.

It identifies:

- `stable_persistence`: dominant family holds >= 70% of analyzed weeks
- `mixed_persistence`: two families competing without clear dominance
- `unstable_rotation`: 3+ distinct families with no family exceeding 50%

Early warning levels:

- `none`: stable persistence observed
- `attention`: mixed persistence (oscillation present but not critical)
- `warning`: unstable rotation with >= 4 weeks of evidence (pattern confirmed)

Behavioral constraints maintained:

- no change to recommendation generation logic
- no automatic intervention
- no recommendation suppression
- QA interpretation only

## QA Digest Final (Fase 3.7)

The QA layer now consolidates all axis observations into a single human-readable digest per class.

It includes:

- dominant axis label
- secondary axis label and tension
- persistence type
- early warning level
- top recommendation focus

Behavioral constraints maintained:

- QA-facing only
- no recommendation generation change
- no automatic intervention

## Short vs Medium Window Comparison (Fase 3.8)

The QA layer can now compare the dominant problem axis across two time windows.

Windows:

- short: last 2–3 weeks (default 3)
- medium: last 6–8 weeks (default 7)

Possible interpretations:

- `acute`: short and medium windows diverge (recent oscillation)
- `structural`: same axis dominates both windows (chronic pattern)
- `inconclusive`: insufficient data for a clear reading

Behavioral constraints maintained:

- QA interpretation only
- no automatic intervention

## Axis vs Recommendation Alignment (Fase 3.9)

The QA layer can now check whether the top recommendation aligns with the dominant problem axis.

Alignment types:

- `convergent`: recommendation family matches dominant axis
- `partially_convergent`: recommendation family matches secondary axis
- `divergent`: recommendation family unrelated to observed axes

Behavioral constraints maintained:

- no recommendation suppression
- no automatic recalibration
- QA observation only

---

## 🗺️ Mapa de Documentação

### Linha atual do produto

Ler em ordem:

1. `README.md` — visão geral, setup e estrutura
2. `ROADMAP.md` — backlog executivo focado em gerador, periodização e governança
3. `DOCUMENTATION_GUIDE.md` — histórico funcional das fases de observabilidade e QA

### Documentos auxiliares do núcleo pedagógico

- `docs/PEDAGOGICAL_DIMENSIONS_SYSTEM.md`
- `docs/PEDAGOGICAL_DIMENSIONS_VERIFICATION.md`
- `docs/expansao-catalogo-pedagogico.md`
- `docs/ficha-validacao-pedagogica-humana.md`

### Documentos legados e operacionais

Estes documentos ainda podem ser úteis, mas nao definem mais o norte do produto:

- `docs/NFC_ARCHITECTURE_REFACTOR.md`
- `PRODUCTION_READINESS_SUMMARY.md`
- `RELEASE_CHECKLIST.md`
- `POST_DEPLOY_MONITORING.md`
- `SIGN_OFF_PRODUCTION.md`

## 📖 Quando Ler Cada Um

### Novo no projeto?

Leia em ordem:

1. `README.md`
2. `ROADMAP.md`
3. `DOCUMENTATION_GUIDE.md`

Tempo: ~20 min

### Vou mexer no gerador e na periodizacao

Leia:

1. `ROADMAP.md`
2. `DOCUMENTATION_GUIDE.md`
3. `docs/PEDAGOGICAL_DIMENSIONS_SYSTEM.md`
4. Codigo em `src/core/`, `src/db/`, `src/screens/periodization/` e `app/periodization/`

Tempo: ~45-60 min

### Vou mexer na leitura QA e recommendation

Leia:

1. `DOCUMENTATION_GUIDE.md`
2. `ROADMAP.md`
3. Codigo em `src/db/observability-summaries.ts` e `src/screens/periodization/`

Tempo: ~30-40 min

### Vou mexer em deploy ou infraestrutura

Leia em ordem:

1. `PRODUCTION_READINESS_SUMMARY.md`
2. `RELEASE_CHECKLIST.md`
3. `POST_DEPLOY_MONITORING.md`
4. `SIGN_OFF_PRODUCTION.md`

Tempo: ~1 hora

## 📋 Documentos Prioritarios Agora

| Ordem | Documento | Papel atual |
|---|---|---|
| 1 | `README.md` | entrada do projeto |
| 2 | `ROADMAP.md` | backlog e prioridade de execucao |
| 3 | `DOCUMENTATION_GUIDE.md` | memoria funcional das fases 2.x e 3.x |
| 4 | `docs/PEDAGOGICAL_DIMENSIONS_SYSTEM.md` | estrutura conceitual pedagogica |
| 5 | `docs/PEDAGOGICAL_DIMENSIONS_VERIFICATION.md` | verificacao do sistema pedagogico |

## ✅ Leitura de foco do produto

O centro atual do GoAtleta e:

- fazer a periodizacao mandar no plano
- melhorar a coerencia do plano gerado
- usar inteligencia observacional para calibrar leitura interna
- manter QA como apoio, nao como motor

## Observação

O bloco antigo de NFC, deploy e operacao continua disponivel no repositório, mas agora deve ser tratado como documentacao auxiliar ou legado de infraestrutura, nao como espinha dorsal da evolucao do produto pedagógico.

## ✅ Checklist de Higiene

**Passou?** → Docs estão limpas!

- [x] Nenhum MD duplicado
- [x] Nenhum MD legado em root
- [x] MDs organizados por função (dev/ops/deploy)
- [x] Índice claro em README
- [x] Crosslinks funcionam
- [x] Nenhum MB de docs extras
- [x] Tamanho total < 60KB
- [x] Onboarding < 30 min

---

## 🎓 Onboarding Agora (3 Passos)

### Step 1: Setup (5 min)
```bash
git clone ...
npm install
npm run typecheck:core
```

### Step 2: Docs (5 min)
Leia `README.md`

### Step 3: Code (10 min)
```bash
ls src/core/
ls src/screens/periodization/
# Ver: sessionGenerator.ts, periodization.ts, WeekTab.tsx, hooks/
```

**Total:** 20 min (antes era 30+)

---

## 🚀 Você Está Pronto!

✅ Projeto limpo
✅ Docs organizados
✅ Documentação estratégica apenas
✅ Foco no gerador e na periodização

**Próxima etapa:** Dev novo? Leia `README.md` → `ROADMAP.md` → `DOCUMENTATION_GUIDE.md` ✅

---

**Last Updated:** 2026-04-22
**Status:** 🟢 PRODUCT-FOCUSED & CLEAN

Agora sim, projeto higiênico! 🧹✨
