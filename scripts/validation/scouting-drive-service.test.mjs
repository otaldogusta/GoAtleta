import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { request as httpRequest } from 'node:http';
import { EventEmitter } from 'node:events';
import {
  createService, driveDownloadUrl, inspectDriveFile, loadApiKey, MAX_VIDEO_BYTES, MAX_MEDIA_RANGE_BYTES, parseMediaRange,
  readBoundedJson, runCloudTracking, streamMedia, validateRequest, RamMediaCache, MEDIA_CACHE_BLOCK_BYTES, MAX_MEDIA_CACHE_BYTES,
  MediaReadAhead, MEDIA_READ_AHEAD_BYTES,
} from '../scouting-drive-service.mjs';

const secret = 'fixture-roboflow-credential-000000';
const request = {
  fileId: 'synthetic-public-video-fixture-0001',
  media: { fingerprint: 'drive-source-fixture', name: 'Fixture.mp4', duration: 910.7, width: 1202, height: 676 },
  scope: { userId: 'user-a', org: 'org-a', classId: 'class-a', sessionId: 'session-a', targetFingerprint: 'youtube:mdfgd1K3HTc' },
};
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const head = (headers = {}, status = 200) => new Response(null, { status, headers: {
  'Content-Type': 'video/mp4', 'Content-Length': '860741220',
  'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*', ...headers,
} });

const videoChunk = (start, end, size = 860741220, body = new Uint8Array(end - start + 1)) => new Response(body, { status: 206, headers: {
  'Content-Type': 'video/mp4', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1),
} });

async function localService(key = secret, options = {}) {
  // Old gateway fixtures intentionally isolate direct streaming; new cases below
  // exercise the production read-ahead default with readAhead: true.
  const server = createService(key, { readAhead: false, credentialOwner: { userId: request.scope.userId, org: request.scope.org }, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Origin: 'http://localhost:8081', 'X-GoAtleta-Tracking': '1', 'Content-Type': 'application/json' };
  return {
    server, base, headers,
    call: (path, init = {}) => {
      const target = new URL(base + path);
      if ((!init.method || init.method === 'GET') && (target.pathname === '/health' || target.pathname.startsWith('/jobs/')) && !target.search) {
        target.searchParams.set('userId', request.scope.userId); target.searchParams.set('org', request.scope.org);
      }
      const body = init.method === 'DELETE' && !init.body ? JSON.stringify({ scope: request.scope }) : init.body;
      return fetch(target, { ...init, ...(body ? { body } : {}), headers: { ...headers, ...init.headers } });
    },
    close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); },
  };
}

async function finished(service, id) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const response = await service.call(`/jobs/${id}`);
    const job = await response.json();
    if (job.status !== 'running') return job;
    await wait(2);
  }
  assert.fail('Fixture job did not finish.');
}

async function prepareMedia(service, fileId = request.fileId, scope = request.scope) {
  const response = await service.call('/media', { method: 'POST', body: JSON.stringify({ fileId, scope }) });
  assert.equal(response.status, 200);
  return response.json();
}

const cacheCap = (id = 'cache-fixture') => ({ id, fileId: request.fileId, scope: request.scope,
  size: 10 * MAX_MEDIA_CACHE_BYTES, mimeType: 'video/mp4', lastModified: 'Wed, 14 Oct 2026 12:00:00 GMT',
  controllers: new Set(), expiresAt: Date.now() + 60000 });
const bytesAt = (start, length) => Uint8Array.from({ length }, (_value, index) => (start + index) % 251);

test('validates file metadata and immutable scope without accepting arbitrary media URLs', () => {
  const input = structuredClone(request);
  const valid = validateRequest(input);
  input.scope.org = 'org-b'; input.media.duration = 1;
  assert.equal(valid.scope.org, 'org-a'); assert.equal(valid.media.duration, 910.7);
  assert.ok(Object.isFrozen(valid.scope)); assert.ok(Object.isFrozen(valid.media));
  assert.equal(driveDownloadUrl(request.fileId), `https://drive.usercontent.google.com/download?id=${request.fileId}&export=download&confirm=t`);
  for (const value of [
    { ...request, fileId: 'https://127.0.0.1/internal' },
    { ...request, fileId: '../file' },
    { ...request, media: { ...request.media, duration: 1801 } },
    { ...request, media: { ...request.media, width: 0 } },
    { ...request, scope: { ...request.scope, org: '' } },
    { ...request, scope: { ...request.scope, userId: null } },
  ]) assert.throws(() => validateRequest(value));
});

test('inspects only HEAD and rejects non-video, unavailable, oversized and non-playable files', async () => {
  const seen = [];
  const info = await inspectDriveFile(request.fileId, { fetcher: async (url, options) => { seen.push([url, options.method]); return head(); } });
  assert.equal(info.size, 860741220); assert.equal(info.mimeType, 'video/mp4');
  assert.equal(seen.length, 1); assert.equal(seen[0][1], 'HEAD');
  for (const response of [
    head({ 'Content-Type': 'text/html' }), head({ 'Content-Length': String(MAX_VIDEO_BYTES + 1) }),
    head({ 'Content-Length': 'unknown' }), head({ 'Content-Length': '0' }),
    head({ 'Accept-Ranges': 'none' }), head({ 'Access-Control-Allow-Origin': 'https://other.invalid' }), head({}, 403),
  ]) await assert.rejects(inspectDriveFile(request.fileId, { fetcher: async () => response }));
});

test('Drive HEAD redirects stay on explicit Google hosts and stop at the bounded limit', async () => {
  for (const location of ['http://drive.google.com/file', 'https://evil.invalid/file', 'https://drive.usercontent.google.com.evil.invalid/file', 'https://user:pass@drive.google.com/file', 'https://drive.google.com:444/file']) {
    let calls = 0;
    await assert.rejects(inspectDriveFile(request.fileId, { fetcher: async () => { calls++; return new Response(null, { status: 302, headers: { location } }); } }), /Destino remoto/);
    assert.equal(calls, 1);
  }
  let calls = 0;
  await assert.rejects(inspectDriveFile(request.fileId, { fetcher: async () => { calls++; return new Response(null, { status: 302, headers: { location: '/download' } }); } }), /redirecionamentos/);
  assert.equal(calls, 4);
});

test('bounds declared and streamed JSON bytes and refuses HTML or non-object output', async () => {
  assert.deepEqual(await readBoundedJson(json({ positions: [] }), 100), { positions: [] });
  await assert.rejects(readBoundedJson(new Response('{}', { headers: { 'Content-Length': '101' } }), 100), /limite/);
  await assert.rejects(readBoundedJson(new Response(' '.repeat(101)), 100), /limite/);
  await assert.rejects(readBoundedJson(new Response('<html>', { headers: { 'Content-Type': 'text/html' } }), 100), /JSON/);
  let readMedia = false;
  await assert.rejects(readBoundedJson(new Response(new ReadableStream({ pull() { readMedia = true; } }, { highWaterMark: 0 }), { headers: { 'Content-Type': 'video/mp4' } }), 100), /JSON/);
  assert.equal(readMedia, false);
  await assert.rejects(readBoundedJson(json([]), 100), /inválido/);
});

test('final JSON transfer has its own deadline and aborts a stalled body without fetching media', async () => {
  let cancelled = false;
  await assert.rejects(runCloudTracking(request, secret, { resultTimeoutMs: 10, fetcher: async (url, options) => {
    if (options.method === 'HEAD') return head();
    if (options.method === 'POST') return json({ job_id: 'remote-job' });
    if (new URL(url).hostname === 'storage.googleapis.com') {
      return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'application/json' } });
    }
    return json({ status: 0, output_signed_url: 'https://storage.googleapis.com/fixture.json' });
  } }), /tempo de resposta/);
  assert.equal(cancelled, true);
});

