import {effectiveRotation,receptionDestinations,receptionReceiver} from './formations.js';
import {createServeFlight,sampleServeFlight,receiveFlightFraction} from './serve-flight.js';
import {serveMotionProgress,serveMotionFrame} from '../../../public/visual-court-3d/serve-motion-clock.js';
import {topspinMarkers,topspinRoot,topspinGuide} from '../../../public/visual-court-3d/topspin-motion-data.js';
import {courtFootwork,setterPenetration,setterSettingBase} from './court-footwork.js';

export const RECEIVE_CONTACT=.64;
export const SERVE_CONTACT=.38;
const clamp=t=>Math.max(0,Math.min(1,t));
const phase=(t,a,b)=>clamp((t-a)/(b-a));
const smooth=t=>t*t*(3-2*t);
const mix=(a,b,t)=>a+(b-a)*t;
const move=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
const length=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const bearing=(from,to)=>Math.atan2(to[0]-from[0],to[1]-from[1]);
function sampleTrack(track,frame){
  const index=Math.min(track.length-1,Math.floor(frame)),next=track[Math.min(index+1,track.length-1)];
  return track[index].map((value,i)=>mix(value,next[i],frame-index));
}
// Saved server marks locate the strike. Work backwards from that mark so the
// entire approach turns with an edited target, as do the two Blender hands.
function serverPoint(path,forward,right,height){
  return [path.server[0]+path.forward[0]*forward+path.right[0]*right,path.server[1]+height,
    path.server[2]+path.forward[1]*forward+path.right[1]*right];
}
function jumpServeBall(path,frame){
  const [across,height,ahead]=sampleTrack(topspinGuide,frame),[travel,jump]=sampleTrack(topspinRoot,frame);
  return serverPoint(path,travel-topspinRoot[topspinMarkers.contact][0]+ahead,across,jump+height);
}
function attackBaseYaw(destination,setter){
 const dx=setter[0]-destination[0],dz=setter[1]-destination[1],distance=Math.hypot(dx,dz)||1;
 // Open toward the setter while keeping the net ahead of the approach.
 return Math.atan2(.55*dx/distance,.55*dz/distance-.45);
}
function blendPose(time,transitions,defaultDuration){
 for(const [start,previousPose,duration=defaultDuration] of transitions){
  if(time>=start&&time<start+duration)return {previousPose,poseBlend:smooth(phase(time,start,start+duration))};
 }
}
export const setterWindows=[[.35,.80],[.35,.59],[.32,.62],[.36,.70],[.32,.42],[.32,.46]];

function arc(a,b,u,height){
  return [mix(a[0],b[0],u),mix(a[1],b[1],u)+4*height*u*(1-u),mix(a[2],b[2],u)];
}
const flights=new Map();
function serveFlight(server,landing,serve){
  const key=JSON.stringify([server,landing,serve]);
  if(!flights.has(key)){
    if(flights.size>=128)flights.delete(flights.keys().next().value);
    const path=createServeFlight(server,landing,serve);
    flights.set(key,{...path,guide:Array.from({length:91},(_,i)=>sampleServeFlight(path,i/90,{wobble:false}))});
  }
  return flights.get(key);
}
/**
 * @param {number} t
 * @param {{system?: string, rotation?: number, bases: number[][], landing?: number[], serve?: string, attackHands?: ('left'|'right'|undefined)[]}} options
 */
