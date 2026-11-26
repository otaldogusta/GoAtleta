import { blockClipValue } from '../../../public/visual-court-3d/block-captured-clip.js';
import {BALL_RADIUS} from '../../../public/visual-court-3d/court-net.js';
import {resolveAttackFlight,sampleAttackFlight} from './attack-physics.js';
import {sampleBlockerPose,blockerContactMotion} from './blocker-motion.js';
import {indoorContactProfile} from './attack-calibration.js';
import {attackClipTiming,secondsFromTakeoffToHit} from './attack-clip-timing.js';
import {attackApproachLateral,attackApproachProgress,CAPTURED_APPROACH_METRES} from './attack-approach.js';
import {courtFootwork} from './court-footwork.js';
import {BACK_ROW_TAKEOFF_DEPTH,BACK_ROW_JUMP_ADVANCE,CHINA_JUMP_ADVANCE,isBackRowAttack,SIX_ZERO_ATTACK_PRESETS} from './attack-settings.js';
import {applySixZeroAttackCover,sixZeroAttackFormation} from './six-zero-attack.js';
const clamp=t=>Math.max(0,Math.min(1,t));
const phase=(t,a,b)=>clamp((t-a)/(b-a));
const ease=t=>t*t*(3-2*t);
function poseState(t,stages,width=.009){let i=0;while(i+1<stages.length&&t>=stages[i+1][0])i++;return {pose:stages[i][1],previousPose:stages[Math.max(0,i-1)][1],poseBlend:i?ease(phase(t,stages[i][0],stages[i][0]+width)):1};}
const mix=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*u);
const turn=(from,to,u)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*u;
const arc=(a,b,u,h)=>{const p=mix(a,b,u);p[1]+=4*h*u*(1-u);return p;};
function attackHeading(frame,base,destination,hit,set,normal){
 const dx=destination[0]-base[0],dz=destination[2]-base[2];
 const setX=hit[0]-set[0],setZ=hit[2]-set[2];
 const plantAngle=Math.hypot(setX,setZ)>1e-6?Math.atan2(normal*setZ,-normal*setX):Math.PI;
 const runAngle=Math.hypot(dx,dz)>1e-6?Math.atan2(dx,dz):plantAngle;
 return turn(runAngle,plantAngle,ease(phase(frame,117,130)));
}
export const attackPresets=[
 // Local animation targets. Arc is the lift above the straight line from
 // release to impact. Flight is the time between those two contacts.
 {name:'4',x:-3.9,z:.65,arc:1.8,flight:1.204},
 {name:'go',x:-3.9,z:.65,arc:.66,flight:.78},
 {name:'31',x:-2.25,z:.65,arc:.41,flight:.51},
 {name:'1',x:1.02,z:.65,arc:.26,flight:.29},
 {name:'2',x:1.02,z:.65,arc:.94,flight:.76},
 {name:'5',x:3.9,z:.65,arc:1.9,flight:1.204},
 {name:'red',x:3.9,z:.65,arc:.57,flight:.68},
 {name:'pipe',x:0,z:1.55,arc:.99,flight:.88},
 {name:'bic',x:0,z:1.55,arc:.50,flight:.60},
 {name:'tempo-costas',x:1.72,z:.65,arc:.30,flight:.31},
 {name:'china',x:4.928,z:.935,arc:.53,flight:.54,blockX:2.85,approachStart:[.72,0,3.03]},
 {name:'metro',x:.22,z:.65,arc:.45,flight:.45},
 {name:'fundo-1',x:3.48,z:1.55,arc:.90,flight:.83,approachStart:[3.65,0,5.1]},
];
export const attackPreset=name=>attackPresets.find(p=>p.name===String(name))||attackPresets[0];
export const attackDuration=layers=>layers.pass?4.4:2.8;
export function attackFormation(){return [[1.5,0,.8],[-3.65,0,-.25],[-2.72,0,-.25],[-4.2,0,3],[-.8,0,6.35],[-1.79,0,-.25],[0,0,-10]];}
export function attackBlockerFormation(attackX,count,depth=-.25){
 const wing=Math.abs(attackX)>2?Math.sign(attackX):0;
 const halfWidth=(count-1)*.465;
 const preferred=wing?attackX-wing*.25-wing*halfWidth:attackX;
 const center=Math.max(-4.05+halfWidth,Math.min(4.05-halfWidth,preferred));
 const destinations=Array.from({length:3},(_,n)=>[center+(n-(count-1)/2)*.93,0,depth]);
 const outside=wing<0?0:count-1;
 const middle=wing?outside-wing:destinations.slice(0,count).reduce((nearest,point,n)=>
  Math.abs(point[0])<Math.abs(destinations[nearest][0])?n:nearest,0);
 const central=count===1?0:middle;
 const nearWing=count===1?0:wing?outside:central===0?1:central-1;
 const farWing=count===3?3-central-nearWing:2;
 const wingX=(wing||Math.sign(nearWing-central)||1)*3.65;
 return [nearWing,central,farWing].map((index,slot)=>{
  const start=count===1&&slot===0?destinations[0]:[slot===1?0:slot===0?wingX:-wingX,0,depth];
  return {start,destination:slot<count?destinations[index]:start};
 });
}