test('legacy cloud protocol sends one Drive URL remotely and fetches only JSON results locally', async () => {
  const calls = [];
  let poll = 0;
  const predictions = { frame_offset: [0, 1], volleyball_v2: [{ predictions: [] }, { predictions: [{ x: 42, y: 12 }] }] };
  const result = await runCloudTracking(request, secret, { pollIntervalMs: 1, fetcher: async (url, options) => {
    calls.push({ url, options });
    if (options.method === 'HEAD') return head();
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.input_url, driveDownloadUrl(request.fileId)); assert.equal(body.infer_fps, 30);
      assert.deepEqual(body.models, [{ model_id: 'volleyball_v2', model_version: '3', inference_type: 'object-detection' }]);
      assert.equal(new URL(url).searchParams.get('api_key'), secret);
      return json({ job_id: 'provider-job-1' });
    }
    if (new URL(url).hostname === 'storage.googleapis.com') return json(predictions);
    return json(++poll === 1 ? { status: 1 } : { status: 0, output_signed_url: 'https://storage.googleapis.com/fixture/output.json?signature=fixture' });
  } });
  assert.deepEqual(result, { media: request.media, provider: 'roboflow', model: 'volleyball_v2/3', sampledFps: 30, predictions });
  assert.equal(calls.filter(call => call.options.method === 'POST').length, 1);
  assert.equal(calls.filter(call => new URL(call.url).hostname.includes('google.com')).length, 1);
  assert.equal(calls.some(call => call.options.method === 'GET' && new URL(call.url).hostname === 'drive.usercontent.google.com'), false);
  assert.equal(calls.every(call => call.options.redirect === 'manual'), true);
});

test('provider refusal and unknown POST timeout never retry or expose provider bodies', async () => {
  for (const [status, pattern] of [[401, /credencial/], [404, /endpoint/], [429, /limite/], [503, /HTTP 503/]]) {
    let posts = 0;
    await assert.rejects(runCloudTracking(request, secret, { fetcher: async (_url, options) => {
      if (options.method === 'HEAD') return head();
      posts++; return new Response(secret, { status });
    } }), error => pattern.test(error.message) && !error.message.includes(secret));
    assert.equal(posts, 1);
  }
  let posts = 0;
  await assert.rejects(runCloudTracking(request, secret, { requestTimeoutMs: 10, fetcher: async (_url, options) => {
    if (options.method === 'HEAD') return head();
    posts++; return new Promise(() => {});
  } }), /tempo de resposta/);
  assert.equal(posts, 1);
});

test('does not fetch arbitrary output URLs or follow API redirects with the API key', async () => {
  for (const outputUrl of ['https://127.0.0.1/internal', 'https://storage.googleapis.com.evil.invalid/result', 'http://storage.googleapis.com/result']) {
    let calls = 0;
    await assert.rejects(runCloudTracking(request, secret, { fetcher: async (_url, options) => {
      calls++; if (options.method === 'HEAD') return head();
      if (options.method === 'POST') return json({ job_id: 'remote-job' });
      return json({ status: 0, output_signed_url: outputUrl });
    } }), /Destino remoto/);
    assert.equal(calls, 3);
  }
  let calls = 0;
  await assert.rejects(runCloudTracking(request, secret, { fetcher: async (_url, options) => {
    calls++; if (options.method === 'HEAD') return head();
    return new Response(null, { status: 302, headers: { location: 'https://evil.invalid' } });
  } }), /HTTP 302/);
  assert.equal(calls, 2);
});

test('limits final JSON size and rejects unknown provider state instead of fabricating results', async () => {
  for (const malformed of [{ status: 'complete' }, { status: -1 }, { status: 2 }, { status: 0 }]) {
    await assert.rejects(runCloudTracking(request, secret, { fetcher: async (_url, options) => {
      if (options.method === 'HEAD') return head();
      if (options.method === 'POST') return json({ job_id: 'remote-job' });
      return json(malformed);
    } }));
  }
  await assert.rejects(runCloudTracking(request, secret, { maxResultBytes: 10, fetcher: async (url, options) => {
    if (options.method === 'HEAD') return head();
    if (options.method === 'POST') return json({ job_id: 'remote-job' });
    if (new URL(url).hostname === 'storage.googleapis.com') return json({ large: 'x'.repeat(100) });
    return json({ status: 0, output_signed_url: 'https://storage.googleapis.com/fixture.json' });
  } }), /limite/);
});

test('loads a raw private key outside Git, uses env precedence, and rejects repository files or .env syntax', () => {
  const folder = mkdtempSync(join(tmpdir(), 'goatleta-drive-key-test-'));
  try {
    const raw = join(folder, 'key.txt'); writeFileSync(raw, secret + '\n');
    assert.equal(loadApiKey({ ROBOFLOW_API_KEY_FILE: raw }), secret);
    assert.equal(loadApiKey({ ROBOFLOW_API_KEY: secret, ROBOFLOW_API_KEY_FILE: 'ignored' }), secret);
    assert.equal(loadApiKey({}), '');
    writeFileSync(raw, `ROBOFLOW_API_KEY=${secret}`);
    assert.throws(() => loadApiKey({ ROBOFLOW_API_KEY_FILE: raw }), /somente a chave/);
    mkdirSync(join(folder, '.git')); writeFileSync(raw, secret);
    assert.throws(() => loadApiKey({ ROBOFLOW_API_KEY_FILE: raw }), /fora de um repositório/);
  } finally { rmSync(folder, { recursive: true }); }
});

test('blocks foreign origins, rebinding, missing CSRF header and unknown routes', async () => {
  const service = await localService();
  try {
    for (const headers of [{ Origin: 'https://evil.invalid' }, { 'X-GoAtleta-Tracking': '' }]) {
      assert.equal((await service.call('/health', { headers })).status, 403);
    }
    const rebindingStatus = await new Promise((resolve, reject) => {
      const req = httpRequest(service.base + '/health', { headers: { ...service.headers, Host: 'evil.invalid' } }, res => {
        res.resume(); res.on('end', () => resolve(res.statusCode));
      });
      req.on('error', reject); req.end();
    });
    assert.equal(rebindingStatus, 403);
    const preflight = await service.call('/jobs', { method: 'OPTIONS' });
    assert.equal(preflight.status, 204); assert.match(preflight.headers.get('access-control-allow-headers'), /X-GoAtleta-Tracking/);
    assert.equal((await service.call('/missing')).status, 404);
    const health = await (await service.call('/health')).json();
    assert.equal(health.ready, true); assert.equal(JSON.stringify(health).includes(secret), false);
  } finally { await service.close(); }
});

test('health supports missing key; credential exists only in RAM and never appears in responses', async () => {
  const service = await localService('');
  try {
    assert.equal((await (await service.call('/health')).json()).ready, false);
    assert.equal((await service.call('/jobs', { method: 'POST', body: JSON.stringify(request) })).status, 503);
    for (const apiKey of ['invalid', secret + '\n', `ROBOFLOW_API_KEY=${secret}`]) {
      assert.equal((await service.call('/credential', { method: 'POST', body: JSON.stringify({ apiKey, scope: request.scope }) })).status, 400);
    }
    const response = await service.call('/credential', { method: 'POST', body: JSON.stringify({ apiKey: secret, scope: request.scope }) });
    assert.deepEqual(await response.json(), { ready: true });
    assert.equal((await (await service.call('/health')).json()).ready, true);
    assert.deepEqual(await (await service.call('/credential', { method: 'DELETE' })).json(), { ready: false });
    assert.equal((await (await service.call('/health')).json()).ready, false);
    const oversized = await service.call('/credential', { method: 'POST', body: JSON.stringify({ apiKey: 'x'.repeat(4100) }) });
    assert.equal(oversized.status, 400);
  } finally { await service.close(); }
});

