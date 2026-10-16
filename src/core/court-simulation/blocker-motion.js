// Shared local blocker timing. Time is seconds relative to the attack contact;
// the visual rig and the collision surface use this same pose clock.
const clamp=value=>Math.max(0,Math.min(1,value));
const ease=value=>value*value*(3-2*value);
const finiteTime=seconds=>Number.isFinite(seconds)?seconds:0;
const CONTACT_END=.484,CONTACT_STEP=.022;

export function sampleBlockerPose(secondsSinceAttack){
 const seconds=finiteTime(secondsSinceAttack);
 const rise=clamp((seconds+.154)/.176),fall=clamp((seconds-.264)/.22);
 return {
  jump:.85*Math.sin(rise*Math.PI/2)*Math.cos(fall*Math.PI/2),
  crouch:.26*Math.sin(Math.PI*clamp((seconds+.33)/.176)),
  extension:ease(rise)*(1-ease(fall)),
 };
}

// Centre of the palms/fingers band in the existing rig, before camera facing.
// Group translation (jump) is outside the body's .95 scale.
export function blockerHandHeight(secondsSinceAttack){
 const {jump,crouch,extension}=sampleBlockerPose(secondsSinceAttack);
 return jump+.95*(1.43-crouch+.12+.51*extension+.035);
}

/**
 * A moving hand band for continuous collision detection. Each segment's centre
 * is its position at start; velocity is metres/second until end. Horizontal
 * span remains the existing pair-of-hands span, while the shorter vertical band
 * follows the visible palms instead of leaving a raised wall during landing.
 */
export function blockerContactMotion(destination,angle=0){
 const x=Number.isFinite(destination?.[0])?destination[0]:0;
 const z=Number.isFinite(destination?.[2])?destination[2]:0;
 const radians=(Number.isFinite(angle)?angle:0)*Math.PI/180;
 const centerAt=seconds=>{const reach=.95*(.04+.40*sampleBlockerPose(seconds).extension);return [x+Math.sin(radians)*reach,blockerHandHeight(seconds),z+Math.cos(radians)*reach];};
 const knots=Array.from({length:23},(_,index)=>index===22?CONTACT_END:index*CONTACT_STEP);
 const motion=knots.slice(0,-1).map((start,index)=>{
  const end=knots[index+1],center=centerAt(start),next=centerAt(end);
  return {start,end,center,velocity:next.map((value,i)=>(value-center[i])/(end-start))};
 });
 return {center:centerAt(0),width:.86,height:.30,motion,activeFrom:0,activeUntil:CONTACT_END};
}
