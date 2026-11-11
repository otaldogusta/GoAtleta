// eslint-disable-next-line import/no-unresolved -- The companion serves the shared camera module at this URL.
import { CameraTransport, CameraVideoSender, parseCameraPair } from './camera.js';

const PORT_MESSAGE = 'goatleta-native-studio-v1';
const MIME = 'video/mp4';
const NATIVE_CHUNK_SIZES = new Set([64 * 1024, 256 * 1024]);
const MAX_VIDEO_BYTES = 64 * 1024 * 1024;
const MAX_RECORDING_MS = 2 * 60 * 60 * 1000;
const SOURCE_BLOCK = 256 * 1024;
const VERIFY_BLOCK = 1024 * 1024;
const MAX_SOURCE_BYTES = 24 * 1024 * 1024 * 1024;
const MAX_SOURCES = 256;
const DATA_FRAGMENT = 32 * 1024;
const MESSAGE_LIMIT = 48 * 1024;
const DATA_BUFFER_LIMIT = 128 * 1024;
const COPY_TIMEOUT_MS = 20_000;
const RECONNECT_LIMIT = 5;
const ACTIONS = new Set(['start-recording', 'pause-recording', 'resume-recording', 'stop-recording', 'camera-on', 'camera-off', 'new-recording']);
const RECORDING_STATES = new Set(['recording', 'paused', 'stopped', 'error']);
const CONNECTION_LABELS = {
  connecting: 'Conectando ao notebook…', connected: 'Conectado ao notebook',
  offline: 'Conexão com o notebook interrompida.', error: 'Pareamento indisponível. Gere outro QR no notebook.',
  unsupported: 'Este WebView não consegue transmitir a prévia.',
};
const validId = value => typeof value === 'string' && /^[\w-]{1,128}$/.test(value);
const validDigest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const captureActive = recording => recording?.state === 'recording' || recording?.state === 'paused';
const between = (value, low, high) => Number.isFinite(value) && value >= low && value <= high;

function encodeBytes(bytes) {
  if (typeof bytes.toBase64 === 'function') return bytes.toBase64();
  let raw = '';
  for (let index = 0; index < bytes.length; index++) raw += String.fromCharCode(bytes[index]);
  return btoa(raw);
}

function decodeBytes(encoded) {
  if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(encoded);
  return Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
}

function waitForNativeBuffer(channel) {
  return new Promise(resolve => {
    const done = () => {
      window.clearTimeout(timer);
      channel.removeEventListener?.('bufferedamountlow', done);
      resolve();
    };
    const timer = window.setTimeout(done, 15);
    if (channel.bufferedAmount >= DATA_BUFFER_LIMIT && typeof channel.addEventListener === 'function') {
      channel.bufferedAmountLowThreshold = DATA_BUFFER_LIMIT - 1;
      channel.addEventListener('bufferedamountlow', done, { once: true });
      if (channel.bufferedAmount < DATA_BUFFER_LIMIT) done();
    }
  });
}

class CopyTimeout extends Error {}

// Provisional ranges are staged while CameraX writes. The finalized file can
// rewrite those bytes, so only a final range check can confirm the original.
class ProgressiveOriginalSender {
  constructor(transport, read, hash, onState) {
    this.transport = transport;
    this.read = read;
    this.hash = hash;
    this.onState = onState;
    this.sources = new Map();
    this.retryCount = 0;
  }

  setSource({ recordingId, bytes, finalized }) {
    if (!validId(recordingId) || !Number.isSafeInteger(bytes) || !between(bytes, 0, MAX_SOURCE_BYTES)
      || typeof finalized !== 'boolean' || (finalized ? bytes === 0 : bytes % SOURCE_BLOCK !== 0)) return false;
    const prior = this.sources.get(recordingId);
    if (prior && (prior.finalized || !finalized && bytes <= prior.bytes)) return false;
    if (!prior && this.sources.size >= MAX_SOURCES) {
      const oldest = Array.from(this.sources.keys()).find(id => id !== this.id);
      this.sources.delete(oldest);
    }
    this.sources.set(recordingId, { bytes, finalized });
    this.pump();
    return !prior;
  }