test('credential readiness, deletion and job creation are bound to the configuring user and organization', async () => {
  const service = await localService(secret, { credentialOwner: null });
  try {
    assert.equal((await (await service.call('/health')).json()).ready, false);
    assert.equal((await service.call('/jobs', { method: 'POST', body: JSON.stringify(request) })).status, 403);
    assert.equal((await service.call('/credential', { method: 'POST', body: JSON.stringify({ apiKey: secret, scope: request.scope }) })).status, 200);
    assert.equal((await (await service.call('/health')).json()).ready, true);
    for (const changed of [{ userId: 'other-user' }, { org: 'other-org' }]) {
      const foreignScope = { ...request.scope, ...changed };
      const query = new URLSearchParams({ userId: foreignScope.userId, org: foreignScope.org });
      assert.equal((await (await service.call('/health?' + query)).json()).ready, false);
      assert.equal((await service.call('/credential', { method: 'DELETE', body: JSON.stringify({ scope: foreignScope }) })).status, 403);
      assert.equal((await service.call('/jobs', { method: 'POST', body: JSON.stringify({ ...request, scope: foreignScope }) })).status, 403);
      assert.equal((await (await service.call('/health')).json()).ready, true);
    }
  } finally { await service.close(); }
});

test('job scope is preserved, duplicate requests reattach and completed result is reused without a new job', async () => {
  let finish, calls = 0;
  const service = await localService(secret, { runner: async input => {
    calls++; assert.ok(Object.isFrozen(input.scope));
    return new Promise(resolve => { finish = resolve; });
  } });
  try {
    const start = () => service.call('/jobs', { method: 'POST', body: JSON.stringify(request) });
    const first = await start(); assert.equal(first.status, 202); const job = await first.json();
    assert.deepEqual(job.scope, request.scope);
    assert.equal((await (await start()).json()).id, job.id);
    assert.equal((await service.call('/jobs', { method: 'POST', body: JSON.stringify({ ...request, scope: { ...request.scope, org: 'org-b' } }) })).status, 403);
    assert.equal((await service.call('/credential', { method: 'DELETE' })).status, 409);
    assert.equal((await service.call('/credential', { method: 'POST', body: JSON.stringify({ apiKey: 'other-credential-00000000' }) })).status, 409);
    const result = { media: request.media, provider: 'roboflow', model: 'volleyball_v2/3', sampledFps: 30, predictions: { frame_offset: [] } };
    finish(result);
    const done = await finished(service, job.id);
    assert.equal(done.status, 'complete'); assert.deepEqual(done.result, result); assert.deepEqual(done.scope, request.scope);
    const cached = await start(); assert.equal(cached.status, 200); assert.equal((await cached.json()).id, job.id); assert.equal(calls, 1);
  } finally { await service.close(); }
});

test('DELETE cancels only local observation and cannot apply a result arriving after cancellation', async () => {
  let finish, seenSignal;
  const service = await localService(secret, { runner: async (_input, _key, options) => {
    seenSignal = options.signal; return new Promise(resolve => { finish = resolve; });
  } });
  try {
    const { id } = await (await service.call('/jobs', { method: 'POST', body: JSON.stringify(request) })).json();
    const cancelled = await (await service.call(`/jobs/${id}`, { method: 'DELETE' })).json();
    assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.remoteCancellationSupported, false);
    assert.match(cancelled.notice, /remoto pode continuar/); assert.equal(seenSignal.aborted, true);
    finish({ predictions: { shouldNotAppear: true } }); await wait(1);
    const final = await (await service.call(`/jobs/${id}`)).json();
    assert.equal(final.status, 'cancelled'); assert.equal(final.result, undefined);
  } finally { await service.close(); }
});

test('unknown provider errors cannot leak secrets, paths or signed URLs to the browser', async () => {
  const service = await localService(secret, { runner: async () => { throw new Error(`bad ${secret} https://storage.googleapis.com/private?sig=secret`); } });
  try {
    const { id } = await (await service.call('/jobs', { method: 'POST', body: JSON.stringify(request) })).json();
    const result = await finished(service, id);
    assert.equal(result.status, 'failed');
    assert.equal(JSON.stringify(result).includes(secret), false); assert.equal(JSON.stringify(result).includes('sig='), false);
    assert.deepEqual(result.scope, request.scope);
  } finally { await service.close(); }
});

test('public Drive playback uses a RAM capability and forwards a bounded Range without a key or saved video', async () => {
  const calls = [];
  const service = await localService('', { fetcher: async (url, options) => {
    calls.push({ url, options });
    if (options.method === 'HEAD') return head();
    assert.deepEqual(options.headers, { Range: 'bytes=0-31', 'Accept-Encoding': 'identity' });
    return videoChunk(0, 31, 860741220, new Uint8Array(32).fill(7));
  } });
  try {
    const ready = await service.call('/media', { method: 'POST', body: JSON.stringify({ fileId: request.fileId, scope: request.scope }) });
    assert.equal(ready.status, 200);
    const source = await ready.json();
    assert.equal(source.size, 860741220); assert.equal(source.mimeType, 'video/mp4');
    assert.match(source.playbackUrl, /^http:\/\/127\.0\.0\.1:\d+\/media\/[a-f0-9-]{36}\?token=[a-f0-9]{64}$/);
    assert.equal(calls.length, 1); assert.equal(calls[0].options.method, 'HEAD');
    const metadata = await fetch(source.playbackUrl, { method: 'HEAD', headers: { Origin: 'http://localhost:8081' } });
    assert.equal(metadata.status, 200); assert.equal(metadata.headers.get('content-length'), '860741220'); assert.equal(calls.length, 1);
    const response = await fetch(source.playbackUrl, { headers: { Origin: 'http://localhost:8081', Range: 'bytes=0-31' } });
    assert.equal(response.status, 206); assert.equal(response.headers.get('content-range'), 'bytes 0-31/860741220');
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:8081');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array(32).fill(7));
    assert.equal(calls.length, 2); assert.equal(calls[1].options.method, 'GET');
    assert.equal(JSON.stringify(calls.map(call => call.options.headers)).includes(secret), false);
  } finally { await service.close(); }
});

test('range parsing supports open and suffix ranges but caps each response at 8 MiB', () => {
  const size = 860741220;
  assert.deepEqual(parseMediaRange('bytes=0-', size), { start: 0, end: MAX_MEDIA_RANGE_BYTES - 1 });
  assert.deepEqual(parseMediaRange('bytes=100-999999999', size), { start: 100, end: MAX_MEDIA_RANGE_BYTES + 99 });
  assert.deepEqual(parseMediaRange('bytes=-32', size), { start: size - 32, end: size - 1 });
  assert.deepEqual(parseMediaRange('bytes=-999999999', size), { start: size - MAX_MEDIA_RANGE_BYTES, end: size - 1 });
  assert.deepEqual(parseMediaRange(`bytes=${size - 20}-${size + 100}`, size), { start: size - 20, end: size - 1 });
  for (const invalid of [undefined, '', 'bytes=-', 'bytes=-0', 'bytes=0-3,8-9', 'bytes=9-8', 'bytes=860741220-', 'bytes=9007199254740992-', 'items=0-1', 'bytes=0-a']) {
    assert.equal(parseMediaRange(invalid, size), null);
  }
});

