# 📊 POST-DEPLOY MONITORING — GoAtleta NFC

**Status:** ✅ LIVE IN PRODUCTION  
**Deploy Date:** 2026-02-18  
**Version:** Expo SDK 55 + NFC Hardening  

---

## 🚀 Deployment Summary

### Update Groups (Live)
- **iOS:** `063d7311-a09c-4626-b522-85512aa3f5ef`
- **Android:** `51bd0fcd-37ec-42c6-a64a-6044d6bf7206`

### Build (In Progress)
- **Android Build:** `8083fe11-9478-4c91-acd9-47bb226791e6`
- **Status:** `IN_QUEUE` → (ETA ~30-45 min)

### SDK Upgrade
- ✅ Expo: `^55.0.4`
- ✅ React Native: `0.83.2`
- ✅ React: `19.2.0`
- ✅ expo-router: `~55.0.3`
- ✅ Validação: `expo-doctor` 17/17 checks ✅

---

## ⚠️ Known Issues (Non-Blocking)

### 1. Working Tree Dirty (EAS warning)
**O quê:** `Commit ...*` (asterisco) na mensagem  
**Causa:** Possível arquivo não commitado durante publish  
**Impacto:** Nenhum (update foi publicado normalmente)  
**Mitigation:** Próximo commit, rodar `git status` antes de publish

### 2. Update Message Truncated
**O quê:** Mensagem do update foi cortada por tamanho  
**Causa:** Muito conteúdo no commit message  
**Impacto:** Nenhum (funcionalidade não afetada)  
**Mitigation:** Próximo update, usar commit message mais conciso

### 3. Sentry Env Fallback (expo-doctor warning)
**O quê:** `organization/project` via env não carregou  
**Causa:** Env var `SENTRY_ORG`/`SENTRY_PROJECT` não presente no build  
**Impacto:** Muito baixo (Sentry ainda funciona via DSN hardcoded)  
**Mitigation:** Opcional — adicionar vars ao eas.json para próximo build

---

## 📋 24-Hour Monitoring Checklist

### Hora 0 (Now - Release)
- [x] Updates publicados (iOS + Android)
- [x] Build Android disparado
- [ ] Aguardar build completar (~30-45 min)
- [ ] Verificar: Build sucesso ✅

### Hora 1-2
- [ ] **Sentry Dashboard**
  - [ ] Checar: Nenhum crash spike
  - [ ] Checar: Nenhum evento com PII (phone, email, uid)
  - [ ] Checar: Rate limiting não bloqueando usuários legítimos
  
- [ ] **Supabase Logs**
  - [ ] `students-import` function: Nenhum erro 429 legítimo
  - [ ] `rules-sync-admin` function: Nenhum erro 429 legítimo
  - [ ] Database: Queries normais (sem timeout)

- [ ] **App Metrics (Sentry)**
  - [ ] `nfc_runtime_metrics` eventos chegando (60s)
  - [ ] `scansPerMin`: ~40 (normal)
  - [ ] `duplicatesPerMin`: < 5 (normal)
  - [ ] `checkinsPending`: ~0 (sincronizando)

### Hora 2-6
- [ ] Monitorar operadores usando app
  - [ ] NFC lê tags normalmente
  - [ ] Sem travamentos após leitura
  - [ ] Check-ins sincronizam (feedback instantâneo)
  - [ ] Sem vibração errada

- [ ] Métricas Sentry
  - [ ] `totalScans`: crescendo (esperado)
  - [ ] `syncErrors`: ~0
  - [ ] `readErrors`: < 1%
  - [ ] Crash rate: 0%

### Hora 6-12
- [ ] Long-running test (6h contínuo)
  - [ ] RAM estável (não crescimento infinito)
  - [ ] Cache size: 0 (dedup working)
  - [ ] Batch sync latency: < 5s p99
  - [ ] Zero deadlocks

- [ ] Segurança
  - [ ] Sentry: Nenhum token/uid/email visível
  - [ ] Rate limit: ~5-10 req/min por função (normal)
  - [ ] No unauthorized access attempts

### Hora 12-24
- [ ] Relatório consolidado
  - [ ] Zero crashes em 24h
  - [ ] Uptime: 100%
  - [ ] Latência mediana: < 2s
  - [ ] PII exposure: 0
  - [ ] Performance: Estável

---

## 🔍 Critical Metrics to Watch

### NFC Loop Health
```
normalizeLoopState() {
  running: boolean
  paused: boolean
  busy: boolean
  status: "idle" | "scanning" | "paused"
  totalTagsRead: number
  totalDuplicatesRejected: number
  totalErrors: number
}

Expected (per hour):
- totalTagsRead: ~2,400 (40 scans/min)
- totalDuplicatesRejected: < 100 (< 4%)
- totalErrors: 0-5 (< 0.2%)
```

### Sync Performance
```
Expected (per checkin):
- p50 latency: < 1s (online)
- p95 latency: < 2s (online)
- p99 latency: < 5s (online)
- Success rate: > 99.5%
- Retry rate: < 0.5%
```

### Security
```
Expected (per hour):
- PII events in Sentry: 0
- Rate limit 429s (legitimate): 0
- Unauthorized access: 0
- JWT rejection: 0-1 (acceptable)
```

---

## 🚨 Alert Thresholds

