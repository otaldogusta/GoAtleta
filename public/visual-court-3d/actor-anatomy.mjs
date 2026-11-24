import * as THREE from './three.module.min.js';

// Elliptical cross-sections give the shirt a chest, waist and shoulder line,
// without an assemblage of visible spheres. Geometry is shared within one rig.
function torsoGeometry(){
 const rings=[[-.5,.155,.105],[-.39,.16,.11],[-.12,.145,.105],[.18,.185,.12],[.38,.205,.115],[.49,.19,.10],[.55,.075,.065]];
 const sides=16,positions=[],indices=[];
 for(const [y,width,depth] of rings)for(let i=0;i<sides;i++){
  const angle=i*Math.PI*2/sides;positions.push(Math.cos(angle)*width,y,Math.sin(angle)*depth);
 }
 for(let row=0;row<rings.length-1;row++)for(let i=0;i<sides;i++){
  const a=row*sides+i,b=row*sides+(i+1)%sides,c=a+sides,d=b+sides;
  indices.push(a,c,b,b,c,d);
 }
 const bottom=positions.length/3;positions.push(0,rings[0][0],0);
 const top=positions.length/3;positions.push(0,rings[rings.length-1][0],0);
 for(let i=0;i<sides;i++){
  const next=(i+1)%sides,offset=(rings.length-1)*sides;
  indices.push(bottom,i,next,top,offset+next,offset+i);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 return geometry;
}

/** Shared solid anatomy; resources belong to this instance only. */
export function createActorAnatomy(parent){
 const group=new THREE.Group();group.name='actor-body';group.scale.setScalar(.95);parent.add(group);
 const material=new THREE.MeshStandardMaterial({color:0xe8757c,roughness:.9,metalness:0});
 const sphere=new THREE.SphereGeometry(1,12,8),cylinder=new THREE.CylinderGeometry(.78,1,1,12),torsoShape=torsoGeometry();
 function mesh(name,geometry){const result=new THREE.Mesh(geometry,material);result.name=name;group.add(result);return result;}
 function oval(name,x,y,z){const result=mesh(name,sphere);result.scale.set(x,y,z);return result;}
 const torso=mesh('torso',torsoShape),pelvis=oval('pelvis',.17,.115,.11);
 const neck=mesh('neck',cylinder),head=oval('head',.102,.135,.105),nose=oval('nose',.017,.023,.021);
 const limbs=[-1,1].map(side=>{
  const name=side<0?'left':'right';
  return {side,
   shoulder:oval(`${name}-shoulder`,.065,.07,.065),elbow:oval(`${name}-elbow`,.052,.052,.047),
   upperArm:mesh(`${name}-upper-arm`,cylinder),forearm:mesh(`${name}-forearm`,cylinder),
   palm:oval(`${name}-palm`,.045,.065,.026),thumb:mesh(`${name}-thumb`,cylinder),
   fingers:Array.from({length:4},(_,i)=>mesh(`${name}-finger-${i}`,cylinder)),
   hip:oval(`${name}-hip`,.09,.085,.09),shorts:mesh(`${name}-shorts`,cylinder),
   thigh:mesh(`${name}-thigh`,cylinder),knee:oval(`${name}-knee`,.072,.075,.07),
   shin:mesh(`${name}-shin`,cylinder),ankle:oval(`${name}-ankle`,.047,.055,.05),foot:oval(`${name}-foot`,.079,.055,.145),
  };
 });
 for(const limb of limbs)limb.digits=[limb.thumb,...limb.fingers];
 const from=new THREE.Vector3(),to=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 function segment(part,ax,ay,az,bx,by,bz,radius,depth=radius){
  from.set(ax,ay,az);to.set(bx,by,bz);direction.subVectors(to,from);
  const length=direction.length();part.position.copy(from).add(to).multiplyScalar(.5);
  part.scale.set(radius,length,depth);part.quaternion.setFromUnitVectors(up,direction.multiplyScalar(1/Math.max(length,1e-9)));
 }
 const fingerPoint=new THREE.Vector3();
 const upperBody=[torso,neck,head,nose,...limbs.flatMap(limb=>[
  limb.shoulder,limb.elbow,limb.upperArm,limb.forearm,limb.palm,limb.thumb,...limb.fingers,
 ])];
 const trunkAngles=new THREE.Euler(0,0,0,'YXZ'),trunkRotation=new THREE.Quaternion();
 function articulateTrunk(pitch,yaw,roll){
  trunkRotation.setFromEuler(trunkAngles.set(pitch,yaw,roll));
  for(const part of upperBody){
   part.position.sub(pelvis.position).applyQuaternion(trunkRotation).add(pelvis.position);
   part.quaternion.premultiply(trunkRotation);
  }
 }
 // The eyes keep reading the play while the hips and chest turn to travel.
 function faceHead(yaw){
  head.rotation.set(0,yaw,0);
  nose.quaternion.copy(head.quaternion);
  nose.position.set(.103*Math.sin(yaw),-.005,.103*Math.cos(yaw)).add(head.position);
 }
 const bodyRight=new THREE.Vector3(),bodyUp=new THREE.Vector3(),bodyForward=new THREE.Vector3(),basis=new THREE.Matrix4();
 for(const geometry of [sphere,cylinder,torsoShape])geometry.computeBoundingBox();
 let shoulderY=1.43,shoulderZ=.025,height=1.8*.95;
 function updateBody(crouch,jump,yaw,scale=.95,lean=0,stride=0,stance=0,stepLift=0,feet=null,feetWeight=0,hipDepthScale=1){
  const bend=crouch/.26,hip=.92-crouch,hipZ=-.13*bend*hipDepthScale;
  shoulderY=1.43-crouch;shoulderZ=.025+lean;
  group.position.set(0,jump,0);group.rotation.set(0,yaw,0);group.scale.setScalar(scale);
  segment(torso,0,hip,hipZ,0,shoulderY,shoulderZ,1,1);pelvis.position.set(0,hip,hipZ);
  pelvis.quaternion.identity();head.quaternion.identity();nose.quaternion.identity();
  segment(neck,0,1.44-crouch,shoulderZ,0,1.58-crouch,shoulderZ,.047);
  head.position.set(0,1.665-crouch,shoulderZ);nose.position.set(0,1.66-crouch,shoulderZ+.103);
  for(let n=0;n<limbs.length;n++){
   const limb=limbs[n],side=limb.side,hipX=side*.095;
   const footYaw=feet?feet[n][3]*feetWeight:0;
   const toeX=.065*Math.sin(footYaw),toeZ=.065*Math.cos(footYaw);
   let lift=Math.max(0,side*stepLift),ankleX=side*(.13+.035*bend+stance),ankleZ=side*stride;
   let kneeX=side*(.12+.025*bend+stance*.5);
   if(feet){
    const foot=feet[n];
    ankleX+=(foot[0]-ankleX)*feetWeight-toeX;
    lift+=(foot[1]-lift)*feetWeight;
    ankleZ+=(foot[2]-ankleZ)*feetWeight+(1-feetWeight)*.065-toeZ;
   }
   const ankleY=.095+lift;
   let kneeY=.49-.35*crouch+.6*lift,kneeZ=.18*bend+ankleZ*.5;
   if(feet){
    // Solve the knee between the hip and planted ankle, bending forward (+Z).
    const dx=ankleX-hipX,dy=ankleY-hip,dz=ankleZ-hipZ;
    const horizontal=Math.hypot(dx,dy),distance=Math.hypot(horizontal,dz);
    const bendDistance=Math.sqrt(Math.max(0,.46**2-distance**2/4));
    const bendScale=bendDistance/(Math.max(1e-6,distance)*Math.max(1e-6,horizontal));
    kneeX+=(hipX+dx*.5-dx*dz*bendScale-kneeX)*feetWeight;
    kneeY+=(hip+dy*.5-dy*dz*bendScale-kneeY)*feetWeight;
    kneeZ+=(hipZ+dz*.5+horizontal**2*bendScale-kneeZ)*feetWeight;
   }
   limb.shoulder.position.set(side*.18,shoulderY,shoulderZ);
   limb.shoulder.quaternion.identity();limb.elbow.quaternion.identity();
   limb.hip.position.set(hipX,hip,hipZ);limb.knee.position.set(kneeX,kneeY,kneeZ);limb.ankle.position.set(ankleX,ankleY,ankleZ);
   segment(limb.thigh,hipX,hip,hipZ,kneeX,kneeY,kneeZ,.09);
   segment(limb.shorts,hipX,hip+.03,hipZ,hipX+(kneeX-hipX)*.34,hip+(kneeY-hip)*.34,hipZ+(kneeZ-hipZ)*.34,.105);
   segment(limb.shin,kneeX,kneeY,kneeZ,ankleX,ankleY,ankleZ,.067);
   limb.foot.position.set(ankleX+toeX,.055+lift,ankleZ+toeZ);
   limb.foot.rotation.set(0,footYaw,0);
  }
 }
 const handRoll=new THREE.Quaternion();
 function setArm(n,elbowX,elbowY,elbowZ,handX,handY,handZ,pitch=0,palmTilt=0,fan=0,handYaw=0,relaxedGrip=0){
  const limb=limbs[n],side=limb.side;
  limb.elbow.position.set(elbowX,elbowY,elbowZ);
  segment(limb.upperArm,limb.shoulder.position.x,limb.shoulder.position.y,limb.shoulder.position.z,elbowX,elbowY,elbowZ,.06);
  segment(limb.forearm,elbowX,elbowY,elbowZ,handX,handY,handZ,.047);
  limb.palm.position.set(handX,handY,handZ);limb.palm.rotation.set(pitch,handYaw,palmTilt,'YXZ');
  const cosine=Math.cos(pitch),sine=Math.sin(pitch),cy=Math.cos(handYaw),sy=Math.sin(handYaw);
  for(let finger=0;finger<4;finger++){
   const dx=(finger-1.5)*.021,tip=.085-Math.max(0,Math.abs(finger-1.5)-.5)*.008-.023*relaxedGrip;
   const curl=.015+.021*relaxedGrip;
   const tipX=dx*(1.3-.34*relaxedGrip)+side*.025*fan,startZ=.035*sine,tipZ=tip*sine+curl*cosine;
   segment(limb.fingers[finger],handX+dx*cy+startZ*sy,handY+.035*cosine,handZ-dx*sy+startZ*cy,handX+tipX*cy+tipZ*sy,handY+tip*cosine-curl*sine,handZ-tipX*sy+tipZ*cy,.009);
  }
  const startX=-side*.032,startZ=-.01*sine,tipX=-side*.068,tipZ=.022*sine+.012*cosine;
  segment(limb.thumb,handX+startX*cy+startZ*sy,handY-.01*cosine,handZ-startX*sy+startZ*cy,handX+tipX*cy+tipZ*sy,handY+.022*cosine-.012*sine,handZ-tipX*sy+tipZ*cy,.013);
  if(relaxedGrip>0){
   // Roll palm and fingers together about the forearm, thumb toward the sky.
   handRoll.setFromAxisAngle(direction.set(sy*sine,cosine,cy*sine),-side*1.15*relaxedGrip);
   limb.palm.quaternion.premultiply(handRoll);
   for(const digit of limb.digits){
    digit.position.sub(limb.palm.position).applyQuaternion(handRoll).add(limb.palm.position);
    digit.quaternion.premultiply(handRoll);
   }
  }
 }
 // The captured landmarks animate the same meshes as the procedural poses.
 // The shirt's local X axis follows the shoulder line so its twist is visible.
 function orientBody(part,left,right,spine,leftIsNegativeX){
  bodyRight.subVectors(left,right);
  if(leftIsNegativeX)bodyRight.negate();
  bodyForward.crossVectors(bodyRight,spine).normalize();
  bodyRight.crossVectors(spine,bodyForward).normalize();
  basis.makeBasis(bodyRight,spine,bodyForward);part.quaternion.setFromRotationMatrix(basis);
 }
 function setCapturedTrunk(hips,chest,skull,left,right,leftIsNegativeX=false){
  segment(torso,hips.x,hips.y,hips.z,chest.x,chest.y,chest.z,1,1);
  bodyUp.subVectors(chest,hips).normalize();orientBody(torso,left.shoulder,right.shoulder,bodyUp,leftIsNegativeX);
  pelvis.position.copy(hips);orientBody(pelvis,left.hip,right.hip,bodyUp,leftIsNegativeX);
  bodyUp.subVectors(skull,chest).normalize();
  segment(neck,chest.x,chest.y,chest.z,skull.x-bodyUp.x*.075,skull.y-bodyUp.y*.075,skull.z-bodyUp.z*.075,.047);
  head.position.copy(skull);orientBody(head,left.shoulder,right.shoulder,bodyUp,leftIsNegativeX);
  nose.position.copy(skull).addScaledVector(bodyForward,.103).addScaledVector(bodyUp,-.005);
  limbs[0].shoulder.position.copy(left.shoulder);limbs[1].shoulder.position.copy(right.shoulder);
 }
 function setCapturedLeg(n,hip,knee,ankle,foot,direction){
  const limb=limbs[n];
  limb.hip.position.copy(hip);limb.knee.position.copy(knee);limb.ankle.position.copy(ankle);
  segment(limb.thigh,hip.x,hip.y,hip.z,knee.x,knee.y,knee.z,.09);
  segment(limb.shorts,hip.x,hip.y+.03,hip.z,hip.x+(knee.x-hip.x)*.34,hip.y+(knee.y-hip.y)*.34,hip.z+(knee.z-hip.z)*.34,.105);
  segment(limb.shin,knee.x,knee.y,knee.z,ankle.x,ankle.y,ankle.z,.067);
  limb.foot.position.copy(foot);
  // Keep the sole level across its width even when turning to face the net.
  limb.foot.rotation.set(-Math.asin(Math.max(-1,Math.min(1,direction.y))),Math.atan2(direction.x,direction.z),0,'YXZ');
 }
 function measureHeight(){
  let top=0;
  for(let n=0;n<group.children.length;n++){
   const part=group.children[n],box=part.geometry.boundingBox;part.updateMatrix();
   const e=part.matrix.elements;
   fingerPoint.set(e[1]>=0?box.max.x:box.min.x,e[5]>=0?box.max.y:box.min.y,e[9]>=0?box.max.z:box.min.z).applyMatrix4(part.matrix);
   top=Math.max(top,fingerPoint.y);
  }
  height=group.position.y+top*group.scale.y;return height;
 }
 return {group,updateBody,setArm,articulateTrunk,faceHead,setCapturedTrunk,setCapturedLeg,measureHeight,get height(){return height;}};
}
