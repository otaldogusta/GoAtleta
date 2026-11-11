import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';

const ROOM = '08a8927a-b67c-4cba-af6b-9e836ab3d032';
const RECORDING = '5f88fc9c-6a17-4f2a-9c6a-26d32758abe7';
const BLOCK = 256 * 1024;

async function nativeFixture(t) {
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
  const nativeCamera = new URL('./android-camera-probe/web/native-camera.js', import.meta.url);
  nativeCamera.searchParams.set('fixture', t.name);
  const nativeCameraUrl = nativeCamera.href;
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

  const native = value => port.onmessage({ data: JSON.stringify(value) });
  const host = value => peer.channel.onmessage({ data: JSON.stringify(value) });
  const openPeer = async () => {
    await setImmediate();
    peer.connectionState = 'connected';
    peer.channel.readyState = 'open';
    peer.channel.onopen();
    return peer;
  };
  await openPeer();
  return { host, native, openPeer, hostMessages, phoneMessages, draws, joins, nodes, copyTimersStarted: () => copyTimersStarted };
}

async function receive(messages, match) {
  const expires = Date.now() + 1000;
  while (Date.now() < expires) {
    const message = messages.findLast(match);
    if (message) return message;
    await setImmediate();
  }
  assert.fail('Expected message did not arrive');
}

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const copyRequest = { kind: 'native-original-request', recordingId: RECORDING };

test('native preview and legacy original share the established camera transport and only offer a requested original', async t => {
  const { host, native, openPeer, hostMessages, phoneMessages, draws, joins, nodes, copyTimersStarted } = await nativeFixture(t);
  native({ kind: 'camera', active: true, controlsVersion: 2, width: 1920, height: 1080, frameRate: 60, zoom: 1 });
  assert.ok(hostMessages.some(message => message.kind === 'camera-status' && message.capture?.frameRate === 60 && message.capture.width === 1920));
  native({ kind: 'camera', active: true, controlsVersion: 2, width: 1920, height: 1080, frameRate: 60, zoom: 1, lensLabel: 'Traseira principal', readyToRecord: false, thermalBlocked: true });
  assert.ok(hostMessages.some(message => message.kind === 'camera-status' && message.capture?.label === 'Traseira principal' && message.readyToRecord === false && message.thermalBlocked === true));
  native({ kind: 'preview', frameId: 1, jpeg: 'AA==' });
  await setImmediate();
  assert.equal(draws.length, 1);
  assert.deepEqual(phoneMessages.find(message => message.kind === 'preview-ack'), { kind: 'preview-ack', frameId: 1 });
  const durationMs = 90 * 60 * 1000;
  const startEpochMs = Date.now() - durationMs;
  native({ kind: 'recording', recordingId: RECORDING, startEpochMs, state: 'stopped', elapsedMs: durationMs, segmentId: 'test-segment' });
  assert.equal(hostMessages.at(-1).kind, 'recording');
  assert.equal(hostMessages.at(-1).state, 'stopped');
  assert.equal(hostMessages.at(-1).durationMs, durationMs);
  host({ kind: 'video-request', recordingId: RECORDING });
  assert.equal(hostMessages.some(message => message.kind.startsWith('video-')), false);

  const original = Buffer.from([1, 3, 7, 31, 127, 255]);
  native({ kind: 'finalized', recordingId: RECORDING, bytes: original.length, chunkSize: 256 * 1024 });
  await setImmediate();
  const offer = hostMessages.find(message => message.kind === 'video-offer');
  assert.equal(offer.bytes, original.length);
  assert.ok(copyTimersStarted() > 0, 'copy timeout is scheduled on Window');
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

  const previewPeer = await openPeer();
  native({ kind: 'camera', active: false, controlsVersion: 2 });
  assert.equal(hostMessages.at(-1).state, 'off');
  native({ kind: 'camera', active: true, controlsVersion: 2, width: 1920, height: 1080, frameRate: 60 });
  const peer = await openPeer();
  assert.notEqual(peer, previewPeer);
  assert.equal(previewPeer.closed, true);
  assert.deepEqual(joins, [undefined, 'test-camera']);
  assert.equal(hostMessages.filter(message => message.kind === 'camera-status').at(-1).state, 'preview');
});

