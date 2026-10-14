import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBallPilot, ballPilotGrid, parseBallPilotArguments, validateBallPilotOutput, validateBallPilotRequest,
  BALL_PILOT_FPS, BALL_PILOT_TIMEOUT_MS } from '../scouting-youtube-ball-pilot.mjs';

const request = { videoId: 'mdfgd1K3HTc', start: 20, end: 21 };
const output = { video_accessible: true, samples: [
  { time: 20, visible: true, x: 0.4, y: 0.3 },
  { time: 20.25, visible: false, x: null, y: null },
  { time: 20.5, visible: true, x: 0.5, y: 0.4 },
  { time: 20.75, visible: false, x: null, y: null },
], limitations: [] };
const providerResult = (value = output, finishReason = 'STOP') => ({ ok: true, status: 200, json: async () => ({
  candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(value) }] } }],
  usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 5, totalTokenCount: 8 },
}) });

test('requires a video ID, bounded times and the fixed 4 Hz rate', () => {
  for (const value of [{ ...request, videoId: 'https://evil/' }, { ...request, videoId: 'mdfgd1K3HT!' },
    { ...request, start: -1 }, { ...request, end: NaN }, { ...request, start: 21 },
    { ...request, end: 50.01 }, { ...request, start: 1790, end: 1801 }, { ...request, fps: 30 }])
    assert.throws(() => validateBallPilotRequest(value));
  assert.deepEqual(validateBallPilotRequest(request), { ...request, fps: 4 });
  assert.equal(BALL_PILOT_FPS, 4); assert.equal(BALL_PILOT_TIMEOUT_MS, 75000);
  assert.deepEqual(ballPilotGrid(request), [20, 20.25, 20.5, 20.75]);
  assert.deepEqual(ballPilotGrid({ ...request, start: 20.1, end: 20.6 }), [20.1, 20.35]);
  assert.deepEqual(ballPilotGrid({ ...request, start: 20, end: 20.00000001 }), [20]);
  assert.equal(ballPilotGrid({ ...request, start: 20, end: 50 }).length, 120);
});

test('reports coverage for actual observations and never applies a trajectory', () => {
  const result = validateBallPilotOutput(output, request);
  assert.equal(result.validation.coverage, 0.5); assert.equal(result.validation.observed, 2);
  assert.equal(result.validation.notObserved, 2); assert.equal(result.validation.unknown, 2);
  assert.equal(result.validation.formatComplete, true); assert.equal(result.autoApplied, false);
  assert.deepEqual(result.samples[1], { time: 20.25, visible: false, x: null, y: null, status: 'unknown', reason: 'not_observed' });
});

test('all false rows mean unknown location, even when the response fills the exact grid', () => {
  const result = validateBallPilotOutput({ ...output, samples: output.samples.map(sample => ({
    time: sample.time, visible: false, x: null, y: null,
  })) }, request);
  assert.equal(result.validation.formatComplete, true); assert.equal(result.validation.coverage, 0);
  assert.equal(result.validation.observed, 0); assert.equal(result.validation.notObserved, 4);
  assert.equal(result.validation.unknown, 4);
  assert.ok(result.samples.every(sample => sample.status === 'unknown' && sample.reason === 'not_observed'));
});

test('missing and duplicated timestamps remain unknown without selecting or interpolating coordinates', () => {
  const result = validateBallPilotOutput({ ...output, samples: [output.samples[0], output.samples[0], output.samples[2]] }, request);
  assert.equal(result.validation.duplicate, 1); assert.equal(result.validation.missing, 2);
  assert.equal(result.validation.visible, 1); assert.equal(result.validation.formatComplete, false);
  assert.deepEqual(result.samples[0], { time: 20, visible: null, x: null, y: null, status: 'unknown', reason: 'duplicate' });
  assert.deepEqual(result.samples[1], { time: 20.25, visible: null, x: null, y: null, status: 'unknown', reason: 'missing' });
});

test('rejects nonfinite, out-of-range, wrong visibility and off-grid observations instead of clamping them', () => {
  const result = validateBallPilotOutput({ ...output, samples: [
    { time: NaN, visible: true, x: 0.5, y: 0.4 },
    { time: 20, visible: true, x: Infinity, y: 0.4 },
    { time: 20.25, visible: true, x: 1.01, y: 0.4 },
    { time: 20.5, visible: false, x: 0.5, y: 0.4 },
    { time: 20.751, visible: true, x: 0.5, y: 0.4 },
    { time: 21, visible: true, x: 0.5, y: 0.4 },
  ] }, request);
  assert.equal(result.validation.invalid, 3); assert.equal(result.validation.missing, 1);
  assert.equal(result.validation.unknown, 4); assert.equal(result.validation.visible, 0);
  assert.ok(result.samples.every(sample => sample.x === null && sample.y === null));
  assert.ok(result.validation.issues.some(issue => issue.reason === 'nonfinite_time'));
  assert.ok(result.validation.issues.some(issue => issue.reason === 'nonfinite_coordinate'));
  assert.ok(result.validation.issues.some(issue => issue.reason === 'coordinate_out_of_range'));
  assert.equal(result.validation.rejectedRows, 6);
  assert.equal(result.validation.issues.filter(issue => issue.reason === 'outside_grid').length, 2);
});