export function sampleReception(t,{system='5-1',rotation=0,bases,landing=[-1.45,6.65],serve='Float',attackHands=[]}){
  t=clamp(t);
  const progress=t,server=bases[6],path=serveFlight(server,landing,serve);
  const contactFraction=receiveFlightFraction(path),ballContact=sampleServeFlight(path,contactFraction);
  const lead=1.5,flightSeconds=path.duration*contactFraction,passSeconds=1.5;
  const duration=lead+flightSeconds+passSeconds,seconds=progress*duration;
  const serveContact=lead/duration,receiveContact=(lead+flightSeconds)/duration;
  const standingFloat=path.kind==='Float';
  const tossFlightSeconds=standingFloat?.60:1.10;
  const tossSeconds=lead-tossFlightSeconds,tossStart=tossSeconds/duration;
  const serveFrame=standingFloat?0:serveMotionFrame(topspinMarkers,serveMotionProgress(progress,tossStart,serveContact,duration));
  // The setter leaves with the release of the toss, not with the serve hit.
  const setterBegin=SERVE_CONTACT*tossSeconds/lead;
  // Preserve the rotation choreography while anchoring it to actual ball events.
  t=progress<serveContact?SERVE_CONTACT*progress/serveContact:progress<receiveContact
    ?mix(SERVE_CONTACT,RECEIVE_CONTACT,phase(progress,serveContact,receiveContact))
    :mix(RECEIVE_CONTACT,1,phase(progress,receiveContact,1));
  const r=effectiveRotation(system,rotation),destinations=receptionDestinations(system,rotation);
  const sixZero=system==='6-0';
  const receiver=receptionReceiver(bases,[ballContact[0],ballContact[2]],system);
  const setterTarget=destinations[0];
  const passX=setterTarget[0]-ballContact[0],passZ=setterTarget[1]-ballContact[2],passDistance=Math.hypot(passX,passZ)||1;
  // Leave space in front of the ribs for the joined forearms on a lateral pass.
  const shoulder=side=>[ballContact[0]-.68*passX/passDistance+side*.46*passZ/passDistance,
    Math.max(.5,ballContact[2]-.68*passZ/passDistance-side*.46*passX/passDistance)];
  const left=shoulder(-1),right=shoulder(1),receiverStart=[bases[receiver][0],bases[receiver][2]];
  const contact=length(receiverStart,left)<length(receiverStart,right)?left:right;
  const contactYaw=bearing(contact,setterTarget);
  const lateralContact=(ballContact[0]-contact[0])*Math.cos(contactYaw)-(ballContact[2]-contact[1])*Math.sin(contactYaw);
  const contactStagger=-Math.sign(lateralContact)*.12;
  const contactSpread=Math.min(.18,Math.abs(lateralContact)*.35);
  const choreographyPerSecond=progress<serveContact?SERVE_CONTACT/lead:
    progress<receiveContact?(RECEIVE_CONTACT-SERVE_CONTACT)/flightSeconds:(1-RECEIVE_CONTACT)/passSeconds;
  const adjustStart=sixZero?SERVE_CONTACT:.32,adjustEnd=sixZero?.57:.50;
  function receiverFootwork(adjustment){
    const adjustmentSeconds=lead*(1-adjustStart/SERVE_CONTACT)+flightSeconds*phase(adjustEnd,SERVE_CONTACT,RECEIVE_CONTACT);
    return courtFootwork(u=>move(receiverStart,contact,u),smooth(adjustment),{
      shuffle:true,facing:setterTarget,travelSeconds:adjustmentSeconds,stridePhase:adjustment,phasePerSecond:choreographyPerSecond/(adjustEnd-adjustStart),
      startYaw:bearing(receiverStart,sixZero?[server[0],server[2]]:setterTarget),startFromReady:sixZero,
      endYaw:contactYaw,endStagger:contactStagger,endSpread:contactSpread,holdStance:true});
  }
  const actors=bases.map((base,i)=>{
    const start=[base[0],base[2]];
    const attackOption=(i===1&&system!=='4-2')||i===2||i===3||(i===5&&!sixZero);
    let p=start,role=i===6?'server':(sixZero?i>0:[3,4,5].includes(i))?'passer':'setter',pose='ready',jump=0;
    let facing=[server[0],server[2]],side=false;
    let feet,transition,attackReadiness=0;
    if(i===6){
      const eventSeconds=seconds-lead;
      const drawStart=-tossFlightSeconds*.5;
      pose=eventSeconds<-tossFlightSeconds?'ready':eventSeconds<drawStart?'toss':eventSeconds<-.06?'draw':eventSeconds<.06?'contact':eventSeconds<.5?'follow':'idle';
      facing=[path.end[0],path.end[2]];
      if(!standingFloat){
        const [travel,elevation]=sampleTrack(topspinRoot,serveFrame);
        const [x,,z]=serverPoint(path,travel-topspinRoot[topspinMarkers.contact][0],0,0);
        p=[x,z];
        jump=elevation;
      }
      transition=blendPose(eventSeconds,[[-tossFlightSeconds,'ready'],[drawStart,'toss'],[-.06,'draw',.06],[.06,'contact'],[.5,'follow']],.10);
    }else if(i===0){
      const begin=setterBegin,end=sixZero?.80:setterWindows[r][1];
      const p1Run=!sixZero&&r===0;
      const runEnd=sixZero?SERVE_CONTACT:p1Run?RECEIVE_CONTACT-.02:end;
      const runEndSeconds=runEnd<=SERVE_CONTACT?lead*runEnd/SERVE_CONTACT:
        runEnd<=RECEIVE_CONTACT?lead+flightSeconds*phase(runEnd,SERVE_CONTACT,RECEIVE_CONTACT):
        lead+flightSeconds+passSeconds*phase(runEnd,RECEIVE_CONTACT,1);
      const runPhase=p1Run?phase(seconds,tossSeconds,runEndSeconds):phase(t,begin,runEnd);
      const startYaw=bearing(start,facing);
      const readYaw=bearing(setterTarget,[ballContact[0],ballContact[2]]);
      const inPlace=length(start,setterTarget)<=.25;
      const penetration=p1Run&&!inPlace?setterPenetration(start,setterTarget,runPhase,startYaw,readYaw,runEndSeconds-tossSeconds):null;
      p=penetration?.position??move(start,setterTarget,smooth(runPhase));
      const travelling=t>begin&&t<runEnd&&!inPlace;
      feet=penetration
        ? {feet:penetration.feet,feetWeight:penetration.feetWeight,...(travelling?{runCycle:penetration.runCycle,runDrive:penetration.runDrive}:{})}
        : courtFootwork(u=>move(start,setterTarget,u),smooth(runPhase),{
            travelSeconds:runEndSeconds-tossSeconds,stridePhase:runPhase,phasePerSecond:choreographyPerSecond/(runEnd-begin),
            startYaw,endYaw:sixZero?readYaw:-Math.PI/2,holdRunStance:true});
      if(travelling){
        pose='approach';
        side=true;
        facing=penetration?.facing??setterTarget;
      }
      else if((penetration||sixZero)&&t>=runEnd&&t<end){
        // Be still facing the passer at first contact. Turn toward zone 4
        // with two separate placements only after the ball comes off the arms.
        const opening=setterSettingBase(p,readYaw,phase(t,RECEIVE_CONTACT+.012,end-.02));
        feet={feet:opening.feet,feetWeight:smooth(phase(t,runEnd,RECEIVE_CONTACT))*smooth(1-phase(t,end-.02,end))};
        facing=opening.facing;side=true;
      }
      else if(t>=end){
        pose=t<.91?'load':t<.965?'rise':'contact';side=true;
        // Prepare the front set toward the entrance, regardless of the pass source.
        facing=[-4.5,p[1]];
        if(penetration)feet={feet:setterSettingBase(p,readYaw,1).feet,feetWeight:0};
      }
      if(inPlace){
        // No approach clip carries the feet between these headings. Each
        // shoe pivots through the air while the other stays on its mark.
        let turn,pivot;
        if(!sixZero){
          turn=runPhase;
          pivot=setterSettingBase(setterTarget,startYaw,turn,-Math.PI/2,start);
        }else if(t<RECEIVE_CONTACT){
          turn=phase(t,SERVE_CONTACT,RECEIVE_CONTACT-.035);
          pivot=setterSettingBase(setterTarget,startYaw,turn,readYaw,start);
        }else{
          turn=phase(t,RECEIVE_CONTACT+.012,end-.02);
          pivot=setterSettingBase(setterTarget,readYaw,turn);
        }
        feet={...pivot,feetWeight:Math.sin(Math.PI*turn)**2,plantedStance:true};
      }
      jump=(penetration?.jump??feet?.jump??0)+.25*smooth(phase(t,.91,.97));
      if(t>=end)transition=blendPose(t,[[end,'ready'],[.91,'load'],[.965,'rise']],.028);
    }else if(sixZero&&t<SERVE_CONTACT){
      // The passers hold the starting formation until the serve.
      p=start;
    }else if(i===receiver&&t<=(sixZero?.69:RECEIVE_CONTACT)){
      const adjustment=phase(t,adjustStart,adjustEnd);
      p=move(start,contact,smooth(adjustment));
      pose=t>=RECEIVE_CONTACT?'follow':t<.55?'ready':t<.60?'load':'contact';
      side=t>=.55;facing=setterTarget;
      feet=receiverFootwork(adjustment);
      if (adjustment === 1) facing = setterTarget;
      transition=blendPose(t,[[.55,'ready'],[.60,'load'],[RECEIVE_CONTACT,'contact']],.035);
    }else{
      const origin=i===receiver?contact:start,destination=destinations[i];
      const recoveryBegin=i===receiver&&(sixZero||i!==4)?.69:RECEIVE_CONTACT;
      const travelSeconds=passSeconds*(1-recoveryBegin)/(1-RECEIVE_CONTACT);
      const elapsed=phase(t,recoveryBegin,1);
      // Keep the original release and travel through mid-run. Gather the last
      // steps in time to hold both marks for the final 100 ms before the set.
      const gather=phase(elapsed,.68,.91),advance=attackOption?.10/travelSeconds:0;
      const recoveryPhase=clamp(elapsed+advance*smooth(gather)),recovery=smooth(recoveryPhase);
      const phasePerSecond=(1+advance*6*gather*(1-gather)/(.91-.68))/travelSeconds;
      p=move(origin,destination,recovery);
      const endYaw=attackOption?attackBaseYaw(destination,setterTarget):bearing(destination,facing);
      const startYaw=bearing(origin,i===receiver?setterTarget:facing);
      // Open the 6–0 attack lane with a backstep when the mark is behind
      // the player. Keep reading the setter through both foot contacts.
      const retreat=sixZero&&attackOption&&Math.cos(bearing(origin,destination)-endYaw)<-.7;
      feet=courtFootwork(u=>move(origin,destination,u),recovery,{shuffle:i===receiver||retreat,facing:i===4?facing:setterTarget,
        travelSeconds,stridePhase:recoveryPhase,phasePerSecond,startYaw,endYaw,holdStance:attackOption||i===receiver,
        initialFeet:i===receiver?receiverFootwork(1).feet:undefined,
        endStagger:attackOption?(attackHands[i]==='left'?-.28:.28):0,holdRunStance:true,startFromReady:sixZero&&i!==receiver});
      if(attackOption)attackReadiness=smooth(phase(recoveryPhase,.72,1));
      const travelling=t>RECEIVE_CONTACT&&t<.995&&recoveryPhase<1&&length(origin,destination)>1;
      if(i===receiver&&t<.69){pose='follow';side=true;facing=setterTarget;}
      else if(travelling){
        pose='approach';
        side=true;facing=destination;
        if(sixZero&&i!==receiver){
          const rise=smooth(phase(elapsed,0,.18));
          transition={previousPose:'ready',poseBlend:rise};
          if(!feet.facing) facing=move([server[0],server[2]],destination,rise);
        }
      }
      // The libero makes a small recovery adjustment without a running silhouette.
      if(!sixZero&&i===4&&i===receiver&&t>=.69){role='passer';pose='ready';side=false;}
      if(attackOption&&recoveryPhase>=1){side=true;facing=[p[0]+Math.sin(endYaw),p[1]+Math.cos(endYaw)];}
      if(i===receiver&&t<.69)transition=blendPose(t,[[RECEIVE_CONTACT,'contact']],.025);
    }
    return {position:[p[0],i===6?path.server[1]:0,p[1]],role,pose,jump,facing,side,...feet,...transition,
      ...(attackReadiness>0?{attackReadiness,attackReadyLeft:attackHands[i]==='left'}:{}),
      ...(feet?.feet&&(attackOption||i===receiver||(r===0&&i===0))?{plantedStance:true}:{})};
  });
  const toss=standingFloat?serverPoint(path,.52,.11,2):jumpServeBall(path,topspinMarkers.toss),hit=path.start;
  const setHand=[setterTarget[0]-.15,2.25,setterTarget[1]];
  let ball;
  const liftStart=tossSeconds-.42;
  if(!standingFloat&&seconds<=tossSeconds)ball=jumpServeBall(path,serveFrame);
  else if(standingFloat&&seconds<=liftStart)ball=serverPoint(path,.70,.17,1.49);
  else if(seconds<tossSeconds){
    const hold=serverPoint(path,.70,.17,1.49);
    const u=phase(seconds,liftStart,tossSeconds);
    // Match the guide hand's velocity to the free toss at release.
    ball=hold.map((v,i)=>{
      const releaseSpeed=(hit[i]-toss[i])/tossFlightSeconds+(i===1?4.905*tossFlightSeconds:0);
      return mix(v,toss[i],smooth(u))+u*u*(u-1)*(tossSeconds-liftStart)*releaseSpeed;
    });
  }
  else if(seconds<lead){
    const elapsed=seconds-tossSeconds,u=elapsed/tossFlightSeconds;
    ball=toss.map((v,i)=>mix(v,hit[i],u));
    ball[1]+=4.905*elapsed*(tossFlightSeconds-elapsed);
  }
  else if(seconds<lead+flightSeconds)ball=sampleServeFlight(path,(seconds-lead)/path.duration);
  else ball=arc(ballContact,setHand,phase(t,RECEIVE_CONTACT,1),2.9);
  // Keep the ball's orientation continuous when the open palm accelerates it.
  const ballSpin=standingFloat?0:4.5*Math.max(0,Math.min(seconds-tossSeconds,tossFlightSeconds))+
    14*Math.max(0,Math.min(seconds-lead,flightSeconds));
  return {actors,ball,receiver,contact,ballContact,setHand,tossHand:toss,duration,tossStart,serveContact,receiveContact,serveGuide:path.guide,
    serveTarget:[path.end[0],path.end[2]],ballSpin};
}
