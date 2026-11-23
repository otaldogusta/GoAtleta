import {Vector3} from './three.module.min.js';
import {runPoses} from './reception-run-clip.mjs';

export function createReceptionRunner(anatomy){
 const group=anatomy.group;
 const [pelvis,torso,head]=['pelvis','torso','head'].map(name=>group.getObjectByName(name));
 const sides=['left','right'].map(side=>Object.fromEntries(
  ['shoulder','elbow','palm','hip','knee','ankle','foot'].map(name=>[name,group.getObjectByName(`${side}-${name}`)])));
 const [hips,chest,skull,...limbs]=Array.from({length:17},()=>new Vector3());
 const landmarks=[hips,chest,skull,...limbs];
 const captures=[0,1].map(side=>{
  const [shoulder,elbow,palm,hip,knee,ankle,toe]=limbs.slice(side*7,side*7+7);
  return {shoulder,elbow,palm,hip,knee,ankle,toe};
 });
 const baseChest=new Vector3(),axis=new Vector3(),pole=new Vector3(),knee=new Vector3();
 const forward=new Vector3(0,0,1),shoeDirection=new Vector3(),handDirection=new Vector3();
 const legLength=.46;

 return (cycle,weight,feet)=>{
  if(weight<=0)return;
  // The left contact is at frame 100, halfway between the two right contacts.
  const sample=cycle<1?cycle*26:26+(cycle-1)*25;
  const index=Math.floor(sample),fraction=sample-index;
  const from=runPoses[index],to=runPoses[Math.min(index+1,runPoses.length-1)];
  for(const [i,joint] of landmarks.entries()){
   const offset=i*3;
   joint.fromArray(from,offset);
   joint.x+=(to[offset]-joint.x)*fraction;
   joint.y+=(to[offset+1]-joint.y)*fraction;
   joint.z+=(to[offset+2]-joint.z)*fraction;
   joint.multiplyScalar(.001);
  }
  const capturedHeight=hips.y;
  let height=capturedHeight;
  for(let side=0;side<2;side++){
   const {hip}=captures[side],ankle=sides[side].ankle.position;
   const span=Math.hypot(hip.x-ankle.x,hip.z-ankle.z);
   height=Math.min(height,ankle.y+Math.sqrt(Math.max(.2,(2*legLength)**2-span**2)));
  }
  for(const joint of landmarks)joint.y+=height-capturedHeight;
  baseChest.copy(sides[0].shoulder.position).lerp(sides[1].shoulder.position,.5);
  hips.lerp(pelvis.position,1-weight);
  chest.lerp(baseChest,1-weight);
  skull.lerp(head.position,1-weight);
  for(const [side,pose] of captures.entries()){
   const base=sides[side];
   const sourceAxis=axis.subVectors(pose.ankle,pose.hip).normalize();
   pole.subVectors(pose.knee,pose.hip).projectOnPlane(sourceAxis);
   for(const name of ['shoulder','elbow','palm','hip'])pose[name].lerp(base[name].position,1-weight);
   const ankle=base.ankle.position,span=axis.subVectors(ankle,pose.hip).length();
   axis.normalize();
   pole.projectOnPlane(axis);
   if(pole.dot(forward)<.02)pole.copy(forward).projectOnPlane(axis);
   pole.normalize();
   const bend=Math.sqrt(Math.max(0,legLength**2-span**2/4));
   knee.copy(pose.hip).lerp(ankle,.5).addScaledVector(pole,bend).lerp(base.knee.position,1-weight);
   const angle=feet[side][3]*weight;
   shoeDirection.set(Math.sin(angle),0,Math.cos(angle));
   if(feet[side][1]>.002){
    const pitch=Math.asin(Math.max(-.65,Math.min(.65,pose.toe.sub(pose.ankle).normalize().y)))*weight;
    shoeDirection.multiplyScalar(Math.cos(pitch));shoeDirection.y=Math.sin(pitch);
   }
   anatomy.setCapturedLeg(side,pose.hip,knee,ankle,base.foot.position,shoeDirection);
  }
  anatomy.setCapturedTrunk(hips,chest,skull,captures[0],captures[1]);
  for(const [side,{elbow,palm}] of captures.entries()){
   handDirection.subVectors(palm,elbow).normalize();
   anatomy.setArm(side,elbow.x,elbow.y,elbow.z,palm.x,palm.y,palm.z,
    Math.atan2(Math.hypot(handDirection.x,handDirection.z),handDirection.y),0,.15,
    Math.atan2(handDirection.x,handDirection.z));
  }
 };
}