  resume(channel) {
    if (channel !== this.channel) {
      this.disconnected();
      this.channel = channel;
      this.id = undefined;
      this.finalAuthorized = false;
    }
    this.online = true;
    this.pump();
  }

  disconnected() {
    this.online = false;
    this.reset();
  }

  reset() {
    if (this.retryTimer !== undefined) window.clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    const owner = this.owner;
    this.owner = undefined;
    owner?.pending?.reject(new Error('A conexão mudou durante a cópia.'));
  }

  request(id, finalAuthorized) {
    if (!this.sources.has(id)) return;
    if (this.id !== id) {
      this.reset();
      this.retryCount = 0;
      this.id = id;
      this.finalAuthorized = false;
    }
    if (finalAuthorized) this.finalAuthorized = true;
    if (this.owner?.failed) this.reset();
    this.pump();
  }

  cancel(id) {
    if (this.id !== id) return;
    this.reset();
    this.id = undefined;
    this.onState({ state: 'unavailable', message: 'O celular não finalizou a gravação.' });
  }

  retry() {
    this.reset();
    this.retryCount = 0;
    this.pump();
  }

  get pending() {
    return this.id !== undefined && this.id !== this.savedId;
  }

  get source() {
    const source = this.sources.get(this.id);
    return source?.finalized && !this.finalAuthorized ? undefined : source;
  }

  current(owner) {
    return this.online && this.owner === owner && this.transport.channel === this.channel;
  }

  async send(owner, message) {
    const expires = performance.now() + COPY_TIMEOUT_MS;
    while (this.current(owner)) {
      // Reserve room in the shared channel for clocks and recording controls.
      if (this.channel.bufferedAmount < DATA_BUFFER_LIMIT && this.transport.send(message)) return;
      if (performance.now() >= expires) throw new CopyTimeout('A conexão está demorando para liberar o envio.');
      await waitForNativeBuffer(this.channel);
    }
    throw new Error('A conexão mudou durante a cópia.');
  }

  async exchange(owner, kind, details) {
    const packet = { kind: `native-original-${kind}`, recordingId: this.id, transferId: owner.transferId, ...details };
    const reply = new Promise((resolve, reject) => { owner.pending = { resolve, reject }; });
    const timer = window.setTimeout(() => owner.pending?.reject(new CopyTimeout('O notebook demorou para confirmar a cópia.')), COPY_TIMEOUT_MS);
    try {
      const [, ack] = await Promise.all([this.send(owner, packet), reply]);
      if (!this.current(owner)) throw new Error('A conexão mudou durante a cópia.');
      if (typeof ack.error === 'string') throw new Error('O notebook não confirmou a cópia. O original foi preservado no celular.');
      return ack;
    } finally {
      window.clearTimeout(timer);
      owner.pending = undefined;
    }
  }

  acknowledge(value) {
    const owner = this.owner;
    if (value.kind !== 'native-original-ack' || !owner?.pending || value.recordingId !== this.id || value.transferId !== owner.transferId
      || !Number.isSafeInteger(value.offset) || !Number.isSafeInteger(value.verified) || !between(value.offset, 0, MAX_SOURCE_BYTES)
      || !between(value.verified, 0, value.offset)) return;
    owner.pending.resolve(value);
  }

  async sendBytes(owner, offset, bytes) {
    const packet = { kind: 'native-original-data', recordingId: this.id, transferId: owner.transferId, offset, data: '' };
    const limit = this.transport.peer?.sctp?.maxMessageSize;
    const max = Number.isFinite(limit) && limit > 0 ? Math.min(MESSAGE_LIMIT, Math.floor(limit)) : MESSAGE_LIMIT;
    for (let sent = 0; sent < bytes.length;) {
      packet.offset = offset + sent;
      const length = Math.min(DATA_FRAGMENT, Math.floor((max - JSON.stringify(packet).length) / 4) * 3, bytes.length - sent);
      if (length < 1) throw new Error('A conexão não permite copiar o original.');
      await this.send(owner, { ...packet, data: encodeBytes(bytes.subarray(sent, sent + length)) });
      sent += length;
    }
  }

