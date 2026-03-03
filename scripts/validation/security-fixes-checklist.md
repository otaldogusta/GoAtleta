Security Fixes Validation Checklist (#2-#5)
===========================================

Date baseline: 2026-03-03

Automated checks already run
----------------------------
- `npm run release:check:core` -> PASS
- `npm run test:core` -> PASS (10 suites, 34 tests)
- `npm run typecheck:core` -> PASS
- `npm run release:check` -> FAIL due to pre-existing lint errors outside this security scope

Edge Function negative smoke tests (FIX #2)
-------------------------------------------
Use:

```powershell
powershell -File scripts/validation/security-fixes-smoke.ps1 `
  -SupabaseUrl "https://<project-ref>.supabase.co" `
  -AccessToken "<jwt>"
```

Expected:
- Invalid payloads return `400`
- If token is invalid/expired, `401` is acceptable

Coverage:
- `students-import` oversized `rows`
- `kb_ingest` oversized `query`
- `send-push` oversized `title/body`
- `claim-trainer-invite` invalid `code`
- `create-student-invite` empty `studentId`

Manual validation for FIX #3 (number coercion)
----------------------------------------------
1. Trigger a regulation path that reads numeric clauses.
2. Force a non-numeric value (for test data only), e.g. `"abc"` in a numeric clause.
3. Confirm app behavior uses fallback instead of breaking logic.
4. Reference implementation: `src/regulation/clause-engine.ts` now uses `safeNumber(...)`.

Manual validation for FIX #4 (sync race)
----------------------------------------
1. In app, enqueue pending writes (offline mode or simulated network failures).
2. Trigger multiple rapid sync attempts (`syncNow`) while timer sync is active.
3. Confirm no duplicate concurrent flush execution and no duplicate records.
4. Reference: `src/core/smart-sync.ts` uses `inFlightSync` lock in `performSync()`.

Manual validation for FIX #5 (token security)
---------------------------------------------
1. On native device, login with `remember=true`.
2. Confirm session is loaded from SecureStore path (not plain AsyncStorage fallback).
3. Logout and confirm secure token removal.
4. Reference: `src/auth/session.ts` (`getSecureStore`, `setItemAsync`, `deleteItemAsync`).
5. Existing automated coverage: `src/auth/__tests__/session-storage.test.ts`.

Sign-off criteria
-----------------
- Edge function smoke script: all tests `PASS`
- Core checks: PASS
- Manual checks for #3/#4/#5 completed and documented with timestamp + tester

