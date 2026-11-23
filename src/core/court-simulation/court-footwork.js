// Toe rise sampled in Blender from CMU Graphics Lab trial 16_35,
// frames 37–89. Retimed to a single swing and grounded at each end.
const toeRise=[0,.29,.57,.88,1,.84,.54,.22,0];
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>value*value*(3-2*value);
const mix=(a,b,u)=>a+(b-a)*u;

/** Run the P1 penetration with a planted outside shoe before the inward cut. */
export function setterPenetration(start,end,progress){
 const bend=[start[0],mix(start[1],end[1],.55)];
 const entry=Math.hypot(bend[0]-start[0],bend[1]-start[1]);
 const exit=Math.hypot(end[0]-bend[0],end[1]-bend[1]);
 const entrySteps=Math.max(2,Math.ceil(entry/.52));
 const exitSteps=Math.max(2,Math.ceil(exit/.52));
 const steps=entrySteps+exitSteps,clock=clamp(progress)*(steps+1);
 const at=beat=>{
  const inbound=beat<=entrySteps;
  const [from,to,u]=inbound?[start,bend,clamp(beat/entrySteps)]:[bend,end,clamp((beat-entrySteps)/exitSteps)];
  // Steer progressively after the plant.
  const cut=inbound?u:clamp((beat-entrySteps-.12)/(exitSteps-.12));
  const x=inbound?cut:cut*cut*(2-cut);
  return [mix(from[0],to[0],x),mix(from[1],to[1],u)];
 };
 const position=at(clock);
 const headingBeat=Math.min(clock,steps);
 const back=at(headingBeat-.05),front=at(headingBeat+.05);
 const facing=[position[0]+front[0]-back[0],position[1]+front[1]-back[1]];
 const inboundYaw=Math.atan2(bend[0]-start[0],bend[1]-start[1]);
 const outboundYaw=Math.atan2(end[0]-bend[0],end[1]-bend[1]);
 const firstSide=(end[0]<start[0]?0:1)^((entrySteps-1)%2);
 const footprint=(side,beat)=>{
  const point=at(beat),yaw=beat<=entrySteps?inboundYaw:outboundYaw,width=side===0?-.14:.14;
  return [point[0]+width*Math.cos(yaw),0,point[1]-width*Math.sin(yaw),yaw];
 };
 const feet=[footprint(0,0),footprint(1,0)];
 for(let landing=1;landing<=steps+1;landing++){
  const side=(landing-1+firstSide)%2;
  const previous=Math.max(0,landing-2);
  const swingStart=landing===1?0:previous+.72;
  if(clock<=swingStart)break;
  const u=clamp((clock-swingStart)/(landing-swingStart));
  const from=feet[side],to=footprint(side,landing);
  const opening=smooth(u);
  const turn=to[3]-from[3],yaw=from[3]+Math.atan2(Math.sin(turn),Math.cos(turn))*opening;
  feet[side]=[mix(from[0],to[0],opening),u===1?0:.19*Math.sin(Math.PI*u)**2,
    mix(from[2],to[2],opening),yaw];
 }
 const beat=clock%1;
 const flight=clock>=1&&clock<steps&&Math.floor(clock)!==entrySteps?clamp((beat-.72)/.28):0;
 return {position,facing,feet,runCycle:(clock+firstSide)%2,feetWeight:smooth(clamp(Math.min(clock,steps+1-clock)/.38)),
  jump:.045*4*flight*(1-flight)};
}

/**
 * Alternating world-space footprints along an authored floor path.
 * @param {(progress: number) => number[]} pointAt
 * @param {number} progress
 * @param {{shuffle?: boolean, facing?: number[]}} [options]
 * @return {{feet?: [[number, number, number, number], [number, number, number, number]], feetWeight?: number}}
 */
export function courtFootwork(pointAt,progress,{shuffle=false,facing}={}){
 const start=pointAt(0),end=pointAt(1);
 const distance=Math.hypot(end[0]-start[0],end[1]-start[1]);
 if(progress<=0||progress>=1||distance<.25)return {};
 const travelYaw=Math.atan2(end[0]-start[0],end[1]-start[1]);
 const yaw=shuffle&&facing?Math.atan2(facing[0]-(start[0]+end[0])*.5,facing[1]-(start[1]+end[1])*.5):travelYaw;
 const lateral=Math.sin(travelYaw-yaw);
 const sideStep=shuffle&&Math.abs(lateral)>.5;
 const leadSide=sideStep&&lateral>0?1:0;
 // Keep the planted shoe within reach of the moving pelvis until the
 // opposite shoe lands. Long strides made the leg solver squat to compensate.
 const steps=Math.max(2,Math.ceil(distance/(shuffle?.30:.38)));
 // Blend into the floor anchors before the first shoe swings, and release
 // after both shoes arrive. The support shoe has full weight in every swing.
 const transition=Math.min(.025,.14/(steps+1));
 const swings=sideStep?steps*2:steps+1;
 const clock=clamp((progress-transition)/(1-2*transition))*swings;
 function footprint(side,along){
  const [x,z]=pointAt(along),width=(side===0?-1:1)*(shuffle?.17:.15);
  return [x+width*Math.cos(yaw),0,z-width*Math.sin(yaw),yaw];
 }
 const feet=[footprint(0,0),footprint(1,0)];
 const step=Math.min(swings-1,Math.floor(clock));
 for(let i=0;i<=step;i++){
  const side=(i+leadSide)%2;
  const destination=sideStep?(Math.floor(i/2)+1)/steps:Math.min(1,(i+1)/steps);
  const from=feet[side],to=footprint(side,destination);
  const u=clamp(clock-i),blend=smooth(u);
  const sample=u*(toeRise.length-1),index=Math.floor(sample);
  const lift=mix(toeRise[index],toeRise[Math.min(index+1,toeRise.length-1)],smooth(sample-index));
  feet[side]=[mix(from[0],to[0],blend),lift*(shuffle?.08:.15),mix(from[2],to[2],blend),yaw];
 }
 return {feet,feetWeight:smooth(clamp(Math.min(progress,1-progress)/transition))};
}
