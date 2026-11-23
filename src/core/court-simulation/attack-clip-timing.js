// The editable Blender scene uses capture frames. The play clock uses seconds.
// Split at the actual takeoff and ball contact so scrubbing has the same pose as playback.
const fraction = (value, start, end) => Math.max(0, Math.min(1, (value - start) / Math.max(1e-8, end - start)));
const smooth = value => value * value * (3 - 2 * value);
const sharedRate = (before, after) => 2 * before * after / (before + after);

export function secondsFromTakeoffToHit(setTime, hitTime, riseToHit, setArc, duration, minimum = .42) {
  const apexFraction = setArc > 0 ? Math.max(0, Math.min(1, .5 + riseToHit / (8 * setArc))) : Number(riseToHit >= 0);
  const apex = setTime + (hitTime - setTime) * apexFraction;
  return Math.min(.62, Math.max(minimum, (hitTime - apex) * duration + .08));
}

// Cubic Hermite with a shared positive tangent at each landmark. The elbow
// keeps moving through frame 132 even when the set changes the speed of the clip.
function frameBetween(time, start, end, first, last, entryRate, exitRate) {
  const u = fraction(time, start, end), duration = end - start, span = last - first;
  return first + span * smooth(u) + u * (1 - u) * duration * ((1 - u) * entryRate - u * exitRate);
}

export function attackClipTiming(time, approach, takeoff, contact, landing, preparationSeconds = 0) {
  // A quick set without a pass can begin running immediately. Reserve a
  // fraction of that approach to lift the first foot from the resting pose.
  const firstStep = Math.max(approach, Math.min(preparationSeconds, takeoff * .2));
  const ready = Math.max(0, firstStep - preparationSeconds);
  const closeStep = takeoff - Math.min(.11, (takeoff - firstStep) * .25);
  const draw = contact - Math.min(.14, (contact - takeoff) * .35);
  const runRate = 105 / Math.max(1e-8, closeStep - firstStep);
  const atFirstStep = preparationSeconds ? sharedRate(11 / Math.max(1e-8, firstStep - ready), runRate) : 0;
  const plantRate = 15 / Math.max(1e-8, takeoff - closeStep);
  const riseRate = 9 / Math.max(1e-8, draw - takeoff);
  const swingRate = 4 / Math.max(1e-8, contact - draw);
  const fallRate = 14 / Math.max(1e-8, landing - contact);
  const atPlant = sharedRate(runRate, plantRate), atTakeoff = sharedRate(plantRate, riseRate);
  const atDraw = sharedRate(riseRate, swingRate), atHit = sharedRate(swingRate, fallRate);
  const atLanding = sharedRate(fallRate, 13 / .25);
  let attackFrame;
  if (preparationSeconds && time < firstStep) attackFrame = frameBetween(time, ready, firstStep, 1, 12, 0, atFirstStep);
  else if (time < closeStep) attackFrame = frameBetween(time, firstStep, closeStep, 12, 117, atFirstStep, atPlant);
  else if (time < takeoff) attackFrame = frameBetween(time, closeStep, takeoff, 117, 132, atPlant, atTakeoff);
  else if (time < draw) attackFrame = frameBetween(time, takeoff, draw, 132, 141, atTakeoff, atDraw);
  else if (time < contact) attackFrame = frameBetween(time, draw, contact, 141, 145, atDraw, atHit);
  else if (time < landing) attackFrame = frameBetween(time, contact, landing, 145, 159, atHit, atLanding);
  else attackFrame = frameBetween(time, landing, landing + .25, 159, 172, atLanding, 0);

  // Register the whole airborne pose to the impact, leaving the arm free to swing.
  const contactWeight = time < contact ? smooth(fraction(time, takeoff, contact))
    : 1 - smooth(fraction(time, contact, landing));
  return { attackFrame, contactWeight };
}
