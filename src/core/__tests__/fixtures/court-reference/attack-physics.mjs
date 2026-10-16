// Local visual simulation. Positions are metres; time is seconds; Y points up.
// Raised hands and the net are finite surfaces. Every response starts exactly
// at the previous contact, and the next event is solved from that new velocity.
const GRAVITY=9.81, BALL_RADIUS=.12, EPS=1e-8, CONTACT_EPS=2e-6;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const add=(a,b,k=1)=>a.map((v,i)=>v+b[i]*k);
const length=a=>Math.hypot(...a);
const finitePoint=(p,fallback)=>fallback.map((v,i)=>Number.isFinite(p?.[i])?p[i]:v);
const number=(v,fallback)=>Number.isFinite(v)?v:fallback;
const pointAt=(segment,t)=>{
 const p=add(segment.origin,segment.velocity,t);p[1]-=.5*GRAVITY*t*t;return p;
};
const velocityAt=(segment,t)=>[segment.velocity[0],segment.velocity[1]-GRAVITY*t,segment.velocity[2]];
const groundTime=(y,vy)=>Math.max(0,(vy+Math.sqrt(vy*vy+2*GRAVITY*Math.max(0,y-BALL_RADIUS)))/GRAVITY);
const isOut=p=>Math.abs(p[0])>4.5+EPS||Math.abs(p[2])>9+EPS;
const bounded=(value,fallback,lo,hi)=>clamp(number(value,fallback),lo,hi);
function responseProfile(profile){
 const surface=(option,tangentRetention,normalRestitution)=>({
  tangentRetention:bounded(option?.tangentRetention,tangentRetention,0,1),normalRestitution:bounded(option?.normalRestitution,normalRestitution,0,1),
  ...(Number.isFinite(option?.verticalSpeed)?{verticalSpeed:clamp(option.verticalSpeed,-20,20)}:{}),
 });
 return {speed:bounded(profile?.speed,16,.5,60),launchMode:profile?.launchMode==='direction'?'direction':'target',
  block:surface(profile?.block,.82,.57),net:surface(profile?.net,.5,.16),tape:surface(profile?.tape,.72,.28),
  floorBounce:{...surface(profile?.floorBounce,.7,.3),count:Math.floor(bounded(profile?.floorBounce?.count,0,0,2))},
 };
}

// Squared distances to rectangle faces, edges and corners are polynomials of
// degree <=4. Their derivative roots partition time into monotone intervals.
// Isolating roots in those intervals avoids fixed-step collision tunnelling,
// including short edge contacts between otherwise distant samples.
const polynomialAt=(coefficients,t)=>coefficients.reduceRight((v,c)=>v*t+c,0);
function polynomialRoots(coefficients,lo,hi){
 const c=[...coefficients];while(c.length>1&&Math.abs(c.at(-1))<1e-14)c.pop();
 if(c.length<2)return [];
 if(c.length===2){const t=-c[0]/c[1];return t>=lo-EPS&&t<=hi+EPS?[clamp(t,lo,hi)]:[];}
 const derivative=c.slice(1).map((v,i)=>v*(i+1));
 const knots=[lo,...polynomialRoots(derivative,lo,hi).filter(t=>t>lo+EPS&&t<hi-EPS),hi];
 const roots=[],record=t=>{if(!roots.some(r=>Math.abs(r-t)<1e-8))roots.push(t);};
 for(const t of knots){
  const scale=c.reduce((sum,v,i)=>sum+Math.abs(v)*Math.max(1,Math.abs(t))**i,0);
  if(Math.abs(polynomialAt(c,t))<1e-11*Math.max(1,scale))record(t);
 }
 for(let i=1;i<knots.length;i++){
  let left=knots[i-1],right=knots[i],a=polynomialAt(c,left),b=polynomialAt(c,right);
  if(a===0||b===0||Math.sign(a)===Math.sign(b))continue;
  for(let n=0;n<58;n++){
   const mid=(left+right)/2,value=polynomialAt(c,mid);
   if(Math.sign(value)===Math.sign(a)){left=mid;a=value;}else right=mid;
  }
  record((left+right)/2);
 }
 return roots.sort((a,b)=>a-b);
}
function squaredDistancePolynomial(parts,radius){
 const result=[-radius*radius,0,0,0,0];
 for(const part of parts)for(let i=0;i<part.length;i++)for(let j=0;j<part.length;j++)result[i+j]+=part[i]*part[j];
 return result;
}

