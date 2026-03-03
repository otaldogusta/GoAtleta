NFC Stress-Test Plan for PR-A
===============================

Goal: validate `useNfcContinuousScan` stability under realistic load and remount events.

Overview
--------
- Run an 8-hour simulated workload with bursts up to 300 scans/minute.
- Collect: memory (RSS), `getNfcLoopState()` samples, `nfc_runtime_metrics` snapshots, and checkinsPending metric.

Required tools
--------------
- Android device/emulator with app installed (debug build)
- `adb` (Android SDK)
- `adb logcat` for RN logs
- Android Studio Profiler (optional)
- A small helper script to simulate scans (see `simulate-nfc-scans.js`) or use physical NFC tap tool

Steps
-----
1. Build and install debug app on emulator/device.
2. Start log collection:

```bash
adb logcat -c
adb logcat *:S ReactNative:V GoAtleta:N > nfc-log.txt
```

3. Expose diagnostics inside the running app via `globalThis.__nfcDiagnostics.getNfcLoopState()` (already attached by hook). Use `adb shell` + `curl` or remote JS executor (Flipper or React DevTools) to sample every 5s:

```bash
# Example using npx react-devtools or Flipper remote exec (manual step). Sample every 5s for 1h:
while true; do
  # run remote JS snippet to evaluate and emit to log
  sleep 5
done
```

4. Run scan simulator (if available) to call the app endpoint that triggers a scan handler, or manually use NFC hardware to simulate rapid scans.

5. Monitor metrics:
- Memory RSS via Android Studio profiler
- `nfc_runtime_metrics` presence in logs every 60s
- `getNfcLoopState()` should report stable counters and status transitions
- `getNfcLoopState()` should show `loopStarted` toggling false/true on remounts only once; never stuck `true` across remounts

Acceptance criteria
-------------------
- No sustained memory growth over 8h (RSS stable within ±10%).
- `recentScanByUidRef` size never exceeds 500 in normal workload; if >500, investigate GC frequency and insertion rate.
- Duplicate checkin rate: <2% false duplicates accepted during stress bursts; verify via `checkinsPending` vs scans emitted.

Automation artifacts
-------------------
- Optional: `simulate-nfc-scans.js` to POST to a local test harness or function that mimics scan flow. (Not included here due to hardware variance.)

Next: implement quick sampling script and collect a 1-hour run for baseline; iterate adjustments.