test('requires visual access, bounded structured output and limitations', () => {
  for (const value of [{ ...output, video_accessible: false }, { ...output, samples: null },
    { ...output, samples: Array(9).fill(output.samples[0]) }, { ...output, limitations: ['x'.repeat(601)] },
    { ...output, limitations: [123] }]) assert.throws(() => validateBallPilotOutput(value, request));
});

test('calls Gemini once with only the YouTube URL, exact clip, 4 Hz and structured JSON', async () => {
  let calls = 0;
  const parent = new AbortController();
  const result = await analyzeBallPilot(request, 'fake-test-secret', parent.signal, async (url, options) => {
    calls++;
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
    assert.equal(options.headers['x-goog-api-key'], 'fake-test-secret');
    assert.equal(options.method, 'POST'); assert.ok(options.signal instanceof AbortSignal);
    const body = JSON.parse(options.body), part = body.contents[0].parts[0];
    assert.deepEqual(part, { fileData: { fileUri: 'https://www.youtube.com/watch?v=mdfgd1K3HTc', mimeType: 'video/*' },
      videoMetadata: { startOffset: '20s', endOffset: '21s', fps: 4 } });
    assert.ok(!options.body.includes('inlineData'));
    assert.equal(body.generationConfig.maxOutputTokens, 8192);
    assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'minimal');
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(body.generationConfig.responseSchema.required, ['video_accessible', 'samples', 'limitations']);
    assert.match(body.contents[0].parts[1].text, /\[20,20.25,20.5,20.75\]/);
    assert.match(body.contents[0].parts[1].text, /Não interpole/);
    return providerResult();
  });
  assert.equal(calls, 1); assert.equal(result.validation.visible, 2); assert.deepEqual(result.usage, { promptTokenCount: 3, candidatesTokenCount: 5, totalTokenCount: 8 });
});

test('503, quota, truncated JSON and unknown timeout never cause a retry or expose the key', async () => {
  for (const response of [{ ok: false, status: 503 }, { ok: false, status: 429 }, providerResult(output, 'MAX_TOKENS'),
    { ok: true, status: 200, json: async () => { throw new Error('fake-test-secret'); } }]) {
    let calls = 0;
    await assert.rejects(analyzeBallPilot(request, 'fake-test-secret', undefined, async () => { calls++; return response; }),
      error => !error.message.includes('fake-test-secret'));
    assert.equal(calls, 1);
  }
  let calls = 0;
  await assert.rejects(analyzeBallPilot(request, 'fake-test-secret', undefined, async () => {
    calls++; throw new Error('Timeout fake-test-secret');
  }), /Falha de conexão/);
  assert.equal(calls, 1);
});

test('propagates cancellation and skips a call that is already aborted', async () => {
  const parent = new AbortController(); let calls = 0;
  await assert.rejects(analyzeBallPilot(request, 'fake-test-secret', parent.signal, async (_url, options) => {
    calls++; parent.abort(); assert.equal(options.signal.aborted, true); return providerResult();
  }), /cancelado/);
  assert.equal(calls, 1);
  await assert.rejects(analyzeBallPilot(request, 'fake-test-secret', parent.signal, async () => { calls++; return providerResult(); }));
  assert.equal(calls, 1);
});

test('empty credentials and invalid request never contact the provider', async () => {
  let calls = 0; const fetcher = async () => { calls++; return providerResult(); };
  for (const key of [undefined, '', '   ']) await assert.rejects(analyzeBallPilot(request, key, undefined, fetcher), /chave local/);
  await assert.rejects(analyzeBallPilot({ ...request, fps: 30 }, 'fake-test-secret', undefined, fetcher));
  assert.equal(calls, 0);
});

test('only persists allowed usage fields and redacts an echoed test credential', async () => {
  const result = await analyzeBallPilot(request, 'fake-test-secret', undefined, async () => ({
    ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [
      { text: 'internal fake-test-secret', thought: true },
      { text: JSON.stringify({ ...output, limitations: ['fake-test-secret'] }) },
    ] } }], usageMetadata: { totalTokenCount: 8, leaked: 'fake-test-secret', thoughtsTokenCount: Infinity } }),
  }));
  assert.deepEqual(result.limitations, ['[oculto]']); assert.deepEqual(result.usage, { totalTokenCount: 8 });
  assert.ok(!JSON.stringify(result).includes('fake-test-secret'));
});

test('CLI requires explicit input and rejects unexpected or duplicated flags', () => {
  for (const args of [[], ['--video-id', request.videoId], ['--key', 'secret'],
    ['--video-id', request.videoId, '--start', '20', '--end', '21', '--start', '20']])
    assert.throws(() => parseBallPilotArguments(args));
  const args = parseBallPilotArguments(['--video-id', request.videoId, '--start', '20', '--end', '21']);
  assert.deepEqual(args.input, { ...request, fps: 4 });
  assert.match(args.output, /scouting-youtube-ball-pilot[\\/]result\.json$/);
});
