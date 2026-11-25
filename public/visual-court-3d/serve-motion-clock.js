// Shared by the court sampler and the Blender player. The ball leaves the
// guide hand at -.65, meets the hitting hand at zero and recovers at +1.
export function serveMotionProgress(time, release, strike, duration) {
  if (time <= release) return -1 + .35 * Math.max(0, time / release);
  if (time < strike) return -.65 * (strike - time) / (strike - release);
  return Math.min(1, (time - strike) * duration / .64);
}

export function serveMotionFrame(markers, progress) {
  if (progress <= -.65) return markers.ready + (markers.toss - markers.ready) * Math.max(0, (progress + 1) / .35);
  if (progress < 0) return markers.toss + (markers.contact - markers.toss) * ((progress + .65) / .65);
  return markers.contact + (markers.recover - markers.contact) * Math.min(1, progress);
}
