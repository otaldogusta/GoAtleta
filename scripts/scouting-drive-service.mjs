// Local control companion only. Never deploy this loopback server as a public API.
// Cloud inference travels Drive -> Roboflow. Playback uses bounded RAM Range streams;
// this companion never writes, buffers or saves the complete video.
import http from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

export const provider = 'roboflow';
export const model = 'volleyball_v2/3';
export const sampledFps = 30;
export const MAX_VIDEO_BYTES = 3_000_000_000;
export const MAX_MEDIA_RANGE_BYTES = 8 * 1024 * 1024;
export const MAX_MEDIA_CACHE_BYTES = 32 * 1024 * 1024;
export const MEDIA_CACHE_BLOCK_BYTES = 64 * 1024;
export const MEDIA_READ_AHEAD_BYTES = 2 * 1024 * 1024;
const MAX_REQUEST_BYTES = 8192;
const ORIGIN = 'http://localhost:8081';
const API_URL = 'https://api.roboflow.com/videoinfer/';
const FILE_ID = /^[A-Za-z0-9_-]{20,160}$/;
const REDIRECT = new Set([301, 302, 303, 307, 308]);

class ServiceError extends Error {}
const fail = message => { throw new ServiceError(message); };
const text = (value, max = 512) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const cancelBody = response => { void response?.body?.cancel().catch(() => {}); };
const MEDIA_TTL_MS = 2 * 60 * 60 * 1000;
const mediaHeaders = {
  'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Expose-Headers': 'Content-Length,Content-Range,Accept-Ranges,Last-Modified',
  'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes', Vary: 'Origin',
};

export function driveDownloadUrl(fileId) {
  if (typeof fileId !== 'string' || !FILE_ID.test(fileId)) fail('ID de arquivo do Drive inválido. Escolha um vídeo, não uma pasta.');
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
}

export function validateRequest(value) {
  if (!object(value)) fail('Requisição inválida.');
  driveDownloadUrl(value.fileId);
  const media = value.media;
  if (!object(media) || !text(media.fingerprint) || !text(media.name, 240) ||
      !Number.isFinite(media.duration) || media.duration <= 0 || media.duration > 1800 ||
      !Number.isInteger(media.width) || media.width < 1 || media.width > 16384 ||
      !Number.isInteger(media.height) || media.height < 1 || media.height > 16384) {
    fail('Confirme os metadados de um vídeo de até 30 minutos antes de gerar o tracking.');
  }
  const scope = validateScope(value.scope);
  return Object.freeze({
    fileId: value.fileId,
    media: Object.freeze({ fingerprint: media.fingerprint, name: media.name, duration: media.duration, width: media.width, height: media.height }),
    scope,
  });
}

export function validateScope(value) {
  const keys = ['userId', 'org', 'classId', 'sessionId', 'targetFingerprint'];
  if (!object(value) || !keys.every(key => text(value[key]))) fail('Contexto de sessão, organização ou vídeo inválido.');
  return Object.freeze(Object.fromEntries(keys.map(key => [key, value[key]])));
}

const sameOwner = (a, b) => Boolean(a && b && a.userId === b.userId && a.org === b.org);
const sameScope = (a, b) => ['userId', 'org', 'classId', 'sessionId', 'targetFingerprint'].every(key => a[key] === b[key]);
function queryOwner(url) {
  if (['userId', 'org'].some(key => url.searchParams.getAll(key).length !== 1 || !text(url.searchParams.get(key)))) return null;
  return { userId: url.searchParams.get('userId'), org: url.searchParams.get('org') };
}

/** A single byte range only; never permit a request for the complete large video. */
export function parseMediaRange(header, size) {
  const match = typeof header === 'string' && /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - Math.min(suffix, MAX_MEDIA_RANGE_BYTES)); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null;
    end = Math.min(size - 1, end, start + MAX_MEDIA_RANGE_BYTES - 1);
  }
  return { start, end };
}

function mediaError(message, status = 502) {
  const error = new ServiceError(message); error.status = status; return error;
}

/**
 * Read-through RAM only: copy bytes after a verified upstream Range supplied them.
 * Fixed-size blocks bound allocations globally; sparse validity ranges never expose
 * untouched bytes. Leases pin referenced blocks until downstream backpressure ends.
 */