test('media capabilities reject missing tokens, foreign origins, multi-ranges and unscoped revocation before any upstream GET', async () => {
  let gets = 0;
  const service = await localService('', { fetcher: async (_url, options) => { if (options.method === 'GET') gets++; return head(); } });
  try {
    const source = await prepareMedia(service);
    const origin = { Origin: 'http://localhost:8081' };
    assert.equal((await fetch(source.playbackUrl.split('?')[0], { headers: origin })).status, 404);
    const invalid = new URL(source.playbackUrl); invalid.searchParams.set('token', 'a'.repeat(64));
    assert.equal((await fetch(invalid, { headers: origin })).status, 404);
    assert.equal((await fetch(source.playbackUrl, { headers: { Origin: 'https://evil.invalid', Range: 'bytes=0-31' } })).status, 403);
    for (const range of [undefined, 'bytes=0-3,8-9', 'bytes=1-0']) {
      const response = await fetch(source.playbackUrl, { headers: { ...origin, ...(range ? { Range: range } : {}) } });
      assert.equal(response.status, 416); assert.equal(response.headers.get('content-range'), 'bytes */860741220');
    }
    const path = source.playbackUrl.slice(service.base.length);
    assert.equal((await service.call(path, { method: 'DELETE', body: JSON.stringify({ scope: { ...request.scope, sessionId: 'other' } }) })).status, 403);
    assert.equal((await fetch(source.playbackUrl, { method: 'DELETE', headers: origin })).status, 403);
    assert.equal((await service.call(path, { method: 'DELETE' })).status, 200);
    assert.equal((await fetch(source.playbackUrl, { method: 'HEAD', headers: origin })).status, 404);
    assert.equal(gets, 0);
  } finally { await service.close(); }
});

test('media capabilities expire, are reused within a scope and remain bounded to four sources', async () => {
  const service = await localService('', { fetcher: async () => head(), mediaTtlMs: 1000 });
  try {
    const first = await prepareMedia(service);
    const repeated = await prepareMedia(service);
    assert.equal(first.playbackUrl, repeated.playbackUrl);
    for (let index = 0; index < 3; index++) await prepareMedia(service, request.fileId + String(index));
    const full = await service.call('/media', { method: 'POST', body: JSON.stringify({ fileId: request.fileId + 'extra', scope: request.scope }) });
    assert.equal(full.status, 409);
  } finally { await service.close(); }
  const expiring = await localService('', { fetcher: async () => head(), mediaTtlMs: 5 });
  try {
    const source = await prepareMedia(expiring); await wait(10);
    assert.equal((await fetch(source.playbackUrl, { method: 'HEAD', headers: { Origin: 'http://localhost:8081' } })).status, 404);
  } finally { await expiring.close(); }
});

test('gateway never consumes a full upstream 200 or an inconsistent Content-Range, MIME or size', async () => {
  for (const changed of [
    { status: 200 }, { headers: { 'Content-Range': 'bytes 1-32/860741220' } },
    { headers: { 'Content-Range': 'bytes 0-31/999999999' } }, { headers: { 'Content-Type': 'text/html' } },
    { headers: { 'Content-Length': '33' } },
  ]) {
    let read = false, cancelled = false;
    const service = await localService('', { fetcher: async (_url, options) => {
      if (options.method === 'HEAD') return head();
      return new Response(new ReadableStream({ pull() { read = true; }, cancel() { cancelled = true; } }, { highWaterMark: 0 }), {
        status: changed.status ?? 206,
        headers: { 'Content-Type': 'video/mp4', 'Content-Range': 'bytes 0-31/860741220', 'Content-Length': '32', ...changed.headers },
      });
    } });
    try {
      const source = await prepareMedia(service);
      const response = await fetch(source.playbackUrl, { headers: { Origin: 'http://localhost:8081', Range: 'bytes=0-31' } });
      assert.equal(response.status, 502); assert.equal(read, false); assert.equal(cancelled, true);
    } finally { await service.close(); }
  }
});

test('gateway caps open ranges to 8 MiB and forwards no browser credential, Referer or Origin', async () => {
  const service = await localService('', { fetcher: async (_url, options) => {
    if (options.method === 'HEAD') return head();
    assert.deepEqual(options.headers, { Range: `bytes=0-${MAX_MEDIA_RANGE_BYTES - 1}`, 'Accept-Encoding': 'identity' });
    return videoChunk(0, MAX_MEDIA_RANGE_BYTES - 1);
  } });
  try {
    const source = await prepareMedia(service);
    const response = await fetch(source.playbackUrl, { headers: { Origin: 'http://localhost:8081', Range: 'bytes=0-', Authorization: 'browser-fixture-credential', Referer: 'http://localhost:8081/' } });
    assert.equal(response.status, 206); assert.equal(response.headers.get('content-length'), String(MAX_MEDIA_RANGE_BYTES));
    assert.equal((await response.arrayBuffer()).byteLength, MAX_MEDIA_RANGE_BYTES);
  } finally { await service.close(); }
});

test('gateway follows Google redirects only and never forwards the Range to arbitrary hosts', async () => {
  const gets = [];
  const service = await localService('', { fetcher: async (url, options) => {
    if (options.method === 'HEAD') return head();
    gets.push(url); return new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/internal' } });
  } });
  try {
    const source = await prepareMedia(service);
    const response = await fetch(source.playbackUrl, { headers: { Origin: 'http://localhost:8081', Range: 'bytes=0-31' } });
    assert.equal(response.status, 502); assert.equal(gets.length, 1);
    assert.equal(new URL(gets[0]).hostname, 'drive.usercontent.google.com');
  } finally { await service.close(); }
});

test('gateway admits at most two concurrent Range streams and releases slots when streams finish', async () => {
  const pending = [];
  const service = await localService('', { fetcher: async (_url, options) => {
    if (options.method === 'HEAD') return head();
    return videoChunk(0, 31, 860741220, new ReadableStream({ start(controller) { pending.push(controller); } }));
  } });
  try {
    const source = await prepareMedia(service), headers = { Origin: 'http://localhost:8081', Range: 'bytes=0-31' };
    const first = fetch(source.playbackUrl, { headers }).then(response => response.arrayBuffer());
    const second = fetch(source.playbackUrl, { headers }).then(response => response.arrayBuffer());
    for (let attempt = 0; attempt < 100 && pending.length < 2; attempt++) await wait(1);
    assert.equal(pending.length, 2);
    const third = await fetch(source.playbackUrl, { headers }); assert.equal(third.status, 503);
    for (const controller of pending) { controller.enqueue(new Uint8Array(32)); controller.close(); }
    assert.deepEqual((await Promise.all([first, second])).map(buffer => buffer.byteLength), [32, 32]);
  } finally { await service.close(); }
});

test('abandoning playback cancels the upstream reader instead of downloading the remaining video', async () => {
  let reading = false, cancelled = false;
  const service = await localService('', { fetcher: async (_url, options) => {
    if (options.method === 'HEAD') return head();
    return videoChunk(0, 31, 860741220, new ReadableStream({ pull() { reading = true; }, cancel() { cancelled = true; } }));
  } });
  try {
    const source = await prepareMedia(service), controller = new AbortController();
    const active = fetch(source.playbackUrl, { signal: controller.signal, headers: { Origin: 'http://localhost:8081', Range: 'bytes=0-31' } });
    const rejected = assert.rejects(active);
    for (let attempt = 0; attempt < 100 && !reading; attempt++) await wait(1);
    assert.equal(reading, true); controller.abort(); await rejected;
    for (let attempt = 0; attempt < 100 && !cancelled; attempt++) await wait(1);
    assert.equal(cancelled, true);
  } finally { await service.close(); }
});

