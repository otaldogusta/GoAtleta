NFC Validation Scripts
======================

security-fixes-smoke.ps1
------------------------
Negative smoke tests for security hardening of edge functions (FIX #2).

Usage:

```powershell
powershell -File scripts/validation/security-fixes-smoke.ps1 `
  -SupabaseUrl "https://<project-ref>.supabase.co" `
  -AccessToken "<jwt>"
```

See also:
- `scripts/validation/security-fixes-checklist.md` for complete #2-#5 validation flow.

simulate-nfc-scans.js
---------------------
This script simulates NFC scan events by POSTing JSON payloads to a configurable HTTP endpoint.

Requirements:
- Node 18+ (global `fetch` available)

Environment / CLI:
- `TARGET_URL` (env or first arg): URL to POST scan payloads to (e.g. http://localhost:3000/test-scan)
- `RATE_PER_MIN` (env or second arg): scans per minute (default 120)
- `DURATION_MIN` (env or third arg): duration in minutes (default 10)
- `UNIQUE_TAGS` (env or fourth arg): number of distinct tag UIDs to cycle through (default 200)
- `BURST_SIZE` / `BURST_INTERVAL_SEC` (optional): if set, script sends `BURST_SIZE` back-to-back requests then waits `BURST_INTERVAL_SEC` seconds, repeating.

Example:

```bash
TARGET_URL=http://localhost:3000/test-scan RATE_PER_MIN=300 DURATION_MIN=30 node simulate-nfc-scans.js
```

Notes:
- The script only POSTs JSON bodies; you must expose or proxy the POST to the code path that processes scans (test harness).
- Use `collect-nfc-logs.ps1` to capture Android logs and filter NFC events during the test.