function wallFrame(description){
 const angle=number(description.angle,0)*Math.PI/180;
 return {center:finitePoint(description.center,[0,2.85,-.25]),normal:[Math.sin(angle),0,Math.cos(angle)],tangent:[Math.cos(angle),0,-Math.sin(angle)],halfWidth:Math.max(.01,number(description.width,.86))/2,halfHeight:Math.max(.01,number(description.height,.85))/2};
}
function nearestOnRectangle(point,wall){
 const relative=add(point,wall.center,-1),u=dot(relative,wall.tangent),v=relative[1];
 const closest=add(wall.center,wall.tangent,clamp(u,-wall.halfWidth,wall.halfWidth));
 closest[1]+=clamp(v,-wall.halfHeight,wall.halfHeight);
 return {closest,u,v,distance:length(add(point,closest,-1))};
}
function rectangleSurface(description,type,wallIndex,motion){
 const wall=wallFrame(motion?{...description,center:motion.center}:description);
 const surfaceVelocity=motion?finitePoint(motion.velocity,[0,0,0]):[0,0,0];
 const centerAt=time=>motion?add(wall.center,surfaceVelocity,time-motion.start):wall.center;
 return {type,wallIndex,radius:BALL_RADIUS,wall,surfaceVelocity,moving:!!motion,
  activeFrom:Math.max(number(description.activeFrom,0),motion?.start??-Infinity),activeUntil:Math.min(number(description.activeUntil,Infinity),motion?.end??Infinity),
  exclusiveEndAt:motion?.exclusiveEnd?motion.end:Infinity,
  nearest:(point,time)=>nearestOnRectangle(point,{...wall,center:centerAt(time)}),
  polynomials:segment=>{
   const relative=add(segment.origin,centerAt(segment.start),-1),velocity=add(segment.velocity,surfaceVelocity,-1),u=dot(relative,wall.tangent),du=dot(velocity,wall.tangent);
   const signed=[dot(relative,wall.normal),dot(velocity,wall.normal)];
   const horizontal=[[0],[u+wall.halfWidth,du],[u-wall.halfWidth,du]];
   const vertical=[[0],[relative[1]+wall.halfHeight,velocity[1],-.5*GRAVITY],[relative[1]-wall.halfHeight,velocity[1],-.5*GRAVITY]];
   return horizontal.flatMap(x=>vertical.map(y=>squaredDistancePolynomial([signed,x,y],BALL_RADIUS)));
  }
 };
}
function handSurfaces(description,wallIndex){
 if(!Array.isArray(description.motion))return [rectangleSurface(description,'block',wallIndex)];
 // A piece stores the centre at its own start, not at the attack's time zero.
 // Only these windows contain hands; the solver never leaves a raised static
 // rectangle behind after the last pose has finished.
 const pieces=description.motion.filter(piece=>piece&&Number.isFinite(piece.start)&&(Number.isFinite(piece.end)||piece.end===Infinity)&&piece.end>piece.start)
  .map(piece=>({...piece,center:finitePoint(piece.center,finitePoint(description.center,[0,2.85,-.25]))}));
 return pieces.map(piece=>rectangleSurface(description,'block',wallIndex,{...piece,exclusiveEnd:pieces.some(next=>next!==piece&&Math.abs(next.start-piece.end)<EPS)}));
}
function netSurfaces(option){
 if(!option)return [];
 const description=typeof option==='object'?option:{},center=finitePoint(description.center,[0,0,0]);
 const width=Math.max(.01,number(description.width,10.5));
 const bottom=center[1]+number(description.bottom,1.43),top=Math.max(bottom+.01,center[1]+number(description.top,2.43));
 const mesh=rectangleSurface({center:[center[0],(bottom+top)/2,center[2]],width,height:top-bottom},'net');
 const tapeRadius=Math.max(0,number(description.tapeRadius,.025)),radius=BALL_RADIUS+tapeRadius,halfWidth=width/2;
 const tape={type:'tape',radius,activeFrom:0,activeUntil:Infinity,
  nearest:point=>{
   const closest=[clamp(point[0],center[0]-halfWidth,center[0]+halfWidth),top,center[2]];
   return {closest,distance:length(add(point,closest,-1))};
  },
  polynomials:segment=>{
   const x=segment.origin[0]-center[0],dx=segment.velocity[0],y=[segment.origin[1]-top,segment.velocity[1],-.5*GRAVITY],z=[segment.origin[2]-center[2],segment.velocity[2]];
   return [[0],[x+halfWidth,dx],[x-halfWidth,dx]].map(part=>squaredDistancePolynomial([part,y,z],radius));
  },
  tapeRadius
 };
 return [tape,mesh];
}