test('paused-browser backpressure can outlive the upstream timeout and resume without truncating Content-Length', async () => {
  const req = new EventEmitter(); req.headers = { range: 'bytes=0-63' };
  const res = new EventEmitter();
  Object.assign(res, { headersSent: false, writableFinished: false, destroyed: false });
  const chunks = [];
  let signal, pausedWithoutAbort = false;
  res.writeHead = (_status, headers) => { res.headersSent = true; assert.equal(headers['Content-Length'], 64); };
  res.write = chunk => {
    chunks.push(Buffer.from(chunk));
    if (chunks.length === 1) {
      setTimeout(() => { pausedWithoutAbort = !signal.aborted; res.emit('drain'); }, 50);
      return false;
    }
    return true;
  };
  res.end = () => { res.writableFinished = true; };
  res.destroy = () => { res.destroyed = true; res.emit('close'); };
  const cap = { fileId: request.fileId, size: 860741220, mimeType: 'video/mp4', lastModified: null, controllers: new Set(), expiresAt: Date.now() + 60000 };
  let reads = 0;
  await streamMedia(req, res, cap, async (_url, options) => {
    signal = options.signal;
    return videoChunk(0, 63, cap.size, new ReadableStream({ pull(controller) {
      controller.enqueue(new Uint8Array(32).fill(++reads));
      if (reads === 2) controller.close();
    } }));
  }, 10);
  assert.equal(pausedWithoutAbort, true);
  assert.equal(res.destroyed, false); assert.equal(res.writableFinished, true);
  assert.equal(Buffer.concat(chunks).byteLength, 64);
  assert.equal(cap.controllers.size, 0);
});

test('a stalled upstream read still expires and cancels the source reader', async () => {
  let cancelled = false;
  const service = await localService('', { mediaTimeoutMs: 10, fetcher: async (_url, options) => {
    if (options.method === 'HEAD') return head();
    return videoChunk(0, 31, 860741220, new ReadableStream({ cancel() { cancelled = true; } }));
  } });
  try {
    const source = await prepareMedia(service);
    await assert.rejects(fetch(source.playbackUrl, { headers: { Origin: 'http://localhost:8081', Range: 'bytes=0-31' } }).then(response => response.arrayBuffer()));
    assert.equal(cancelled, true);
  } finally { await service.close(); }
});

test('RAM cache returns only received contiguous bytes and never bridges sparse holes', () => {
  const cache = new RamMediaCache(), cap = cacheCap();
  cache.put(cap, 10, new Uint8Array([1, 2, 3]));
  cache.put(cap, 15, new Uint8Array([6, 7]));
  assert.equal(cache.acquire(cap, { start: 9, end: 16 }), null);
  let lease = cache.acquire(cap, { start: 10, end: 16 });
  assert.equal(lease.end, 12); assert.equal(lease.length, 3);
  assert.deepEqual(Buffer.concat(lease.chunks), Buffer.from([1, 2, 3])); lease.release();
  cache.put(cap, 13, new Uint8Array([4, 5]));
  lease = cache.acquire(cap, { start: 10, end: 18 });
  assert.equal(lease.end, 16); assert.equal(lease.length, 7);
  assert.deepEqual(Buffer.concat(lease.chunks), Buffer.from([1, 2, 3, 4, 5, 6, 7])); lease.release();
  assert.equal(cache.acquire(cap, { start: 17, end: 18 }), null);
});

test('RAM cache handles unaligned fragments across blocks and preserves exact source bytes', () => {
  const cache = new RamMediaCache(), cap = cacheCap(), block = MEDIA_CACHE_BLOCK_BYTES;
  cache.put(cap, block - 13, bytesAt(block - 13, block + 27));
  cache.put(cap, block - 5, bytesAt(block - 5, block + 12));
  const lease = cache.acquire(cap, { start: block - 8, end: 2 * block + 13 });
  assert.equal(lease.length, block + 22);
  assert.deepEqual(Buffer.concat(lease.chunks), Buffer.from(bytesAt(block - 8, block + 22)));
  assert.equal(cache.stats().bytes, 3 * block);
  lease.release(); assert.equal(cache.stats().pinnedBytes, 0);
});

test('cache identity isolates capability, scope and source version without exposing bytes to another owner', () => {
  const cache = new RamMediaCache(), cap = cacheCap(); cache.put(cap, 0, bytesAt(0, 32));
  for (const foreign of [
    { ...cap, id: 'other-capability' }, { ...cap, fileId: cap.fileId + 'other' },
    { ...cap, size: cap.size + 1 }, { ...cap, lastModified: 'another-version' },
    { ...cap, scope: { ...cap.scope, userId: 'other-user' } }, { ...cap, scope: { ...cap.scope, org: 'other-org' } },
  ]) assert.equal(cache.acquire(foreign, { start: 0, end: 31 }), null);
  const lease = cache.acquire(cap, { start: 0, end: 31 }); assert.ok(lease); lease.release();
});

test('global LRU enforces actual block allocations across many sources and preserves leased bytes under pressure', () => {
  const block = MEDIA_CACHE_BLOCK_BYTES, cache = new RamMediaCache(2 * block), cap = cacheCap();
  cache.put(cap, 0, bytesAt(0, 2 * block));
  const lease = cache.acquire(cap, { start: 0, end: 2 * block - 1 });
  const original = Buffer.concat(lease.chunks);
  for (let index = 0; index < 50; index++) {
    cache.put(cacheCap('pressure-' + index), 0, bytesAt(index, block));
    assert.ok(cache.stats().bytes <= 2 * block);
  }
  assert.equal(cache.stats().pinnedBytes, 2 * block);
  assert.deepEqual(Buffer.concat(lease.chunks), original);
  lease.release(); lease.release();
  for (let index = 0; index < 50; index++) cache.put(cacheCap('new-' + index), 0, bytesAt(index, block));
  assert.equal(cache.stats().bytes, 2 * block); assert.equal(cache.stats().blocks, 2);
  assert.equal(cache.acquire(cap, { start: 0, end: 31 }), null);
  assert.throws(() => { cache.maxBytes = MAX_MEDIA_CACHE_BYTES * 2; }, TypeError);
  assert.equal(cache.maxBytes, 2 * block);
});

test('revocation and expiry retire pinned blocks immediately and release their accounted memory after downstream completes', () => {
  const block = MEDIA_CACHE_BLOCK_BYTES, cache = new RamMediaCache(2 * block), cap = cacheCap();
  cache.put(cap, 0, bytesAt(0, block));
  const lease = cache.acquire(cap, { start: 0, end: 31 });
  cap.revoked = true; cache.delete(cap);
  assert.equal(cache.acquire(cap, { start: 0, end: 31 }), null);
  cache.put(cap, 0, bytesAt(0, block)); assert.equal(cache.stats().bytes, block);
  lease.release(); assert.equal(cache.stats().bytes, 0);
  const expiring = cacheCap('expired'); cache.put(expiring, 0, bytesAt(0, block));
  expiring.expiresAt = Date.now() - 1;
  assert.equal(cache.acquire(expiring, { start: 0, end: 31 }), null); assert.equal(cache.stats().bytes, 0);
});

test('conflicting overlapping bytes invalidate the capability rather than blending two originals', () => {
  const cache = new RamMediaCache(), cap = cacheCap(), controller = new AbortController(); cap.controllers.add(controller);
  cache.put(cap, 100, new Uint8Array([1, 2, 3]));
  const lease = cache.acquire(cap, { start: 100, end: 102 });
  assert.throws(() => cache.put(cap, 101, new Uint8Array([9])), /bytes.*mudaram/);
  assert.equal(controller.signal.aborted, true); assert.equal(cap.invalid, true);
  assert.equal(cache.acquire(cap, { start: 100, end: 102 }), null);
  lease.release(); assert.equal(cache.stats().bytes, 0);
});

