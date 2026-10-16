// Angular presentation state only. The host document and camera stay external.
// Angles/deltas are radians, velocities radians/second, timestamps/dt milliseconds.
export const CAMERA_MOTION=Object.freeze({
 maxAzimuthVelocity:3,maxElevationVelocity:2,
 smoothingMs:24,maxSampleGapMs:100,releaseFreshnessMs:80,
 damping:14,cutoff:.02,maxDurationMs:350,
 minElevation:.12,maxElevation:1.25,
});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=Number.isFinite;
const validVelocity=value=>value&&finite(value.azimuth)&&finite(value.elevation);
const stoppedSample=timeMs=>({azimuth:0,elevation:0,timeMs:finite(timeMs)?timeMs:0});

/** deltaAngular is the actual per-event change, AFTER applying the pitch bounds.
 * A fresh reversal or a zero delta replaces that axis immediately; stale samples
 * cannot leave a velocity behind after a long pause. No input is mutated.
 */
export function sampleCameraAngularVelocity(previous,deltaAngular,dtMs,timeMs){
 if(!validVelocity(deltaAngular)||!finite(dtMs)||dtMs<=0||dtMs>CAMERA_MOTION.maxSampleGapMs||!finite(timeMs)||finite(previous?.timeMs)&&timeMs<previous.timeMs)return stoppedSample(timeMs);
 const fresh=validVelocity(previous)&&finite(previous.timeMs)&&timeMs>=previous.timeMs&&timeMs-previous.timeMs<=CAMERA_MOTION.maxSampleGapMs;
 const alpha=1-Math.exp(-dtMs/CAMERA_MOTION.smoothingMs);
 const axis=(name,max)=>{
  const current=clamp(deltaAngular[name]*1000/dtMs,-max,max),prior=fresh?clamp(previous[name],-max,max):current;
  return current===0||Math.sign(current)!==Math.sign(prior)?current:prior+(current-prior)*alpha;
 };
 return {azimuth:axis('azimuth',CAMERA_MOTION.maxAzimuthVelocity),elevation:axis('elevation',CAMERA_MOTION.maxElevationVelocity),timeMs};
}

/** Starting a glide changes no camera angle. Old/future/invalid releases stop. */
export function releaseCameraMotion(velocity,nowMs){
 if(!validVelocity(velocity)||!finite(velocity.timeMs)||!finite(nowMs)||nowMs<velocity.timeMs||nowMs-velocity.timeMs>CAMERA_MOTION.releaseFreshnessMs)return null;
 const azimuth=clamp(velocity.azimuth,-CAMERA_MOTION.maxAzimuthVelocity,CAMERA_MOTION.maxAzimuthVelocity),elevation=clamp(velocity.elevation,-CAMERA_MOTION.maxElevationVelocity,CAMERA_MOTION.maxElevationVelocity);
 return Math.hypot(azimuth,elevation)<=CAMERA_MOTION.cutoff?null:{azimuth,elevation,elapsedMs:0};
}

function elevationBounds(options){
 const min=options?.minElevation??CAMERA_MOTION.minElevation,max=options?.maxElevation??CAMERA_MOTION.maxElevation;
 return finite(min)&&finite(max)&&min<=max?[min,max]:[CAMERA_MOTION.minElevation,CAMERA_MOTION.maxElevation];
}
function poleTime(elevation,velocity,min,max){
 if(!velocity)return Infinity;
 const distance=(velocity>0?max:min)-elevation,fraction=distance*CAMERA_MOTION.damping/velocity;
 return fraction<=0?0:fraction>=1?Infinity:-Math.log1p(-fraction)/CAMERA_MOTION.damping;
}

/** Exact exponential integration, including the cutoff time and pitch stop.
 * Returns motion:null once settled. Hitting a pole removes only outward pitch
 * velocity; yaw continues without a stored pitch impulse or a rebound.
 */
export function integrateCameraMotion(angles,motion,dtMs,options){
 const [min,max]=elevationBounds(options);
 const azimuth=finite(angles?.azimuth)?angles.azimuth:0,elevation=clamp(finite(angles?.elevation)?angles.elevation:CAMERA_MOTION.minElevation,min,max);
 const stop=()=>({azimuth,elevation,motion:null});
 if(!validVelocity(motion)||!finite(motion.elapsedMs)||motion.elapsedMs<0||!finite(dtMs)||dtMs<0)return stop();
 const vx=clamp(motion.azimuth,-CAMERA_MOTION.maxAzimuthVelocity,CAMERA_MOTION.maxAzimuthVelocity);
 let vy=clamp(motion.elevation,-CAMERA_MOTION.maxElevationVelocity,CAMERA_MOTION.maxElevationVelocity);
 if(elevation<=min&&vy<0||elevation>=max&&vy>0)vy=0;
 const speed=Math.hypot(vx,vy),remainingMs=CAMERA_MOTION.maxDurationMs-motion.elapsedMs;
 if(speed<=CAMERA_MOTION.cutoff||remainingMs<=0)return stop();
 const damping=CAMERA_MOTION.damping;
 let stopSeconds=Math.min(remainingMs/1000,Math.log(speed/CAMERA_MOTION.cutoff)/damping);
 const hitSeconds=poleTime(elevation,vy,min,max);
 // Once pitch stops, the remaining cutoff belongs to yaw alone. Resolve that
 // instant analytically too, so a coarse frame cannot add an extra drift tail.
 if(hitSeconds<=stopSeconds){
  const yawStop=Math.abs(vx)>CAMERA_MOTION.cutoff?Math.log(Math.abs(vx)/CAMERA_MOTION.cutoff)/damping:0;
  stopSeconds=Math.min(stopSeconds,Math.max(hitSeconds,yawStop));
 }
 const seconds=Math.min(dtMs/1000,stopSeconds),decay=Math.exp(-damping*seconds),integral=-Math.expm1(-damping*seconds)/damping;
 const pitchStopped=hitSeconds<=seconds+1e-12;
 const nextAzimuth=azimuth+vx*integral,nextElevation=pitchStopped?(vy>0?max:min):clamp(elevation+vy*integral,min,max);
 const nextVy=pitchStopped?0:vy*decay,nextVx=vx*decay;
 const done=seconds>=stopSeconds-1e-12||Math.hypot(nextVx,nextVy)<=CAMERA_MOTION.cutoff;
 return {azimuth:nextAzimuth,elevation:nextElevation,motion:done?null:{azimuth:nextVx,elevation:nextVy,elapsedMs:motion.elapsedMs+seconds*1000}};
}
