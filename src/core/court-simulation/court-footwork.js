// Toe rise sampled in Blender from CMU Graphics Lab trial 16_35,
// frames 37–89. Retimed to a single swing and grounded at each end.
const toeRise=[0,.29,.57,.88,1,.84,.54,.22,0];
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>value*value*(3-2*value);
const mix=(a,b,u)=>a+(b-a)*u;
const turnTowards=(from,to,weight)=>{
 const turn=to-from;
 return from+Math.atan2(Math.sin(turn),Math.cos(turn))*weight;
};
const orientForArrival=(yaw,endYaw,beat,steps)=>turnTowards(yaw,endYaw,smooth(clamp((beat-steps+1.5)/1.5)));

/** Run the P1 penetration with a planted outside shoe before the inward cut. */
export function setterPenetration(start,end,progress,startYaw,arrivalYaw=-Math.PI/2,travelSeconds){
 const bend=[start[0],mix(start[1],end[1],.55)];
 const entry=Math.hypot(bend[0]-start[0],bend[1]-start[1]);
 const exit=Math.hypot(end[0]-bend[0],end[1]-bend[1]);
 const entrySteps=Math.max(2,Math.ceil(entry/1.2));
 const exitSteps=Math.max(2,Math.ceil(exit/1.2));
 const steps=entrySteps+exitSteps,p=clamp(progress),cadenceAngle=2*Math.PI*p;
 // Allow time to push out and gather; turnover is fastest in mid-run.
 const clock=(p-.13*Math.sin(cadenceAngle)/(2*Math.PI))*(steps+1);
 const exitDuration=exitSteps+.55,brake=1.65;
 const cutSpeed=Math.abs(end[1]-bend[1])/(exitDuration-.5*brake);
 const entryBrake=.8,cruise=(entry-.5*entryBrake*cutSpeed)/(entrySteps-.5-.5*entryBrake);
 const at=beat=>{
  if(beat<=entrySteps){
   // Build speed over the first push, then lengthen the following strides.
   const t=Math.max(0,beat),load=Math.max(0,t-entrySteps+entryBrake);
   const distance=cruise*(t<1?t*t*.5:t-.5)+.5*(cutSpeed-cruise)*load*load/entryBrake;
   return [start[0],mix(start[1],bend[1],entry?clamp(distance/entry):0)];
  }
  // Keep carrying the hips forward during the gathering step, braking
  // over the last two contacts instead of running in place at the target.
  const elapsed=Math.min(exitDuration,beat-entrySteps);
  const braking=Math.max(0,elapsed-exitDuration+brake);
  const u=(elapsed-.5*braking*braking/brake)/(exitDuration-.5*brake);
  const plant=.12/(exitDuration-.5*brake);
  const cut=clamp((u-plant)/(1-plant));
  return [mix(bend[0],end[0],cut*cut*(2-cut)),mix(bend[1],end[1],u)];
 };
 const position=at(clock);
 const inboundYaw=Math.atan2(bend[0]-start[0],bend[1]-start[1]);
 // The last footfalls brake and open the chest toward the pass.
 const headingAt=beat=>{
  const sample=Math.min(beat,steps+.5);
  const back=at(sample-.05),front=at(sample+.05);
  const dx=front[0]-back[0],dz=front[1]-back[1];
  const yaw=Math.hypot(dx,dz)>1e-8?Math.atan2(dx,dz):inboundYaw;
  const departure=turnTowards(startYaw??inboundYaw,yaw,smooth(clamp(beat)));
  return turnTowards(departure,arrivalYaw,smooth(clamp((beat-steps+2.25)/2.25)));
 };
 const heading=headingAt(clock);
 const facing=[position[0]+Math.sin(heading),position[1]+Math.cos(heading)];
 const firstSide=(end[0]<start[0]?0:1)^((entrySteps-1)%2);
 const footprint=(side,beat)=>{
  // Touch down ahead of the hips and pass over the support during stance.
  const lead=beat===entrySteps?.45:.32;
  const point=at(beat>=steps?steps+1:beat>0?beat+lead:beat),yaw=headingAt(beat),width=side===0?-.14:.14;
  return [point[0]+width*Math.cos(yaw),0,point[1]-width*Math.sin(yaw),yaw];
 };
 const gait=runningFeet(clock,steps,footprint,firstSide,entrySteps,.38);
 gait.feetWeight=smooth(clamp(Math.min(clock/.9,(steps+1-clock)/1.45)));
 const before=at(clock-.02),after=at(clock+.02);
 const seconds=travelSeconds??Math.max(.5,(entry+exit)/3.4);
 const beatsPerSecond=(steps+1)*(1-.13*Math.cos(cadenceAngle))/seconds;
 const speed=Math.hypot(after[0]-before[0],after[1]-before[1])*beatsPerSecond/.04;
 return {position,facing,runDrive:smooth(clamp((speed-.25)/4.25)),...gait};
}

