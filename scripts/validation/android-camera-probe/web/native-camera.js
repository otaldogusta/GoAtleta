import { CameraTransport, CameraVideoSender, parseCameraPair } from './camera.js';

const PORT_MESSAGE = 'goatleta-native-studio-v1';
const MIME = 'video/mp4';
const NATIVE_CHUNK_SIZES = new Set([64 * 1024, 256 * 1024]);
const MAX_VIDEO_BYTES = 64 * 1024 * 1024;
const RECONNECT_LIMIT = 5;
const ACTIONS = new Set(['start-recording', 'pause-recording', 'resume-recording', 'stop-recording', 'camera-on', 'camera-off', 'new-recording']);
const RECORDING_STATES = new Set(['recording', 'paused', 'stopped', 'error']);
const CONNECTION_LABELS = {
  connecting: 'Conectando ao notebook…', connected: 'Conectado ao notebook',
  offline: 'Conexão com o notebook interrompida.', error: 'Pareamento indisponível. Gere outro QR no notebook.',
  unsupported: 'Este WebView não consegue transmitir a prévia.',
};
const validId = value => typeof value === 'string' && /^[\w-]{1,128}$/.test(value);
const captureActive = recording => recording?.state === 'recording' || recording?.state === 'paused';
const between = (value, low, high) => Number.isFinite(value) && value >= low && value <= high;

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

  let port, stream, context, recording, capture, connectedChannel, offChannel;
  let active = false, finalizing = false, controlsVersion, connected = false;
  let reconnectTimer, clockTimer, retries = 0, joining = false, closed = false, disabled = false;
  let frameBusy = false, captureGeneration = 0, pendingRead, pendingCommand, pendingVideoRequest, lastCopy;
  const originals = new Map();

  function post(value) {
    try { port?.postMessage(JSON.stringify(value)); } catch { /* Page is closing. */ }
  }

  function clock() {
    if (!recording) return {};
    const { recordingId, state, startEpochMs, elapsedMs, segmentId, sampleAt, activeSinceEpochMs } = recording;
    const senderEpochMs = Date.now();
    const timeMs = elapsedMs + (state === 'recording' && !finalizing ? Math.max(0, performance.now() - sampleAt) : 0);
    return {
      recordingId, state, startEpochMs, segmentId, mimeType: MIME,
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
    });
    if (sent && state === 'off') offChannel = transport.channel;
  }

  function publishRecording() {
    if (!connected || !recording) return;
    const { recordingId, state, startEpochMs, startedAtISO, mimeType, durationMs, segmentId } = clock();
    transport.send({ kind: 'recording', recordingId, state, startEpochMs, startedAtISO, mimeType, durationMs, segmentId });
  }

  function setConnection(state) {
    connected = state === 'connected';
    connectionLabel.textContent = CONNECTION_LABELS[state];
    reconnectButton.hidden = state !== 'offline';
    retryCopyButton.disabled = !connected;
    post({ kind: 'connection', state });
  }

  function scheduleReconnect() {
    if (closed || disabled || connected || reconnectTimer !== undefined || retries >= RECONNECT_LIMIT) return;
    const delay = Math.min(12_000, 1500 * 2 ** retries++);
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
      if (pendingVideoRequest && originals.has(pendingVideoRequest)) requestCopy(pendingVideoRequest);
    } else {
      pendingCommand = undefined;
      sender.disconnected();
      if (state === 'offline') scheduleReconnect();
    }
  }

  function requestCopy(id) {
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

  const transport = new CameraTransport(pair, { clock, onState: connectionChanged, onMessage: receiveHost });
  const sender = new CameraVideoSender({
    roomId: pair.roomId, send: message => transport.send(message), connected: () => connected,
    getMaxMessageSize: () => transport.peer?.sctp?.maxMessageSize ?? 0,
    setTimer: (callback, delay) => window.setTimeout(callback, delay),
    clearTimer: timer => window.clearTimeout(timer),
    store: { get: id => originals.get(id), getChunk: readChunk },
    onState: progress => {
      lastCopy = progress.recordingId;
      copyLabel.hidden = false;
      copyLabel.textContent = progress.state === 'sending' ? `Enviando ao notebook · ${progress.percent}%` : progress.message;
      retryCopyButton.hidden = progress.state !== 'error';
      retryCopyButton.disabled = !connected;
    },
  });

  async function readChunk(recordingId, index) {
    while (pendingRead) await pendingRead.result.catch(() => {});
    const meta = originals.get(recordingId);
    if (closed || !meta || !between(index, 0, meta.chunkCount - 1) || !Number.isInteger(index)) throw new Error('Trecho do vídeo indisponível.');
    const requestId = crypto.randomUUID();
    const expected = Math.min(meta.chunkSize, meta.bytes - index * meta.chunkSize);
    let resolve, reject;
    const result = new Promise((accept, fail) => { resolve = accept; reject = fail; });
    const timer = setTimeout(() => reject(new Error('O app demorou para ler o vídeo original.')), 5000);
    pendingRead = { requestId, recordingId, index, expected, resolve, reject, result };
    post({ kind: 'read-chunk', requestId, recordingId, index });
    try { return await result; }
    finally { clearTimeout(timer); pendingRead = undefined; }
  }

  function completeRead(value) {
    const current = pendingRead;
    if (!current || value.requestId !== current.requestId) return;
    try {
      if (value.kind !== 'chunk' || value.recordingId !== current.recordingId || value.index !== current.index
        || typeof value.data !== 'string' || value.data.length !== Math.ceil(current.expected / 3) * 4) throw new Error();
      const bytes = Uint8Array.from(atob(value.data), character => character.charCodeAt(0));
      if (bytes.length !== current.expected) throw new Error();
      current.resolve({ recordingId: current.recordingId, index: current.index, blob: new Blob([bytes], { type: MIME }) });
    } catch { current.reject(new Error('Trecho inválido no vídeo original.')); }
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
    if (value.controlsVersion === 2) controlsVersion = 2;
    if (value.resetRecording === true && !captureActive(recording)) recording = undefined;
    capture = active && between(value.width, 1, 4096) && between(value.height, 1, 4096) && between(value.frameRate, 1, 240)
      ? { label: 'Câmera traseira', width: value.width, height: value.height, frameRate: value.frameRate, ...(between(value.zoom, 1, 10) ? { zoom: value.zoom } : {}) }
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
      transport.disconnect();
      connected = false;
      void connect();
      return;
    }
    publishCamera();
  }

  function updateRecording(value) {
    if (!validId(value.recordingId) || !RECORDING_STATES.has(value.state) || !between(value.startEpochMs, 1, 8.64e15)
      || !between(value.elapsedMs, 0, 60_000) || !validId(value.segmentId)) return;
    const prior = recording;
    const sampleAge = between(value.sampleEpochMs, value.startEpochMs, Date.now()) ? Math.min(500, Date.now() - value.sampleEpochMs) : 0;
    recording = { ...value, sampleAt: performance.now() - sampleAge };
    finalizing = false;
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
      const bytes = Uint8Array.from(atob(value.jpeg), character => character.charCodeAt(0));
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
    else if (value.kind === 'chunk' || value.kind === 'chunk-error') completeRead(value);
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
  retryCopyButton.onclick = () => { if (lastCopy && connected) requestCopy(lastCopy); };
  window.addEventListener('pagehide', () => {
    closed = true;
    clearInterval(clockTimer);
    clearTimeout(reconnectTimer);
    sender.disconnected();
    transport.disconnect();
    stream?.getTracks().forEach(track => track.stop());
    pendingRead?.reject(new Error('O app de câmera foi fechado.'));
    port?.close();
  }, { once: true });
}

if (typeof document !== 'undefined' && document.getElementById('native-frames')) bootNativeCamera();
