import * as THREE from './three.module.min.js';
import {createCourtShoeGeometry} from './court-shoe.mjs';

// Cross sections from the Blender athlete. Y runs from the first joint
// (-.5) to the second (+.5); widths and depths stay in metres as limbs flex.
function profileGeometry(rings,sides=16){
 const positions=[],indices=[];
 for(const [y,width,depth] of rings)for(let i=0;i<sides;i++){
  const angle=i*Math.PI*2/sides;positions.push(Math.cos(angle)*width,y,Math.sin(angle)*depth);
 }
 for(let row=0;row<rings.length-1;row++)for(let i=0;i<sides;i++){
  const a=row*sides+i,b=row*sides+(i+1)%sides,c=a+sides,d=b+sides;
  indices.push(a,c,b,b,c,d);
 }
 // Keep flat cap normals off the rounded limb. The end rings sit inside
 // the joints so bending the knee cannot reveal a zigzag of shaded caps.
 for(const row of [0,rings.length-1]){
  const cap=positions.length/3;
  positions.push(...positions.slice(row*sides*3,(row+1)*sides*3));
  const center=positions.length/3;positions.push(0,rings[row][0],0);
  for(let i=0;i<sides;i++){
   const a=cap+i,b=cap+(i+1)%sides;
   if(row===0)indices.push(center,a,b);else indices.push(center,b,a);
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 return geometry;
}

// All ten pads share these two shape keys. The Blender knuckle bows the
// digit in local +Z. At zero weight the original straight cylinder is used.
function digitGeometry(){
 const rings=[0,.16,.32,.48,.64,.8,.90,.94,.97,.985,.995,1];
 const geometry=new THREE.CylinderGeometry(.78,1,1,12,rings.length-1);
 const positions=geometry.getAttribute('position'),bend=positions.clone(),pad=positions.clone();
 for(let i=0;i<positions.count;i++){
  const u=positions.getY(i)+.5,t=rings[Math.round(u*(rings.length-1))];
  const radius=(1-.22*t)/(1-.22*u),x=positions.getX(i)*radius,z=positions.getZ(i)*radius;
  positions.setXYZ(i,x,t-.5,z);
  bend.setXYZ(i,0,0,3*4*t*(1-t));
  const cap=Math.max(0,(t-.90)/.10);
  const taper=.96*(Math.sqrt(Math.max(0,1-cap*cap))-1);
  pad.setXYZ(i,x*taper,0,z*taper);
 }
 // Bake normals for each shape as well, so the pads catch the court light
 // across the rounded end and the bent knuckle at inspection zoom.
 const shapeNormals=[bend,pad].map(delta=>{
  const shaped=geometry.clone(),vertices=shaped.getAttribute('position');
  for(let i=0;i<vertices.array.length;i++)vertices.array[i]+=delta.array[i];
  shaped.computeVertexNormals();
  const normals=shaped.getAttribute('normal'),rest=geometry.getAttribute('normal');
  for(let i=0;i<normals.array.length;i++)normals.array[i]-=rest.array[i];
  return normals;
 });
 geometry.morphTargetsRelative=true;
 geometry.morphAttributes.position=[bend,pad];
 geometry.morphAttributes.normal=shapeNormals;
 geometry.computeBoundingBox();
 return geometry;
}

/** Shared solid anatomy; resources belong to this instance only. */
export function createActorAnatomy(parent){
 const group=new THREE.Group();group.name='actor-body';group.scale.setScalar(.95);parent.add(group);
 const material=new THREE.MeshStandardMaterial({color:0xe8757c,roughness:.9,metalness:0});
 const sphere=new THREE.SphereGeometry(1,16,10),cylinder=new THREE.CylinderGeometry(.78,1,1,12);
 const shoeShape=createCourtShoeGeometry();
 const torsoShape=profileGeometry([[-.55,.155,.107],[-.42,.171,.120],[-.15,.157,.108],[.15,.191,.127],[.32,.207,.125],[.425,.195,.098],[.5,.086,.075]],16);
 const upperArmShape=profileGeometry([[-.50,.050,.048],[-.43,.074,.069],[-.27,.075,.068],[-.16,.069,.062],[-.15,.063,.058],[0,.061,.057],[.24,.054,.051],[.44,.045,.044],[.5,.032,.031]]);
 const forearmShape=profileGeometry([[-.50,.030,.031],[-.43,.045,.043],[-.29,.055,.054],[-.03,.045,.046],[.28,.032,.032],[.5,.030,.031]]);
 const shortsShape=profileGeometry([[-.5,.053,.060],[-.38,.084,.088],[-.20,.098,.100],[.06,.104,.102],[.46,.092,.090],[.5,.090,.087]]);
 const thighShape=profileGeometry([[-.50,.082,.082],[-.26,.083,.081],[.03,.079,.078],[.32,.061,.059],[.44,.054,.052],[.5,.039,.037]]);
 const shinShape=profileGeometry([[-.50,.037,.037],[-.44,.050,.052],[-.32,.057,.061],[-.22,.060,.066],[-.08,.055,.063],[.18,.041,.045],[.36,.034,.036],[.50,.025,.025]]);
 function mesh(name,geometry){const result=new THREE.Mesh(geometry,material);result.name=name;group.add(result);return result;}
 function oval(name,x,y,z){const result=mesh(name,sphere);result.scale.set(x,y,z);return result;}
 const torso=mesh('torso',torsoShape),pelvis=oval('pelvis',.17,.115,.11);
 const neck=mesh('neck',cylinder),head=oval('head',.102,.135,.105),nose=oval('nose',.017,.023,.021);
 let digitShape;
 const limbs=[-1,1].map(side=>{
  const name=side<0?'left':'right';
  return {side,
   shoulder:oval(`${name}-shoulder`,.073,.077,.069),elbow:oval(`${name}-elbow`,.047,.048,.045),
   upperArm:mesh(`${name}-upper-arm`,upperArmShape),forearm:mesh(`${name}-forearm`,forearmShape),
   palm:oval(`${name}-palm`,.045,.065,.026),thumb:mesh(`${name}-thumb`,cylinder),
   fingers:Array.from({length:4},(_,i)=>mesh(`${name}-finger-${i}`,cylinder)),
   hip:oval(`${name}-hip`,.092,.087,.096),shorts:mesh(`${name}-shorts`,shortsShape),
   thigh:mesh(`${name}-thigh`,thighShape),knee:oval(`${name}-knee`,.056,.060,.054),
   shin:mesh(`${name}-shin`,shinShape),ankle:oval(`${name}-ankle`,.034,.043,.036),foot:mesh(`${name}-foot`,shoeShape),
  };
 });
 for(const limb of limbs)limb.digits=[limb.thumb,...limb.fingers];
 function useSettingDigits(limb,open){
  if(open&&!digitShape){
   digitShape=digitGeometry();
   // The renderer disposes attached geometry. Release the cached hand as
   // well if the actor is removed while posing with the regular cylinders.
   cylinder.addEventListener('dispose',()=>{
    if(!limbs.some(hand=>hand.thumb.geometry===digitShape))digitShape.dispose();
   });
  }
  const geometry=open?digitShape:cylinder;
  if(limb.thumb.geometry===geometry)return;
  for(const digit of limb.digits){
   digit.geometry=geometry;
   if(open){
    digit.updateMorphTargets();
    digit.boundingBox=cylinder.boundingBox.clone();
   }else{
    delete digit.boundingBox;
    delete digit.morphTargetInfluences;
    delete digit.morphTargetDictionary;
   }
  }
 }
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
 const legAxis=new THREE.Vector3(),kneeForward=new THREE.Vector3();
 for(const geometry of [sphere,cylinder,torsoShape,upperArmShape,forearmShape,shortsShape,thighShape,shinShape])geometry.computeBoundingBox();
 let shoulderY=1.43,shoulderZ=.025,height=1.8*.95;
 function updateBody(crouch,jump,yaw,scale=.95,lean=0,stride=0,stance=0,stepLift=0,feet=null,feetWeight=0,hipDepthScale=1){
  const bend=crouch/.26,hip=.92-crouch,hipZ=-.13*bend*hipDepthScale;
  shoulderY=1.43-crouch;shoulderZ=.025+lean;
  group.position.set(0,jump,0);group.rotation.set(0,yaw,0);group.scale.setScalar(scale);
  segment(torso,0,hip,hipZ,0,shoulderY,shoulderZ,1,1);pelvis.position.set(0,hip,hipZ);
  pelvis.quaternion.identity();head.quaternion.identity();nose.quaternion.identity();
  segment(neck,0,1.40-crouch,shoulderZ,0,1.58-crouch,shoulderZ,.047);
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
    // Flex toward this shoe's toes, including the outside foot in a block.
    const dx=ankleX-hipX,dy=ankleY-hip,dz=ankleZ-hipZ;
    const distance=legAxis.set(dx,dy,dz).length();
    legAxis.normalize();
    kneeForward.set(Math.sin(footYaw),0,Math.cos(footYaw)).projectOnPlane(legAxis).normalize();
    const bendDistance=Math.sqrt(Math.max(0,.46**2-distance**2/4));
    kneeX+=(hipX+dx*.5+kneeForward.x*bendDistance-kneeX)*feetWeight;
    kneeY+=(hip+dy*.5+kneeForward.y*bendDistance-kneeY)*feetWeight;
    kneeZ+=(hipZ+dz*.5+kneeForward.z*bendDistance-kneeZ)*feetWeight;
   }
   limb.shoulder.position.set(side*.18,shoulderY,shoulderZ);
   limb.shoulder.quaternion.identity();limb.elbow.quaternion.identity();
   limb.hip.position.set(hipX,hip,hipZ);limb.knee.position.set(kneeX,kneeY,kneeZ);limb.ankle.position.set(ankleX,ankleY,ankleZ);
   shapeLeg(limb,limb.hip.position,limb.knee.position,limb.ankle.position);
   limb.foot.position.set(ankleX+toeX,.055+lift,ankleZ+toeZ);
   limb.foot.scale.x=-side;
   limb.foot.rotation.set(0,footYaw,0);
  }
 }
 const handRoll=new THREE.Quaternion();
 function seatSettingWrist(n,openness){
  const {forearm,elbow,palm}=limbs[n];
  // The captured hand marker is at the centre of the palm. Join the visible
  // forearm to its heel so an extended wrist still shows the whole palm.
  fingerPoint.set(0,-.044*openness,0).applyQuaternion(palm.quaternion).add(palm.position);
  const e=elbow.position,w=fingerPoint;
  segment(forearm,e.x,e.y,e.z,w.x,w.y,w.z,1);
 }
 function setArm(n,elbowX,elbowY,elbowZ,handX,handY,handZ,pitch=0,palmTilt=0,fan=0,handYaw=0,relaxedGrip=0,palmUp=0,setting=false){
  const limb=limbs[n],side=limb.side;
  useSettingDigits(limb,setting);
  limb.elbow.position.set(elbowX,elbowY,elbowZ);
  segment(limb.upperArm,limb.shoulder.position.x,limb.shoulder.position.y,limb.shoulder.position.z,elbowX,elbowY,elbowZ,1);
  segment(limb.forearm,elbowX,elbowY,elbowZ,handX,handY,handZ,1);
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
  if(relaxedGrip>0||palmUp>0){
   // Roll the whole hand about its long axis, including the thumb.
   handRoll.setFromAxisAngle(direction.set(sy*sine,cosine,cy*sine),-side*(1.15*relaxedGrip+Math.PI*palmUp));
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
  // Captured spikes use the opposite side naming to the reception skeleton.
  for(const limb of limbs)limb.foot.scale.x=leftIsNegativeX?-limb.side:limb.side;
  segment(torso,hips.x,hips.y,hips.z,chest.x,chest.y,chest.z,1,1);
  bodyUp.subVectors(chest,hips).normalize();orientBody(torso,left.shoulder,right.shoulder,bodyUp,leftIsNegativeX);
  pelvis.position.copy(hips);orientBody(pelvis,left.hip,right.hip,bodyUp,leftIsNegativeX);
  bodyUp.subVectors(skull,chest).normalize();
  segment(neck,chest.x,chest.y,chest.z,skull.x-bodyUp.x*.075,skull.y-bodyUp.y*.075,skull.z-bodyUp.z*.075,.047);
  head.position.copy(skull);orientBody(head,left.shoulder,right.shoulder,bodyUp,leftIsNegativeX);
  nose.position.copy(skull).addScaledVector(bodyForward,.103).addScaledVector(bodyUp,-.005);
  limbs[0].shoulder.position.copy(left.shoulder);limbs[1].shoulder.position.copy(right.shoulder);
 }
 function shapeLeg(limb,hip,knee,ankle){
  segment(limb.thigh,hip.x,hip.y,hip.z,knee.x,knee.y,knee.z,1);
  segment(limb.shorts,hip.x,hip.y+.03,hip.z,hip.x+(knee.x-hip.x)*.43,hip.y+(knee.y-hip.y)*.43,hip.z+(knee.z-hip.z)*.43,1);
  segment(limb.shin,knee.x,knee.y,knee.z,ankle.x,ankle.y,ankle.z,1);
 }
 function setCapturedLeg(n,hip,knee,ankle,foot,direction){
  const limb=limbs[n];
  limb.hip.position.copy(hip);limb.knee.position.copy(knee);limb.ankle.position.copy(ankle);
  shapeLeg(limb,hip,knee,ankle);
  limb.foot.position.copy(foot);
  // Keep the sole level across its width even when turning to face the net.
  limb.foot.rotation.set(-Math.asin(Math.max(-1,Math.min(1,direction.y))),Math.atan2(direction.x,direction.z),0,'YXZ');
 }
 function measureHeight(){
  let top=0;
  for(let n=0;n<group.children.length;n++){
   const part=group.children[n],box=part.boundingBox??part.geometry.boundingBox;part.updateMatrix();
   const e=part.matrix.elements;
   fingerPoint.set(e[1]>=0?box.max.x:box.min.x,e[5]>=0?box.max.y:box.min.y,e[9]>=0?box.max.z:box.min.z).applyMatrix4(part.matrix);
   top=Math.max(top,fingerPoint.y);
  }
  height=group.position.y+top*group.scale.y;return height;
 }
 return {group,updateBody,setArm,seatSettingWrist,articulateTrunk,faceHead,setCapturedTrunk,setCapturedLeg,measureHeight,get height(){return height;}};
}
