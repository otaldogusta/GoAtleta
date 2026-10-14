import test from 'node:test';
import assert from 'node:assert/strict';
import { trackingModel, decodeTrackingOutput } from '../../public/scouting-ai/decoder.js';

const gridShape = [1, 36, 27, 48], heatmapShape = [1, 18, 288, 512];
const gridSize = 27 * 48, heatmapSize = 288 * 512;
const grid = () => new Float32Array(36 * gridSize);
const heatmaps = () => new Float32Array(18 * heatmapSize);
function spot(values, frame, x, y, size = 3, score = .75) {
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) values[frame * heatmapSize + (y + dy) * 512 + x + dx] = score;
}

test('defaults to the existing V2b and whitelists two same-origin artifacts', () => {
  assert.equal(trackingModel().file, './model.onnx');
  assert.equal(trackingModel('v4c').file, './model-v4c.onnx');
  for (const model of ['https://host.invalid/model.onnx', '../secret', '__proto__', 'constructor', null, { toString: () => 'v2b' }]) assert.throws(() => trackingModel(model));
});

test('rejects wrong output planes, dimensions, types and truncated batches', () => {
  assert.throws(() => decodeTrackingOutput('v2b', grid(), [1, 27, 27, 48]));
  assert.throws(() => decodeTrackingOutput('v4c', heatmaps(), gridShape));
  assert.throws(() => decodeTrackingOutput('v4c', heatmaps().subarray(0, 500), heatmapShape));
  assert.throws(() => decodeTrackingOutput('v2b', [], gridShape));
  for (const threshold of [0, NaN, Infinity, -.1, 1.1]) assert.throws(() => decodeTrackingOutput('v2b', grid(), gridShape, threshold));
});

test('decodes each grid frame with its own confidence and offsets, ignoring the radius plane', () => {
  const values = grid();
  for (let frame = 0; frame < 9; frame++) {
    const index = frame * 4 * gridSize + 7 * 48 + 12;
    values[index] = .8; values[index + gridSize] = .25; values[index + gridSize * 2] = .5; values[index + gridSize * 3] = 99;
  }
  const points = decodeTrackingOutput('v2b', values, gridShape);
  assert.equal(points.length, 9);
  for (const point of points) { assert.equal(point.x, 12.25 / 48); assert.equal(point.y, 7.5 / 27); assert.ok(Math.abs(point.score - .8) < 1e-6); }
});

test('non-finite grid scores and malformed offsets never become ball positions', () => {
  const values = grid(); values.fill(NaN, 0, gridSize);
  const offset = 4 * gridSize;
  values[offset + 4] = .9; values[offset + gridSize + 4] = Infinity;
  const points = decodeTrackingOutput('v2b', values, gridShape);
  assert.ok(Number.isNaN(points[0].x)); assert.ok(Number.isNaN(points[1].x));
  values[offset + gridSize + 4] = -2;
  assert.ok(Number.isNaN(decodeTrackingOutput('v2b', values, gridShape)[1].x));
});

test('heatmap decodes a region centroid without reading the nine radius maps', () => {
  const values = heatmaps();
  spot(values, 0, 200, 100); spot(values, 8, 350, 150);
  values.fill(1, 9 * heatmapSize);
  const points = decodeTrackingOutput('v4c', values, heatmapShape);
  assert.deepEqual(points[0], { score: .75, x: 201 / 512, y: 101 / 288 });
  assert.deepEqual(points[8], { score: .75, x: 351 / 512, y: 151 / 288 });
  assert.ok(Number.isNaN(points[1].x));
});

test('heatmap chooses the largest connected region and reports that region score', () => {
  const values = heatmaps();
  spot(values, 0, 10, 10, 2, .99); spot(values, 0, 300, 130, 4, .6);
  const point = decodeTrackingOutput('v4c', values, heatmapShape)[0];
  assert.equal(point.x, 301.5 / 512); assert.equal(point.y, 131.5 / 288); assert.ok(Math.abs(point.score - .6) < 1e-6);
});

test('heatmap absence, low evidence and non-finite cells remain missing instead of interpolating', () => {
  const values = heatmaps(); spot(values, 0, 20, 20); spot(values, 2, 30, 30);
  spot(values, 3, 40, 40, 3, .4); values[4 * heatmapSize] = NaN; values[5 * heatmapSize] = Infinity;
  values[6 * heatmapSize] = 1;
  const points = decodeTrackingOutput('v4c', values, heatmapShape);
  for (const index of [1, 3, 4, 5, 6]) assert.ok(Number.isNaN(points[index].x));
  assert.ok(Number.isFinite(points[0].x)); assert.ok(Number.isFinite(points[2].x));
});

test('heatmap border regions stay in image coordinates', () => {
  const values = heatmaps(); spot(values, 0, 509, 285);
  const point = decodeTrackingOutput('v4c', values, heatmapShape)[0];
  assert.equal(point.x, 510 / 512); assert.equal(point.y, 286 / 288);
});