/** Pivot with two separate placements, optionally gathering onto a nearby mark. */
export function setterSettingBase(position,readYaw,progress,targetYaw=-Math.PI/2,start=position){
 const u=clamp(progress);
 const delta=turnTowards(readYaw,targetYaw,1)-readYaw;
 const heading=readYaw+delta*smooth(u);
 // A wide turn needs an intermediate base; a single 150° step would
 // land beside the other shoe before that supporting foot can move.
 const stages=Math.max(1,Math.ceil(Math.abs(delta)/(Math.PI/2)));
 const stage=Math.min(stages-1,Math.floor(u*stages)),within=u*stages-stage;
 const feet=[0,1].map(side=>{
  const first=(delta<0?0:1)===side;
  const swing=clamp(2*within-(first?0:1));
  const step=(stage+smooth(swing))/stages,yaw=readYaw+delta*step,width=side===0?-.14:.14;
  const lift=swing>0&&swing<1?.07*Math.sin(Math.PI*swing)**2:0;
  return [mix(start[0],position[0],step)+width*Math.cos(yaw),lift,
   mix(start[1],position[1],step)-width*Math.sin(yaw),yaw];
 });
 return {feet,facing:[mix(start[0],position[0],smooth(u))+Math.sin(heading),
  mix(start[1],position[1],smooth(u))+Math.cos(heading)]};
}

// Both the curved penetration and a straight sprint sample the same footfalls
// and CMU phase. The support shoe stays fixed until push-off, with a short
// flight before the next touchdown. The outside shoe has a longer contact during a cut.
function runningFeet(clock,steps,footprint,firstSide,cutBeat=-1,startingPush=.72,firstLanding=1){
 const feet=[footprint(0,0),footprint(1,0)];
 const stance=.61;
 // A long drawn route can seek directly to the last touchdown of each foot.
 for(let landing=Math.max(1,firstLanding-2);landing<firstLanding;landing++){
  const side=(landing-1+firstSide)%2;
  feet[side]=footprint(side,landing);
 }
 for(let landing=firstLanding;landing<=steps+1;landing++){
  const side=(landing-1+firstSide)%2;
  const previous=Math.max(0,landing-2);
  const swingStart=landing===1?0:landing===2?startingPush:previous+(previous===cutBeat?.78:stance);
  if(clock<=swingStart)break;
  const u=clamp((clock-swingStart)/(landing-swingStart));
  const from=feet[side],to=footprint(side,landing);
  const opening=smooth(u);
  const turn=to[3]-from[3],yaw=from[3]+Math.atan2(Math.sin(turn),Math.cos(turn))*opening;
  const swing=u*(1.36-.36*u);
  const clearance=Math.min(.22,.13*Math.hypot(to[0]-from[0],to[2]-from[2]));
  feet[side]=[mix(from[0],to[0],opening),u===1?0:clearance*Math.sin(Math.PI*swing)**2,
    mix(from[2],to[2],opening),yaw];
 }
 const beat=clock%1;
 const release=Math.floor(clock)===cutBeat?.78:stance;
 const flight=clock<1&&startingPush<.72?clamp((clock-startingPush)/(1-startingPush)):
  clock>=1&&clock<steps?clamp((beat-release)/(1-release)):0;
 return {feet,runCycle:(clock+firstSide)%2,feetWeight:smooth(clamp(Math.min(clock,steps+1-clock)/.38)),
  jump:.045*4*flight*(1-flight)};
}