function swingFootFrame(frame,foot){
 return foot===1?frame+3*Math.sin(Math.PI*phase(frame,20,32)):frame;
}
function swingFootTravel(footFrame,channel){
 const start=blockClipValue(1,channel);
 return (blockClipValue(footFrame,channel)-start)/(blockClipValue(32,channel)-start);
}
// The short Blender study is stretched to the distance of a real double block.
// Allocate time to the distance travelled as well as to the original beats:
// the crossing step must carry the hips across, not teleport them in two frames.
const closingBeats=Array.from({length:32},(_,index)=>{
 const frame=index+1;
 const hipTravel=(swingFootTravel(frame,2)+swingFootTravel(swingFootFrame(frame,1),5))*.5;
 return .48*index/31+.52*hipTravel;
});
function closingFrame(progress){
 if(progress<=0)return 1;
 const end=closingBeats.findIndex(beat=>beat>=progress);
 return end<1?32:end+phase(progress,closingBeats[end-1],closingBeats[end]);
}
export function blockClosingSchedule(travel,setContact,takeoff,seconds,groundedClose=false){
 const latestPlant=takeoff-.07*seconds;
 // Reserve a compact final crossover. Reaching across the full defensive
 // route with the grounded clip would overextend the two supported legs.
 const entryDistance=groundedClose?Math.max(0,travel-1.2):travel>3?travel-2.72:0;
 const entryTime=entryDistance?Math.max(.25,entryDistance/4)*seconds:0;
 const closeTime=Math.max(.28,(travel-entryDistance)/3.3)*seconds;
 const spareTime=Math.max(0,latestPlant-setContact-entryTime-closeTime);
 const plant=latestPlant-Math.min(.05*seconds,spareTime);
 const read=Math.min(setContact,plant-closeTime-entryTime);
 return {entryDistance,entryTime,plant,read};
}
export function closeBlock(t,actor,start,destination,setContact,takeoff,seconds,groundedClose=false){
 const dx=destination[0]-start[0],travel=Math.abs(dx);
 const impact=takeoff+.154*seconds;
 if(!travel){actor.position=destination;return 0;}
 const latestPlant=takeoff-.07*seconds;
 // A middle already in position only adjusts the base, leading with the shoe
 // on the destination side. Keep the initial formation even on a nine-cm edit.
 if(travel<=.15){
  const u=phase(t,Math.min(setContact,latestPlant-.24*seconds),latestPlant);
  actor.position=destination;
  if(t<takeoff+.08*seconds){
   actor.feet=[0,1].map(n=>{
    const foot=clamp(2*u-(n===(dx>0?0:1)?0:1));
    return [start[0]+dx*ease(foot)+(n===0?.17:-.17),.3*travel*Math.sin(Math.PI*foot),start[2],0];
   });
   actor.position=[(actor.feet[0][0]+actor.feet[1][0])/2,0,start[2]];
   actor.feetWeight=1-ease(phase(t,takeoff,takeoff+.08*seconds));
  }
  return 0;
 }
 // A far wing covers the excess with ordinary footfalls. Only the final
 // crossing and closing plant are fitted to the two-step blocking study.
 // A high set gives the middle time to brake on both feet. On a quick set
 // keep the established travel speed and take only the time available.
 const {entryDistance,entryTime,plant,read}=blockClosingSchedule(travel,setContact,takeoff,seconds,groundedClose);
 const entryEnd=read+entryTime;
 const preparation=Math.max(0,-read/seconds);
 if(t>=impact){actor.position=destination;return preparation;}
 const entryX=start[0]+Math.sign(dx)*entryDistance;
 if(entryDistance&&t<entryEnd){
  const stridePhase=phase(t,read,entryEnd),progress=ease(stridePhase);
  const floor=u=>[start[0]+(entryX-start[0])*u,start[2]];
  const [x,z]=floor(progress);
  actor.position=[x,0,z];
  const gait=courtFootwork(floor,progress,groundedClose?
   {shuffle:true,facing:[(start[0]+entryX)/2,start[2]+1],startYaw:0,endYaw:0,holdStance:true} : entryDistance<1.6?
   {shuffle:true,facing:[x,z+1]}:{travelSeconds:entryTime/seconds,stridePhase,startYaw:0,endYaw:0,holdRunStance:true});
  if(gait.feet){
   actor.feet=[gait.feet[1],gait.feet[0]];
   actor.feetWeight=groundedClose?1:gait.feetWeight;
   if(gait.plantedStance)actor.plantedStance=true;
   if(gait.travelMotion)actor.travelMotion=gait.travelMotion;
   if(gait.runCycle!==undefined){
    actor.runCycle=gait.runCycle;
    actor.runDrive=gait.runDrive;
    actor.facing=gait.facing;
    actor.jump=gait.jump;
   }
  }
  actor.blockFrame=1;
  return preparation;
 }
 const progress=phase(t,entryEnd,plant);
 const frame=closingFrame(progress);
 if(t<takeoff+.08*seconds){
  actor.feet=[0,1].map(index=>{
   const sourceFoot=dx<0?index:1-index,channel=2+3*sourceFoot;
   const footFrame=groundedClose&&sourceFoot===1&&frame>20
    ?20+12*phase(frame,26,32):swingFootFrame(frame,sourceFoot);
   const travelFraction=swingFootTravel(footFrame,channel);
   // Turn the opening shoe during its swing, hold its heading on the
   // ground, then square it to the net during the closing step.
   const heading=sourceFoot===1
    ? .96*ease(phase(frame,1,13))*(1-ease(phase(groundedClose?footFrame:frame,20,32)))
    : .14*ease(phase(frame,13,26));
   return [entryX+(destination[0]-entryX)*travelFraction+(index===0?.17:-.17),Math.max(0,blockClipValue(footFrame,channel+1)-.05),
    start[2]+blockClipValue(footFrame,channel+2),Math.sign(dx)*heading];
  });
  actor.feetWeight=1-ease(phase(t,takeoff,takeoff+.08*seconds));
 }
 actor.position=progress===1?destination:[(actor.feet[0][0]+actor.feet[1][0])/2,0,start[2]];
 actor.blockFrame=t<plant?frame:t<takeoff?32+6*phase(t,plant,takeoff):38+8*phase(t,takeoff,impact);
 actor.blockMirror=dx>0;
 return preparation;
}
let flightCacheKey='',flightCacheValue=null;
function resolvedFlight(hit,target,walls,attackArc){const key=JSON.stringify([hit,target,walls,attackArc]);if(key!==flightCacheKey){flightCacheValue=resolveAttackFlight({hit,target,walls,net:true,profile:indoorContactProfile,attackArc});flightCacheKey=key;}return flightCacheValue;}
// Reconstructed from the nine visible Indoor presets; timings remain visual estimates.
function sampleCore(t,{layers={},bases=attackFormation(),preset='4',blockers=1,x,targetOverride=null,hitOverride=null,setHeight=null,attackArc=null,passHeight=2.1,blockAngle=0,blockAngles={},manualBlockers=[],attackHand='right',system}={}){
 const blockerTime=t;
 const config=attackPreset(preset),blockX=x??config.blockX??config.x,handSide=attackHand==='left'?-1:1;x=hitOverride?.[0]??x??config.x;const z=hitOverride?.[1]??config.z;
 t=clamp(t);const lead=layers.pass?1.6/4.4:0,u=(t-lead)/(1-lead);
 const target=targetOverride?[targetOverride[0],.12,targetOverride[1]]:[blockX>0?-2.38:2.38,.12,-4.95];
 // Aiming changes the outgoing shot, not the striking hand or contact anchor.
 const setter=bases[0],hit=[x+handSide*.13,3,z-.1],set=[setter[0]-.22,2.28,setter[2]-.08];
 const actors=bases.map(p=>({position:[...p],role:'setter',pose:'ready',jump:0,facing:[x,z],side:true}));
 const s=actors[0];s.jump=.23*Math.sin(Math.PI*phase(u,.13,.25));
 if(config.name==='tempo-costas'||config.name==='china'||config.name==='fundo-1')s.facing=[setter[0]-1,setter[2]];
 Object.assign(s,poseState(u,[[-1,'ready'],[-.02,'load'],[.13,'rise'],[.17,'contact'],[.195,'follow'],[.265,'ready']]));
 const duration=attackDuration(layers),seconds=1/duration;
 const setContact=lead+(1-lead)*.19,contact=setContact+config.flight*seconds;
 const contactPhase=.19+config.flight/2.8;
 const setArc=setHeight??config.arc;
 // Follow the editable set when its apex is within a playable jump window.
 // Use seconds so adding a pass or a rebound cannot accelerate the approach.
 const takeoffLead=secondsFromTakeoffToHit(setContact,contact,hit[1]-set[1],setArc,duration,config.flight<=.31?.32:.42);
 const jumpStart=contact-takeoffLead*seconds,jumpPeak=contact-.04*seconds,jumpEnd=contact+.44*seconds;
 const backRow=isBackRowAttack(config.name),slide=config.name==='china';
 const takeoff=[slide?x-CHINA_JUMP_ADVANCE:x,0,backRow?Math.max(BACK_ROW_TAKEOFF_DEPTH,z+BACK_ROW_JUMP_ADVANCE):z];
 const runStart=backRow?[bases[3][0],0,Math.max(bases[3][2],takeoff[2]+.55)]:bases[3];
 const runDistance=Math.hypot(takeoff[0]-runStart[0],takeoff[2]-runStart[2]);
 const normalApproachStart=lead+(1-lead)*.18;
 const runTime=Math.max(.43,runDistance/4);
 const approachStart=Math.max(0,Math.min(normalApproachStart,jumpStart-runTime*seconds)-Math.max(0,runDistance-2.65)*.16*seconds);
 const plantStart=jumpStart-.11*seconds,poseTransition=.04*seconds;
 const bodyScale=.9,captureMetres=CAPTURED_APPROACH_METRES*bodyScale;
 // Short edits fit the recorded stride. Once there is space for a real
 // preparatory step, gradually assign the surplus to running feet. At
 // full weight the final approach has the exact length it had in Blender.
 const surplus=Math.max(0,runDistance-captureMetres);
 const extraSteps=ease(phase(surplus,.25,.65));
 const leadDistance=surplus*extraSteps;
 const leadFraction=runDistance>0?leadDistance/runDistance:0;
 const capturedStart=approachStart+(jumpStart-approachStart)*leadFraction;
 const a=actors[3];a.role='attacker';
 Object.assign(a,attackClipTiming(t*duration,capturedStart*duration,jumpStart*duration,contact*duration,jumpEnd*duration,.22));
 const progress=attackApproachProgress(a.attackFrame);
 let leadProgress=0;
 a.attackLeadIn=0;
 if(leadDistance>0){
  const fullLeadFraction=surplus/runDistance;
  const leadEnd=Math.max(approachStart+(jumpStart-approachStart)*fullLeadFraction,Math.min(.22*seconds,jumpStart*.2));
  leadProgress=ease(phase(t,approachStart,leadEnd));
  const leadPath=u=>[
   runStart[0]+(takeoff[0]-runStart[0])*fullLeadFraction*u,
   runStart[2]+(takeoff[2]-runStart[2])*fullLeadFraction*u,
  ];
  const gait=courtFootwork(leadPath,leadProgress);
  if(gait.feet){
   // Release the extra steps across the last half metre as the recorded
   // starting pose takes over. A short adjustment blends in proportionally.
   const blendSpan=Math.min(.35,.50/surplus);
   a.attackLeadIn=ease(clamp(Math.min(leadProgress,1-leadProgress)/blendSpan))*extraSteps;
   a.feet=gait.feet;
   a.feetWeight=gait.feetWeight;
  }
 }
 a.position=mix(runStart,takeoff,leadFraction*leadProgress+(1-leadFraction)*progress);
 if(runDistance>1e-6){
  const sway=-handSide*bodyScale*attackApproachLateral(a.attackFrame,progress);
  a.position[0]+=sway*(takeoff[2]-runStart[2])/runDistance;
  a.position[2]-=sway*(takeoff[0]-runStart[0])/runDistance;
 }
 a.attackStrideScale=(runDistance-leadDistance)/captureMetres;
 a.attackSlide=slide;
 if(backRow)a.attackTakeoffDepth=takeoff[2];
 if(backRow&&t>jumpStart){
  const travel=takeoff[2]-z;
  // Carry the forward momentum through contact, then slow before landing.
  const forward=t<=contact?phase(t,jumpStart,contact):1+.22*(1-(1-phase(t,contact,jumpEnd))**2);
  a.position[2]-=travel*forward;
 }
 if(slide)a.position[0]+=CHINA_JUMP_ADVANCE*(phase(t,jumpStart,contact)+.4*ease(phase(t,contact,jumpEnd)));
 const rise=phase(t,jumpStart,jumpPeak),fall=phase(t,jumpPeak,jumpEnd);
 a.jump=.9*(t<jumpPeak?1-(1-rise)**2:1-fall*fall);
 a.side=false;a.mirror=handSide<0;
 // Retain the authored side of the set normal when the contact handle crosses the setter.
 const normal=config.x>1.5-.22?1:-1;
 const heading=attackHeading(a.attackFrame,runStart,takeoff,hit,set,normal);
 a.facing=[a.position[0]+Math.sin(heading),a.position[2]+Math.cos(heading)];
 const swingStart=contact-.10*seconds,followStart=contact+.045*seconds;
 Object.assign(a,poseState(t,[[0,'ready'],[approachStart,'approach'],[plantStart,'plant'],[jumpStart,'launch'],
  [jumpStart+.13*seconds,'draw'],[swingStart,'contact'],[followStart,'follow'],
  [jumpEnd-.04*seconds,'land'],[jumpEnd+.20*seconds,'ready']],poseTransition));
 if(a.pose==='contact')a.poseBlend=ease(phase(t,swingStart,contact));
 if(a.pose==='approach'&&t>=approachStart+poseTransition){
  // Both poses have the same silhouette key. Only the articulated 3D rig
  // interprets the blend as progress through the alternating footfalls.
  a.previousPose='approach';
  a.poseBlend=phase(t,approachStart+poseTransition,plantStart);
 }
 const count=Math.max(1,Math.min(3,blockers)),blockIds=[1,2,5];
 // Moving the attack contact edits the hitter and ball; the chosen preset
 // anchors automatic blockers until the preset or their own positions change.
 // Leave room for the forearms and fingers during the rise beside the tape.
 const blockerFormation=attackBlockerFormation(blockX,count,system==='6-0'?-.55:undefined);
 const contacts=[];
 let blockPreparation=0;
 for(const [n,i] of blockIds.entries()){
  const b=actors[i],manual=manualBlockers.includes(i);
  const {start,destination}=manual?{start:bases[i],destination:bases[i]}:blockerFormation[n];
  const angle=blockAngles[i]??blockAngle;
  if(n<count&&layers.block)contacts.push({x:destination[0],wall:{...blockerContactMotion(destination,angle),angle}});
  Object.assign(b,sampleBlockerPose((t-contact)*attackDuration(layers)));
  b.role='blocker';b.pose='block';b.side=false;b.facing=[x,z];b.handAngle=angle;
  const preparation=closeBlock(blockerTime,b,start,destination,setContact,contact-.154*seconds,seconds);
  if(n<count&&layers.block)blockPreparation=Math.max(blockPreparation,preparation);
 }

 const walls=contacts.sort((a,b)=>a.x-b.x).map(contact=>contact.wall);
 const flight=layers.attack?resolvedFlight(hit,target,walls,attackArc):null;
 const p=bases[4],passContact=layers.pass?.118:null,passHand=[p[0]-.48,.75,p[2]-.28];
 const receiver=actors[4];receiver.role='passer';receiver.facing=[p[0]-.75,p[2]-1];receiver.side=false;
 if(layers.pass){
  Object.assign(receiver,poseState(t,[[0,'ready'],[.025,'load'],[.103,'contact'],[.124,'follow'],[.192,'ready']],.007));
  receiver.side=t>=.025&&t<.192;
  if(t>=.025&&t<.032)receiver.previousSide=false;
  if(t>=.192&&t<.199)receiver.previousSide=true;
 }else receiver.pose='ready';
 let ball;
 if(layers.pass&&t<passContact){
  const incoming=phase(t,0,passContact),origin=[p[0]-.65,2.45,p[2]-1.65];
  ball=mix(origin,passHand,incoming);ball[1]=origin[1]+(passHand[1]-origin[1])*incoming*incoming;
 }
 else if(u<.19){const passPhase=phase(t,passContact??0,lead+(1-lead)*.19);ball=layers.pass?arc(passHand,set,passPhase,passHeight):arc([setter[0],1.85,setter[2]],set,phase(u,0,.19),.08);}
 else if(t<contact)ball=arc(set,hit,phase(t,setContact,contact),setArc);
 else ball=layers.attack?sampleAttackFlight(flight,phase(u,contactPhase,1)):arc(hit,[x,BALL_RADIUS,z],phase(u,contactPhase,1),0);
 return {actors,ball,flight,walls,blockPreparation,setHand:set,setDestination:hit,attackTarget:target,...(backRow?{backRowApproach:[runStart,takeoff]}:{}),...(flight?{attackArc:flight.attackArc,attackGuide:flight.attackGuide}:{}),handSide,setArc,passArc:passHeight,passContact,passHand:layers.pass?passHand:null,visible:true,duration,setContact,attackContact:contact};
}

