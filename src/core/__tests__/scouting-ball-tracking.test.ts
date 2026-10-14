import { selectBallTracking, type BallTrackingCandidate } from '../scouting-ball-tracking';

const point = (frame: number, x: number, y = .3, score = .9): BallTrackingCandidate => ({ time: frame / 30, x, y, score });
const spikeSequence = () => [point(0, .2), point(1, .21), point(2, .85, .8, .55), point(3, .23), point(4, .24)];

test('rejects invalid/weak candidates and keeps the strongest observation at duplicate times', () => {
  const rows = [point(2, .4), point(0, .2, .3, .49), point(1, .3, .3, .6), point(1, .31), point(3, NaN), point(4, 1.01), point(5, .5, .3, Infinity)];
  const result = selectBallTracking(rows);
  expect(result.positions).toEqual([{ time: 1 / 30, x: .31, y: .3 }, { time: 2 / 30, x: .4, y: .3 }]);
  expect(result.metrics).toEqual({ candidates: 7, invalid: 3, belowConfidence: 1, duplicateTimes: 1, isolatedSpikes: 0, accepted: 2 });
});

test('removes a weak isolated excursion without inventing a replacement observation', () => {
  const rows = spikeSequence();
  const result = selectBallTracking(rows);
  expect(result.positions.map(p => p.time)).toEqual([0, 1 / 30, 3 / 30, 4 / 30]);
  expect(result.metrics.isolatedSpikes).toBe(1);
  expect(rows).toEqual(spikeSequence());
  expect(result.positions.every(p => !('score' in p))).toBe(true);
});

test('retains confident jumps and fast legitimate movement even at weak confidence', () => {
  const confident = spikeSequence(); confident[2].score = .9;
  expect(selectBallTracking(confident).positions).toHaveLength(5);
  const fast = [point(0, .1), point(1, .25), point(2, .4, .3, .55), point(3, .55), point(4, .7)];
  expect(selectBallTracking(fast).positions).toHaveLength(5);
  const turn = [point(0, .1), point(1, .2), point(2, .35, .3, .55), point(3, .2), point(4, .1)];
  expect(selectBallTracking(turn).positions).toHaveLength(5);
});

test('needs four reliable adjacent observations and never filters through gaps or scene cuts', () => {
  expect(selectBallTracking(spikeSequence().slice(1)).positions).toHaveLength(4);
  const weakNeighbor = spikeSequence(); weakNeighbor[0].score = .72;
  expect(selectBallTracking(weakNeighbor).positions).toHaveLength(5);
  const gap = spikeSequence(); gap.slice(2).forEach(p => { p.time += 1 / 30; });
  expect(selectBallTracking(gap).positions).toHaveLength(5);
  expect(selectBallTracking(spikeSequence(), { cuts: [2 / 30] }).positions).toHaveLength(5);
  expect(selectBallTracking(spikeSequence(), { cuts: [3 / 30] }).positions).toHaveLength(5);
});

test('supports empty results, exact threshold and boundaries, without filling missing frames', () => {
  expect(selectBallTracking([]).metrics.accepted).toBe(0);
  const rows = [point(0, 0, 1, .5), point(20, 1, 0, .8)];
  expect(selectBallTracking(rows).positions).toEqual([{ time: 0, x: 0, y: 1 }, { time: 20 / 30, x: 1, y: 0 }]);
  expect(selectBallTracking(rows, { minConfidence: .6 }).positions).toHaveLength(1);
});

test('uses the supplied sample cadence and keeps time-varying acceleration at high speed', () => {
  const rows = spikeSequence().map(p => ({ ...p, time: p.time * 2 }));
  expect(selectBallTracking(rows, { sampledFps: 15 }).metrics.isolatedSpikes).toBe(1);
  expect(selectBallTracking(rows).metrics.isolatedSpikes).toBe(0);
  const acceleration = [point(0, .1), point(1, .12), point(2, .2, .3, .55), point(3, .4), point(4, .7)];
  expect(selectBallTracking(acceleration).positions).toHaveLength(5);
  expect(selectBallTracking(spikeSequence(), { sampledFps: NaN, minConfidence: NaN }).metrics.isolatedSpikes).toBe(1);
});