test('sparse bookkeeping is bounded and the 65th disconnected byte is never exposed as valid', () => {
  const cache = new RamMediaCache(), cap = cacheCap();
  for (let index = 0; index < 65; index++) cache.put(cap, index * 2, new Uint8Array([index]));
  assert.equal(cache.stats().bytes, MEDIA_CACHE_BLOCK_BYTES);
  assert.equal(cache.acquire(cap, { start: 128, end: 128 }), null);
  const lease = cache.acquire(cap, { start: 126, end: 128 }); assert.equal(lease.length, 1); lease.release();
});

test('HTTP repeated GOP ranges reuse received bytes, return exact partial prefixes and never prefetch missing suffixes', async () => {
  const ranges = [], cache = new RamMediaCache();
  const service = await localService('', { mediaCache: cache, fetcher: async (_url, options) => {
    if (options.method === 'HEAD') return head();
    ranges.push(options.headers.Range);
    const [, left, right] = /^bytes=(\d+)-(\d+)$/.exec(options.headers.Range), start = Number(left), end = Number(right);
    return videoChunk(start, end, 860741220, bytesAt(start, end - start + 1));
  } });
  const fetchRange = async (url, start, end, expectedEnd = end) => {
    const response = await fetch(url, { headers: { Origin: 'http://localhost:8081', Range: `bytes=${start}-${end}` } });
    assert.equal(response.status, 206); assert.equal(response.headers.get('content-range'), `bytes ${start}-${expectedEnd}/860741220`);
    assert.equal(response.headers.get('content-length'), String(expectedEnd - start + 1));
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytesAt(start, expectedEnd - start + 1));
  };
  try {
    const source = await prepareMedia(service), block = MEDIA_CACHE_BLOCK_BYTES;
    await fetchRange(source.playbackUrl, 0, 2 * block - 1);
    for (let index = 0; index < 20; index++) await fetchRange(source.playbackUrl, 100 + index, block + 500 + index);
    assert.deepEqual(ranges, [`bytes=0-${2 * block - 1}`]);
    await fetchRange(source.playbackUrl, block, 3 * block - 1, 2 * block - 1);
    assert.equal(ranges.length, 1);
    await fetchRange(source.playbackUrl, 2 * block, 3 * block - 1);
    assert.equal(ranges.length, 2); assert.equal(ranges[1], `bytes=${2 * block}-${3 * block - 1}`);
    assert.ok(cache.stats().bytes <= MAX_MEDIA_CACHE_BYTES);
  } finally { await service.close(); }
  assert.equal(cache.stats().bytes, 0);
});

test('a cancelled upstream Range retains only its received prefix for the next GOP seek', async () => {
  let gets = 0, cancelled = false;
  const service = await localService('', { fetcher: async (_url, options) => {
    if (options.method === 'HEAD') return head();
    gets++;
    return videoChunk(0, 1024 * 1024 - 1, 860741220, new ReadableStream({ start(controller) { controller.enqueue(bytesAt(0, MEDIA_CACHE_BLOCK_BYTES)); }, cancel() { cancelled = true; } }));
  } });
  try {
    const source = await prepareMedia(service), controller = new AbortController();
    const response = await fetch(source.playbackUrl, { signal: controller.signal, headers: { Origin: 'http://localhost:8081', Range: 'bytes=0-1048575' } });
    const reader = response.body.getReader(); assert.equal((await reader.read()).done, false);
    controller.abort();
    for (let attempt = 0; attempt < 100 && !cancelled; attempt++) await wait(1);
    assert.equal(cancelled, true);
    const cached = await fetch(source.playbackUrl, { headers: { Origin: 'http://localhost:8081', Range: 'bytes=0-1048575' } });
    assert.equal(cached.headers.get('content-range'), `bytes 0-${MEDIA_CACHE_BLOCK_BYTES - 1}/860741220`);
    assert.deepEqual(new Uint8Array(await cached.arrayBuffer()), bytesAt(0, MEDIA_CACHE_BLOCK_BYTES));
    assert.equal(gets, 1);
  } finally { await service.close(); }
});

test('HTTP capability revocation clears retained media bytes instead of keeping a stale cache', async () => {
  const cache = new RamMediaCache();
  const service = await localService('', { mediaCache: cache, fetcher: async (_url, options) => options.method === 'HEAD' ? head() : videoChunk(0, 31) });
  try {
    const source = await prepareMedia(service);
    await (await fetch(source.playbackUrl, { headers: { Origin: 'http://localhost:8081', Range: 'bytes=0-31' } })).arrayBuffer();
    assert.equal(cache.stats().bytes, MEDIA_CACHE_BLOCK_BYTES);
    const response = await service.call(source.playbackUrl.slice(service.base.length), { method: 'DELETE' }); assert.equal(response.status, 200);
    assert.equal(cache.stats().bytes, 0);
  } finally { await service.close(); }
});

async function until(predicate, message = 'Fixture state did not settle.') {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (predicate()) return;
    await wait(2);
  }
  assert.fail(message);
}

const requestedRange = options => {
  const match = /^bytes=(\d+)-(\d+)$/.exec(options.headers.Range);
  assert.ok(match);
  return { start: Number(match[1]), end: Number(match[2]) };
};

