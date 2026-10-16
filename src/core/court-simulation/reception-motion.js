import {effectiveRotation,receptionDestinations,receptionReceiver} from './formations.js';

export const RECEIVE_CONTACT=.64;
export const SERVE_CONTACT=.38;
const clamp=t=>Math.max(0,Math.min(1,t));
const phase=(t,a,b)=>clamp((t-a)/(b-a));
const smooth=t=>t*t*(3-2*t);
const mix=(a,b,t)=>a+(b-a)*t;
const move=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
const length=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const setterWindows=[[.35,.80],[.35,.59],[.32,.62],[.36,.70],[.32,.42],[.32,.46]];

// Reconstructed from front-view checkpoints at 50%, 62.5%, 75% and 100%.
// A receiver meets the ball on its near shoulder, rather than standing on the X.
export function receptionContact(bases,landing,receiver){
  const start=bases[receiver];
  // A short serve can bring the receiver to the net, never through it.
  return [mix(start[0],landing[0],.5),Math.max(.15,Math.min(start[2],landing[1]-.9))];
}
function arc(a,b,u,height){
  return [mix(a[0],b[0],u),mix(a[1],b[1],u)+4*height*u*(1-u),mix(a[2],b[2],u)];
}
export function sampleReception(t,{system='5-1',rotation=0,bases,landing=[-1.45,6.65],serve='Float'}){
  t=clamp(t);
  const r=effectiveRotation(system,rotation),destinations=receptionDestinations(system,rotation);
  const receiver=receptionReceiver(bases,landing),contact=receptionContact(bases,landing,receiver);
  const ballContact=[landing[0],1.05,Math.max(0,contact[1]-.15)];
  const setterTarget=destinations[0],server=bases[6];
  const release=smooth(phase(t,RECEIVE_CONTACT,1));
  const actors=bases.map((base,i)=>{
    const start=[base[0],base[2]];
    let p=start,role=i===6?'server':[3,4,5].includes(i)?'passer':'setter',pose='ready',jump=0;
    let facing=[server[0],server[2]],side=false;
    if(i===6){
      pose=t<.08?'ready':t<.22?'toss':t<SERVE_CONTACT?'draw':t<.405?'contact':t<.47?'follow':'idle';
      jump=serve==='Topspin'?.32*Math.sin(Math.PI*phase(t,.22,.44)):0;
    }else if(i===0){
      const [begin,end]=setterWindows[r];
      if(r===0){
        // R1 penetration: stay in the right lane before cutting toward the net.
        p=[mix(start[0],setterTarget[0],smooth(phase(t,.50,.75))),mix(start[1],setterTarget[1],smooth(phase(t,.35,.78)))];
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
      side=t>=.55;facing=[ballContact[0],ballContact[2]];
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
  const hand=[server[0]+.3,1.9,server[2]],hit=[server[0]+.3,2.55+(serve==='Topspin'?.3:0),server[2]];
  let ball;
  if(t<SERVE_CONTACT)ball=arc(hand,hit,phase(t,.06,SERVE_CONTACT),.65);
  else if(t<RECEIVE_CONTACT)ball=arc(hit,ballContact,phase(t,SERVE_CONTACT,RECEIVE_CONTACT),serve==='Float'?.65:1.3);
  else ball=arc(ballContact,[setterTarget[0]-.15,2.25,setterTarget[1]],phase(t,RECEIVE_CONTACT,1),2.9);
  return {actors,ball,receiver,contact,ballContact,duration:4.1};
}
