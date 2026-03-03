# Post-Deploy Checklist & Monitoring (PR-A + PR-C + Validation)

**Deployment Date:** 2026-03-03  
**Deployed Commits:** a2871f4 (PR-A: NFC hardening), af9e235 (PR-C: JWT), 8b7678c (validation infrastructure)  
**Status:** 🟢 **LIVE in Production**

---

## 📋 Pre-Monitoring Checklist (Do This First)

### Immediate Actions (Next 30 minutes)

- [ ] **Verify builds landed on stores**
  - iOS App Store: Check build status (should be "Ready for Review" or "In Review")
  - Google Play: Check internal testing / staging track status
  - Command: `eas build:list --platform ios --limit 5` and `eas build:list --platform android --limit 5`

- [ ] **Confirm Expo push notifications working**
  ```bash
  # Test: Send test notification to yourself via Supabase Realtime
  curl -X POST https://[YOUR_SUPABASE_URL]/functions/v1/send-push \
    -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
    -H "Content-Type: application/json" \
    -d '{"userId":"[TEST_USER_ID]","title":"Test","body":"Deployment successful"}'
  ```

- [ ] **Verify Sentry project is receiving events**
  - Go to Sentry dashboard
  - Check "Release" tab for new version tag
  - Confirm "Events" counter incrementing (not stuck at 0)

- [ ] **Check Supabase Edge Functions are active**
  - Open Supabase dashboard → Functions
  - Verify `students-import`, `rules-sync-admin`, `assistant` show "✅ Active"
  - No "⚠️ Deployment failed" icons
  - Command: `supabase functions list` (if CLI available)

---

## 🔴 Critical Metrics (Monitor Every Hour for First 24h)

### Metric 1: Crash Rate

**Target:** 0% crashes (or <0.001% if background tasks fail rarely)

**How to Monitor:**
```bash
# Check Sentry every 30 minutes
# Sentry Dashboard → Issues
# Filter: "Timestamp" Last 1h → Check "Error" type issues
```

**What to Look For:**
- `useNfcContinuousScan` crashes (loop ref issues)
- `recentScanByUidRef` OOM errors (indicates GC failing)
- `handleScanError` unhandled exceptions
- Edge Function 5xx errors in logs

**If Crash Rate > 0.1%:**
```bash
# Immediate action: Prepare rollback
git revert af9e235 af9e236  # Revert PR-C first (safer)
# If still crashing, revert a2871f4  # Then revert PR-A
npx eas submit --platform ios --latest  # Re-submit previous build
```

---

### Metric 2: PII in Sentry Events

**Target:** 0 events with exposed PII (email, phone, student names in logs)

**How to Monitor:**
```bash
# Sentry Dashboard → Issues → Filter for custom issues
# Search terms: "email", "phone", "login_email", "student_name"
# Or: Sentry Issues → Breadcrumbs → Check any log messages
```

**What to Look For:**
- Logs containing `login_email: user@example.com`
- Student names in breadcrumb messages
- Phone numbers in error messages
- Auth tokens in request headers (logged by accident)

**If PII Found:**
```bash
# 1. Immediate: Issue security alert to team
# 2. Check which function leaked PII (search Sentry breadcrumb source)
# 3. Fix in code: Replace logNfcEvent({email: user.email}) with logNfcEvent({userId})
# 4. Redeploy function: supabase functions deploy [function-name]
# 5. Mark issue as "resolved" in Sentry only after fix deployed
```

---

### Metric 3: NFC Scans per Minute (Operational Health)

**Target:** 40–60 scans/min (during normal school hours), 0–5 scans/min (off-hours)

**How to Monitor:**
```bash
# Option 1: Check Sentry Custom Metrics (if configured)
# Sentry Dashboard → Metrics → "nfc.scans_per_minute"

# Option 2: Check via app logs
adb logcat -c
adb logcat | grep -i "tag_detected\|cache_gc_cleanup\|checkin_pending"
# Count "tag_detected" events in 1 minute, multiply by 60

# Option 3: Use Supabase Realtime (if analytics table hooked)
postgresql> SELECT COUNT(*) FROM nfc_metrics WHERE created_at > NOW() - INTERVAL '1 hour';
```

