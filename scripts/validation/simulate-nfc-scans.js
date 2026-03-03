#!/usr/bin/env node
/**
 * simulate-nfc-scans.js
 *
 * Simple HTTP-based NFC scan simulator for stress-testing the app's scan handling.
 * Usage examples in README.md. Requires Node 18+ (global fetch).
 */

const DEFAULT_RATE_PER_MIN = 120; // scans per minute
const DEFAULT_DURATION_MIN = 10;

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const target = process.env.TARGET_URL || process.argv[2];
  if (!target) {
    console.error('Missing TARGET_URL (env) or first arg. Example: TARGET_URL=http://localhost:3000/test-scan node simulate-nfc-scans.js');
    process.exit(2);
  }

  const ratePerMin = Number(process.env.RATE_PER_MIN || process.argv[3] || DEFAULT_RATE_PER_MIN);
  const durationMin = Number(process.env.DURATION_MIN || process.argv[4] || DEFAULT_DURATION_MIN);
  const uniqueTags = Number(process.env.UNIQUE_TAGS || process.argv[5] || 200);
  const burstSize = Number(process.env.BURST_SIZE || 0);
  const burstIntervalSec = Number(process.env.BURST_INTERVAL_SEC || 0);

  console.log(`[${nowIso()}] Starting simulation -> ${target}`);
  console.log(`rate=${ratePerMin}/min duration=${durationMin}min uniqueTags=${uniqueTags} burstSize=${burstSize} burstIntervalSec=${burstIntervalSec}`);

  let sent = 0;
  let succeeded = 0;
  let failed = 0;

  const start = Date.now();
  const endAt = start + durationMin * 60 * 1000;

  const tagForIndex = (i) => `SIM-TAG-${String(i % uniqueTags).padStart(4, '0')}`;

  // steady mode: interval between requests in ms
  const intervalMs = Math.max(1, Math.floor(60_000 / Math.max(1, ratePerMin)));

  const reportInterval = setInterval(() => {
    console.log(`[${nowIso()}] sent=${sent} ok=${succeeded} fail=${failed} elapsed_s=${Math.round((Date.now()-start)/1000)}`);
  }, 10_000);

  try {
    let i = 0;
    while (Date.now() < endAt) {
      if (burstSize > 0 && burstIntervalSec > 0) {
        for (let b = 0; b < burstSize && Date.now() < endAt; b++) {
          i++;
          void sendOne(tagForIndex(i)).then((ok) => (ok ? succeeded++ : failed++) ).catch(()=>failed++);
          sent++;
        }
        await sleep(burstIntervalSec * 1000);
        continue;
      }

      i++;
      const ok = await sendOne(tagForIndex(i));
      if (ok) succeeded++; else failed++;
      sent++;
      await sleep(intervalMs);
    }
  } finally {
    clearInterval(reportInterval);
    console.log(`[${nowIso()}] Finished. sent=${sent} ok=${succeeded} fail=${failed}`);
  }

  async function sendOne(tagUid) {
    const payload = {
      uid: tagUid,
      timestamp: nowIso(),
    };

    try {
      const res = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(()=>'');
        console.error(`[${nowIso()}] -> ${res.status} ${res.statusText} : ${text}`);
        return false;
      }
      return true;
    } catch (err) {
      console.error(`[${nowIso()}] request failed:`, err && err.message ? err.message : err);
      return false;
    }
  }
}

run().catch((err) => {
  console.error('Simulator failed:', err);
  process.exit(1);
});
