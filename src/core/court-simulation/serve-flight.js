// A predictive hand-to-floor flight. Reception samples the descending branch
// before its floor endpoint, so the guide and the animated ball share one path.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const mix=(a,b,u)=>a+(b-a)*u;
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
const NET_HEIGHT=2.43;
const BALL_RADIUS=.12;
const TAPE_HALF_HEIGHT=.0325;
const CLEARANCE_MARGIN=.035;
const NET_VOLUME_HALF_DEPTH=BALL_RADIUS+TAPE_HALF_HEIGHT+CLEARANCE_MARGIN;
const FLOAT_VERTICAL_WOBBLE=.06;
const SHORT_APEX_LIMIT=4.5;

function heightAt(path,u){
  const before=u<=path.apexFraction;
  const span=before?path.apexFraction:1-path.apexFraction;
  const endpoint=before?path.start[1]:path.end[1];
  const relative=(u-path.apexFraction)/span;
  return path.apexHeight-(path.apexHeight-endpoint)*relative*relative;
}

// Solve the required apex directly for a height constraint on either parabola.
function requiredApex(startHeight,endHeight,apexFraction,u,height){
  const before=u<=apexFraction;
  const span=before?apexFraction:1-apexFraction;
  const endpoint=before?startHeight:endHeight;
  const square=((u-apexFraction)/span)**2;
  return (height-endpoint*square)/(1-square);
}

/**
 * Create a serve using metres and [x,y,z] coordinates. The server is its floor
 * position, target is [x,z], and kind is Float or Topspin. The floor marker is
 * clamped to the receiving court; requestedTarget retains the saved input.
 */
export function createServeFlight(serverXYZ,targetXZ,kind='Float'){
  kind=kind==='Topspin'?'Topspin':'Float';
  const requestedServer=[finite(serverXYZ?.[0],1.7),finite(serverXYZ?.[1],0),finite(serverXYZ?.[2],-10.44)];
  const server=[requestedServer[0],requestedServer[1],Math.min(requestedServer[2],-.5)];
  const requestedTarget=[finite(targetXZ?.[0],-1.45),finite(targetXZ?.[1],6.65)];
  const target=[clamp(requestedTarget[0],-4.5,4.5),clamp(requestedTarget[1],1,9)];
  const distance=Math.hypot(target[0]-server[0],target[1]-server[2]);
  const forward=[(target[0]-server[0])/distance,(target[1]-server[2])/distance];
  const right=[forward[1],-forward[0]];
  const start=[server[0]+.38*forward[0]+.03*right[0],server[1]+2.28,server[2]+.38*forward[1]+.03*right[1]];
  const end=[target[0],BALL_RADIUS,target[1]];
  const netFraction=-start[2]/(end[2]-start[2]);
  const preferredApex=kind==='Topspin'?.75*netFraction:netFraction;
  const nominalNetMargin=mix(.30,kind==='Topspin'?.95:.40,clamp((target[1]-1)/2,0,1));
  const minimumCenterHeight=NET_HEIGHT+BALL_RADIUS+TAPE_HALF_HEIGHT+CLEARANCE_MARGIN;
  const wobbleAllowance=kind==='Float'?FLOAT_VERTICAL_WOBBLE:0;
  const constraints=[
    [netFraction,NET_HEIGHT+nominalNetMargin],
    ...[-NET_VOLUME_HALF_DEPTH,0,NET_VOLUME_HALF_DEPTH].map(z=>[
      (z-start[2])/(end[2]-start[2]),minimumCenterHeight+wobbleAllowance,
    ]),
  ].filter(([u])=>u>0&&u<1);
  const apexFor=fraction=>Math.max(start[1]+.01,end[1]+.01,...constraints.map(([u,height])=>
    requiredApex(start[1],end[1],fraction,u,height)));
  let apexFraction=preferredApex,apexHeight=apexFor(apexFraction);
  // On a short target a late, shallow descent is essential. Move the apex
  // towards the tape only as much as needed to avoid an implausibly high lob.
  if(apexHeight>SHORT_APEX_LIMIT&&apexFor(netFraction)<=SHORT_APEX_LIMIT){
    let low=preferredApex,high=netFraction;
    for(let i=0;i<48;i++){
      const middle=(low+high)/2;
      if(apexFor(middle)>SHORT_APEX_LIMIT)low=middle;else high=middle;
    }
    apexFraction=high;apexHeight=apexFor(apexFraction);
  }
  const path={kind,server,requestedServer,requestedTarget,target,start,end,forward,right,
    targetAdjusted:target.some((value,i)=>value!==requestedTarget[i]),
    serverAdjusted:server.some((value,i)=>value!==requestedServer[i]),
    preferredApexFraction:preferredApex,apexAdjusted:Math.abs(apexFraction-preferredApex)>1e-10,
    apexFraction,apexHeight,netFraction,nominalNetMargin,minimumCenterHeight,
    horizontalDistance:Math.hypot(end[0]-start[0],end[2]-start[2]),
    nominalSpeed:kind==='Topspin'?17.5:14,
    minimumReceiveDuration:(kind==='Topspin'?1.0:1.2)+.08*(3-target[1]),
  };
  path.netHeight=heightAt(path,netFraction);
  path.receiveFraction=receiveFlightFraction(path);
  path.duration=Math.max(path.horizontalDistance/path.nominalSpeed,path.minimumReceiveDuration/path.receiveFraction);
  path.receiveDuration=path.duration*path.receiveFraction;
  return path;
}

/** Sample the floor flight. Set wobble:false for the predictive guide. */
export function sampleServeFlight(path,u,{wobble=true}={}){
  u=clamp(finite(u,0),0,1);
  if(u===0)return [...path.start];
  if(u===1)return [...path.end];
  const position=[mix(path.start[0],path.end[0],u),heightAt(path,u),mix(path.start[2],path.end[2],u)];
  if(wobble&&path.kind==='Float'){
    const envelope=Math.sin(Math.PI*u);
    const lateral=.16*envelope*Math.sin(6*Math.PI*u);
    position[0]+=path.right[0]*lateral;
    position[2]+=path.right[1]*lateral;
    position[1]+=FLOAT_VERTICAL_WOBBLE*envelope*Math.sin(8*Math.PI*u);
  }
  return position;
}

/** The descending root at the receiver's contact height, never the toss. */
export function receiveFlightFraction(path,height=1.05){
  height=clamp(finite(height,1.05),path.end[1],path.apexHeight);
  return path.apexFraction+(1-path.apexFraction)*Math.sqrt((path.apexHeight-height)/(path.apexHeight-path.end[1]));
}