**If Scans Drop to 0 (Offline/Technical Issue):**
- [ ] Check if users are reporting "NFC not scanning"
- [ ] Verify `loopStartedRef` via dev tools: `globalThis.__nfcDiagnostics.getNfcLoopState()`
- [ ] Check app logs for `shouldIgnoreContinuousScanError` or `NFC_ERRORS.CANCELLED`
- [ ] If persistent: revert to previous build

**If Scans Show Spike (>200/min) — Possible Duplicate Acceptance:**
- [ ] Check cache size: `globalThis.__nfcDiagnostics.getRecentScanCacheSize()`
- [ ] Look for `scan_duplicate_blocked` events (should be ~5–10% of scans, not 0%)
- [ ] If duplicates NOT being blocked: `DUPLICATE_WINDOW_MS` not applied correctly
- [ ] Fallback: reduce DUPLICATE_WINDOW_MS from 5s to 3s (temporary patch)

---

## 🟡 Warning Signals (Non-Critical, Monitor)

### Memory Usage (Android/iOS)

**Target:** App RSS <200MB; <250MB peak during active scanning

**How to Monitor:**
```bash
# Android Studio Profiler
# 1. Open Android Studio → Profiler tab
# 2. Select your running app
# 3. Watch Memory graph (should be flat, not sawtooth pattern)
# 4. If sawtooth: GC cleanup is working. If linear growth: leak detected

# Alternative: adb shell command
adb shell dumpsys meminfo [PACKAGE_NAME] | grep "Total"
```

**If Memory Grows >300MB:**
- [ ] Check `cache_size_snapshot` events in Sentry
- [ ] Cache size should be <500 entries; if >1000: GC not running
- [ ] Confirm `recentScanByUidRef` cleanup useEffect is registered (check React DevTools)
- [ ] Manual test: Enable app, let it run 30min, check memory — should stabilize

---

### Sync Errors (Smart Sync Failures)

**Target:** <0.5% of check-ins fail to sync

**How to Monitor:**
```bash
# Check Sentry for "sync_error" events
# Sentry Dashboard → Issues → Filter: "sync_error"

# Or check database pending checkins
postgresql> SELECT COUNT(*) FROM attendance_checkins WHERE sync_status = 'pending' AND created_at < NOW() - INTERVAL '1 hour';
```

**If >100 pending checkins older than 1h:**
- [ ] Network is down? Check Sentry breadcrumbs for "Network error"
- [ ] Supabase is returning 5xx? Check Supabase logs
- [ ] `handleSyncNow()` is not being called? Check app logs for sync triggers
- [ ] Manual test: Turn off network, check-in, turn on network, verify sync completes

---

### JWT Token Expiry (Edge Function 401s)

**Target:** 0 unauthorized (401) responses from Edge Functions

**How to Monitor:**
```bash
# Supabase Dashboard → Edge Functions → Logs
# Filter: "401 Unauthorized"
# Should show 0 hits

# Or check Sentry for "isAuthorized check failed" (from auto-link-student)
```

**If 401 Rate > 0.1%:**
- [ ] Check Sentry issue: "auto-link-student auth check failed: Configuration error"
- [ ] Verify `AUTH_HOOK_SECRET` is set in Supabase Function secrets
- [ ] Verify token refresh is working: check `AuthProvider` logs for "Session refreshed"
- [ ] If webhook broken: check webhook sender is including `Authorization: [SECRET]` header

---

## 📊 Monitoring Windows

### Hour 0–1 (Immediate Post-Deploy)

**Frequency:** Every 5 minutes

What to check:
- [ ] Sentry: any crash spike?
- [ ] App startup errors?
- [ ] Expo push notifications working?
- [ ] No obvious 5xx errors in function logs?

**Decision rule:** If crash rate >0.01% or PII found → **ROLLBACK IMMEDIATELY**

---

### Hour 1–6 (First Afternoon/Evening)

**Frequency:** Every 15 minutes (can slow down after hour 2)

What to check:
- [ ] Crash rate holding at 0%?
- [ ] NFC scans happening normally (if school is in session)?
- [ ] Memory usage stable <200MB?
- [ ] No sync errors piling up?