  async stage(owner, offset, length) {
    const bytes = await this.read(owner.id, offset, length);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    await this.sendBytes(owner, offset, bytes);
    return this.exchange(owner, 'commit', { offset, bytes: length, sha256 });
  }

  async verify(owner, source, offset) {
    const bytes = Math.min(VERIFY_BLOCK, source.bytes - offset);
    const sha256 = await this.hash(owner.id, offset, bytes);
    const range = { offset, bytes, sha256 };
    const checked = await this.exchange(owner, 'check', range);
    if (!checked.needsData) return checked;
    if (checked.verified !== offset || checked.offset > source.bytes) throw new Error('O notebook retornou um intervalo inválido.');
    for (let sent = 0; sent < bytes; sent += SOURCE_BLOCK) {
      const chunk = await this.read(owner.id, offset + sent, Math.min(SOURCE_BLOCK, bytes - sent));
      await this.sendBytes(owner, offset + sent, chunk);
    }
    return this.exchange(owner, 'commit', range);
  }

  async copy(owner) {
    while (this.current(owner)) {
      const source = this.source;
      if (!source?.bytes) return;
      owner.attemptedSource = source;
      if (source !== owner.source) {
        const ack = await this.exchange(owner, 'offer', source);
        if (ack.offset > source.bytes || ack.needsData === true
          || (source.finalized ? ack.verified !== source.bytes && ack.verified % VERIFY_BLOCK !== 0
            : ack.verified !== 0 || ack.offset % SOURCE_BLOCK !== 0)) throw new Error('O notebook retornou uma posição inválida.');
        owner.source = source;
        owner.offset = ack.offset;
        owner.verified = ack.verified;
        this.retryCount = 0;
      }
      if (source.finalized) {
        if (owner.verified === source.bytes) {
          owner.saved = true;
          this.savedId = owner.id;
          this.onState({ state: 'ready', message: 'Salvo no computador' });
          return;
        }
        const offset = owner.verified;
        const ack = await this.verify(owner, source, offset);
        if (ack.needsData === true || ack.offset > source.bytes || ack.verified !== Math.min(source.bytes, offset + VERIFY_BLOCK))
          throw new Error('O notebook não confirmou o intervalo do original.');
        owner.offset = ack.offset;
        owner.verified = ack.verified;
        this.onState({ state: 'sending', message: `Conferindo o original · ${Math.floor(ack.verified / source.bytes * 100)}%` });
      } else if (owner.offset < source.bytes) {
        const offset = owner.offset;
        const ack = await this.stage(owner, offset, SOURCE_BLOCK);
        if (ack.needsData === true || ack.offset !== offset + SOURCE_BLOCK || ack.verified !== 0)
          throw new Error('O notebook não confirmou o trecho enviado.');
        owner.offset = ack.offset;
        this.onState({ state: 'sending', message: `Copiado para o notebook · ${Math.floor(ack.offset / (1024 * 1024))} MiB` });
      } else return;
    }
  }

  pump() {
    if (!this.online || this.retryTimer !== undefined || !this.source?.bytes) return;
    const owner = this.owner ??= { id: this.id, transferId: crypto.randomUUID() };
    if (owner.running || owner.saved || owner.failed) return;
    owner.running = true;
    void this.copy(owner).catch(error => {
      if (!this.current(owner)) return;
      // Finalization may truncate the growing file while a provisional read is pending.
      const source = this.sources.get(owner.id);
      if (error instanceof CopyTimeout || !owner.attemptedSource?.finalized && source?.finalized && source !== owner.attemptedSource) {
        this.reset();
        const delay = Math.min(12_000, 500 * 2 ** Math.min(5, this.retryCount++));
        this.retryTimer = window.setTimeout(() => {
          this.retryTimer = undefined;
          this.pump();
        }, delay);
        return;
      }
      owner.failed = true;
      this.onState({ state: 'error', message: error.message || 'Não foi possível copiar o original.' });
    }).finally(() => {
      owner.running = false;
      if (this.current(owner) && this.source !== owner.source) this.pump();
    });
  }
}