test('aligned read-ahead reduces twenty distinct 4 KiB GOP misses from twenty source GETs to one', async () => {
  const counts = [];
  for (const readAhead of [false, true]) {
    const ranges = [], cache = new RamMediaCache();
    const service = await localService('', { readAhead, mediaCache: cache, fetcher: async (_url, options) => {
      if (options.method === 'HEAD') return head();
      const { start, end } = requestedRange(options); ranges.push([start, end]);
      return videoChunk(start, end, 860741220, bytesAt(start, end - start + 1));
    } });
    try {
      const source = await prepareMedia(service);
      const metadata = await fetch(source.playbackUrl, { method: 'HEAD', headers: { Origin: 'http://localhost:8081' } });
      assert.equal(metadata.status, 200); assert.equal(ranges.length, 0);
      for (let index = 0; index < 20; index++) {
        const start = index * 4096, end = start + 4095;
        const response = await fetch(source.playbackUrl, { headers: { Origin: 'http://localhost:8081', Range: `bytes=${start}-${end}` } });
        assert.equal(response.status, 206);
        assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/860741220`);
        assert.equal(response.headers.get('content-length'), '4096');
        assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytesAt(start, 4096));
      }
      counts.push(ranges.length);
      if (readAhead) {
        assert.deepEqual(ranges, [[0, MEDIA_READ_AHEAD_BYTES - 1]]);
        assert.equal(cache.stats().bytes, MEDIA_READ_AHEAD_BYTES);
      }
      assert.ok(cache.stats().bytes <= MAX_MEDIA_CACHE_BYTES);
    } finally { await service.close(); }
    assert.equal(cache.stats().bytes, 0);
  }
  assert.deepEqual(counts, [20, 1]);
});

test('an open browser Range receives only the verified aligned prefix with exact 206 and CORS metadata', async () => {
  const ranges = [];
  const service = await localService('', { readAhead: true, fetcher: async (_url, options) => {
    if (options.method === 'HEAD') return head();
    const { start, end } = requestedRange(options); ranges.push([start, end]);
    return videoChunk(start, end, 860741220, bytesAt(start, end - start + 1));
  } });
  try {
    const source = await prepareMedia(service), start = MEDIA_READ_AHEAD_BYTES + 1000;
    const response = await fetch(source.playbackUrl, { headers: { Origin: 'http://localhost:8081', Range: `bytes=${start}-` } });
    const last = 2 * MEDIA_READ_AHEAD_BYTES - 1;
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:8081');
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('content-range'), `bytes ${start}-${last}/860741220`);
    assert.equal(response.headers.get('content-length'), String(last - start + 1));
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytesAt(start, last - start + 1));
    assert.deepEqual(ranges, [[MEDIA_READ_AHEAD_BYTES, last]]);
  } finally { await service.close(); }
});

test('read-ahead deduplicates simultaneous GOP waits and bounds fills across distant audio/video regions', async () => {
  const cap = cacheCap(), cache = new RamMediaCache(), pending = [];
  const readAhead = new MediaReadAhead(cache, async (_url, options) => {
    const { start, end } = requestedRange(options);
    return videoChunk(start, end, cap.size, new ReadableStream({ start(controller) { pending.push({ start, end, controller }); } }));
  });
  try {
    const first = readAhead.ensure(cap, 0);
    const overlap = readAhead.ensure(cap, 8192);
    const distant = readAhead.ensure(cap, 50 * MEDIA_READ_AHEAD_BYTES + 4096);
    const queuedAbort = new AbortController();
    const queued = readAhead.ensure(cap, 100 * MEDIA_READ_AHEAD_BYTES, queuedAbort.signal);
    const rejected = assert.rejects(queued, { name: 'AbortError' });
    assert.deepEqual(readAhead.stats(), { active: 2, queued: 1, tasks: 3 });
    await until(() => pending.length === 2);
    assert.deepEqual(pending.map(value => value.start), [0, 50 * MEDIA_READ_AHEAD_BYTES]);
    queuedAbort.abort(); await rejected;
    assert.deepEqual(readAhead.stats(), { active: 2, queued: 0, tasks: 2 });
    for (const value of pending) { value.controller.enqueue(bytesAt(value.start, value.end - value.start + 1)); value.controller.close(); }
    await Promise.all([first, overlap, distant]);
    await until(() => readAhead.stats().active === 0);
    assert.equal(pending.length, 2); assert.equal(cache.stats().bytes, 2 * MEDIA_READ_AHEAD_BYTES);
    const lease = cache.acquire(cap, { start: 8192, end: 12287 });
    assert.deepEqual(Buffer.concat(lease.chunks), Buffer.from(bytesAt(8192, 4096))); lease.release();
  } finally { readAhead.close(); cache.clear(); }
});

test('an abandoned GOP consumer can finish only its one bounded RAM window for the next seek', async () => {
  const cap = cacheCap(), cache = new RamMediaCache();
  let gets = 0, source, cancelled = false;
  const readAhead = new MediaReadAhead(cache, async (_url, options) => {
    gets++; const { start, end } = requestedRange(options);
    assert.equal(start, 0); assert.equal(end, MEDIA_READ_AHEAD_BYTES - 1);
    return videoChunk(start, end, cap.size, new ReadableStream({ start(controller) {
      source = controller; controller.enqueue(bytesAt(0, 4096));
    }, cancel() { cancelled = true; } }));
  });
  try {
    const consumer = new AbortController();
    const abandoned = readAhead.ensure(cap, 0, consumer.signal);
    const rejected = assert.rejects(abandoned, { name: 'AbortError' });
    await until(() => cache.stats().bytes > 0);
    consumer.abort(); await rejected;
    assert.equal(cancelled, false); assert.equal(readAhead.stats().active, 1);
    source.enqueue(bytesAt(4096, MEDIA_READ_AHEAD_BYTES - 4096)); source.close();
    await until(() => readAhead.stats().active === 0);
    await readAhead.ensure(cap, 32768);
    assert.equal(gets, 1); assert.equal(cache.stats().bytes, MEDIA_READ_AHEAD_BYTES);
    assert.equal(cache.acquire(cap, { start: MEDIA_READ_AHEAD_BYTES, end: MEDIA_READ_AHEAD_BYTES + 31 }), null);
    const lease = cache.acquire(cap, { start: 32768, end: 36863 });
    assert.deepEqual(Buffer.concat(lease.chunks), Buffer.from(bytesAt(32768, 4096))); lease.release();
  } finally { readAhead.close(); cache.clear(); }
});

test('revoking a capability aborts its background fill and erases received bytes after browser cancellation', async () => {
  const cache = new RamMediaCache(); let gets = 0, cancelled = false;
  const service = await localService('', { readAhead: true, mediaCache: cache, fetcher: async (_url, options) => {
    if (options.method === 'HEAD') return head();
    gets++; const { start, end } = requestedRange(options);
    return videoChunk(start, end, 860741220, new ReadableStream({ start(controller) { controller.enqueue(bytesAt(start, 4096)); }, cancel() { cancelled = true; } }));
  } });
  try {
    const source = await prepareMedia(service), controller = new AbortController();
    const active = fetch(source.playbackUrl, { signal: controller.signal, headers: { Origin: 'http://localhost:8081', Range: 'bytes=0-' } });
    const rejected = assert.rejects(active);
    await until(() => cache.stats().bytes > 0);
    controller.abort(); await rejected; assert.equal(cancelled, false);
    const revoked = await service.call(source.playbackUrl.slice(service.base.length), { method: 'DELETE' });
    assert.equal(revoked.status, 200);
    await until(() => cancelled);
    assert.equal(cache.stats().bytes, 0); assert.equal(gets, 1);
    const invalid = await fetch(source.playbackUrl, { headers: { Origin: 'http://localhost:8081', Range: 'bytes=4096-' } });
    assert.equal(invalid.status, 404); assert.equal(gets, 1);
  } finally { await service.close(); }
});

test('expiry stops an active read-ahead fill, clears partial bytes and aborts all capability consumers', async () => {
  const cap = cacheCap(), cache = new RamMediaCache(), consumer = new AbortController();
  cap.expiresAt = Date.now() + 50; cap.controllers.add(consumer);
  let cancelled = false;
  const readAhead = new MediaReadAhead(cache, async (_url, options) => {
    const { start, end } = requestedRange(options);
    return videoChunk(start, end, cap.size, new ReadableStream({ start(controller) { controller.enqueue(bytesAt(start, 4096)); }, cancel() { cancelled = true; } }));
  });
  try {
    await assert.rejects(readAhead.ensure(cap, 0), error => error.status === 410);
    assert.equal(cancelled, true); assert.equal(consumer.signal.aborted, true);
    assert.equal(cache.stats().bytes, 0);
    await until(() => readAhead.stats().active === 0);
  } finally { readAhead.close(); cache.clear(); }
});

test('a stalled read-ahead fill expires per upstream read, cancels its reader and releases the global slot', async () => {
  const cap = cacheCap(), cache = new RamMediaCache(); let cancelled = false;
  const readAhead = new MediaReadAhead(cache, async (_url, options) => {
    const { start, end } = requestedRange(options);
    return videoChunk(start, end, cap.size, new ReadableStream({ cancel() { cancelled = true; } }));
  }, { timeoutMs: 10 });
  try {
    await assert.rejects(readAhead.ensure(cap, 0), error => error.status === 504);
    await until(() => readAhead.stats().active === 0);
    assert.equal(cancelled, true); assert.equal(cache.stats().bytes, 0);
  } finally { readAhead.close(); }
});

test('read-ahead refuses malformed headers before caching bytes and never fills a client range outside the file', async () => {
  const cap = cacheCap(), cache = new RamMediaCache(); let gets = 0, read = false, cancelled = false;
  const readAhead = new MediaReadAhead(cache, async (_url, options) => {
    gets++; const { start, end } = requestedRange(options);
    return new Response(new ReadableStream({ pull() { read = true; }, cancel() { cancelled = true; } }, { highWaterMark: 0 }), {
      status: 206, headers: { 'Content-Type': 'text/html', 'Content-Range': `bytes ${start}-${end}/${cap.size}`, 'Content-Length': String(end - start + 1) },
    });
  });
  try {
    for (const offset of [-1, 0.5, cap.size, Infinity, NaN]) await assert.rejects(readAhead.ensure(cap, offset), error => error.status === 416);
    assert.equal(gets, 0);
    await assert.rejects(readAhead.ensure(cap, 0), /não confirmou/);
    await until(() => readAhead.stats().active === 0);
    assert.equal(gets, 1); assert.equal(read, false); assert.equal(cancelled, true); assert.equal(cache.stats().bytes, 0);
  } finally { readAhead.close(); }
});

test('read-ahead truncates only the last aligned window to EOF and keeps partial upstream ranges contiguous', async () => {
  const cap = cacheCap(), cache = new RamMediaCache(), ranges = [];
  cap.size = MEDIA_READ_AHEAD_BYTES + 12345;
  const readAhead = new MediaReadAhead(cache, async (_url, options) => {
    const { start, end } = requestedRange(options); ranges.push([start, end]);
    const shorterEnd = Math.min(end, start + 4095);
    return videoChunk(start, shorterEnd, cap.size, bytesAt(start, shorterEnd - start + 1));
  });
  try {
    await readAhead.ensure(cap, cap.size - 1);
    assert.deepEqual(ranges, [[MEDIA_READ_AHEAD_BYTES, cap.size - 1], [MEDIA_READ_AHEAD_BYTES + 4096, cap.size - 1],
      [MEDIA_READ_AHEAD_BYTES + 8192, cap.size - 1], [MEDIA_READ_AHEAD_BYTES + 12288, cap.size - 1]]);
    const lease = cache.acquire(cap, { start: MEDIA_READ_AHEAD_BYTES, end: cap.size - 1 });
    assert.equal(lease.length, 12345); assert.deepEqual(Buffer.concat(lease.chunks), Buffer.from(bytesAt(MEDIA_READ_AHEAD_BYTES, 12345))); lease.release();
    assert.equal(cache.acquire(cap, { start: 0, end: 31 }), null);
  } finally { readAhead.close(); cache.clear(); }
});

test('read-ahead cache stays at 32 MiB across many requested windows and does not prefetch the next window', async () => {
  const cap = cacheCap(), cache = new RamMediaCache(), ranges = [];
  const readAhead = new MediaReadAhead(cache, async (_url, options) => {
    const { start, end } = requestedRange(options); ranges.push([start, end]);
    return videoChunk(start, end, cap.size, bytesAt(start, end - start + 1));
  });
  try {
    for (let index = 0; index < 19; index++) {
      await readAhead.ensure(cap, index * 3 * MEDIA_READ_AHEAD_BYTES + 4096);
      assert.ok(cache.stats().bytes <= MAX_MEDIA_CACHE_BYTES);
    }
    await until(() => readAhead.stats().active === 0);
    assert.equal(ranges.length, 19); assert.equal(cache.stats().bytes, MAX_MEDIA_CACHE_BYTES);
    assert.ok(ranges.every(([start, end], index) => start === index * 3 * MEDIA_READ_AHEAD_BYTES && end - start + 1 === MEDIA_READ_AHEAD_BYTES));
    assert.equal(cache.acquire(cap, { start: MEDIA_READ_AHEAD_BYTES, end: MEDIA_READ_AHEAD_BYTES + 31 }), null);
  } finally { readAhead.close(); cache.clear(); }
});

function pausedResponse(range = 'bytes=0-65535') {
  const req = new EventEmitter(); req.headers = { range };
  const res = new EventEmitter();
  Object.assign(res, { headersSent: false, writableFinished: false, destroyed: false, written: 0 });
  res.writeHead = () => { res.headersSent = true; };
  res.write = chunk => { res.written += chunk.byteLength; return false; };
  res.end = () => { res.writableFinished = true; };
  res.destroy = () => { res.destroyed = true; res.emit('close'); };
  return { req, res };
}

test('a cached lease paused in drain expires at capability TTL after its read-ahead fill already completed', async () => {
  const cache = new RamMediaCache(), cap = cacheCap('paused-ttl'); let gets = 0;
  const readAhead = new MediaReadAhead(cache, async (_url, options) => {
    gets++; const { start, end } = requestedRange(options);
    return videoChunk(start, end, cap.size, bytesAt(start, end - start + 1));
  });
  const { req, res } = pausedResponse();
  const guard = setTimeout(() => res.emit('drain'), 1000);
  try {
    await readAhead.ensure(cap, 0);
    await until(() => readAhead.stats().active === 0);
    cap.expiresAt = Date.now() + 50;
    const active = streamMedia(req, res, cap, async () => assert.fail('The cached response must not fetch again.'), 10, false, cache, readAhead);
    await until(() => res.written > 0);
    assert.equal(cache.stats().pinnedBytes, MEDIA_CACHE_BLOCK_BYTES);
    assert.equal(res.destroyed, false);
    await active;
    assert.equal(res.destroyed, true); assert.equal(res.writableFinished, false);
    assert.equal(cache.stats().bytes, 0); assert.equal(cache.stats().pinnedBytes, 0);
    assert.equal(cap.controllers.size, 0); assert.equal(gets, 1);
    assert.equal(req.listenerCount('aborted'), 0); assert.equal(res.listenerCount('drain'), 0);
  } finally { clearTimeout(guard); readAhead.close(); cache.clear(); }
});

test('capability TTL cancels an upstream reader paused at downstream drain without an inactivity timer', async () => {
  const cache = new RamMediaCache(), cap = cacheCap('upstream-paused-ttl');
  const { req, res } = pausedResponse('bytes=0-63');
  cap.expiresAt = Date.now() + 70;
  let cancelled = false, signal;
  const guard = setTimeout(() => res.emit('drain'), 1000);
  try {
    const active = streamMedia(req, res, cap, async (_url, options) => {
      signal = options.signal;
      return videoChunk(0, 63, cap.size, new ReadableStream({ start(controller) { controller.enqueue(bytesAt(0, 32)); }, cancel() { cancelled = true; } }));
    }, 10, false, cache);
    await until(() => res.written > 0);
    await wait(20);
    assert.equal(cancelled, false); assert.equal(signal.aborted, false);
    await active;
    assert.equal(cancelled, true); assert.equal(signal.aborted, true); assert.equal(signal.reason.status, 410);
    assert.equal(res.destroyed, true); assert.equal(res.writableFinished, false);
    assert.equal(cache.stats().bytes, 0); assert.equal(cap.controllers.size, 0);
    assert.equal(req.listenerCount('aborted'), 0); assert.equal(res.listenerCount('drain'), 0);
  } finally { clearTimeout(guard); cache.clear(); }
});

test('a finished media response clears its TTL timer instead of aborting a later capability consumer', async () => {
  const cache = new RamMediaCache(), cap = cacheCap('finished-stream-ttl'), later = new AbortController();
  const { req, res } = pausedResponse('bytes=0-31');
  cap.expiresAt = Date.now() + 50;
  cache.put(cap, 0, bytesAt(0, 32));
  res.write = chunk => { res.written += chunk.byteLength; return true; };
  try {
    await streamMedia(req, res, cap, async () => assert.fail('The cached response must not fetch.'), 10, false, cache);
    assert.equal(res.writableFinished, true); assert.equal(res.destroyed, false); assert.equal(cap.controllers.size, 0);
    cap.controllers.add(later);
    await wait(70);
    assert.equal(later.signal.aborted, false);
    // stats does not prune: this also proves that the finished stream's timer
    // did not fire a deferred deletion after releasing its own lease.
    assert.equal(cache.stats().bytes, MEDIA_CACHE_BLOCK_BYTES);
  } finally { cap.controllers.delete(later); cache.clear(); }
});
