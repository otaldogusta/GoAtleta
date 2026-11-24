import { courtFootwork } from "./court-simulation/court-footwork.js";

type FloorPoint = { x: number; z: number };
type Travel = "run" | "walk" | "stop";
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** The editor spends equal time on each segment. Steps follow metres of path,
 * independent of how many pointer samples the teacher recorded in a bend. */
export function manualCourtTravel(points: FloorPoint[], progress: number, durationMs: number) {
  const count = points.length - 1;
  if (count < 1) return;
  const secondsPerSegment = Math.max(450, Number.isFinite(durationMs) ? durationMs : 1600) / (1000 * count);
  const metres = [0], yawArea = [0], yaws: number[] = [], kinds: Travel[] = [];
  for (let i = 0; i < count; i++) {
    const dx = points[i + 1].x - points[i].x, dz = points[i + 1].z - points[i].z;
    const length = Math.hypot(dx, dz), raw = Math.atan2(dx, dz);
    const previous = yaws[i - 1] ?? raw;
    const yaw = length ? previous + Math.atan2(Math.sin(raw - previous), Math.cos(raw - previous)) : previous;
    yaws.push(yaw);
    metres.push(metres[i] + length);
    yawArea.push(yawArea[i] + length * yaw);
    kinds.push(length < 1e-6 ? "stop" : "walk");
  }
  if (metres[count] < .025) return;
  // A repeated pointer event can last only a few milliseconds. Preserve the
  // step across it; gather both shoes only for an actual hold on the timeline.
  for (let i = 0; i < count;) {
    if (kinds[i] !== "stop") { i++; continue; }
    const first = i++;
    while (i < count && kinds[i] === "stop") i++;
    if ((i - first) * secondsPerSegment < .12) kinds.fill("walk", first, i);
  }

  const atTime = (time: number) => {
    const t = clamp(time, 0, count), i = Math.min(count - 1, Math.floor(t));
    return metres[i] + (metres[i + 1] - metres[i]) * (t - i);
  };
  const speedAt = (time: number) => {
    // Average 160 ms to keep a noisy pointer sample from changing the gait.
    const halfWindow = .08 / secondsPerSegment;
    const a = Math.max(0, time - halfWindow), b = Math.min(count, time + halfWindow);
    return (atTime(b) - atTime(a)) / ((b - a) * secondsPerSegment);
  };
  let i = 0;
  while (i < count) {
    if (kinds[i] === "stop" || speedAt(i + .5) < 1.7) { i++; continue; }
    const first = i++;
    while (i < count && kinds[i] !== "stop" && speedAt(i + .5) >= 1.7) i++;
    if (metres[i] - metres[first] >= 1.6) kinds.fill("run", first, i);
  }

  const time = clamp(progress, 0, 1) * count, segment = Math.min(count - 1, Math.floor(time));
  const kind = kinds[segment];
  let start = segment, end = segment + 1;
  while (start > 0 && kinds[start - 1] === kind) start--;
  while (end < count && kinds[end] === kind) end++;
  const distance = metres[end] - metres[start];
  const along = distance ? (atTime(time) - metres[start]) / distance : 0;
  function segmentAt(value: number) {
    let low = 0, high = count - 1;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (metres[mid + 1] <= value) low = mid + 1;
      else high = mid;
    }
    return low;
  }
  const pointAt = (part: number) => {
    const value = metres[start] + clamp(part, 0, 1) * distance;
    const index = segmentAt(value), width = metres[index + 1] - metres[index];
    const ratio = width ? (value - metres[index]) / width : 0;
    const a = points[index], b = points[index + 1];
    return [a.x + (b.x - a.x) * ratio, a.z + (b.z - a.z) * ratio];
  };
  const integral = (value: number) => {
    const index = segmentAt(value);
    return yawArea[index] + (value - metres[index]) * yaws[index];
  };
  const headingAt = (part: number) => {
    const value = metres[start] + clamp(part, 0, 1) * distance;
    const a = Math.max(0, value - .38), b = Math.min(metres[count], value + .38);
    // Average unwrapped headings so even a 180-degree return turns smoothly.
    return (integral(b) - integral(a)) / (b - a);
  };
  const feet = courtFootwork(pointAt, along, { travelSeconds: (end - start) * secondsPerSegment,
    holdStance: true, route: { length: distance, headingAt, speed: speedAt(time), running: kind === "run" } });
  const yaw = headingAt(along), facing: [number, number] = [Math.sin(yaw), Math.cos(yaw)];
  return { ...feet, facing, plantedStance: true };
}