function bootNativeCamera() {
  const canvas = document.getElementById('native-frames');
  const connectionLabel = document.getElementById('native-connection');
  const copyLabel = document.getElementById('native-copy');
  const reconnectButton = document.getElementById('native-retry');
  const retryCopyButton = document.getElementById('native-retry-copy');
  let pair;
  try {
    pair = parseCameraPair(location.hash);
    history.replaceState(null, '', location.pathname);
  } catch {
    connectionLabel.textContent = 'Pareamento inválido. Gere outro QR no notebook.';
    return;
  }

  let port, stream, context, recording, capture, connectedChannel, offChannel, readyToRecord, thermalBlocked;
  let active = false, finalizing = false, controlsVersion, connected = false;
  let reconnectTimer, clockTimer, retries = 0, joining = false, closed = false, disabled = false;
  let frameBusy = false, captureGeneration = 0, pendingRead, pendingCommand, pendingVideoRequest, lastCopy, progressiveCopy;
  const originals = new Map();

  function post(value) {
    try { port?.postMessage(JSON.stringify(value)); } catch { /* Page is closing. */ }
  }

  function clock() {
    if (!recording) return {};
    const { recordingId, state, startEpochMs, elapsedMs, segmentId, sampleAt, activeSinceEpochMs } = recording;
    const senderEpochMs = Date.now();
    const timeMs = Math.min(MAX_RECORDING_MS, elapsedMs + (state === 'recording' && !finalizing ? Math.max(0, performance.now() - sampleAt) : 0));
    return {
      recordingId, state, startEpochMs, segmentId, mimeType: MIME,
      ...(nativeSender.sources.has(recordingId) ? { originalTransfer: 'progressive-v1' } : {}),
      startedAtISO: new Date(startEpochMs).toISOString(),
      durationMs: timeMs, timeMs, senderEpochMs,
      pausedMs: Math.max(0, senderEpochMs - startEpochMs - timeMs),
      ...(between(activeSinceEpochMs, startEpochMs, senderEpochMs) ? { activeSinceEpochMs } : {}),
      recording: state === 'recording' && !finalizing,
    };
  }

  function publishCamera() {
    if (!connected || controlsVersion !== 2) return;
    const state = finalizing ? 'finalizing' : recording?.state === 'error' ? 'error'
      : captureActive(recording) ? recording.state : active ? 'preview' : 'off';
    const sent = transport.send({ kind: 'camera-status', roomId: pair.roomId, state, controlsVersion,
      ...(recording ? { recordingId: recording.recordingId } : {}), ...(active && capture ? { capture } : {}),
      ...(readyToRecord === undefined ? {} : { readyToRecord }), ...(thermalBlocked === undefined ? {} : { thermalBlocked }),
    });
    if (sent && state === 'off') offChannel = transport.channel;
  }

  function publishRecording() {
    if (!connected || !recording) return;
    const { recordingId, state, startEpochMs, startedAtISO, mimeType, durationMs, segmentId, originalTransfer } = clock();
    transport.send({ kind: 'recording', recordingId, state, startEpochMs, startedAtISO, mimeType, durationMs, segmentId, originalTransfer });
  }

  function setConnection(state) {
    connected = state === 'connected';
    connectionLabel.textContent = CONNECTION_LABELS[state];
    reconnectButton.hidden = state !== 'offline';
    retryCopyButton.disabled = !connected;
    post({ kind: 'connection', state });
  }

  function scheduleReconnect() {
    const awaitingOriginal = recording?.state === 'stopped' && nativeSender.sources.has(recording.recordingId)
      && nativeSender.savedId !== recording.recordingId;
    if (closed || disabled || connected || reconnectTimer !== undefined
      || retries >= RECONNECT_LIMIT && !captureActive(recording) && !nativeSender.pending && !awaitingOriginal) return;
    const delay = 1500 * 2 ** Math.min(3, retries++);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      if (!connected) void connect();
    }, delay);
  }

  async function connect() {
    if (closed || disabled || joining || connected || !stream) return;
    joining = true;
    try { await transport.connect(stream); }
    catch (error) {
      transport.disconnect();
      disabled = [401, 403, 404, 410].includes(error?.status);
      setConnection(disabled ? 'error' : 'offline');
    } finally {
      joining = false;
      if (!transport.peer && !connected) scheduleReconnect();
    }
  }

  function connectionChanged(state) {
    const wasConnected = connected;
    setConnection(state);
    if (connected) {
      retries = 0;
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      publishCamera();
      // CameraTransport replays terminal metadata when its channel opens. A
      // recovered heartbeat can also restore a still-open channel.
      if (!wasConnected && connectedChannel === transport.channel) publishRecording();
      connectedChannel = transport.channel;
      sender.resume();
      nativeSender.resume(transport.channel);
      if (pendingVideoRequest && originals.has(pendingVideoRequest)) requestCopy(pendingVideoRequest);
    } else {
      pendingCommand = undefined;
      sender.disconnected();
      if (wasConnected && nativeSender.pending) showCopy('paused', 'Cópia aguardando reconexão ao computador.', true);
      nativeSender.disconnected();
      if (state === 'offline') scheduleReconnect();
    }
  }

  function requestCopy(id) {
    if (nativeSender.sources.has(id)) return;
    if (!originals.has(id) && id === recording?.recordingId) {
      pendingVideoRequest = id;
      return;
    }
    if (pendingVideoRequest === id) pendingVideoRequest = undefined;
    void sender.enqueue(id, { force: true });
  }

  function receiveHost(value) {
    if (!value || typeof value !== 'object') return;
    const { kind, roomId, recordingId } = value;
    if (kind === 'native-original-request' && validId(recordingId)) {
      // The host repeats the request after storing the terminal manifest.
      const finalAuthorized = recording?.recordingId !== recordingId || recording.state === 'stopped';
      nativeSender.request(recordingId, finalAuthorized);
      return;
    }
    if (kind === 'native-original-ack') { nativeSender.acknowledge(value); return; }
    if (kind === 'video-request' && validId(recordingId)) { requestCopy(recordingId); return; }
    if (typeof kind === 'string' && kind.startsWith('video-')) { sender.handle(value); return; }
    if (!ACTIONS.has(kind)) return;
    if (kind === 'stop-recording' || kind === 'pause-recording' || kind === 'resume-recording' || kind === 'new-recording') {
      if (!recording || recordingId !== recording.recordingId) return;
    } else if (roomId !== pair.roomId) return;
    if (roomId !== undefined && roomId !== pair.roomId) return;
    const commandId = crypto.randomUUID();
    pendingCommand = { commandId, action: kind };
    post({ kind: 'command', commandId, action: kind, ...(validId(recordingId) ? { recordingId } : {}) });
  }

  function showCopy(state, message, progressive) {
    progressiveCopy = progressive;
    copyLabel.hidden = false;
    copyLabel.textContent = message;
    retryCopyButton.hidden = state !== 'error';
    retryCopyButton.disabled = !connected;
  }

  const transport = new CameraTransport(pair, { clock, onState: connectionChanged, onMessage: receiveHost });
  const nativeSender = new ProgressiveOriginalSender(transport, (recordingId, offset, bytes) => readNativeChunk(recordingId, offset / SOURCE_BLOCK, bytes),
    readNativeHash, progress => showCopy(progress.state, progress.message, true));
  const sender = new CameraVideoSender({
    roomId: pair.roomId, send: message => transport.send(message), connected: () => connected,
    getMaxMessageSize: () => transport.peer?.sctp?.maxMessageSize ?? 0,
    setTimer: (callback, delay) => window.setTimeout(callback, delay),
    clearTimer: timer => window.clearTimeout(timer),
    store: { get: id => originals.get(id), getChunk: readChunk },
    onState: progress => {
      lastCopy = progress.recordingId;
      showCopy(progress.state, progress.state === 'sending' ? `Enviando ao notebook · ${progress.percent}%` : progress.message, false);
    },
  });

  async function readChunk(recordingId, index) {
    const meta = originals.get(recordingId);
    if (closed || !meta || !between(index, 0, meta.chunkCount - 1) || !Number.isInteger(index)) throw new Error('Trecho do vídeo indisponível.');
    const bytes = await readNativeChunk(recordingId, index, Math.min(meta.chunkSize, meta.bytes - index * meta.chunkSize));
    return { recordingId, index, blob: new Blob([bytes], { type: MIME }) };
  }

  function readNativeChunk(recordingId, index, expected) {
    return requestNative({ kind: 'read-chunk', recordingId, index }, value => {
      if (value.kind !== 'chunk' || value.recordingId !== recordingId || value.index !== index
        || typeof value.data !== 'string' || value.data.length !== Math.ceil(expected / 3) * 4) throw new Error();
      const bytes = decodeBytes(value.data);
      if (bytes.length !== expected) throw new Error();
      return bytes;
    });
  }

  function readNativeHash(recordingId, offset, bytes) {
    return requestNative({ kind: 'hash-range', recordingId, offset, bytes }, value => {
      if (value.kind !== 'range-hash' || value.recordingId !== recordingId || value.offset !== offset
        || value.bytes !== bytes || !validDigest(value.sha256)) throw new Error();
      return value.sha256;
    });
  }

  async function requestNative(message, parse) {
    while (pendingRead) await pendingRead.result.catch(() => {});
    if (closed) throw new Error('O app de câmera foi fechado.');
    const requestId = crypto.randomUUID();
    let resolve, reject;
    const result = new Promise((accept, fail) => { resolve = accept; reject = fail; });
    const timer = setTimeout(() => reject(new Error('O app demorou para ler o vídeo original.')), 5000);
    pendingRead = { requestId, parse, resolve, reject, result };
    post({ ...message, requestId });
    try { return await result; }
    finally { clearTimeout(timer); pendingRead = undefined; }
  }

  function completeRead(value) {
    const current = pendingRead;
    if (!current || value.requestId !== current.requestId) return;
    try { current.resolve(current.parse(value)); }
    catch { current.reject(new Error('Trecho inválido no vídeo original.')); }
  }

  function finalized(value) {
    const id = value.recordingId;
    if (!validId(id) || !Number.isSafeInteger(value.bytes) || !between(value.bytes, 1, MAX_VIDEO_BYTES) || !NATIVE_CHUNK_SIZES.has(value.chunkSize)) return;
    if (!originals.has(id) && originals.size >= 4) originals.delete(originals.keys().next().value);
    originals.set(id, { id, roomId: pair.roomId, mimeType: MIME, state: 'stopped', bytes: value.bytes, chunkSize: value.chunkSize, chunkCount: Math.ceil(value.bytes / value.chunkSize) });
    if (pendingVideoRequest === id && connected) requestCopy(id);
  }

  function updateCamera(value) {
    if (typeof value.active !== 'boolean') return;
    active = value.active;
    finalizing = value.state === 'finalizing';
    readyToRecord = typeof value.readyToRecord === 'boolean' ? value.readyToRecord : undefined;
    thermalBlocked = typeof value.thermalBlocked === 'boolean' ? value.thermalBlocked : undefined;
    if (value.controlsVersion === 2) controlsVersion = 2;
    if (value.resetRecording === true && !captureActive(recording)) recording = undefined;
    capture = active && between(value.width, 1, 4096) && between(value.height, 1, 4096) && between(value.frameRate, 1, 240)
      ? { label: value.lensLabel === 'Traseira principal' ? value.lensLabel : 'Câmera traseira', width: value.width, height: value.height, frameRate: value.frameRate, ...(between(value.zoom, 1, 10) ? { zoom: value.zoom } : {}) }
      : undefined;
    if (!active) {
      captureGeneration++;
      context?.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (active && offChannel && offChannel === transport.channel) {
      // The host removes its stream on camera-off. A fresh offer delivers a
      // new track event while keeping the same room lease and transfer cursor.
      offChannel = undefined;
      sender.disconnected();
      nativeSender.disconnected();
      transport.disconnect();
      connected = false;
      void connect();
      return;
    }
    publishCamera();
  }

  function updateRecording(value) {
    if (!validId(value.recordingId) || !RECORDING_STATES.has(value.state) || !between(value.startEpochMs, 1, 8.64e15)
      || !between(value.elapsedMs, 0, MAX_RECORDING_MS) || !validId(value.segmentId)) return;
    const prior = recording;
    const sampleAge = between(value.sampleEpochMs, value.startEpochMs, Date.now()) ? Math.min(500, Date.now() - value.sampleEpochMs) : 0;
    recording = { ...value, sampleAt: performance.now() - sampleAge };
    finalizing = false;
    if (recording.state === 'error') nativeSender.cancel(recording.recordingId);
    sender.setPaused(captureActive(recording));
    publishCamera();
    if (prior?.recordingId !== recording.recordingId || prior.state !== recording.state || prior.segmentId !== recording.segmentId) publishRecording();
  }

  async function drawFrame(value) {
    if (!Number.isSafeInteger(value.frameId) || value.frameId < 0) return;
    if (frameBusy || !context || !active || typeof value.jpeg !== 'string' || value.jpeg.length > 384 * 1024) {
      post({ kind: 'preview-ack', frameId: value.frameId });
      return;
    }
    frameBusy = true;
    const generation = captureGeneration;
    let bitmap;
    try {
      const bytes = decodeBytes(value.jpeg);
      bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
      if (!active || closed || generation !== captureGeneration) return;
      const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
      const width = bitmap.width * scale, height = bitmap.height * scale;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    } catch { /* A dropped preview frame never affects the native original. */ }
    finally {
      bitmap?.close();
      frameBusy = false;
      post({ kind: 'preview-ack', frameId: value.frameId });
    }
  }

  function commandFailed(value) {
    if (value.commandId !== pendingCommand?.commandId || value.action !== pendingCommand?.action) return;
    pendingCommand = undefined;
    transport.send(value.action === 'start-recording'
      ? { kind: 'recording-start-error', roomId: pair.roomId, reason: 'source-unavailable' }
      : { kind: 'camera-control-error', roomId: pair.roomId, command: value.action });
  }

  function receiveNative(event) {
    if (typeof event.data !== 'string' || event.data.length > 400 * 1024) return;
    let value;
    try { value = JSON.parse(event.data); } catch { return; }
    if (!value || typeof value !== 'object') return;
    if (value.kind === 'preview') void drawFrame(value);
    else if (value.kind === 'camera') updateCamera(value);
    else if (value.kind === 'recording') updateRecording(value);
    else if (value.kind === 'finalized') finalized(value);
    else if (value.kind === 'source') {
      if (nativeSender.setSource(value) && value.recordingId === recording?.recordingId) publishRecording();
    }
    else if (value.kind === 'chunk' || value.kind === 'chunk-error' || value.kind === 'range-hash') completeRead(value);
    else if (value.kind === 'command-error' || value.kind === 'command-result' && value.ok === false) commandFailed(value);
  }

  function acceptPort(event) {
    if (port || !event.isTrusted || event.data !== PORT_MESSAGE || event.ports.length !== 1 || event.source !== null) return;
    port = event.ports[0];
    window.removeEventListener('message', acceptPort);
    port.onmessage = receiveNative;
    post({ kind: 'ready' });
    if (!window.isSecureContext || typeof canvas.captureStream !== 'function' || typeof RTCPeerConnection !== 'function' || typeof createImageBitmap !== 'function') {
      setConnection('unsupported');
      return;
    }
    try {
      context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error();
      context.fillRect(0, 0, canvas.width, canvas.height);
      stream = canvas.captureStream(15);
    } catch { setConnection('unsupported'); return; }
    clockTimer = setInterval(() => {
      if (connected && captureActive(recording)) transport.send({ kind: 'clock', ...clock() });
    }, 250);
    void connect();
  }

  window.addEventListener('message', acceptPort);
  reconnectButton.onclick = () => { retries = 0; clearTimeout(reconnectTimer); reconnectTimer = undefined; void connect(); };
  retryCopyButton.onclick = () => {
    if (!connected) return;
    if (progressiveCopy) nativeSender.retry();
    else if (lastCopy) requestCopy(lastCopy);
  };
  window.addEventListener('pagehide', () => {
    closed = true;
    clearInterval(clockTimer);
    clearTimeout(reconnectTimer);
    sender.disconnected();
    nativeSender.disconnected();
    transport.disconnect();
    stream?.getTracks().forEach(track => track.stop());
    pendingRead?.reject(new Error('O app de câmera foi fechado.'));
    port?.close();
  }, { once: true });
}

if (typeof document !== 'undefined' && document.getElementById('native-frames')) bootNativeCamera();
