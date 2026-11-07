import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';

const ROOM = '08a8927a-b67c-4cba-af6b-9e836ab3d032';
const RECORDING = '5f88fc9c-6a17-4f2a-9c6a-26d32758abe7';

test('native preview and original share the established camera transport and only offer a requested original', async t => {
  const listeners = new Map(), hostMessages = [], phoneMessages = [], draws = [], joins = [];
  let peer, cleanedPath, copyTimersStarted = 0;
  const previewStream = { getTracks: () => [{ stop() {} }] };
  const canvas = {
    width: 640, height: 360,
    getContext: () => ({ fillRect() {}, clearRect() {}, drawImage: (...args) => draws.push(args) }),
    captureStream(rate) { assert.equal(rate, 15); return previewStream; },
  };
  const port = { postMessage: data => phoneMessages.push(JSON.parse(data)), close() {} };
  const nodes = new Map(['native-connection', 'native-copy', 'native-retry', 'native-retry-copy'].map(id => [id, {}]));
  nodes.set('native-frames', canvas);
  const stubs = {
    document: { getElementById: id => nodes.get(id) },
    window: {
      isSecureContext: true,
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener: type => listeners.delete(type),
      setTimeout(callback, delay) {
        assert.equal(this, window, 'WebView timer requires the Window receiver');
        copyTimersStarted++;
        return setTimeout(callback, delay);
      },
      clearTimeout(timer) { assert.equal(this, window); clearTimeout(timer); },
    },
    location: { hash: `#room=${ROOM}&token=${'a'.repeat(64)}`, pathname: '/native-camera' },
    history: { replaceState: (_state, _title, path) => { cleanedPath = path; } },
    createImageBitmap: async () => ({ width: 640, height: 360, close() {} }),
    fetch: async (path, options) => {
      assert.equal(options.headers['X-GoAtleta-Live-Role'], 'camera');
      assert.ok(path.startsWith(`/rooms/${ROOM}/`));
      if (path.endsWith('/join')) joins.push(options.headers['X-GoAtleta-Live-Client']);
      return { ok: true, json: async () => ({ cameraClientId: 'test-camera', generation: 1, cursor: 0, signals: [] }) };
    },
    RTCPeerConnection: class {
      constructor() { peer = this; this.connectionState = 'connecting'; this.sctp = { maxMessageSize: 65536 }; }
      addTrack(_track, stream) { assert.equal(stream, previewStream); }
      getSenders() { return []; }
      createDataChannel() {
        this.channel = { readyState: 'connecting', bufferedAmount: 0, send: value => hostMessages.push(JSON.parse(value)), close() {} };
        return this.channel;
      }
      async createOffer() { return { type: 'offer', sdp: 'test' }; }
      async setLocalDescription(description) { this.localDescription = description; }
      close() { this.closed = true; }
    },
  };
  const previous = Object.fromEntries(Object.keys(stubs).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    listeners.get('pagehide')?.();
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  for (const [key, value] of Object.entries(stubs)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const nativeCameraUrl = new URL('./android-camera-probe/web/native-camera.js', import.meta.url).href;
  const cameraUrl = new URL('../../public/scouting-live/camera.js', import.meta.url).href;
  // The companion serves both files from the same URL directory.
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      return nextResolve(context.parentURL === nativeCameraUrl && specifier === './camera.js' ? cameraUrl : specifier, context);
    },
  });
  try { await import(nativeCameraUrl); }
  finally { hook.deregister(); }

  const handshake = { data: 'goatleta-native-studio-v1', ports: [port], source: null };
  listeners.get('message')({ ...handshake, isTrusted: false });
  assert.equal(phoneMessages.length, 0);
  listeners.get('message')({ ...handshake, isTrusted: true });
  assert.equal(cleanedPath, '/native-camera');
  assert.deepEqual(phoneMessages[0], { kind: 'ready' });
  await setImmediate();
  peer.connectionState = 'connected';
  peer.channel.readyState = 'open';
  peer.channel.onopen();

  const native = value => port.onmessage({ data: JSON.stringify(value) });
  const host = value => peer.channel.onmessage({ data: JSON.stringify(value) });
  native({ kind: 'camera', active: true, controlsVersion: 2, width: 1920, height: 1080, frameRate: 60, zoom: 1 });
  assert.ok(hostMessages.some(message => message.kind === 'camera-status' && message.capture?.frameRate === 60 && message.capture.width === 1920));
  native({ kind: 'preview', frameId: 1, jpeg: 'AA==' });
  await setImmediate();
  assert.equal(draws.length, 1);
  assert.deepEqual(phoneMessages.find(message => message.kind === 'preview-ack'), { kind: 'preview-ack', frameId: 1 });
  const startEpochMs = Date.now() - 10000;
  native({ kind: 'recording', recordingId: RECORDING, startEpochMs, state: 'stopped', elapsedMs: 10000, segmentId: 'test-segment' });
  assert.equal(hostMessages.at(-1).kind, 'recording');
  assert.equal(hostMessages.at(-1).state, 'stopped');
  host({ kind: 'video-request', recordingId: RECORDING });
  assert.equal(hostMessages.some(message => message.kind.startsWith('video-')), false);

  const original = Buffer.from([1, 3, 7, 31, 127, 255]);
  native({ kind: 'finalized', recordingId: RECORDING, bytes: original.length, chunkSize: 256 * 1024 });
  await setImmediate();
  const offer = hostMessages.find(message => message.kind === 'video-offer');
  assert.equal(offer.bytes, original.length);
  assert.ok(copyTimersStarted > 0, 'copy timeout is scheduled on Window');
  const transfer = { transferId: offer.transferId, recordingId: RECORDING };
  host({ kind: 'video-accept', ...transfer, nextPart: 0, partsPerMessage: 4, maxInFlight: 8 });
  const read = phoneMessages.find(message => message.kind === 'read-chunk');
  assert.equal(read.recordingId, RECORDING);
  assert.equal(read.index, 0);
  native({ kind: 'chunk', requestId: 'stale', recordingId: RECORDING, index: 0, data: original.toString('base64') });
  assert.equal(hostMessages.some(message => message.kind === 'video-parts'), false);
  native({ kind: 'chunk', requestId: read.requestId, recordingId: RECORDING, index: 0, data: original.toString('base64') });
  for (let attempt = 0; attempt < 100 && !hostMessages.some(message => message.kind === 'video-parts'); attempt++) await setImmediate();
  const batch = hostMessages.find(message => message.kind === 'video-parts');
  assert.ok(batch);
  assert.deepEqual(Buffer.from(batch.parts[0].data, 'base64'), original);
  host({ kind: 'video-ack', ...transfer, index: 0, nextPart: 1 });
  await setImmediate();
  assert.ok(hostMessages.some(message => message.kind === 'video-complete'));
  host({ kind: 'video-saved', ...transfer, nextPart: 1 });
  assert.equal(nodes.get('native-copy').textContent, 'Salvo no computador');

  const previewPeer = peer;
  native({ kind: 'camera', active: false, controlsVersion: 2 });
  assert.equal(hostMessages.at(-1).state, 'off');
  native({ kind: 'camera', active: true, controlsVersion: 2, width: 1920, height: 1080, frameRate: 60 });
  await setImmediate();
  assert.notEqual(peer, previewPeer);
  assert.equal(previewPeer.closed, true);
  assert.deepEqual(joins, [undefined, 'test-camera']);
  peer.connectionState = 'connected';
  peer.channel.readyState = 'open';
  peer.channel.onopen();
  assert.equal(hostMessages.filter(message => message.kind === 'camera-status').at(-1).state, 'preview');
});