// Keep approach/contact clocks fixed in seconds. A longer rebound extends the
// replay; a short flight can land while the players finish their recovery.
export function sampleAttack(t,options={}){
 const sixZero=options.system==='6-0';
 if(sixZero){
  const preset=SIX_ZERO_ATTACK_PRESETS.includes(options.preset)?options.preset:'4';
  options={...options,preset,bases:options.bases??sixZeroAttackFormation(preset,options.rotation??0,attackFormation())};
 }
 const timing=sampleCore(0,options),baseDuration=timing.duration,hitTime=timing.attackContact*baseDuration;
 // A no-pass quick can start too close to contact even with an early read.
 // Give the blockers their missing lead time while all ball events retain
 // their existing spacing in seconds, including rebounds and scrubbing.
 const preRoll=timing.blockPreparation;
 const duration=preRoll+Math.max(baseDuration,hitTime+(timing.flight?.landingTime??timing.flight?.duration??0)),seconds=clamp(t)*duration-preRoll;
 const {blockPreparation,...frame}=sampleCore(seconds/baseDuration,options);
 if(sixZero)applySixZeroAttackCover(frame.actors,options.bases,options.preset,
  frame.flight?.hit??[options.hitOverride?.[0]??attackPreset(options.preset).x,0,options.hitOverride?.[1]??attackPreset(options.preset).z],
  seconds,baseDuration,options.layers?.pass);
 if(frame.flight&&seconds>=hitTime)frame.ball=sampleAttackFlight(frame.flight,(seconds-hitTime)/frame.flight.duration);
 const scale=baseDuration/duration;
 const offset=preRoll/duration;
 return {...frame,duration,setContact:offset+frame.setContact*scale,attackContact:offset+frame.attackContact*scale,passContact:frame.passContact==null?null:offset+frame.passContact*scale};
}
