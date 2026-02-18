# PR Stack Summary — 2026-02-17

## Context
Este documento organiza os entregáveis recentes em blocos de PR para facilitar revisão, auditoria e retro/handoff.

## PR A — UI polish (Events + Assistant cards)
### Commits
- `26cc6ca` style(events): organize details modal with side-by-side fields
- `22c7e26` style(events): force side-by-side fields in details modal
- `aef249e` fix(events): close details modal after successful save
- `6ebe5bb` style(events): remove extra padded wrapper in details modal
- `1da4005` feat(events): use dropdowns for category and sport in details modal
- `0a69a78` fix(events): anchor detail dropdown list to modal container
- `1ca80fc` style(events): remove dropdown item separator lines in details modal
- `ea1852e` style(events): remove separator lines from create-event dropdowns
- `d7870f7` fix(events): use pt-BR date format in details modal inputs
- `94c6f16` refactor(dates): standardize pt-BR date input/display across app flows
- `164bb26` style(events): add subtle shimmer placeholders in details modal loading
- `7154279` fix(events): add fallback navigation when closing details modal
- `32b5a30` fix(events): split detail datetime into separate date and time fields
- `36489f9` fix(events): improve details modal save/delete behavior and change tracking
- `e26ebb4` style(events): match delete button with student edit modal pattern
- `96f4567` style(assistant): make quick suggestion cards responsive and readable

### Outcome
- Ajustes visuais/UX de eventos e cards do assistente estabilizados para uso real (mobile + web).

---

## PR 1 — AI Foundation (deterministic + evidence contract)
### Commit
- `a133b76` feat(ai): start foundation with progression engine and evidence contract

### Key files
- `src/core/models.ts`
- `src/core/progression-engine.ts`
- `src/core/__tests__/progression-engine.test.ts`
- `src/db/sqlite.ts`
- `src/db/ai-foundation.ts`
- `supabase/functions/assistant/index.ts`

### Outcome
- Fundamentos de IA determinística + contrato de evidência/citação + base local.

---

## PR 2 — Assistant blocks and orchestration
### Commit
- `ae4fde7` feat(assistant): implement progression, executive summary, support mode and autofix actions

### Key files
- `app/assistant/index.tsx`
- `src/core/ai-operations.ts`

### Outcome
- Blocos de assistente integrados na UI com ações operacionais.

---

## PR 3 — Production RAG + observability + smoke
### Commit
- `2449e3d` feat(ai): ship PR3 RAG retrieval, observability, and smoke tooling

### Key files
- `supabase/functions/assistant/index.ts`
- `supabase/migrations/20260216_create_kb_documents_for_rag.sql`
- `scripts/seed-kb-documents.sql`
- `scripts/smoke-assistant-rag.ps1`
- `src/core/volleyball/skill-ladders.ts`
- `src/core/progression-engine.ts`
- `src/core/models.ts`
- `src/db/sqlite.ts`
- `src/db/ai-foundation.ts`
- `app/assistant/index.tsx`

### Outcome
- Retrieval com escopo por org/esporte, logs estruturados, cache/dedup e smoke enterprise.

---

## PR 3.1 — Hardening pós-smoke
### Commit
- `bafede7` fix(ai-rag): harden org parsing and align kb RLS helpers

### Key files
- `supabase/functions/assistant/index.ts`
- `supabase/migrations/20260216_create_kb_documents_for_rag.sql`
- `scripts/setup-kb-rag.sql`

### Outcome
- Robustez de payload (`organizationId` / `organization_id`) e RLS alinhada ao padrão `is_org_member`/`is_org_admin`.

---

## Validation snapshot
- Org seeded (`fbd81104-da5e-4358-8ea5-36a4c57e96cb`): `citations_count > 0`.
- Org sem seed (`e8622a02-1c6c-49a1-a2c9-b2a5fb9ee934`): `citations_count = 0`, sem vazamento cross-org.
- Guardrail: comportamento conservador com `missing_data` quando faltam evidências.

## Suggested release tags (optional)
- `ai-pr1-foundation`
- `ai-pr2-assistant-blocks`
- `ai-pr3-rag-observability`
- `ai-pr3-1-hardening`

---

## PR NFC1 — Presença NFC por UID (Android-first)
### Scope
- Leitura de tag NFC por UID (sem escrita NDEF), com fluxo de bind `tag_uid -> student_id` por organização.
- Nova tela `app/nfc-attendance.tsx` com:
  - seleção de turma
  - scan de tag
  - registro de check-in quando UID já está vinculado
  - modal de vinculação quando UID ainda não existe (admin)
- Módulos:
  - `src/nfc/nfc.ts`
  - `src/nfc/nfc-errors.ts`
  - `src/nfc/nfc-types.ts`
  - `src/nfc/nfc-hooks.ts`
  - `src/data/nfc-tag-bindings.ts`
  - `src/data/attendance-checkins.ts`
- Migração:
  - `supabase/migrations/20260218_add_nfc_presence.sql`
- Guardrails:
  - Web sem NFC
  - fallback de erro quando módulo nativo NFC não está presente no build
  - bind restrito por RLS para admin de org

### Rebuild Required
- Esta entrega exige novo build nativo (Dev Client/EAS), pois usa módulo NFC nativo.
- Comandos recomendados:
  - `eas build --profile development --platform android`
  - instalar build no device
  - `npx expo start -c`
