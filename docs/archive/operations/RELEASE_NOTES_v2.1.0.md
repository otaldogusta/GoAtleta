# GoAtleta v2.1.0 - Security Hardening Release Notes

Release date: 2026-03-03

## Summary
- Complete hardening cycle for client and edge-function security.
- Crash resilience improved for persisted/session JSON parsing.
- Input validation enforced across critical Supabase Edge Functions.
- Sync/NFC stability improved for long-running and concurrent workloads.

## Security Fixes Included

### FIX #1 - Safe JSON parsing
- Added centralized safe parser (`safeJsonParse`) and replaced risky parse flows in storage/network paths.
- Prevents crash loops when persisted payloads are malformed.

### FIX #2 - Edge Function input validation
- Added shared validation utility for string/array/number/object payload constraints.
- Hardened functions:
  - `students-import`
  - `kb_ingest`
  - `send-push`
  - `claim-trainer-invite`
  - `create-student-invite`

### FIX #3 - Number coercion safety
- Added safe number guards (`safeNumber`, `safeInt`) and replaced unsafe conversions in critical logic.

### FIX #4 - SmartSync race hardening
- Added queued re-sync handling during in-flight flushes to avoid missed post-flight writes.

### FIX #5 - Session/token handling hardening
- Session parsing and refresh now use safe parsing paths.
- Session storage flow remains secured with SecureStore on native.

### FIX #6/#7 - NFC loop/runtime stability
- Added periodic yield in continuous scan loop.
- Added explicit cleanup for diagnostics attachment to avoid stale globals on remount/unmount cycles.

## Deploy Notes
- Supabase functions deployed and active:
  - `send-push` (v1)
  - `kb_ingest` (v1)
- Existing critical functions re-deployed with validation updates:
  - `students-import`
  - `claim-trainer-invite`
  - `create-student-invite`

## Validation Evidence
- Core suite: 10/10 suites passing, 34/34 tests passing.
- Session storage suite: 5/5 tests passing.
- Smoke validation script executed against production endpoints:
  - All 5 hardened routes returned protected behavior (401/400 depending on auth context and payload path).

## Operational Follow-up (Post-release)
- Monitor 24h using `POST_DEPLOY_MONITORING.md` checklist:
  - Crash rate
  - NFC memory/duplicate metrics
  - Edge Function auth/validation error profile (`401/403/429/400` distribution)