function intersectSurface(segment,surface,profile,firstTouch=true){
 const lo=Math.max(0,surface.activeFrom-segment.start),hi=Math.min(segment.duration,surface.activeUntil-segment.start);
 if(hi<lo)return null;
 const roots=surface.polynomials(segment).flatMap(c=>polynomialRoots(c,lo,hi)).sort((a,b)=>a-b);
 for(const time of roots){
  // The ground is terminal, including a simultaneous ground/surface touch.
  if(time>=segment.duration-EPS)continue;
  const absoluteTime=segment.start+time;
  if(absoluteTime<surface.activeFrom-EPS||absoluteTime>surface.activeUntil+EPS||absoluteTime>=surface.exclusiveEndAt-EPS)continue;
  const point=pointAt(segment,time),nearest=surface.nearest(point,absoluteTime);
  if(Math.abs(nearest.distance-surface.radius)>CONTACT_EPS||nearest.distance<EPS)continue;
  const difference=add(point,nearest.closest,-1),normal=difference.map(v=>v/nearest.distance);
  const incomingVelocity=velocityAt(segment,time),surfaceVelocity=surface.surfaceVelocity??[0,0,0],relativeVelocity=add(incomingVelocity,surfaceVelocity,-1),incidence=dot(relativeVelocity,normal);
  // A zero-time root from the previous event is separating, so it is ignored.
  // No positional nudge is used: adjacent segments remain exactly continuous.
  if(incidence>=-1e-7)continue;
  const tangentVelocity=add(relativeVelocity,normal,-incidence);
  const response=profile[surface.type];
  const outgoingVelocity=add(add(tangentVelocity.map(v=>v*response.tangentRetention),normal,-incidence*response.normalRestitution),surfaceVelocity);
  // The fitted impulse represents the initial touch, not a motor that keeps
  // relaunching a ball chattering against the same tape or hand.
  if(firstTouch&&response.verticalSpeed!==undefined)outgoingVelocity[1]=response.verticalSpeed;
  const surfacePoint=surface.type==='tape'?add(nearest.closest,normal,surface.tapeRadius):nearest.closest;
  return {type:surface.type,...(surface.wallIndex!==undefined?{wallIndex:surface.wallIndex}:{}),...(surface.moving?{surfaceVelocity:[...surfaceVelocity]}:{}),point,surfacePoint,time,normal,incomingVelocity,outgoingVelocity,
   edge:surface.type==='tape'||Math.abs(nearest.u)>surface.wall.halfWidth+EPS||Math.abs(nearest.v)>surface.wall.halfHeight+EPS};
 }
 return null;
}

/**
 * Resolve successive contacts until the ground or the bounded contact limit.
 * net is opt-in; true uses x +/-5.25, y1.43..2.43 at z0. Its object form accepts
 * center (translation), width, bottom, top and tapeRadius. Hand descriptions
 * optionally limit contact to absolute seconds activeFrom..activeUntil. A hand's
 * motion array is piecewise translation: {start,end,center,velocity}, with centre
 * measured at start and velocity in metres/second. No surface exists outside
 * those pieces. Responses are solved in the moving hand's frame, then returned
 * as world velocities. Rotation stays constant for each hand description.
 * A truncated flight ends at its last contact, never at a fabricated landing.
 * collision remains an alias for the first event, with absolute event times.
 * profile optionally controls launch speed/mode and each surface's tangential
 * retention, normal restitution and empirical world verticalSpeed. The default
 * launch solves the requested ground target. launchMode:'direction' launches
 * toward that point at a constant 3D speed; gravity then determines the landing.
 * floorBounce.count (0..2) continues after first ground contact. landing and
 * landingTime always identify that first ground, while endPoint is the final
 * resolved position. Optional floor contacts do not change the rally outcome.
 */
