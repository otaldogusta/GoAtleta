/** Local, credential-free browser capture. Does not review or approve the evidence. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const hash = b => createHash('sha256').update(b).digest('hex');
export const redactError = text => String(text).replace(/https?:\/\/\S+/g, '[url-redacted]').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, 1000);
async function settleForm(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve, reject) => {
      const start = performance.now(); let previous = '', stable = 0;
      const frame = () => {
        const elements = new Set();
        for (const input of document.querySelectorAll('input'))
          for (let node = input; node; node = node.parentElement) elements.add(node);
        const signature = [...elements].map(node => {
          const s = getComputedStyle(node), r = node.getBoundingClientRect();
          return [s.opacity,s.transform,Math.round(r.x*10),Math.round(r.y*10),Math.round(r.width*10),Math.round(r.height*10)].join(':');
        }).join('|');
        stable = signature === previous ? stable + 1 : 0; previous = signature;
        if (stable >= 12) resolve();
        else if (performance.now()-start > 8000) reject(Error('FORM_NOT_STABLE'));
        else requestAnimationFrame(frame);
      }; frame();
    });
  });
}
export function validateScenario(s) {
  const u = new URL(s.url);
  if (u.origin !== 'http://localhost:8081' || u.username || u.password || u.search || u.hash)
    throw Error('Only credential-free localhost:8081 routes are permitted.');
  if (!Array.isArray(s.steps) || s.steps.length > 10 || s.steps.some(x =>
    !['hover', 'focus', 'press'].includes(x.action) || typeof x.selector !== 'string' ||
    (x.action === 'press' && !['Tab', 'Escape', 'ArrowDown', 'ArrowUp'].includes(x.key))))
    throw Error('Only bounded non-submitting interactions are permitted.');
  return s;
}
export async function capture(run, scenarioPath, options = {}) {
  run = path.resolve(run);
  const manifestRaw = await fs.readFile(path.join(run, 'manifest.json'));
  const manifest = JSON.parse(manifestRaw);
  if (!manifest.vnext || manifest.filesystem_policy !== 'read_only' || !manifest.visual_policy?.ui)
    throw Error('A read-only vNext UI bundle is required.');
  const scenarioRaw = await fs.readFile(scenarioPath);
  const scenario = validateScenario(JSON.parse(scenarioRaw));
  const folder = path.join(run, 'evidence');
  // Exclusive directory prevents accidental replacement of a prior capture/review.
  await fs.mkdir(folder);
  const result = {state: 'UNVERIFIED', manifest_sha256: hash(manifestRaw),
    scenario_sha256: hash(scenarioRaw), artifacts: [], scope: 'Expo Web; not native', errors: []};
  let browser, server, serverLog;
  let stage = 'startup';
  try {
    if (options.startApp) {
      try {
        await fetch(new URL('/status', scenario.url), {signal: AbortSignal.timeout(1500), redirect: 'error'});
        throw Error('PORT_ALREADY_IN_USE');
      } catch (e) { if (e.message === 'PORT_ALREADY_IN_USE') throw e; }
      if (process.platform === 'win32') throw Error('Auto-start is Linux-container-only; start the isolated app manually on Windows.');
      serverLog = await fs.open(path.join(run, 'expo-server.log'), 'wx');
      server = spawn('npm', ['run', 'dev:web'], {cwd: options.workspace, detached: true,
        stdio: ['ignore', serverLog.fd, serverLog.fd]});
      let spawnError;
      server.on('error', e => { spawnError = e; });
      let ready = false;
      for (let n = 0; n < 60; n++) {
        if (spawnError || server.exitCode !== null) throw Error('APP_START_FAILED');
        try { ready = (await fetch(new URL('/status', scenario.url), {signal: AbortSignal.timeout(1500), redirect: 'error'})).ok; } catch {}
        if (ready) break;
        await new Promise(r => setTimeout(r, 1000));
      }
      if (!ready) throw Error('APP_NOT_READY');
    }
    stage = 'playwright-import';
    const modulePath = process.env.ENGINEER_PLAYWRIGHT_MODULE;
    const {chromium} = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
    if (!options.workspace) throw Error('SOURCE_WORKSPACE_REQUIRED');
    const workspace = path.resolve(options.workspace);
    const verifySources = async () => {
      const verified = {};
      for (const [file, expected] of Object.entries(manifest.files ?? {})) {
        if (!file.startsWith('workspace/') || file.startsWith('workspace/runtime/')) continue;
        const relative = file.slice('workspace/'.length);
        const absolute = path.resolve(workspace, relative);
        if (path.relative(workspace, absolute).startsWith('..') || hash(await fs.readFile(absolute)) !== expected)
          throw Error('SOURCE_MISMATCH');
        verified[relative] = expected;
      }
      if (!Object.keys(verified).length) throw Error('NO_SOURCE_BINDING');
      return verified;
    };
    stage = 'source-verification';
    result.source_hashes = await verifySources();
    stage = 'chromium-launch';
    browser = await chromium.launch({headless: true});
    for (const [viewport, [width, height]] of Object.entries({
      'mobile-small': [390,844], tablet: [768,1024], desktop: [1440,900]})) {
      for (const reduced of [false, true]) {
        const stem = viewport + (reduced ? '-reduced' : '');
        const context = await browser.newContext({viewport: {width,height}, deviceScaleFactor: 1,
          reducedMotion: reduced ? 'reduce' : 'no-preference', serviceWorkers: 'block',
          recordVideo: {dir: folder, size: {width,height}}});
        try {
          await context.route('**/*', route => {
            const url = new URL(route.request().url());
            return url.origin === 'http://localhost:8081' ? route.continue() : route.abort();
          });
          await context.routeWebSocket('**/*', socket => socket.close());
          const page = await context.newPage();
          stage = 'navigation:' + stem;
          const consoleErrors = [], pageErrors = [];
          page.on('console', m => { if (m.type() === 'error') consoleErrors.push(redactError(m.text())); });
          page.on('pageerror', e => pageErrors.push(redactError(e.message)));
          const response = await page.goto(scenario.url, {waitUntil: 'networkidle', timeout: 240000});
          if (!response?.ok()) throw Error('PAGE_NOT_READY');
          stage = 'readiness:' + stem;
          if (scenario.readySelector) await page.locator(scenario.readySelector).first().waitFor({state: 'visible'});
          for (const step of scenario.steps) {
            const locator = page.locator(step.selector);
            if (step.action === 'hover') await locator.hover();
            if (step.action === 'focus') await locator.focus();
            if (step.action === 'press') await locator.press(step.key);
          }
          stage = 'capture:' + stem;
          await settleForm(page);
          await page.screenshot({path: path.join(folder, stem + '.png'), fullPage: false});
          await fs.writeFile(path.join(folder, stem + '.aria.txt'), await page.locator('body').ariaSnapshot());
          const video = page.video();
          await context.close();
          await video.saveAs(path.join(folder, stem + '.webm'));
          await video.delete();
          for (const [extension, kind] of [['png','screenshot'],['webm','video'],['aria.txt','accessibility']]) {
            const file = stem + '.' + extension;
            result.artifacts.push({path: 'evidence/' + file, kind, viewport, reduced_motion: reduced,
              sha256: hash(await fs.readFile(path.join(folder,file)))});
          }
          result.errors.push({viewport, reduced_motion: reduced, console_errors: consoleErrors.length,
            page_errors: pageErrors.length, console_messages: consoleErrors, page_messages: pageErrors});
        } finally { await context.close(); }
      }
    }
    await verifySources();
    result.state = 'CAPTURED'; // Requires separate review; never means PASS.
  } catch {
    result.failure = 'CAPTURE_FAILED'; // Error bodies can contain URLs or private page data.
    result.failure_stage = stage;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server?.pid) {
      try { process.kill(-server.pid, 'SIGTERM'); } catch {}
      await new Promise(r => setTimeout(r, 500));
      try { process.kill(-server.pid, 'SIGKILL'); } catch {}
    }
    if (serverLog) await serverLog.close();
    await fs.writeFile(path.join(folder,'capture.json'), JSON.stringify(result,null,2));
  }
  return result.state;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length < 4) throw Error('Usage: node engineer_ui_evidence.mjs RUN SCENARIO --workspace WORKSPACE [--start-app]');
  const i = process.argv.indexOf('--start-app');
  const w = process.argv.indexOf('--workspace');
  const state = await capture(process.argv[2], process.argv[3], {startApp: i >= 0, workspace: w >= 0 ? process.argv[w+1] : undefined});
  console.log(JSON.stringify({state}));
  process.exitCode = state === 'CAPTURED' ? 0 : 1;
}
