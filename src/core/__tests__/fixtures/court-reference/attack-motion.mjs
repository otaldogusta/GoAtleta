import {resolveAttackFlight,sampleAttackFlight} from './attack-physics.mjs';
import {sampleBlockerPose,blockerContactMotion} from './blocker-motion.mjs';
import {indoorContactProfile} from './attack-calibration.mjs';
const clamp=t=>Math.max(0,Math.min(1,t));
const phase=(t,a,b)=>clamp((t-a)/(b-a));
const ease=t=>t*t*(3-2*t);
function poseState(t,stages,width=.009){let i=0;while(i+1<stages.length&&t>=stages[i+1][0])i++;return {pose:stages[i][1],previousPose:stages[Math.max(0,i-1)][1],poseBlend:i?ease(phase(t,stages[i][0],stages[i][0]+width)):1};}
const mix=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*u);
const arc=(a,b,u,h)=>{const p=mix(a,b,u);p[1]+=4*h*u*(1-u);return p;};
export const attackPresets=[
 {name:'4',x:-3.9,z:.65,arc:1.8,contact:.62},
 {name:'go',x:-3.9,z:.65,arc:1.8,contact:.60},
 {name:'31',x:-2.25,z:.65,arc:.35,contact:.57},
 {name:'1',x:1.02,z:.65,arc:.22,contact:.56},
 {name:'2',x:1.02,z:.65,arc:1.1,contact:.58},
 {name:'5',x:3.9,z:.65,arc:1.9,contact:.62},
 {name:'red',x:3.9,z:.65,arc:.65,contact:.57},
 {name:'pipe',x:0,z:1.55,arc:1.7,contact:.62},
 {name:'bic',x:0,z:1.55,arc:.9,contact:.57},
];
export const attackPreset=name=>attackPresets.find(p=>p.name===String(name))||attackPresets[0];
export const attackDuration=layers=>layers.pass?4.4:2.8;
export function attackFormation(){return [[1.5,0,.8],[-3.65,0,-.25],[-2.72,0,-.25],[-3,0,3],[-.8,0,6.35],[-1.79,0,-.25],[0,0,-10]];}
let flightCacheKey='',flightCacheValue=null;
function resolvedFlight(hit,target,walls){const key=JSON.stringify([hit,target,walls]);if(key!==flightCacheKey){flightCacheValue=resolveAttackFlight({hit,target,walls,net:true,profile:indoorContactProfile});flightCacheKey=key;}return flightCacheValue;}
// Reconstructed from the nine visible Indoor presets; timings remain visual estimates.
function sampleCore(t,{layers={},bases=attackFormation(),preset='4',blockers=1,x,targetOverride=null,hitOverride=null,setHeight=null,passHeight=2.1,blockAngle=0,blockAngles={},manualBlockers=[]}={}){
 const config=attackPreset(preset),blockX=x??config.x,handSide=blockX>0?-1:1;x=hitOverride?.[0]??x??config.x;const z=hitOverride?.[1]??config.z;
 t=clamp(t);const lead=layers.pass?1.6/4.4:0,u=(t-lead)/(1-lead);
 const motion=u<.19?u:.19+(u-.19)*(.62-.19)/(config.contact-.19);
 const target=targetOverride?[targetOverride[0],.12,targetOverride[1]]:[blockX>0?-2.38:2.38,.12,-4.95];
 // Aiming changes the outgoing shot, not the striking hand or contact anchor.
 const setter=bases[0],hit=[x+handSide*.13,3,z-.1],set=[setter[0]-.22,2.28,setter[2]-.08];
 const actors=bases.map(p=>({position:[...p],role:'setter',pose:'ready',jump:0,facing:[x,z],side:true}));
 const s=actors[0];s.jump=.23*Math.sin(Math.PI*phase(u,.13,.25));
 Object.assign(s,poseState(u,[[-1,'ready'],[-.02,'load'],[.13,'rise'],[.17,'contact'],[.195,'follow'],[.265,'ready']]));
 const a=actors[3];a.role='attacker';a.position=mix(bases[3],[x,0,z],ease(phase(motion,.18,.56)));
 a.pose=motion<.12?'ready':motion<.47?'approach':motion<.54?'plant':motion<.60?'draw':motion<.645?'contact':motion<.75?'follow':motion<.89?'land':'ready';
 a.jump=.9*Math.sin(Math.PI*phase(motion,.51,.82));a.facing=[target[0],target[2]];a.side=false;a.mirror=handSide<0;
 const contact=lead+(1-lead)*config.contact,clockScale=4.4/attackDuration(layers);
 // Reference checkpoints at 68/72/74/78/82/86% anchor takeoff, extension and landing.
 // Preserve the physical jump duration when the pass lead-in is disabled.
 const jumpStart=contact-.053*clockScale,jumpPeak=contact-.012*clockScale,jumpEnd=contact+.11*clockScale;
 a.jump=t<jumpPeak?.9*Math.sin(Math.PI/2*phase(t,jumpStart,jumpPeak)):.9*Math.cos(Math.PI/2*phase(t,jumpPeak,jumpEnd));
 Object.assign(a,poseState(t,[[0,'ready'],[lead+(1-lead)*.18,'approach'],[jumpStart-.025*clockScale,'plant'],[jumpStart,'draw'],[contact-.015*clockScale,'contact'],[contact+.022*clockScale,'follow'],[jumpEnd,'land'],[jumpEnd+.055*clockScale,'ready']],.009*clockScale));
 if(t<jumpStart){a.facing=[x,z];if(t<lead+(1-lead)*.12)a.facing=[0,-9];}
 const count=Math.max(1,Math.min(3,blockers)),blockIds=[1,2,5];
 // Moving the attack contact edits the hitter and ball; the chosen preset
 // anchors automatic blockers until the preset or their own positions change.
 const preferred=blockX<-2?blockX+.25+(count-1)*.465:blockX>2?blockX-.25-(count-1)*.465:blockX;
 const center=Math.max(-4.05+(count-1)*.465,Math.min(4.05-(count-1)*.465,preferred));
 const walls=[];
 for(const [n,i] of blockIds.entries()){
  const b=actors[i],destination=manualBlockers.includes(i)?[...bases[i]]:[center+(n-(count-1)/2)*.93,0,-.25];
  const angle=blockAngles[i]??blockAngle;
  if(n<count&&layers.block)walls.push({...blockerContactMotion(destination,angle),angle});
  b.position=mix(bases[i],destination,ease(phase(t,lead+(1-lead)*.24,contact-.07*clockScale)));
  Object.assign(b,sampleBlockerPose((t-contact)*attackDuration(layers)));
  b.role='blocker';b.pose='block';b.side=false;b.facing=[x,z];b.handAngle=angle;
 }

 const flight=layers.attack?resolvedFlight(hit,target,walls):null;
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
 else if(u<config.contact)ball=arc(set,hit,phase(u,.19,config.contact),setHeight??config.arc);
 else ball=layers.attack?sampleAttackFlight(flight,phase(u,config.contact,1)):arc(hit,[x,0,z],phase(u,config.contact,1),0);
 return {actors,ball,flight,walls,attackTarget:target,handSide,setArc:setHeight??config.arc,passArc:passHeight,passContact,passHand:layers.pass?passHand:null,visible:true,duration:attackDuration(layers),setContact:lead+(1-lead)*.19,attackContact:lead+(1-lead)*config.contact};
}

// Keep approach/contact clocks fixed in seconds. A longer rebound extends the
// replay; a short flight can land while the players finish their recovery.
export function sampleAttack(t,options={}){
 const timing=sampleCore(0,options),baseDuration=timing.duration,hitTime=timing.attackContact*baseDuration;
 const duration=Math.max(baseDuration,hitTime+(timing.flight?.landingTime??timing.flight?.duration??0)),seconds=clamp(t)*duration;
 const frame=sampleCore(clamp(seconds/baseDuration),options);
 if(frame.flight&&seconds>=hitTime)frame.ball=sampleAttackFlight(frame.flight,(seconds-hitTime)/frame.flight.duration);
 const scale=baseDuration/duration;
 return {...frame,duration,setContact:frame.setContact*scale,attackContact:frame.attackContact*scale,passContact:frame.passContact==null?null:frame.passContact*scale};
}