/**
 * Alternating world-space footprints along an authored floor path.
 * @param {(progress: number) => number[]} pointAt
 * @param {number} progress
 * @param {{shuffle?: boolean, facing?: number[], travelSeconds?: number, stridePhase?: number, phasePerSecond?: number, startYaw?: number, endYaw?: number, endStagger?: number, endSpread?: number, holdStance?: boolean, holdRunStance?: boolean, startFromReady?: boolean, initialFeet?: number[][], route?: {length: number, headingAt: (fraction: number) => number, speed: number, running: boolean}}} [options]
 * @returns {{feet?: [[number, number, number, number], [number, number, number, number]], feetWeight?: number, runCycle?: number, runDrive?: number, plantedStance?: boolean, travelMotion?: {kind: "walk" | "shuffle", phase: number, direction: 1 | -1}, jump?: number, facing?: [number, number]}}
 */
export function courtFootwork(pointAt,progress,{shuffle=false,facing,travelSeconds,stridePhase,phasePerSecond,startYaw,endYaw,endStagger=0,endSpread=0,holdStance=false,holdRunStance=false,startFromReady=false,initialFeet,route}={}){
 const start=pointAt(0),end=pointAt(1);
 const distance=route?.length??Math.hypot(end[0]-start[0],end[1]-start[1]);
 const speed=travelSeconds>0?distance/travelSeconds:0;
 const running=route?.running??(shuffle?distance>=2&&speed>=2.2:distance>=1.6&&speed>=1.7);
 const plantRun=running&&holdRunStance;
 if(!holdStance&&!plantRun&&(progress<=0||progress>=1||distance<.25))return {};
 const travelYaw=Math.atan2(end[0]-start[0],end[1]-start[1]);
 const yaw=shuffle&&facing?Math.atan2(facing[0]-(start[0]+end[0])*.5,facing[1]-(start[1]+end[1])*.5):travelYaw;
 const lateral=Math.sin(travelYaw-yaw);
 const pivot=endStagger!==0&&distance<.25;
 const sideStep=!pivot&&shuffle&&Math.abs(lateral)>.5;
 const leadSide=sideStep&&lateral>0?1:0;
 // A lateral beat opens and gathers both shoes. Widen the opening for a
 // quick adjustment; use a crossover run for longer, urgent coverage.
 const lateralStride=Math.max(.45,Math.min(.70,speed*.47));
 const steps=Math.max(sideStep||pivot?1:2,Math.ceil(distance/(sideStep?lateralStride:.39)));
 // Blend into the floor anchors before the first shoe swings, and release
 // after both shoes arrive. The support shoe has full weight in every swing.
 const transition=Math.min(.025,.14/(steps+1));
 const swings=sideStep?steps*2:steps+1;
 const clock=clamp((progress-transition)/(1-2*transition))*swings;
 const initialYaw=startYaw??yaw;
 const leaveStance=(target,beat)=>turnTowards(initialYaw,target,smooth(clamp(beat/1.25)));
 const halfWidth=route ? .16 : (shuffle||running ? .17 : .15);
 function footprint(side,along,heading=initialYaw){
  if(along===0&&initialFeet)return initialFeet[side];
  if(startFromReady&&along===0){
   const sign=side===0?-1:1,across=sign*.28,forward=.036;
   return [start[0]+across*Math.cos(initialYaw)+forward*Math.sin(initialYaw),0,
    start[1]-across*Math.sin(initialYaw)+forward*Math.cos(initialYaw),initialYaw+sign*.166];
  }
  const [x,z]=pointAt(along),width=(side===0?-1:1)*(halfWidth+endSpread*smooth(clamp((along-.65)/.35)));
  if(route)heading=route.headingAt(along);
  // Advance the lead shoe on its landing; a planted shoe never moves to adopt the stagger.
  const forward=(side===0?.5:-.5)*endStagger*smooth(clamp((along-.65)/.35));
  return [x+width*Math.cos(heading)+forward*Math.sin(heading),0,z-width*Math.sin(heading)+forward*Math.cos(heading),heading];
 }
 if(progress<=0||progress>=1||(!pivot&&distance<1e-5)){
  const along=clamp(progress),heading=along>=1?(endYaw??yaw):initialYaw;
  return {feet:[footprint(0,along,heading),footprint(1,along,heading)],feetWeight:0,...(plantRun?{plantedStance:true}:{})};
 }
 if(running){
  const strides=Math.ceil(distance/Math.max(.59,Math.min(.88,speed/3.2)));
  // Footfalls keep time as the hips accelerate. This gives short push-off
  // and braking steps, and lets the two longest steps fall in mid-run.
  const time=clamp(stridePhase??progress);
  // A hand-drawn root travels linearly in each segment. Gather the last
  // shoe over the final third of a stride as the hips arrive at the mark.
  const runBeats=route?strides+.34:strides+1,travelBeat=time*runBeats;
  const clock=route&&travelBeat>strides?strides+(travelBeat-strides)/.34:travelBeat;
  const heading=beat=>orientForArrival(leaveStance(travelYaw,beat),endYaw??yaw,beat,strides);
  const contact=(side,beat)=>{
   const landing=beat===0?0:beat>=strides?1:(beat+.31)/runBeats;
   return footprint(side,stridePhase===undefined?landing:smooth(landing),heading(beat));
  };
  const [x,z]=pointAt(progress),angle=route?.headingAt(progress)??heading(clock);
  const instantSpeed=route?.speed??(stridePhase===undefined?speed:distance*6*time*(1-time)*(phasePerSecond??1/travelSeconds));
  const gait=runningFeet(clock,strides,contact,0,-1,.38,route?Math.max(1,Math.floor(clock)-1):1);
  gait.feetWeight=smooth(clamp(Math.min(clock/.9,(strides+1-clock)/1.45)));
  return {...gait,runDrive:smooth(clamp((instantSpeed-.25)/4.25)),facing:[x+Math.sin(angle),z+Math.cos(angle)],
   ...(plantRun?{plantedStance:true}:{})};
 }
 const heading=beat=>endStagger!==0&&steps===1?turnTowards(initialYaw,endYaw??yaw,smooth(clamp(beat))):
  orientForArrival(leaveStance(yaw,beat),shuffle&&!holdStance?yaw:endYaw??yaw,beat,steps);
 const feet=[footprint(0,0),footprint(1,0)];
 const step=Math.min(swings-1,Math.floor(clock));
 for(let i=0;i<=step;i++){
  const side=(i+leadSide)%2;
  const destination=sideStep?(Math.floor(i/2)+1)/steps:Math.min(1,(i+1)/steps);
  const from=feet[side],to=footprint(side,destination,heading(i+1));
  const u=clamp(clock-i),blend=smooth(u);
  const sample=u*(toeRise.length-1),index=Math.floor(sample);
  const lift=mix(toeRise[index],toeRise[Math.min(index+1,toeRise.length-1)],smooth(sample-index));
  const turn=to[3]-from[3],footYaw=from[3]+Math.atan2(Math.sin(turn),Math.cos(turn))*blend;
  feet[side]=[mix(from[0],to[0],blend),lift*(pivot?.06:sideStep?.07:.11),mix(from[2],to[2],blend),footYaw];
 }
 const direction=sideStep?(lateral>0?1:-1):(Math.cos(travelYaw-yaw)<0?-1:1);
 // Both Blender clips start with the left shoe swinging. A rightward shuffle
 // mirrors the whole clip. A retreat plays the same walk backwards within its
 // two alternating contacts, keeping the chest toward the ball.
 const phase=(!sideStep&&direction<0?3-clock%2:clock)%2;
 const [x,z]=pointAt(progress),angle=route?.headingAt(progress)??heading(clock);
 return {feet,feetWeight:smooth(clamp(Math.min(progress,1-progress)/transition)),
  facing:[x+Math.sin(angle),z+Math.cos(angle)],travelMotion:{kind:sideStep?'shuffle':'walk',direction,phase}};
}