**Decision rule:** If any metric red → investigate before going to sleep

---

### Hour 6–24 (Overnight + Next Morning)

**Frequency:** Every 1–2 hours

What to check:
- [ ] Overnight: App running stably in background
- [ ] Next morning: First wave of users → scans, sync, notifications all working?
- [ ] Any error patterns emerging?

**Decision rule:** By morning, should have high confidence deployment is stable

---

### Day 2–7 (Ongoing Monitoring)

**Frequency:** Once per day (check first thing)

What to check:
- [ ] Weekly crash rate <0.01%?
- [ ] PII exposure still = 0?
- [ ] NFC scans/min trending normal?
- [ ] Memory not drifting upward?

**Action:** If any issue found, coordinate with team for patch

---

## 🚨 Emergency Rollback Steps

**Do this if:**
- Crash rate >0.1% sustained for 15+ minutes
- PII found in Sentry
- NFC completely non-functional
- Significant data corruption detected

**Rollback Process:**

```bash
# 1. Immediately notify team: "ROLLING BACK to previous build"

# 2. Identify safe rollback point (ask: which commit was last stable?)
# Usually the commit BEFORE a2871f4 (PR-A)
git log --oneline | head -5
# Find the commit before a2871f4 and note its hash (e.g., 9b4338e)

# 3. Revert the problematic commits
git revert af9e235 af9e236  # Revert PR-C first (safest)
git revert a2871f4          # Then revert PR-A if still broken
# OR: git reset --hard 9b4338e (nuclear option: discard all changes)

# 4. Force-push to main (⚠️ only if authorized)
git push origin main --force-with-lease

# 5. Re-submit to app stores from last known-good build
eas build --platform ios --build-from-git-branch main
eas submit --platform ios --latest

# 6. Monitor the revert: Sentry crash rate should drop to <0.01% within 10 min
```

---

## 📝 Monitoring Log Template

Use this to document findings every hour:

```markdown
## [2026-03-03 HH:MM] Monitoring Report

**Checked By:** [Your Name]
**Metrics Status:**
- Crash Rate: 0.00% ✅ / ⚠️ / 🔴
- PII Events: 0 ✅ / ⚠️ / 🔴
- NFC Scans/min: 45 (normal) ✅ / ⚠️ / 🔴
- Memory: 180MB ✅ / ⚠️ / 🔴

**Observations:**
- [Any unusual activity?]
- [User reports?]
- [Edge function logs clean?]

**Actions Taken:**
- [ ] Checked Sentry
- [ ] Checked Supabase Function logs
- [ ] Checked app logs (adb)
- [ ] Verified network connectivity

**Next Check:** [Time + 1 hour]
```

---

## 📞 Escalation Contacts

If critical issues emerge:

- **Technical (Crashes):** Reach out to core team; prepare rollback
- **Security (PII Leak):** Notify security lead immediately; do NOT wait
- **NFC Hardware:** Check if users report hardware issues (vs code bugs)
- **Supabase/Network:** Check status.supabase.com and upstatus

---

## ✅ Sign-Off

Once you're confident the deployment is stable (24h+ with 0 issues), sign off:

```markdown
**PRODUCTION SIGN-OFF**

Date: 2026-03-03
Deployments: a2871f4 (PR-A), af9e235 (PR-C), 8b7678c (validation)

24-Hour Monitoring Summary:
- ✅ Crash Rate: 0.00%
- ✅ PII Exposure: 0 events
- ✅ NFC Functional: Yes
- ✅ Memory Stable: <200MB
- ✅ Sync Working: 99.9%

Approved By: [Name]
Date/Time: [Timestamp]

No further rollback needed. Monitoring can move to standard cadence.
```

---

## 🔗 Reference Files

- `docs/NFC_ARCHITECTURE_REFACTOR.md` — Long-term improvements
- `scripts/validation/stress-test-plan.md` — If issues persist, run formal test
- `scripts/validation/simulate-nfc-scans.js` — Reproduce issues locally
- `src/nfc/nfc-state-machine.ts` — POC for future refactor