export class RamMediaCache {
  #entries = new Map();
  #bytes = 0;
  #hits = 0;
  #misses = 0;
  constructor(maxBytes = MAX_MEDIA_CACHE_BYTES) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < MEDIA_CACHE_BLOCK_BYTES || maxBytes > MAX_MEDIA_CACHE_BYTES || maxBytes % MEDIA_CACHE_BLOCK_BYTES !== 0) {
      throw new Error('Invalid bounded media cache size.');
    }
    Object.defineProperty(this, 'maxBytes', { value: maxBytes, enumerable: true });
  }
  #version(cap) {
    return JSON.stringify([cap.id, cap.fileId, cap.size, cap.mimeType, cap.lastModified, cap.scope]);
  }
  #usable(cap) {
    return !cap.revoked && !cap.invalid && Number.isFinite(cap.expiresAt) && cap.expiresAt > Date.now();
  }
  #touch(entry) { this.#entries.delete(entry.key); this.#entries.set(entry.key, entry); }
  #drop(entry) {
    if (entry.pins) { entry.retired = true; return; }
    if (this.#entries.get(entry.key) === entry) { this.#entries.delete(entry.key); this.#bytes -= MEDIA_CACHE_BLOCK_BYTES; }
  }
  #prune() {
    for (const entry of this.#entries.values()) if (!this.#usable(entry.cap)) this.#drop(entry);
  }
  #makeSpace() {
    this.#prune();
    if (this.#bytes + MEDIA_CACHE_BLOCK_BYTES <= this.maxBytes) return true;
    for (const entry of this.#entries.values()) {
      if (!entry.pins) { this.#drop(entry); return true; }
    }
    return false;
  }
  stats() {
    return { bytes: this.#bytes, maxBytes: this.maxBytes, blocks: this.#entries.size,
      pinnedBytes: [...this.#entries.values()].filter(entry => entry.pins > 0).length * MEDIA_CACHE_BLOCK_BYTES,
      hits: this.#hits, misses: this.#misses };
  }
  delete(cap) {
    for (const entry of this.#entries.values()) if (entry.cap.id === cap.id) this.#drop(entry);
  }
  clear() { for (const entry of this.#entries.values()) this.#drop(entry); }
  put(cap, start, value) {
    if (!this.#usable(cap)) { this.delete(cap); return; }
    if (!(value instanceof Uint8Array) || !Number.isSafeInteger(start) || start < 0 || start + value.byteLength > cap.size || value.byteLength > MAX_MEDIA_RANGE_BYTES) {
      throw new Error('Invalid received media fragment.');
    }
    const version = this.#version(cap);
    for (let consumed = 0; consumed < value.byteLength;) {
      const absolute = start + consumed, index = Math.floor(absolute / MEDIA_CACHE_BLOCK_BYTES);
      const offset = absolute % MEDIA_CACHE_BLOCK_BYTES, length = Math.min(value.byteLength - consumed, MEDIA_CACHE_BLOCK_BYTES - offset);
      const key = `${version}:${index}`;
      let entry = this.#entries.get(key);
      if (entry?.retired) { consumed += length; continue; }
      if (!entry) {
        if (!this.#makeSpace()) { consumed += length; continue; }
        entry = { key, cap, index, buffer: Buffer.alloc(MEDIA_CACHE_BLOCK_BYTES), valid: [], pins: 0, retired: false };
        this.#entries.set(key, entry); this.#bytes += MEDIA_CACHE_BLOCK_BYTES;
      }
      // Conflicting overlapping bytes are evidence of a changed/corrupt original,
      // never a reason to blend two versions under the same capability.
      for (const [left, right] of entry.valid) {
        const overlapStart = Math.max(left, offset), overlapEnd = Math.min(right, offset + length);
        if (overlapStart < overlapEnd && !entry.buffer.subarray(overlapStart, overlapEnd).equals(value.subarray(consumed + overlapStart - offset, consumed + overlapEnd - offset))) {
          cap.invalid = true; this.delete(cap);
          const error = mediaError('Os bytes do vídeo do Drive mudaram. Confira a mídia novamente.', 409);
          for (const controller of cap.controllers) controller.abort(error);
          throw error;
        }
      }
      const spans = [...entry.valid, [offset, offset + length]].sort((a, b) => a[0] - b[0]);
      const merged = [];
      for (const span of spans) {
        const last = merged.at(-1);
        if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
        else merged.push([...span]);
      }
      // Bound sparse bookkeeping as well as byte buffers; an adversarial set of
      // tiny disjoint ranges falls back to normal streaming rather than growing.
      if (merged.length <= 64) {
        entry.buffer.set(value.subarray(consumed, consumed + length), offset); entry.valid = merged;
      }
      this.#touch(entry); consumed += length;
    }
  }
  acquire(cap, range) {
    this.#prune();
    if (!this.#usable(cap) || !Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < 0 || range.end < range.start || range.end >= cap.size || range.end - range.start + 1 > MAX_MEDIA_RANGE_BYTES) {
      this.#misses++; return null;
    }
    const version = this.#version(cap), pieces = [];
    let next = range.start;
    while (next <= range.end) {
      const index = Math.floor(next / MEDIA_CACHE_BLOCK_BYTES), offset = next % MEDIA_CACHE_BLOCK_BYTES;
      const entry = this.#entries.get(`${version}:${index}`);
      const valid = entry && !entry.retired && entry.valid.find(([left, right]) => left <= offset && offset < right);
      if (!valid) break;
      const length = Math.min(range.end - next + 1, valid[1] - offset);
      entry.pins++; this.#touch(entry); pieces.push({ entry, bytes: entry.buffer.subarray(offset, offset + length) });
      next += length;
    }
    if (!pieces.length) { this.#misses++; return null; }
    this.#hits++;
    let released = false;
    return { start: range.start, end: next - 1, length: next - range.start, chunks: pieces.map(piece => piece.bytes), release: () => {
      if (released) return; released = true;
      for (const { entry } of pieces) { entry.pins--; if (entry.retired || !this.#usable(entry.cap)) this.#drop(entry); }
    } };
  }
}

/** One requested, aligned 2 MiB window; never chain into the next window. */
export class MediaReadAhead {
  #cache; #fetcher; #timeout; #diagnostics;
  #tasks = new Map(); #queue = []; #active = 0; #closed = false;
  constructor(cache, fetcher = fetch, { timeoutMs = 60000, diagnostics = false } = {}) {
    this.#cache = cache; this.#fetcher = fetcher; this.#timeout = timeoutMs; this.#diagnostics = diagnostics;
  }
  stats() { return { active: this.#active, queued: this.#queue.length, tasks: this.#tasks.size }; }
  #usable(cap) { return !cap.revoked && !cap.invalid && cap.expiresAt > Date.now(); }
  #key(cap, start) { return JSON.stringify([cap.id, cap.fileId, cap.size, cap.mimeType, cap.lastModified, cap.scope, start]); }
  ensure(cap, offset, signal) {
    signal?.throwIfAborted();
    if (this.#closed || !this.#usable(cap)) return Promise.reject(mediaError('A fonte de reprodução expirou. Confira o vídeo novamente.', 410));
    if (!Number.isSafeInteger(offset) || offset < 0 || offset >= cap.size) return Promise.reject(mediaError('Trecho de vídeo inválido.', 416));
    const start = Math.floor(offset / MEDIA_READ_AHEAD_BYTES) * MEDIA_READ_AHEAD_BYTES;
    const end = Math.min(cap.size - 1, start + MEDIA_READ_AHEAD_BYTES - 1);
    const present = this.#cache.acquire(cap, { start, end });
    const complete = present?.end === end; present?.release();
    if (complete) return Promise.resolve();
    const key = this.#key(cap, start);
    let task = this.#tasks.get(key);
    if (!task) {
      if (this.#queue.length >= 4) return Promise.reject(mediaError('Aguarde os trechos do vídeo em preparação.', 503));
      task = { key, cap, start, end, waiters: 0, started: false, controller: null };
      task.promise = new Promise((resolve, reject) => { task.resolve = resolve; task.reject = reject; });
      this.#tasks.set(key, task); this.#queue.push(task);
    }
    const waiting = this.#wait(task, signal);
    this.#drain();
    return waiting;
  }
  #wait(task, signal) {
    task.waiters++;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return; settled = true;
        signal?.removeEventListener('abort', abort); task.waiters--;
        if (!task.started && task.waiters === 0) this.#cancelQueued(task, new DOMException('Cancelled', 'AbortError'));
        if (error) reject(error); else resolve();
      };
      const abort = () => finish(signal.reason ?? new DOMException('Cancelled', 'AbortError'));
      signal?.addEventListener('abort', abort, { once: true });
      task.promise.then(() => finish(), error => finish(error));
      if (signal?.aborted) abort();
    });
  }
  #cancelQueued(task, error) {
    const index = this.#queue.indexOf(task);
    if (index < 0) return;
    this.#queue.splice(index, 1); this.#tasks.delete(task.key); task.reject(error);
  }
  delete(cap) {
    const error = mediaError('A fonte de reprodução foi encerrada.', 410);
    for (const task of this.#tasks.values()) if (task.cap.id === cap.id) {
      if (task.started) task.controller.abort(error); else this.#cancelQueued(task, error);
    }
  }
  close() {
    this.#closed = true;
    for (const task of this.#tasks.values()) {
      if (task.started) task.controller.abort(); else this.#cancelQueued(task, new DOMException('Closed', 'AbortError'));
    }
  }
  #drain() {
    while (!this.#closed && this.#active < 2 && this.#queue.length) {
      const task = this.#queue.shift(); task.started = true; this.#active++;
      const controller = new AbortController(); task.controller = controller; task.cap.controllers.add(controller);
      const expiry = setTimeout(() => {
        const error = mediaError('A fonte de reprodução expirou.', 410);
        this.#cache.delete(task.cap);
        for (const current of task.cap.controllers) current.abort(error);
      }, Math.max(1, task.cap.expiresAt - Date.now()));
      expiry.unref();
      void this.#fill(task).then(task.resolve, task.reject).finally(() => {
        clearTimeout(expiry); task.cap.controllers.delete(controller); this.#tasks.delete(task.key); this.#active--; this.#drain();
      });
    }
  }
  async #fill(task) {
    const { cap, controller } = task;
    let reader, sent = 0, stage = 'cache-fill-fetch';
    const started = Date.now(), expected = task.end - task.start + 1;
    const diagnose = eventCode => { if (this.#diagnostics) console.log(JSON.stringify({ eventCode, stage, sent, expected, status: 206, elapsed: Date.now() - started })); };
    const cancelRead = () => { if (reader) void reader.cancel().catch(() => {}); };
    controller.signal.addEventListener('abort', cancelRead, { once: true });
    const upstream = async (operation, nextStage) => {
      stage = nextStage;
      let rejectAbort;
      const aborted = new Promise((_, reject) => { rejectAbort = reject; });
      const onAbort = () => rejectAbort(controller.signal.reason);
      controller.signal.addEventListener('abort', onAbort, { once: true });
      const timer = setTimeout(() => controller.abort(mediaError('A leitura do trecho do Drive ficou sem resposta.', 504)), this.#timeout);
      try { controller.signal.throwIfAborted(); return await Promise.race([operation(), aborted]); }
      finally { clearTimeout(timer); controller.signal.removeEventListener('abort', onAbort); }
    };
    try {
      if (!this.#usable(cap)) throw mediaError('A fonte de reprodução expirou.', 410);
      let next = task.start;
      const known = this.#cache.acquire(cap, { start: task.start, end: task.end });
      if (known) { next = known.end + 1; sent = known.length; known.release(); }
      while (next <= task.end) {
        const opened = await openDriveRange(cap, { start: next, end: task.end }, this.#fetcher, controller.signal, operation => upstream(operation, 'cache-fill-fetch'));
        controller.signal.throwIfAborted(); reader = opened.response.body.getReader();
        let received = 0;
        while (received < opened.length) {
          const chunk = await upstream(() => reader.read(), 'cache-fill-read'); controller.signal.throwIfAborted();
          if (!this.#usable(cap)) throw mediaError('A fonte de reprodução expirou.', 410);
          if (chunk.done || chunk.value.byteLength > opened.length - received) throw mediaError('O Drive devolveu um trecho de vídeo incompleto.');
          this.#cache.put(cap, opened.range.start + received, chunk.value);
          received += chunk.value.byteLength; sent += chunk.value.byteLength;
        }
        void reader.cancel().catch(() => {}); reader.releaseLock(); reader = null;
        next = opened.range.end + 1;
      }
      const verified = this.#cache.acquire(cap, { start: task.start, end: task.end });
      const complete = verified?.end === task.end; verified?.release();
      if (!complete) throw mediaError('Não há espaço no buffer de vídeo. Aguarde a reprodução atual.', 503);
      stage = 'cache-fill-complete'; diagnose('fill_completed');
    } catch (error) { diagnose('fill_failed'); throw error; }
    finally {
      controller.signal.removeEventListener('abort', cancelRead);
      if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock(); }
      controller.abort();
    }
  }
}

async function openDriveRange(cap, range, fetcher, signal, awaitFetch = operation => operation()) {
  let url = driveDownloadUrl(cap.fileId);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await awaitFetch(() => fetcher(safeUrl(url, 'drive'), {
      method: 'GET', redirect: 'manual', signal,
      headers: { Range: `bytes=${range.start}-${range.end}`, 'Accept-Encoding': 'identity' },
    }));
    if (REDIRECT.has(response.status)) {
      cancelBody(response);
      const location = response.headers.get('location');
      if (!location || redirects === 3) throw mediaError('O Drive excedeu o limite de redirecionamentos.');
      url = safeUrl(new URL(location, url).toString(), 'drive'); continue;
    }
    const contentRange = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') ?? '');
    const mimeType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    const length = response.headers.get('content-length');
    const start = Number(contentRange?.[1]), end = Number(contentRange?.[2]), size = Number(contentRange?.[3]);
    const changed = cap.lastModified && response.headers.get('last-modified') && cap.lastModified !== response.headers.get('last-modified');
    if (response.status !== 206 || !contentRange || start !== range.start || end < start || end > range.end || size !== cap.size ||
        !Number.isSafeInteger(end) || end - start + 1 > MAX_MEDIA_RANGE_BYTES || mimeType !== cap.mimeType || changed ||
        (length !== null && (!/^\d+$/.test(length) || Number(length) !== end - start + 1)) || !response.body) {
      cancelBody(response);
      throw mediaError('O Drive não confirmou o trecho do vídeo original. Confira a mídia novamente.');
    }
    return { response, range: { start, end }, length: end - start + 1 };
  }
  throw mediaError('O Drive excedeu o limite de redirecionamentos.');
}

export async function streamMedia(req, res, cap, fetcher, timeoutMs = 60000, diagnostics = false, cache, readAhead) {
  const range = parseMediaRange(req.headers.range, cap.size);
  if (!range) {
    res.writeHead(416, { ...mediaHeaders, 'Content-Range': `bytes */${cap.size}` }); res.end(); return;
  }
  const controller = new AbortController(); cap.controllers.add(controller);
  let reader, lease, stage = 'upstream-fetch', sent = 0, expected = range.end - range.start + 1;
  const started = Date.now();
  const diagnose = eventCode => {
    // Deliberately omit URLs, ids, capabilities, credentials and arbitrary Error text.
    if (diagnostics) console.log(JSON.stringify({ eventCode, stage, sent, expected, status: res.headersSent ? 206 : 0, elapsed: Date.now() - started }));
  };
  const disconnect = () => { if (!res.writableFinished) controller.abort(); };
  req.once('aborted', disconnect); res.once('close', disconnect);
  const cancelRead = () => { if (reader) void reader.cancel().catch(() => {}); };
  controller.signal.addEventListener('abort', cancelRead, { once: true });
  // Capability lifetime also bounds paused downstream writes after a cache fill
  // finished. This is independent of upstream inactivity and never resets on IO.
  const expiry = setTimeout(() => {
    const error = mediaError('A fonte de reprodução expirou. Confira o vídeo novamente.', 410);
    cache?.delete(cap); readAhead?.delete(cap);
    for (const current of cap.controllers) current.abort(error);
  }, Math.max(1, cap.expiresAt - Date.now()));
  expiry.unref();
  const upstream = async (operation, nextStage) => {
    stage = nextStage;
    let rejectAbort;
    const aborted = new Promise((_, reject) => { rejectAbort = reject; });
    const onAbort = () => rejectAbort(controller.signal.reason);
    controller.signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => {
      diagnose('upstream_idle_timeout');
      controller.abort(mediaError('A leitura do trecho do Drive ficou sem resposta.', 504));
    }, timeoutMs);
    try {
      controller.signal.throwIfAborted();
      return await Promise.race([operation(), aborted]);
    } finally {
      clearTimeout(timer); controller.signal.removeEventListener('abort', onAbort);
    }
  };
  try {
    if (readAhead) { stage = 'cache-fill-wait'; await readAhead.ensure(cap, range.start, controller.signal); controller.signal.throwIfAborted(); }
    lease = cache?.acquire(cap, range);
    if (lease) {
      stage = 'cache-read'; expected = lease.length;
      res.writeHead(206, { ...mediaHeaders, 'Content-Type': cap.mimeType, 'Content-Length': lease.length,
        'Content-Range': `bytes ${lease.start}-${lease.end}/${cap.size}`, ...(cap.lastModified ? { 'Last-Modified': cap.lastModified } : {}) });
      for (const chunk of lease.chunks) {
        controller.signal.throwIfAborted(); sent += chunk.byteLength;
        if (!res.write(chunk)) { stage = 'downstream-drain'; await once(res, 'drain', { signal: controller.signal }); }
      }
      stage = 'complete'; res.end(); diagnose('cache_hit'); return;
    }
    if (readAhead) throw mediaError('O buffer de vídeo não está disponível. Tente novamente.', 503);
    const opened = await openDriveRange(cap, range, fetcher, controller.signal, operation => upstream(operation, 'upstream-fetch'));
    controller.signal.throwIfAborted(); reader = opened.response.body.getReader();
    expected = opened.length;
    res.writeHead(206, {
      ...mediaHeaders, 'Content-Type': cap.mimeType, 'Content-Length': opened.length,
      'Content-Range': `bytes ${opened.range.start}-${opened.range.end}/${cap.size}`,
      ...(cap.lastModified ? { 'Last-Modified': cap.lastModified } : {}),
    });
    while (sent < opened.length) {
      const chunk = await upstream(() => reader.read(), 'upstream-read'); controller.signal.throwIfAborted();
      if (chunk.done || chunk.value.byteLength > opened.length - sent) throw mediaError('O Drive devolveu um trecho de vídeo incompleto.');
      cache?.put(cap, opened.range.start + sent, chunk.value);
      sent += chunk.value.byteLength;
      // A paused/seeking video may intentionally stop consuming bytes for minutes.
      // No upstream inactivity timer is armed while honoring that backpressure.
      if (!res.write(chunk.value)) { stage = 'downstream-drain'; await once(res, 'drain', { signal: controller.signal }); }
    }
    stage = 'complete'; res.end(); diagnose('stream_completed');
  } catch (error) {
    diagnose(controller.signal.aborted && !(controller.signal.reason instanceof ServiceError) ? 'client_disconnected' : 'stream_failed');
    if (res.headersSent) res.destroy();
    else if (!res.destroyed) {
      res.writeHead(error instanceof ServiceError ? (error.status ?? 502) : 502, { ...mediaHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error instanceof ServiceError ? error.message : 'Não foi possível reproduzir o trecho do Drive.' }));
    }
  } finally {
    clearTimeout(expiry);
    req.removeListener('aborted', disconnect); res.removeListener('close', disconnect);
    controller.signal.removeEventListener('abort', cancelRead);
    if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock(); }
    lease?.release();
    controller.abort(); cap.controllers.delete(controller);
  }
}

function safeUrl(value, destination) {
  let url;
  try { url = new URL(value); } catch { fail('O serviço retornou uma URL inválida.'); }
  const host = url.hostname.toLowerCase();
  const allowed = destination === 'drive'
    ? host === 'drive.usercontent.google.com' || host === 'drive.google.com' || host === 'googleusercontent.com' || host.endsWith('.googleusercontent.com')
    : host === 'storage.googleapis.com' || host.endsWith('.storage.googleapis.com') || host === 'storage.roboflow.com' || host === 'media.roboflow.com';
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !allowed) {
    fail('Destino remoto não autorizado. Nenhum arquivo foi baixado.');
  }
  return url.toString();
}

async function deadline(signal, timeoutMs, operation, timeoutMessage) {
  const controller = new AbortController();
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  let rejectAbort;
  const aborted = new Promise((_, reject) => { rejectAbort = reject; });
  const onAbort = () => rejectAbort(combined.reason ?? new DOMException('Cancelled', 'AbortError'));
  combined.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new ServiceError(timeoutMessage)), timeoutMs);
  try {
    combined.throwIfAborted();
    return await Promise.race([operation(combined), aborted]);
  } finally {
    clearTimeout(timer);
    combined.removeEventListener('abort', onAbort);
  }
}

export async function inspectDriveFile(fileId, { fetcher = fetch, signal, timeoutMs = 15000 } = {}) {
  return deadline(signal, timeoutMs, async requestSignal => {
    let url = driveDownloadUrl(fileId);
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await fetcher(safeUrl(url, 'drive'), { method: 'HEAD', redirect: 'manual', signal: requestSignal });
      cancelBody(response);
      if (REDIRECT.has(response.status)) {
        const location = response.headers.get('location');
        if (!location || redirects === 3) fail('O Drive excedeu o limite de redirecionamentos.');
        url = safeUrl(new URL(location, url).toString(), 'drive');
        continue;
      }
      if (response.status !== 200) fail('O vídeo do Drive não está acessível diretamente. Confira a permissão desse arquivo.');
      const mimeType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      const rawSize = response.headers.get('content-length');
      const size = rawSize && /^\d+$/.test(rawSize) ? Number(rawSize) : 0;
      if (!['video/mp4', 'video/quicktime'].includes(mimeType)) fail('O Drive não devolveu um vídeo MP4/MOV. Nenhum processamento foi iniciado.');
      if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_VIDEO_BYTES) fail('O vídeo precisa ter tamanho conhecido e no máximo 3 GB.');
      if (response.headers.get('accept-ranges')?.toLowerCase() !== 'bytes' || response.headers.get('access-control-allow-origin') !== '*') {
        fail('O arquivo não permite a reprodução direta necessária para mostrar a trajetória.');
      }
      return { size, mimeType, lastModified: response.headers.get('last-modified') ?? null };
    }
    fail('O Drive excedeu o limite de redirecionamentos.');
  }, 'O Drive demorou para confirmar o vídeo. Nenhum processamento foi iniciado.');
}

export async function readBoundedJson(response, maxBytes, signal) {
  const declaredSize = response.headers.get('content-length');
  if (declaredSize && (!/^\d+$/.test(declaredSize) || Number(declaredSize) > maxBytes)) {
    cancelBody(response);
    fail('A resposta do tracking excedeu o limite permitido.');
  }
  const mimeType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (!response.body || !(mimeType === 'application/json' || mimeType === 'text/plain' || /^application\/[a-z0-9.+-]+\+json$/.test(mimeType ?? ''))) {
    cancelBody(response);
    fail('O provedor não retornou JSON de tracking.');
  }
  const reader = response.body.getReader();
  const onAbort = () => { void reader.cancel(signal.reason).catch(() => {}); };
  signal?.addEventListener('abort', onAbort, { once: true });
  const chunks = [];
  let size = 0;
  try {
    signal?.throwIfAborted();
    for (;;) {
      const chunk = await reader.read();
      signal?.throwIfAborted();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) fail('A resposta do tracking excedeu o limite permitido.');
      chunks.push(chunk.value);
    }
    let result;
    try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('O provedor retornou JSON de tracking inválido.'); }
    if (!object(result)) fail('O provedor retornou um resultado de tracking inválido.');
    return result;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function requestJson(req, maxBytes) {
  const declaredSize = req.headers['content-length'];
  if (declaredSize && (!/^\d+$/.test(declaredSize) || Number(declaredSize) > maxBytes)) fail('Requisição excede o limite permitido.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.byteLength;
    if (size > maxBytes) fail('Requisição excede o limite permitido.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('Requisição JSON inválida.'); }
}

async function providerJson(url, init, { fetcher, signal, timeoutMs, maxBytes = 1024 * 1024, result = false }) {
  return deadline(signal, timeoutMs, async requestSignal => {
    let target = url;
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await fetcher(target, { ...init, redirect: 'manual', signal: requestSignal });
      if (REDIRECT.has(response.status) && result) {
        cancelBody(response);
        const location = response.headers.get('location');
        if (!location || redirects === 3) fail('O resultado excedeu o limite de redirecionamentos.');
        target = safeUrl(new URL(location, target).toString(), 'result');
        continue;
      }
      if (!response.ok) {
        cancelBody(response);
        if (response.status === 401 || response.status === 403) fail('O Roboflow recusou a credencial ou o acesso ao resultado.');
        if (response.status === 404 || response.status === 410) fail('A API de vídeo do Roboflow está indisponível neste endpoint. Nenhuma trajetória foi aplicada.');
        if (response.status === 429) fail('O limite do Roboflow foi atingido. Nenhuma nova tentativa foi iniciada automaticamente.');
        fail(`O Roboflow recusou a operação (HTTP ${response.status}). Nenhuma trajetória foi aplicada.`);
      }
      return readBoundedJson(response, maxBytes, requestSignal);
    }
    fail('O resultado excedeu o limite de redirecionamentos.');
  }, 'O Roboflow excedeu o tempo de resposta. O processamento remoto pode continuar; não houve nova tentativa automática.');
}

export async function runCloudTracking(input, apiKey, {
  fetcher = fetch, signal, pollIntervalMs = 5000, requestTimeoutMs = 30000,
  resultTimeoutMs = 30000, maxResultBytes = 32 * 1024 * 1024, onSubmitting = () => {},
} = {}) {
  const request = validateRequest(input);
  await inspectDriveFile(request.fileId, { fetcher, signal });
  signal?.throwIfAborted();
  const apiUrl = new URL(API_URL);
  apiUrl.searchParams.set('api_key', apiKey);
  onSubmitting();
  // One POST only: an unknown timeout must never create another paid remote job.
  const submitted = await providerJson(apiUrl.toString(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input_url: driveDownloadUrl(request.fileId), infer_fps: sampledFps,
      models: [{ model_id: 'volleyball_v2', model_version: '3', inference_type: 'object-detection' }],
    }),
  }, { fetcher, signal, timeoutMs: requestTimeoutMs });
  if (typeof submitted.job_id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(submitted.job_id)) {
    fail('O Roboflow não confirmou um job de vídeo válido. Não houve nova tentativa automática.');
  }
  apiUrl.searchParams.set('job_id', submitted.job_id);
  for (;;) {
    signal?.throwIfAborted();
    const status = await providerJson(apiUrl.toString(), { method: 'GET' }, { fetcher, signal, timeoutMs: requestTimeoutMs });
    if (!Number.isInteger(status.status) || status.status < 0) fail('O Roboflow retornou um estado de job desconhecido.');
    if (status.status > 1) fail('O Roboflow não conseguiu processar esse vídeo. Nenhuma trajetória foi aplicada.');
    if (status.status === 0) {
      const resultUrl = safeUrl(status.output_signed_url, 'result');
      const predictions = await providerJson(resultUrl, { method: 'GET' }, {
        fetcher, signal, timeoutMs: resultTimeoutMs, maxBytes: maxResultBytes, result: true,
      });
      return { media: request.media, provider, model, sampledFps, predictions };
    }
    await wait(pollIntervalMs, undefined, { signal });
  }
}