test('stages the authorized native original during capture, resumes its durable prefix and repairs finalized bytes', async t => {
  const { host, native, openPeer, hostMessages, phoneMessages, nodes } = await nativeFixture(t);
  const recording = { recordingId: RECORDING, startEpochMs: Date.now() - 90 * 60 * 1000, state: 'recording',
    elapsedMs: 90 * 60 * 1000, segmentId: 'match-segment' };
  native({ kind: 'recording', ...recording });
  native({ kind: 'source', recordingId: RECORDING, bytes: BLOCK * 2, finalized: false });
  assert.equal(hostMessages.at(-1).originalTransfer, 'progressive-v1');
  assert.ok(!hostMessages.some(value => value.kind === 'native-original-offer'));
  host(copyRequest);
  const firstOffer = await receive(hostMessages, value => value.kind === 'native-original-offer');
  assert.equal(firstOffer.bytes, BLOCK * 2);
  assert.equal(firstOffer.finalized, false);
  const ack = (transferId, offset, verified, extra) => host({ kind: 'native-original-ack', recordingId: RECORDING, transferId, offset, verified, ...extra });
  ack('foreign', 0, 0);
  await setImmediate();
  assert.ok(!phoneMessages.some(value => value.kind === 'read-chunk'));
  ack(firstOffer.transferId, 0, 0);
  const firstBlock = Buffer.alloc(BLOCK, 7);
  const answerChunk = async (index, bytes) => {
    const request = await receive(phoneMessages, value => value.kind === 'read-chunk' && value.index === index);
    phoneMessages.splice(phoneMessages.indexOf(request), 1);
    native({ ...request, kind: 'chunk', data: bytes.toString('base64') });
  };
  const previousPeer = await openPeer();
  previousPeer.channel.bufferedAmount = 128 * 1024;
  await answerChunk(0, firstBlock);
  await setImmediate();
  assert.ok(!hostMessages.some(value => value.kind === 'native-original-data'));
  native({ kind: 'recording', ...recording, state: 'paused' });
  assert.equal(hostMessages.at(-1).state, 'paused');
  native({ kind: 'recording', ...recording });
  previousPeer.channel.bufferedAmount = 0;
  const commit = await receive(hostMessages, value => value.kind === 'native-original-commit');
  assert.equal(commit.sha256, digest(firstBlock));
  assert.deepEqual(hostMessages.filter(value => value.kind === 'native-original-data').map(value => value.offset),
    Array.from({ length: 8 }, (_, index) => index * 32 * 1024));
  ack(firstOffer.transferId, BLOCK, 0);
  const abandoned = await receive(phoneMessages, value => value.kind === 'read-chunk' && value.index === 1);
  previousPeer.connectionState = 'disconnected';
  previousPeer.onconnectionstatechange();
  assert.match(nodes.get('native-copy').textContent, /reconexão/);
  nodes.get('native-retry').onclick();
  const reconnected = await openPeer();
  assert.notEqual(previousPeer, reconnected);
  assert.equal(hostMessages.filter(value => value.kind === 'native-original-offer').length, 1);
  host(copyRequest);
  const resumed = await receive(hostMessages, value => value.kind === 'native-original-offer' && value.transferId !== firstOffer.transferId);
  ack(resumed.transferId, BLOCK, 0);
  // A native read already queued for the retired channel may complete late.
  phoneMessages.splice(phoneMessages.indexOf(abandoned), 1);
  native({ ...abandoned, kind: 'chunk', data: firstBlock.toString('base64') });
  await answerChunk(1, Buffer.alloc(BLOCK, 8));
  const secondCommit = await receive(hostMessages, value => value.kind === 'native-original-commit' && value.transferId === resumed.transferId);
  assert.equal(secondCommit.offset, BLOCK);
  ack(resumed.transferId, BLOCK * 2, 0);

  const finalized = Buffer.concat([Buffer.alloc(BLOCK, 9), Buffer.alloc(BLOCK, 8), Buffer.from([4, 3, 2, 1])]);
  native({ kind: 'recording', ...recording, state: 'stopped' });
  native({ kind: 'source', recordingId: RECORDING, bytes: finalized.length, finalized: true });
  await setImmediate();
  assert.ok(!hostMessages.some(value => value.kind === 'native-original-offer' && value.finalized));
  host(copyRequest);
  const finalOffer = await receive(hostMessages, value => value.kind === 'native-original-offer' && value.finalized);
  ack(finalOffer.transferId, BLOCK * 2, 0);
  const hash = await receive(phoneMessages, value => value.kind === 'hash-range');
  assert.equal(hash.bytes, finalized.length);
  native({ ...hash, kind: 'range-hash', sha256: digest(finalized) });
  const check = await receive(hostMessages, value => value.kind === 'native-original-check');
  assert.equal(check.sha256, digest(finalized));
  ack(finalOffer.transferId, BLOCK * 2, 0, { needsData: true });
  for (let index = 0; index < 3; index++) await answerChunk(index, finalized.subarray(index * BLOCK, (index + 1) * BLOCK));
  const repaired = await receive(hostMessages, value => value.kind === 'native-original-commit' && value.bytes === finalized.length);
  assert.equal(repaired.sha256, digest(finalized));
  const fragments = hostMessages.slice(hostMessages.indexOf(check) + 1).filter(value => value.kind === 'native-original-data');
  assert.deepEqual(Buffer.concat(fragments.map(value => Buffer.from(value.data, 'base64'))), finalized);
  assert.notEqual(nodes.get('native-copy').textContent, 'Salvo no computador');
  ack(finalOffer.transferId, finalized.length, finalized.length);
  await setImmediate();
  assert.equal(nodes.get('native-copy').textContent, 'Salvo no computador');
});

test('resumes final verification above four GiB and leaves matching ranges unchanged', async t => {
  const { host, native, hostMessages, phoneMessages, nodes } = await nativeFixture(t);
  const offset = 5 * 1024 ** 3;
  const tail = Buffer.from([3, 2, 1]);
  const bytes = offset + tail.length;
  native({ kind: 'source', recordingId: RECORDING, bytes, finalized: true });
  host(copyRequest);
  const offer = await receive(hostMessages, value => value.kind === 'native-original-offer');
  assert.equal(offer.bytes, bytes);
  const ack = (verified) => host({ kind: 'native-original-ack', recordingId: RECORDING, transferId: offer.transferId, offset: bytes, verified });
  ack(offset);
  const hash = await receive(phoneMessages, value => value.kind === 'hash-range');
  assert.equal(hash.offset, offset);
  assert.equal(hash.bytes, tail.length);
  native({ ...hash, kind: 'range-hash', sha256: digest(tail) });
  await receive(hostMessages, value => value.kind === 'native-original-check');
  ack(bytes);
  await setImmediate();
  assert.equal(nodes.get('native-copy').textContent, 'Salvo no computador');
  assert.ok(!phoneMessages.some(value => value.kind === 'read-chunk'));
  assert.ok(!hostMessages.some(value => value.kind === 'native-original-data'));
});