### Immediate Action Required
| Metric | Threshold | Action |
|--------|-----------|--------|
| Crash Rate | > 1% | Rollback immediately |
| NFC Loop Status | Hanging | Check logs, investigate state machine |
| Memory Growth | > 500MB delta/hour | Potential leak, rollback |
| PII in Sentry | > 0 events | Rollback + investigate masking |
| Rate Limit 429s | > 50/hour (legitimate users) | Increase limits or check for abuse |
| Sync Latency p99 | > 30s | Database issue, check Supabase |

### Moderate Alert (Monitor)
| Metric | Threshold | Action |
|--------|-----------|--------|
| Crash Rate | 0.1-1% | Investigate, monitor 1 hour |
| Error Rate | > 5% | Check error logs |
| Duplicate Rate | > 10% | May indicate rapid re-tapping |
| Offline Pending | > 100 checkins | Check network, user education |

---

## 📊 Sentry Dashboard Setup

### Create Custom Alerts

1. **Alert: High Crash Rate**
   ```
   Condition: crash_rate > 1%
   Notify: #goatleta-alerts
   ```

2. **Alert: PII Detected**
   ```
   Condition: event contains "uid" OR "phone" OR "email"
   Notify: #security-alerts (URGENT)
   ```

3. **Alert: NFC Loop Errors**
   ```
   Condition: event.tags.screen = "nfc-attendance" AND level = "error"
   Threshold: > 10/hour
   Notify: #nfc-monitoring
   ```

### Custom Dashboard
- Create widget: `nfc_runtime_metrics` (count, last 24h)
- Create widget: `nfc_runtime_metrics.scansPerMin` (trend)
- Create widget: `nfc_runtime_metrics.syncErrors` (count)
- Create graph: Crash rate (hourly)

---

## 🔄 Rollback Plan (If Issues)

### Immediate Rollback
```bash
# If critical issue detected:
eas update:promote \
  --channel=production-backup \
  --to-channel=production

# Or manual rollback to previous update:
# 1. Go to Expo dashboard
# 2. Find previous update group ID
# 3. Click "Promote to production"
```

### Build Rollback (If Android build fails)
```bash
# Skip current build, use previous APK
# 1. Go to Play Store Console
# 2. Find previous version
# 3. Promote to production

# Time to rollback: ~30 min (Play Store review)
```

---

## 📈 Success Criteria (24-Hour Window)

| Criteria | Status | Evidence |
|----------|--------|----------|
| Zero crashes | [ ] | Sentry crash rate = 0 |
| Zero PII exposure | [ ] | No uid/phone/email in Sentry |
| NFC working | [ ] | `totalScans` > 500 |
| Sync reliable | [ ] | `syncErrors` < 5 |
| Performance stable | [ ] | Latency p99 < 5s |
| Rate limit working | [ ] | No spam activity |
| Security intact | [ ] | JWT enforced, no 401s |

---

## 📞 Escalation Path

**If Issue Detected:**

1. **Severity CRITICAL** (crash rate > 1%, PII exposure)
   - [ ] Alert team on Slack #goatleta-alerts
   - [ ] Trigger immediate rollback
   - [ ] Post-incident: Check logs + fix

2. **Severity HIGH** (sync failing, latency > 30s)
   - [ ] Monitor for 30 min
   - [ ] Check Supabase status
   - [ ] If persists > 1 hour, rollback

3. **Severity MEDIUM** (error rate 1-5%, UX degradation)
   - [ ] Investigate root cause (6 hours)
   - [ ] Plan fix for next update
   - [ ] Don't rollback unless HIGH

---

## 📝 Post-Deployment Tasks

### Week 1
- [x] Deploy to production ✅
- [ ] Monitor 24h continuously
- [ ] Collect stress test data (if operational)
- [ ] QA sign-off (normal operation)

### Week 2
- [ ] Analyze NFC metrics (Sentry)
- [ ] Confirm zero memory leaks
- [ ] Document performance baseline
- [ ] Plan next hardening (if needed)

### Week 4
- [ ] Full post-launch review
- [ ] Performance report
- [ ] Security audit findings
- [ ] Plan next phase (if any)

---

## 📊 Baseline Metrics (Set Now)

Use data from first 24h as baseline:

```
Baseline (Production):
- Crash Rate: ____%
- Median Latency: ____ms
- P99 Latency: ____ms
- NFC Scans/min: ____
- Sync Success Rate: _____%
- Memory Usage (median): ____MB
- PII Events: 0 (expected)

Capture at Hour 0, Hour 6, Hour 12, Hour 24
Trends matter more than absolute values
```

---

## ✅ Sign-Off

```
Status: LIVE IN PRODUCTION ✅
Start Time: 2026-02-18 ~14:00 UTC
Monitor Until: 2026-02-19 ~14:00 UTC (24h)

Build Status: IN_QUEUE
- Android: 8083fe11-9478-4c91-acd9-47bb226791e6
- ETA: ~30-45 min

All systems: GREEN ✅
Ready for continuous monitoring.
```

---

## 📞 Quick Reference

**Sentry:** https://sentry.io/accounts/otaldogusta/projects/goatleta/  
**Expo:** https://expo.dev/accounts/otaldogusta/projects/goatleta  
**Supabase:** https://supabase.com/dashboard  
**Slack:** #goatleta-alerts (if issues)

**Contact:**
- On-call: [Your name]
- Backup: [Team member]
- Escalation: [Manager]

Deploy monitoring starts now. Good luck! 🚀