function outsideGit(path) {
  for (let parent = dirname(path); ; parent = dirname(parent)) {
    if (existsSync(join(parent, '.git'))) return false;
    if (parent === dirname(parent)) return true;
  }
}

export function loadApiKey(environment = process.env) {
  let key = environment.ROBOFLOW_API_KEY?.trim() ?? '';
  if (!key && environment.ROBOFLOW_API_KEY_FILE) {
    const location = environment.ROBOFLOW_API_KEY_FILE;
    if (!isAbsolute(location) || !outsideGit(resolve(location))) fail('O arquivo privado da credencial deve ficar fora de um repositório Git.');
    let target, size;
    try {
      target = realpathSync(location);
      const stat = statSync(target);
      size = stat.isFile() ? stat.size : 0;
    } catch { fail('Não foi possível ler o arquivo privado da credencial do Roboflow.'); }
    if (!outsideGit(target) || size < 1 || size > 4096) fail('Arquivo privado de credencial inválido.');
    key = readFileSync(target, 'utf8').trim();
  }
  if (key && !/^[A-Za-z0-9_-]{20,100}$/.test(key)) fail('Credencial do Roboflow inválida. Use somente a chave, sem formato .env.');
  return key;
}

export function createService(apiKey = '', options = {}) {
  const jobs = new Map();
  const media = new Map();
  const cache = options.mediaCache instanceof RamMediaCache ? options.mediaCache : new RamMediaCache();
  const readAhead = options.readAhead === false ? null : new MediaReadAhead(cache, options.fetcher ?? fetch, { timeoutMs: options.mediaTimeoutMs, diagnostics: options.diagnostics ?? process.env.SCOUTING_DRIVE_DIAGNOSTICS === '1' });
  const pendingMedia = new Set();
  let mediaStreams = 0;
  let active = null;
  // These are local development bindings, not proof of Supabase authorization.
  // An env/file key has no default owner and cannot be inherited by another login.
  let credentialOwner = options.credentialOwner ? Object.freeze({ userId: options.credentialOwner.userId, org: options.credentialOwner.org }) : null;
  const runner = options.runner ?? runCloudTracking;
  const revokeMedia = cap => { cap.revoked = true; readAhead?.delete(cap); cache.delete(cap); for (const controller of cap.controllers) controller.abort(); media.delete(cap.id); };
  const pruneMedia = () => { for (const cap of media.values()) if (Date.now() >= cap.expiresAt || cap.invalid) revokeMedia(cap); };
  const snapshot = job => ({
    id: job.id, status: job.status, scope: job.input.scope,
    ...(job.result ? { result: job.result } : {}), ...(job.error ? { error: job.error } : {}),
    ...(job.status === 'cancelled' ? { remoteCancellationSupported: false, notice: 'Somente a consulta local foi interrompida. O processamento remoto pode continuar.' } : {}),
  });
  const server = http.createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': ORIGIN, Vary: 'Origin' });
      res.end(JSON.stringify(value));
    };
    if (req.headers.host !== `127.0.0.1:${req.socket.localPort}` || req.headers.origin !== ORIGIN) return send(403, { error: 'Origem não autorizada.' });
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'GET,HEAD,POST,DELETE', 'Access-Control-Allow-Headers': 'Content-Type,X-GoAtleta-Tracking,Range', Vary: 'Origin' });
      res.end(); return;
    }
    const url = new URL(req.url, 'http://127.0.0.1');
    const mediaId = url.pathname.match(/^\/media\/([a-f0-9-]{36})$/)?.[1];
    if (mediaId && ['GET', 'HEAD', 'DELETE'].includes(req.method)) {
      pruneMedia();
      const cap = media.get(mediaId), token = url.searchParams.get('token');
      if (!cap || url.searchParams.getAll('token').length !== 1 || [...url.searchParams.keys()].some(key => key !== 'token') ||
          typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(cap.token, 'hex'))) {
        return send(404, { error: 'Fonte de reprodução indisponível. Confira o arquivo novamente.' });
      }
      if (req.method === 'DELETE') {
        if (req.headers['x-goatleta-tracking'] !== '1') return send(403, { error: 'Requisição não autorizada.' });
        try {
          const value = await requestJson(req, 4096), scope = validateScope(value?.scope);
          if (!sameScope(cap.scope, scope)) return send(403, { error: 'A fonte de reprodução pertence a outro contexto.' });
          revokeMedia(cap); return send(200, { revoked: true });
        } catch (error) {
          return send(400, { error: error instanceof ServiceError ? error.message : 'Contexto da reprodução inválido.' });
        }
      }
      if (req.method === 'HEAD') {
        res.writeHead(200, { ...mediaHeaders, 'Content-Type': cap.mimeType, 'Content-Length': cap.size, ...(cap.lastModified ? { 'Last-Modified': cap.lastModified } : {}) });
        res.end(); return;
      }
      if (mediaStreams >= 2) return send(503, { error: 'Aguarde os trechos de vídeo em reprodução antes de solicitar outro.' });
      mediaStreams++;
      try { await streamMedia(req, res, cap, options.fetcher ?? fetch, options.mediaTimeoutMs, options.diagnostics ?? process.env.SCOUTING_DRIVE_DIAGNOSTICS === '1', cache, readAhead); }
      finally { mediaStreams--; }
      return;
    }
    if (req.headers['x-goatleta-tracking'] !== '1') return send(403, { error: 'Requisição não autorizada.' });
    if (req.method === 'POST' && url.pathname === '/media' && !url.search) {
      if (!req.headers['content-type']?.startsWith('application/json')) return send(400, { error: 'Envie uma requisição JSON.' });
      let controller;
      const disconnect = () => { if (!res.writableFinished) controller?.abort(); };
      res.once('close', disconnect);
      try {
        const value = await requestJson(req, MAX_REQUEST_BYTES);
        const scope = validateScope(value?.scope);
        driveDownloadUrl(value?.fileId);
        pruneMedia();
        if (pendingMedia.size >= 2) return send(503, { error: 'Aguarde a conferência de vídeo atual.' });
        controller = new AbortController(); pendingMedia.add(controller);
        const info = await inspectDriveFile(value.fileId, { fetcher: options.fetcher ?? fetch, signal: controller.signal });
        controller.signal.throwIfAborted();
        let cap = [...media.values()].find(item => item.fileId === value.fileId && sameScope(item.scope, scope) && item.size === info.size && item.lastModified === info.lastModified);
        if (!cap) {
          if (media.size >= 4) return send(409, { error: 'Há quatro fontes de reprodução ativas. Feche uma fonte ou aguarde sua expiração.' });
          cap = { id: randomUUID(), token: randomBytes(32).toString('hex'), fileId: value.fileId, scope, ...info, expiresAt: Date.now() + (options.mediaTtlMs ?? MEDIA_TTL_MS), controllers: new Set() };
          media.set(cap.id, cap);
        }
        return send(200, { playbackUrl: `http://127.0.0.1:${req.socket.localPort}/media/${cap.id}?token=${cap.token}`, size: cap.size, mimeType: cap.mimeType, lastModified: cap.lastModified });
      } catch (error) {
        if (!res.destroyed) send(400, { error: error instanceof ServiceError ? error.message : 'Não foi possível preparar a reprodução do Drive.' });
        return;
      } finally {
        res.removeListener('close', disconnect);
        if (controller) pendingMedia.delete(controller);
      }
    }
    if (req.method === 'GET' && url.pathname === '/health') return send(200, { provider, model, ready: Boolean(apiKey && sameOwner(credentialOwner, queryOwner(url))), mediaTransfer: 'drive-to-provider', remoteCancellationSupported: false });
    if (url.pathname === '/credential' && ['POST', 'DELETE'].includes(req.method)) {
      if (active?.status === 'running') return send(409, { error: 'Aguarde a conclusão do tracking antes de alterar a credencial em memória.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return send(400, { error: 'Envie uma requisição JSON.' });
      try {
        const value = await requestJson(req, 4096);
        const scope = validateScope(value?.scope);
        if (req.method === 'DELETE') {
          if (!sameOwner(credentialOwner, scope)) return send(403, { error: 'A credencial em memória pertence a outro contexto.' });
          apiKey = ''; credentialOwner = null; return send(200, { ready: false });
        }
        if (!object(value) || typeof value.apiKey !== 'string' || !/^[A-Za-z0-9_-]{20,100}$/.test(value.apiKey)) fail('Credencial do Roboflow inválida.');
        apiKey = value.apiKey;
        credentialOwner = Object.freeze({ userId: scope.userId, org: scope.org });
        return send(200, { ready: true });
      } catch (error) {
        return send(400, { error: error instanceof ServiceError ? error.message : 'Não foi possível definir a credencial em memória.' });
      }
    }
    const jobId = url.pathname.match(/^\/jobs\/([a-f0-9-]{36})$/)?.[1];
    if (jobId && ['GET', 'DELETE'].includes(req.method)) {
      const job = jobs.get(jobId);
      if (!job) return send(404, { error: 'Tracking não encontrado. Nenhuma nova execução foi iniciada.' });
      if (req.method === 'GET' && !sameOwner(job.input.scope, queryOwner(url))) return send(403, { error: 'O tracking pertence a outro contexto.' });
      if (req.method === 'DELETE') {
        try {
          const body = await requestJson(req, 4096);
          const scope = validateScope(body?.scope);
          if (!sameScope(job.input.scope, scope)) return send(403, { error: 'O tracking pertence a outro contexto.' });
        } catch (error) {
          return send(400, { error: error instanceof ServiceError ? error.message : 'Contexto de cancelamento inválido.' });
        }
        if (job.status === 'running') { job.status = 'cancelled'; job.controller.abort(); }
      }
      return send(job.status === 'running' ? 202 : 200, snapshot(job));
    }
    if (req.method !== 'POST' || url.pathname !== '/jobs' || url.search) return send(404, { error: 'Operação não encontrada.' });
    if (!apiKey) return send(503, { error: 'Configure a credencial privada do Roboflow no companion local.' });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(400, { error: 'Envie uma requisição JSON.' });
    try {
      const input = validateRequest(await requestJson(req, MAX_REQUEST_BYTES));
      if (!sameOwner(credentialOwner, input.scope)) return send(403, { error: 'Configure uma credencial em memória para este usuário e organização.' });
      const signature = JSON.stringify(input);
      for (const job of jobs.values()) {
        if (job.signature === signature && ['running', 'complete'].includes(job.status)) return send(job.status === 'running' ? 202 : 200, snapshot(job));
      }
      if (active?.status === 'running') return send(409, { error: 'Um tracking já está em andamento. Aguarde a conclusão.' });
      for (const [id, job] of jobs) if (job.status !== 'running' && Date.now() - job.created > 3600000) jobs.delete(id);
      while (jobs.size >= 4) jobs.delete(jobs.keys().next().value);
      const job = { id: randomUUID(), signature, input, created: Date.now(), status: 'running', controller: new AbortController(), result: null, error: null };
      jobs.set(job.id, job); active = job;
      send(202, snapshot(job));
      const jobApiKey = apiKey;
      const timeout = setTimeout(() => job.controller.abort(new ServiceError('Tempo de acompanhamento excedido. O job remoto pode continuar; nenhuma nova tentativa foi iniciada.')), options.jobTimeoutMs ?? 1800000);
      timeout.unref();
      void Promise.resolve().then(() => runner(input, jobApiKey, { ...options, signal: job.controller.signal })).then(result => {
        if (job.status !== 'running') return;
        job.controller.signal.throwIfAborted();
        job.result = result; job.status = 'complete';
      }).catch(error => {
        if (job.status !== 'running') return;
        job.status = 'failed';
        job.error = error instanceof ServiceError ? error.message : 'Não foi possível concluir o tracking remoto. O job pode continuar no provedor; nenhuma trajetória foi aplicada ou nova tentativa iniciada.';
      }).finally(() => { clearTimeout(timeout); if (active === job) active = null; });
    } catch (error) {
      send(400, { error: error instanceof ServiceError ? error.message : 'Requisição inválida.' });
    }
  });
  server.on('close', () => {
    for (const job of jobs.values()) if (job.status === 'running') job.controller.abort();
    for (const cap of media.values()) revokeMedia(cap);
    for (const controller of pendingMedia) controller.abort();
    cache.clear();
    readAhead?.close();
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const key = loadApiKey();
    createService(key).listen(8095, '127.0.0.1', () => console.log(`Tracking Drive em 127.0.0.1:8095 · ${model}. Controle e streaming por trechos; nenhum vídeo é salvo neste processo.`));
  } catch (error) {
    console.error(error instanceof ServiceError ? error.message : 'Não foi possível iniciar o companion de tracking.');
    process.exitCode = 1;
  }
}