export function resolveAttackFlight({hit,target,walls=[],net=false,maxCollisions=16,profile}={}){
 hit=finitePoint(hit,[0,2.95,.55]);target=finitePoint(target,[2.6,BALL_RADIUS,-6.5]);
 hit[1]=Math.max(BALL_RADIUS,hit[1]);target[1]=Math.max(BALL_RADIUS,target[1]);
 const calibrated=responseProfile(profile),delta=add(target,hit,-1),horizontal=Math.hypot(delta[0],delta[2]),travel=clamp(horizontal/calibrated.speed,.16,1.8);
 const initialVelocity=calibrated.launchMode==='direction'?delta.map(value=>value*calibrated.speed/Math.max(EPS,length(delta))):[delta[0]/travel,(delta[1]+.5*GRAVITY*travel*travel)/travel,delta[2]/travel];
 const surfaces=[...(Array.isArray(walls)?walls:[]).flatMap((wall,i)=>handSurfaces(wall??{},i)),...netSurfaces(net)];
 const limit=clamp(Math.floor(number(maxCollisions,16)),1,64),segments=[],collisions=[];
 let origin=[...hit],velocity=initialVelocity,start=0,status='landed',landing,landingTime=null,endPoint,bounces=calibrated.floorBounce.count;
 for(;;){
  const segment={origin:[...origin],velocity:[...velocity],duration:groundTime(origin[1],velocity[1]),start};
  let next=null;
  for(const surface of surfaces){
   const firstTouch=!collisions.some(event=>event.type===surface.type&&event.wallIndex===surface.wallIndex);
   const candidate=intersectSurface(segment,surface,calibrated,firstTouch);
   if(candidate&&(!next||candidate.time<next.time-EPS))next=candidate;
  }
  if(!next){
   segments.push(segment);endPoint=pointAt(segment,segment.duration);endPoint[1]=BALL_RADIUS;start+=segment.duration;
   if(landingTime===null){landing=[...endPoint];landingTime=start;}
   const incomingVelocity=velocityAt(segment,segment.duration),bounce=calibrated.floorBounce;
   if(bounces>0&&-incomingVelocity[1]*bounce.normalRestitution>EPS){
    const outgoingVelocity=[incomingVelocity[0]*bounce.tangentRetention,-incomingVelocity[1]*bounce.normalRestitution,incomingVelocity[2]*bounce.tangentRetention];
    collisions.push({type:'floor',point:[...endPoint],surfacePoint:[endPoint[0],0,endPoint[2]],time:start,normal:[0,1,0],incomingVelocity,outgoingVelocity,edge:false});
    origin=[...endPoint];velocity=outgoingVelocity;bounces--;
    if(collisions.length>=limit){status='truncated';break;}
    continue;
   }
   break;
  }
  segment.duration=next.time;segments.push(segment);start+=next.time;
  collisions.push({...next,time:start});origin=[...next.point];velocity=[...next.outgoingVelocity];
  if(collisions.length>=limit){status='truncated';landing??=[...origin];endPoint=[...origin];break;}
 }
 const landed=status==='landed',out=landingTime!==null?isOut(landing):null;
 const touchedBlock=collisions.some(event=>event.type==='block'),touchedNet=collisions.some(event=>event.type==='net'||event.type==='tape');
 const outcome=!landed?'limite-contatos':touchedBlock?(out?'desvio-fora':landing[2]>=0?'bloqueado':'desvio-dentro'):touchedNet?(out?'rede-fora':landing[2]>=0?'rede-retorno':'rede-dentro'):'livre';
 const terminationReason=landed?'ground':'contact-limit';
 const result={hit:[...hit],target:[...target],collision:collisions[0]??null,collisions,landing,landingTime,endPoint,out,outcome,status,landed,terminationReason,duration:start,segments,gravity:GRAVITY,ballRadius:BALL_RADIUS};
 result.guidePoints=segments.map(segment=>Array.from({length:33},(_,i)=>pointAt(segment,segment.duration*i/32)));
 return result;
}

/** A continuous centre position over the resolved flight, including rebounds. */
export function sampleAttackFlight(flight,u){
 const t=clamp(Number.isFinite(u)?u:0,0,1)*flight.duration;
 if(t>=flight.duration-EPS)return [...(flight.endPoint??flight.landing)];
 const segment=flight.segments.find(s=>t<=s.start+s.duration+EPS)??flight.segments.at(-1);
 return pointAt(segment,clamp(t-segment.start,0,segment.duration));
}
