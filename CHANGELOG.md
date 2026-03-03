# Changelog

## 2026-03-03 - Security Hardening Rollup

### Added
- `safeJsonParse` utility and adoption across storage/network parsing paths.
- `safeNumber`/`safeInt` utilities for safer numeric coercion.
- Shared edge-function input validators in `supabase/functions/_shared/input-validation.ts`.
- Security smoke validation assets:
  - `scripts/validation/security-fixes-smoke.ps1`
  - `scripts/validation/security-fixes-checklist.md`

### Changed
- Edge functions hardened with payload validation and size limits:
  - `students-import`
  - `kb_ingest`
  - `send-push`
  - `claim-trainer-invite`
  - `create-student-invite`
- `SmartSync` improved with queued resync handling during in-flight flushes.
- Session parsing/refresh hardened to avoid invalid JSON crashes.
- NFC continuous loop improved with periodic event-loop yield and diagnostics cleanup.

### Deployed
- Supabase functions deployed and active:
  - `send-push` (v1)
  - `kb_ingest` (v1)

### Validation
- Core test suite passing: 10 suites / 34 tests.
- Session storage tests passing: 5/5.
- Smoke tests with anon token confirm endpoint/auth hardening behavior (`401` expected).
- Smoke tests with user JWT pending (requires valid project user token).

