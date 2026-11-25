import {BALL_RADIUS} from './court-net.js';
import * as THREE from './three.module.min.js';
import {shoeSupportHeight} from './court-shoe.mjs';
import {ATTACK_CLIP_JOINT as joint, ATTACK_CLIP_SIZE, sampleAttackClip} from './attack-captured-clip.mjs?v=spike-release-20261124';
import {createStrikePalm} from './strike-palm.mjs';

const limbNames = ['Shoulder','Elbow','Wrist','Hand','Hip','Knee','Ankle','Toe','Heel'];
const localName = name => name[0].toLowerCase() + name.slice(1);
const sides = ['left','right'];
const bufferAtHit = new Float32Array(ATTACK_CLIP_SIZE);
sampleAttackClip(145,bufferAtHit);
const hitShoulder = new THREE.Vector3().fromArray(bufferAtHit,joint.rightShoulder);
const halfShoulderWidth=hitShoulder.distanceTo(new THREE.Vector3().fromArray(bufferAtHit,joint.leftShoulder))*.5;
const hitPalm = new THREE.Vector3().fromArray(bufferAtHit,joint.rightWrist)
  .lerp(new THREE.Vector3().fromArray(bufferAtHit,joint.rightHand),.5);
hitShoulder.y -= bufferAtHit[joint.rootMotion+1];
hitPalm.y -= bufferAtHit[joint.rootMotion+1];
const contactReach=hitPalm.distanceTo(hitShoulder)+halfShoulderWidth;
// Play the authored joints on the editable approach and the host's flight clock.
export function createCapturedAttacker(anatomy) {
  const pose = new Float32Array(ATTACK_CLIP_SIZE);
  const hips=new THREE.Vector3(), chest=new THREE.Vector3(), skull=new THREE.Vector3();
  const limbs=sides.map(()=>Object.fromEntries(limbNames.map(name=>[localName(name),new THREE.Vector3()])));
  const offsets=sides.map(side=>limbNames.map(name=>joint[side+name]));
  const vectors=limbs.map(limb=>limbNames.map(name=>limb[localName(name)]));
  const direction=new THREE.Vector3(), bend=new THREE.Vector3(), axis=new THREE.Vector3();
  const originalAxis=new THREE.Vector3(), rotateBend=new THREE.Quaternion(), step=new THREE.Vector3();
  const pelvisForward=new THREE.Vector3(), kneeForward=new THREE.Vector3(), up=new THREE.Vector3(0,1,0);
  const foot=new THREE.Vector3(), palm=new THREE.Vector3();
  const target=new THREE.Vector3(), shoulder=new THREE.Vector3();
  const shot=new THREE.Vector3();
  const aimPalm=createStrikePalm(anatomy);
  const lateralAxis=new THREE.Vector3(1,0,0),soleForward=new THREE.Vector3(0,0,1);
  const groundLine=new THREE.Plane();
  const gait={stride:1,release:0,leadIn:0,heightAboveFloor:0};
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

  function read(point,offset,sign,lift) {
    point.set(sign*pose[offset],pose[offset+1]-lift,pose[offset+2]);
  }
  function fitStride(hip,knee,ankle,offsetX,offsetY,offsetZ) {
    const upper=hip.distanceTo(knee),lower=knee.distanceTo(ankle);
    originalAxis.subVectors(ankle,hip);
    const originalSpan=originalAxis.length();
    originalAxis.normalize();
    bend.subVectors(knee,hip);
    bend.addScaledVector(originalAxis,-bend.dot(originalAxis));
    // Extend or shorten the horizontal stride with the root's travel.
    step.subVectors(ankle,hip);
    step.x+=offsetX;step.y+=offsetY;step.z+=offsetZ;
    // For a long edited route, stop just before a straight, singular knee.
    // A straight extension already in the capture still plays at full reach.
    const maxSpan=Math.max(originalSpan,.985*(upper+lower));
    const reach=Math.sqrt(Math.max(0,maxSpan**2-step.y**2));
    const horizontal=Math.hypot(step.x,step.z);
    if(horizontal>reach){
      step.x*=reach/horizontal;step.z*=reach/horizontal;
    }
    const span=step.length();
    if(span<1e-6)return;
    axis.copy(step).multiplyScalar(1/span);
    rotateBend.setFromUnitVectors(originalAxis,axis);
    bend.applyQuaternion(rotateBend);
    kneeForward.copy(pelvisForward).projectOnPlane(axis);
    if(kneeForward.lengthSq()<1e-8)kneeForward.copy(up).projectOnPlane(axis);
    kneeForward.normalize();
    // The capture occasionally puts a nearly straight knee behind the leg.
    // Measure the pole in metres before normalizing: a millimetre of noise
    // must not steer a much deeper bend when an edited approach shortens the stride.
    const anterior=bend.dot(kneeForward);
    const poleFloor=.14*Math.min(upper,lower);
    const correction=Math.max(0,poleFloor-anterior);
    if(!correction && !offsetX && !offsetY && !offsetZ)return;
    bend.addScaledVector(kneeForward,correction).normalize();
    const along=clamp((upper**2-lower**2+span**2)/(2*span),-upper,upper);
    knee.copy(hip).addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,upper**2-along**2)));
    step.add(hip).sub(ankle);
    ankle.add(step);
    foot.add(step);
  }
  function setLeg(n,kneeDrive,anchor) {
    const {hip,knee,ankle,heel,toe}=limbs[n];
    const {stride,leadIn,release,heightAboveFloor}=gait;
    direction.subVectors(toe,heel).normalize();
    foot.addVectors(heel,toe).multiplyScalar(.5);
    let dx=0,dy=kneeDrive,dz=ankle.z*(stride-1);
    if(anchor && leadIn){
      dx=(anchor[0]-foot.x)*leadIn;
      dy=THREE.MathUtils.lerp(dy,anchor[1]+.055-foot.y,leadIn);
      dz=THREE.MathUtils.lerp(dz,anchor[2]-foot.z,leadIn);
      direction.lerp(soleForward,leadIn).normalize();
    }
    // Limit only the last grounded shoe near the attack line. Use takeoff
    // depth during release so the limit travels with the airborne player.
    const {x:nx,z:nz}=groundLine.normal;
    const forwardEdge=groundLine.distanceToPoint(foot)+nx*dx+nz*dz-.145;
    const clearance=Math.max(0,-forwardEdge)*release;
    fitStride(hip,knee,ankle,dx+nx*clearance,dy,dz+nz*clearance);
    // Toe and heel are capture markers near the floor. Account for the size
    // of the court shoe, including the vertical projection of its tipped toe.
    foot.y=Math.max(foot.y,shoeSupportHeight(direction.y)-heightAboveFloor);
    anatomy.setCapturedLeg(n,hip,knee,ankle,foot,direction);
  }
  return function update(actor,yaw,scale,jump,feet) {
    sampleAttackClip(actor.attackFrame,pose);
    // The capture uses +X for anatomical right. With Three.js forward at
    // +Z and up at +Y, anatomical right is -X.
    const lift=pose[joint.rootMotion+1], sign=actor.mirror?1:-1;
    const ball=actor.contactTarget,root=actor.position;
    read(hips,joint.pelvis,sign,lift);read(chest,joint.chest,sign,lift);read(skull,joint.head,sign,lift);
    for(let n=0;n<2;n++) {
      const source=offsets[actor.mirror?1-n:n];
      for(let i=0;i<source.length;i++)read(vectors[n][i],source[i],sign,lift);
    }
    pelvisForward.subVectors(limbs[0].hip,limbs[1].hip).cross(up).normalize();
    const release=1-THREE.MathUtils.smoothstep(actor.attackFrame,132,139);
    const stride=1+(clamp(actor.attackStrideScale??1,.45,1.25)-1)*release;
    const kneeDrive=actor.attackSlide ? .36*THREE.MathUtils.smoothstep(actor.attackFrame,104,122)*release : 0;
    // Only an extended approach uses extra strides before the captured run.
    // The upright ready pose yields slightly as weight passes over each shoe.
    const leadIn=feet?clamp(actor.attackLeadIn??0,0,1):0;
    if(leadIn){
      const settle=(.055-.18*Math.max(feet[0][1],feet[1][1]))*leadIn;
      hips.y-=settle;chest.y-=settle;skull.y-=settle;
      for(let n=0;n<2;n++){
        const limb=limbs[n],armSwing=clamp(feet[n][2]-feet[1-n][2],-.6,.6)*leadIn;
        for(const point of vectors[n])point.y-=settle;
        for(const point of [limb.elbow,limb.wrist,limb.hand]){
          point.sub(limb.shoulder).applyAxisAngle(lateralAxis,-armSwing).add(limb.shoulder);
        }
      }
    }
    const velocity=actor.spikeVelocity;
    const aimed=Number.isFinite(velocity?.[0])&&Number.isFinite(velocity?.[1])&&Number.isFinite(velocity?.[2])
      &&Math.hypot(...velocity)>1e-6;
    if(aimed){
      // The last ground contacts face the set. Turn in flight and land on
      // that heading so the shoes do not swivel back during recovery.
      const delta=Math.atan2(velocity[0],velocity[2])-yaw;
      const turn=Math.atan2(Math.sin(delta),Math.cos(delta));
      const opening=THREE.MathUtils.smoothstep(actor.attackFrame,132,144);
      // At a directly backwards edited target both turning sides meet.
      // Keep the plant heading there instead of flipping the hips across it.
      const sideWeight=1-THREE.MathUtils.smoothstep(Math.abs(turn),2*Math.PI/3,Math.PI);
      yaw+=clamp(turn,-1.25,1.25)*sideWeight*opening;
      shot.fromArray(velocity).normalize().applyAxisAngle(up,-yaw);
    }
    const group=anatomy.group;
    group.rotation.set(0,yaw,0);group.scale.setScalar(scale);group.position.set(0,jump,0);
    const airborneHeight=Math.max(0,(root?.y||0)+jump);
    const weight=clamp(actor.contactWeight??0,0,1)*clamp(airborneHeight/.12,0,1);
    if(weight>0 && Number.isFinite(ball?.x) && Number.isFinite(ball?.y) && Number.isFinite(ball?.z)
        && Number.isFinite(root?.x) && Number.isFinite(root?.y) && Number.isFinite(root?.z)) {
      const dx=(ball.x-root.x)/scale;
      const dz=(ball.z-root.z)/scale;
      const c=Math.cos(yaw),s=Math.sin(yaw);
      target.set(dx*c-dz*s,(ball.y-root.y-jump)/scale,dx*s+dz*c);
      shoulder.copy(hitShoulder);shoulder.x*=sign;
      palm.copy(hitPalm);palm.x*=sign;
      // Register the pose at impact, not the hand currently winding up. This
      // keeps the whip visible all the way to the near surface of the ball.
      if(aimed)direction.copy(shot);
      else direction.subVectors(target,shoulder).normalize();
      target.addScaledVector(direction,-BALL_RADIUS/scale).sub(palm).clampLength(0,contactReach).multiplyScalar(weight*scale);
      target.y=Math.max(-airborneHeight,target.y);
      group.position.set(target.x*c+target.z*s,jump+target.y,-target.x*s+target.z*c);
    }
    anatomy.setCapturedTrunk(hips,chest,skull,limbs[0],limbs[1]);
    gait.stride=stride;gait.release=release;gait.leadIn=leadIn;
    gait.heightAboveFloor=((root?.y || 0)+group.position.y)/scale;
    groundLine.constant=Number.isFinite(actor.attackTakeoffDepth) && Number.isFinite(root?.z)
      ? ((actor.attackFrame<=132?root.z:actor.attackTakeoffDepth)-3.005)/scale : Infinity;
    groundLine.normal.set(-Math.sin(yaw),0,Math.cos(yaw));
    for(let n=0;n<2;n++) {
      const limb=limbs[n];
      setLeg(n,n===(actor.mirror?0:1)?kneeDrive:0,feet?.[1-n]);
      palm.addVectors(limb.wrist,limb.hand).multiplyScalar(.5);
      direction.subVectors(limb.hand,limb.wrist).normalize();
      const pitch=Math.atan2(Math.hypot(direction.x,direction.z),direction.y);
      const twist=Math.atan2(direction.x,direction.z);
      anatomy.setArm(n,limb.elbow.x,limb.elbow.y,limb.elbow.z,palm.x,palm.y,palm.z,pitch,0,.15,twist);
      if(aimed && n===(actor.mirror?0:1)){
        const opening=THREE.MathUtils.smoothstep(actor.attackFrame,141,145);
        const follow=1-THREE.MathUtils.smoothstep(actor.attackFrame,146,150);
        if(opening*follow>0)aimPalm(n,up,shot,opening*follow);
      }
    }
    anatomy.measureHeight();
  };
}
