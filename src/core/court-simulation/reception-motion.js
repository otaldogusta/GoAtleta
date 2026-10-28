import {effectiveRotation,receptionDestinations,receptionReceiver} from './formations.js';
import {createServeFlight,sampleServeFlight,receiveFlightFraction} from './serve-flight.js';

export const RECEIVE_CONTACT=.64;
export const SERVE_CONTACT=.38;
const clamp=t=>Math.max(0,Math.min(1,t));
const phase=(t,a,b)=>clamp((t-a)/(b-a));
const smooth=t=>t*t*(3-2*t);
const mix=(a,b,t)=>a+(b-a)*t;
const move=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
const length=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
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
export function sampleReception(t,{system='5-1',rotation=0,bases,landing=[-1.45,6.65],serve='Float'}){
  t=clamp(t);
  const progress=t,server=bases[6],path=serveFlight(server,landing,serve);
  const contactFraction=receiveFlightFraction(path),ballContact=sampleServeFlight(path,contactFraction);
  const lead=1.5,flightSeconds=path.duration*contactFraction,passSeconds=1.5;
  const duration=lead+flightSeconds+passSeconds,seconds=progress*duration;
  const serveContact=lead/duration,receiveContact=(lead+flightSeconds)/duration;
  const tossSeconds=lead-1.1,tossStart=tossSeconds/duration;
  // The setter leaves with the release of the toss, not with the serve hit.
  const setterBegin=SERVE_CONTACT*tossSeconds/lead;
  // Preserve the rotation choreography while anchoring it to actual ball events.
  t=progress<serveContact?SERVE_CONTACT*progress/serveContact:progress<receiveContact
    ?mix(SERVE_CONTACT,RECEIVE_CONTACT,phase(progress,serveContact,receiveContact))
    :mix(RECEIVE_CONTACT,1,phase(progress,receiveContact,1));
  const r=effectiveRotation(system,rotation),destinations=receptionDestinations(system,rotation);
  const receiver=receptionReceiver(bases,[ballContact[0],ballContact[2]]);
  const setterTarget=destinations[0];
  const passX=setterTarget[0]-ballContact[0],passZ=setterTarget[1]-ballContact[2],passDistance=Math.hypot(passX,passZ)||1;
  const shoulder=side=>[ballContact[0]-.19*passX/passDistance+side*.58*passZ/passDistance,
    Math.max(.5,ballContact[2]-.19*passZ/passDistance-side*.58*passX/passDistance)];
  const left=shoulder(-1),right=shoulder(1),receiverStart=[bases[receiver][0],bases[receiver][2]];
  const contact=length(receiverStart,left)<length(receiverStart,right)?left:right;
  const release=smooth(phase(t,RECEIVE_CONTACT,1));
  const actors=bases.map((base,i)=>{
    const start=[base[0],base[2]];
    let p=start,role=i===6?'server':[3,4,5].includes(i)?'passer':'setter',pose='ready',jump=0;
    let facing=[server[0],server[2]],side=false;
    if(i===6){
      const eventSeconds=seconds-lead;
      pose=eventSeconds<-1.1?'ready':eventSeconds<-.55?'toss':eventSeconds<-.06?'draw':eventSeconds<.06?'contact':eventSeconds<.5?'follow':'idle';
      facing=[path.end[0],path.end[2]];
    }else if(i===0){
      const begin=setterBegin,end=setterWindows[r][1];
      if(r===0){
        // R1 penetration: stay in the right lane before cutting toward the net.
        p=[mix(start[0],setterTarget[0],smooth(phase(t,.50,.75))),mix(start[1],setterTarget[1],smooth(phase(t,begin,.78)))];
      }else p=move(start,setterTarget,smooth(phase(t,begin,end)));
      const travelling=t>begin&&t<end&&length(start,setterTarget)>.25;
      if(travelling){role='attacker';pose='approach';side=true;facing=setterTarget;}
      else if(t>=end){
        pose=t<.91?'load':t<.965?'rise':'contact';side=true;
        // Prepare the front set toward the entrance, regardless of the pass source.
        facing=[-4.5,p[1]];
      }
      jump=.25*smooth(phase(t,.91,.97));
    }else if(i===receiver&&t<RECEIVE_CONTACT){
      p=move(start,contact,smooth(phase(t,.32,.50)));
      pose=t<.55?'ready':t<.60?'load':'contact';
      side=t>=.55;facing=setterTarget;
    }else{
      const origin=i===receiver?contact:start,destination=destinations[i];
      const recovery=i===receiver&&i!==4?smooth(phase(t,.69,1)):release;
      p=move(origin,destination,recovery);
      const travelling=t>RECEIVE_CONTACT&&t<.995&&length(origin,destination)>1;
      if(i===receiver&&t<.69){pose='follow';side=true;facing=setterTarget;}
      else if(travelling){role='attacker';pose='approach';side=true;facing=destination;}
      else if(t>=RECEIVE_CONTACT){role=i===4?'passer':'setter';pose='ready';}
      // The libero makes a small recovery adjustment without a running silhouette.
      if(i===4&&i===receiver&&t>=.69){role='passer';pose='ready';side=false;}
      if(t>=.995&&Math.abs(destination[0])>4&&destination[1]<4){side=true;facing=[0,p[1]];}
    }
    return {position:[p[0],0,p[1]],role,pose,jump,facing,side};
  });
  const dx=path.end[0]-server[0],dz=path.end[2]-server[2],distance=Math.hypot(dx,dz)||1;
  const hand=(forward,right,height)=>[server[0]+dx/distance*forward+dz/distance*right,server[1]+height,server[2]+dz/distance*forward-dx/distance*right];
  const hold=hand(.6,.03,1.72),toss=hand(.36,.03,2.29),hit=path.start;
  let ball;
  if(seconds<lead-1.25)ball=hold;
  else if(seconds<tossSeconds)ball=hold.map((v,i)=>mix(v,toss[i],phase(seconds,lead-1.25,tossSeconds)));
  else if(seconds<lead){
    const elapsed=seconds-tossSeconds,u=elapsed/1.1;
    ball=toss.map((v,i)=>mix(v,hit[i],u));
    ball[1]+=4.905*elapsed*(1.1-elapsed);
  }
  else if(seconds<lead+flightSeconds)ball=sampleServeFlight(path,(seconds-lead)/path.duration);
  else ball=arc(ballContact,[setterTarget[0]-.15,2.25,setterTarget[1]],phase(t,RECEIVE_CONTACT,1),2.9);
  return {actors,ball,receiver,contact,ballContact,duration,tossStart,serveContact,receiveContact,serveGuide:path.guide,
    serveTarget:[path.end[0],path.end[2]],ballSpin:serve==='Topspin'?14*Math.max(0,Math.min(seconds-lead,flightSeconds)):0};
}
