import {Vector3} from './three.module.min.js';
import {setterRunPoses} from './setter-run-data.mjs';
import {walkPoses,shufflePoses} from './travel-motion-data.mjs';
import {shoeSupportHeight} from './court-shoe.mjs';

const mirroredJoint=[0,1,2,10,11,12,13,14,15,16,3,4,5,6,7,8,9];

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
 const torsoOffset=new Vector3(),ankleTarget=new Vector3(),shoeTarget=new Vector3();
 const upperArmDirection=new Vector3(),forearmDirection=new Vector3(),restDirection=new Vector3();
 const plantedForward=new Vector3(),shoeDirection=new Vector3(),handDirection=new Vector3();
 const legLength=.46;

 return (cycle,weight,feet,travel,runDrive)=>{
  if(weight<=0)return;
  const running=!travel;
  const drive=Number.isFinite(runDrive)?Math.max(0,Math.min(1,runDrive)):1;
  const poses=running?setterRunPoses:travel.kind==='shuffle'?shufflePoses:walkPoses;
  const upperLeg=running?.454:legLength,lowerLeg=running?.451:legLength;
  const mirror=poses===shufflePoses&&travel.direction===1;
  // CMU's opposite contacts are 26/25 frames apart. The Blender walk
  // and shuffle have exactly 16 frames from one contact to the next.
  const sample=running?(cycle<1?cycle*26:26+(cycle-1)*25):cycle*16;
  const index=Math.floor(sample),fraction=sample-index;
  const from=poses[index],to=poses[Math.min(index+1,poses.length-1)];
  for(const [i,joint] of landmarks.entries()){
   const offset=(mirror?mirroredJoint[i]:i)*3;
   joint.fromArray(from,offset);
   joint.x+=(to[offset]-joint.x)*fraction;
   joint.y+=(to[offset+1]-joint.y)*fraction;
   joint.z+=(to[offset+2]-joint.z)*fraction;
   if(mirror)joint.x=-joint.x;
   joint.multiplyScalar(.001);
  }
  const capturedHeight=hips.y;
  let height=capturedHeight;
  // Retarget spine length without shortening the shirt whenever the run fades in.
  torsoOffset.subVectors(chest,hips);
  const spineLength=torsoOffset.length();
  torsoOffset.multiplyScalar((.51-spineLength)/spineLength);
  chest.add(torsoOffset);
  skull.add(torsoOffset);
  for(const {shoulder,elbow,palm} of captures){
   shoulder.add(torsoOffset);elbow.add(torsoOffset);palm.add(torsoOffset);
  }
  for(let side=0;side<2;side++){
   const {hip,ankle:recordedAnkle}=captures[side],ankle=sides[side].ankle.position;
   const span=Math.hypot(hip.x-ankle.x,hip.z-ankle.z);
   const hipOffset=hip.y-capturedHeight;
   // A loaded knee still has flex. Match the reach of the stance in Blender.
   // The trailing leg folds in the air and mustn't pull the whole pelvis down.
   const supportReach=running?Math.min(upperLeg+lowerLeg-.008,Math.max(.81,hip.distanceTo(recordedAnkle))):2*legLength;
   const ceiling=ankle.y-hipOffset+Math.sqrt(Math.max(0,supportReach**2-span**2));
   const support=running?1-Math.min(1,feet[side][1]/.065):1;
   height+=Math.min(0,ceiling-height)*support;
  }
  for(const joint of landmarks)joint.y+=height-capturedHeight;
  baseChest.copy(sides[0].shoulder.position).lerp(sides[1].shoulder.position,.5);
  hips.lerp(pelvis.position,1-weight);
  chest.lerp(baseChest,1-weight);
  skull.lerp(head.position,1-weight);
  for(const [side,pose] of captures.entries()){
   const base=sides[side];
   const upper=upperLeg+(base.knee.position.distanceTo(base.hip.position)-upperLeg)*(1-weight);
   const lower=lowerLeg+(base.ankle.position.distanceTo(base.knee.position)-lowerLeg)*(1-weight);
   const sourceAxis=axis.subVectors(pose.ankle,pose.hip).normalize();
   pole.subVectors(pose.knee,pose.hip).projectOnPlane(sourceAxis);
   if(running){
    // Blend the two bone directions about their joint. Cross-fading three
    // independent points shortens the forearm as the runner leaves ready.
    const upperWeight=weight*(.60+.40*drive);
    upperArmDirection.subVectors(pose.elbow,pose.shoulder).normalize();
    forearmDirection.subVectors(pose.palm,pose.elbow).normalize();
    pose.shoulder.lerp(base.shoulder.position,1-weight);
    restDirection.subVectors(base.elbow.position,base.shoulder.position);
    const upperLength=restDirection.length();
    upperArmDirection.lerp(restDirection.normalize(),1-upperWeight).normalize();
    pose.elbow.copy(pose.shoulder).addScaledVector(upperArmDirection,upperLength+weight*(.352-upperLength));
    restDirection.subVectors(base.palm.position,base.elbow.position);
    const forearmLength=restDirection.length();
    forearmDirection.lerp(restDirection.normalize(),1-upperWeight).normalize();
    pose.palm.copy(pose.elbow).addScaledVector(forearmDirection,forearmLength+weight*(.382-forearmLength));
    pose.hip.lerp(base.hip.position,1-weight);
   }else for(const name of ['shoulder','elbow','palm','hip'])pose[name].lerp(base[name].position,1-weight);
   // The simulation owns each footprint. Once the shoe leaves the floor,
   // recover the bent trailing leg at the height of the captured ankle.
   // Ease the pitch as well so the sole cannot tip through the floor at toe-off.
   const swing=Math.min(1,Math.max(0,feet[side][1]/.085));
   const swingPhase=swing*swing*(3-2*swing);
   const swingWeight=swingPhase*weight;
   // The ground mark already accounts for the turning torso. Multiplying
   // its yaw by clip weight would swivel an otherwise stationary shoe.
   shoeDirection.set(0,0,1).applyQuaternion(base.foot.quaternion);
   const baseYaw=Math.atan2(shoeDirection.x,shoeDirection.z);
   const turn=feet[side][3]-baseYaw;
   const angle=baseYaw+weight*Math.atan2(Math.sin(turn),Math.cos(turn));
   shoeDirection.set(Math.sin(angle),0,Math.cos(angle));
   plantedForward.copy(shoeDirection);
   if(swingWeight>0){
    const pitch=Math.asin(Math.max(-.9,Math.min(.65,pose.toe.sub(pose.ankle).normalize().y)))*swingWeight;
    shoeDirection.multiplyScalar(Math.cos(pitch));shoeDirection.y=Math.sin(pitch);
   }
   ankleTarget.copy(base.ankle.position);
   if(running){
    // During recovery the ankle passes under the hip and reaches forward
    // for touchdown. Ground marks take over continuously at either end.
    const release=swingWeight*(.55+.45*drive);
    ankleTarget.z+=(pose.ankle.z-ankleTarget.z)*release;
    ankleTarget.y+=(pose.ankle.y-ankleTarget.y)*release;
   }else ankleTarget.y+=swingWeight*Math.max(0,pose.ankle.y-base.ankle.position.y);
   // Lift the ankle with the pitched sole. A low captured ankle must still
   // clear the floor by the swing height of the simulated footprint.
   const shoeOffsetY=base.foot.position.y-base.ankle.position.y;
   const clearance=feet[side][1];
   ankleTarget.y=Math.max(ankleTarget.y,shoeSupportHeight(shoeDirection.y)+clearance-shoeOffsetY);
   let span=axis.subVectors(ankleTarget,pose.hip).length();
   axis.normalize();
   if(running&&feet[side][1]>0){
    // A ground mark is final only at contact. Keep a little flex in the
    // recovering knee even if the trajectory requests an unreachable ankle.
    const limit=upper+lower-.008*weight;
    if(span>limit){span=limit;ankleTarget.copy(pose.hip).addScaledVector(axis,span);}
   }
   shoeTarget.copy(base.foot.position).sub(base.ankle.position).add(ankleTarget);
   plantedForward.projectOnPlane(axis).normalize();
   pole.projectOnPlane(axis);
   if(pole.lengthSq()<1e-6)pole.copy(plantedForward);
   // Flex over the toes on support and progressively recover the captured
   // bend plane as that shoe lifts; keep both leg segments articulated.
   pole.normalize().lerp(plantedForward,1-swingPhase).normalize();
   if(weight<1){
    restDirection.subVectors(base.knee.position,base.hip.position).projectOnPlane(axis).normalize();
    pole.lerp(restDirection,1-weight).normalize();
   }
   const along=(upper**2-lower**2+span**2)/(2*Math.max(span,1e-8));
   const bend=Math.sqrt(Math.max(0,upper**2-along**2));
   knee.copy(pose.hip).addScaledVector(axis,along).addScaledVector(pole,bend);
   anatomy.setCapturedLeg(side,pose.hip,knee,ankleTarget,shoeTarget,shoeDirection);
  }
  anatomy.setCapturedTrunk(hips,chest,skull,captures[0],captures[1],true);
  for(const [side,{elbow,palm}] of captures.entries()){
   handDirection.subVectors(palm,elbow).normalize();
   anatomy.setArm(side,elbow.x,elbow.y,elbow.z,palm.x,palm.y,palm.z,
    Math.atan2(Math.hypot(handDirection.x,handDirection.z),handDirection.y),0,.15,
    Math.atan2(handDirection.x,handDirection.z),running?weight:0);
  }
 };
}
