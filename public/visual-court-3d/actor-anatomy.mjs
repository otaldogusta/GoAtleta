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
 const from=new THREE.Vector3(),to=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 function segment(part,ax,ay,az,bx,by,bz,radius,depth=radius){
  from.set(ax,ay,az);to.set(bx,by,bz);direction.subVectors(to,from);
  const length=direction.length();part.position.copy(from).add(to).multiplyScalar(.5);
  part.scale.set(radius,length,depth);part.quaternion.setFromUnitVectors(up,direction.multiplyScalar(1/Math.max(length,1e-9)));
 }
 const fingerPoint=new THREE.Vector3();
 for(const geometry of [sphere,cylinder,torsoShape])geometry.computeBoundingBox();
 let shoulderY=1.43,shoulderZ=.025,height=1.8*.95;
 function updateBody(crouch,jump,yaw,scale=.95,lean=0,stride=0,stance=0,stepLift=0){
  const bend=crouch/.26,hip=.92-crouch,hipZ=-.13*bend;
  shoulderY=1.43-crouch;shoulderZ=.025+lean;
  group.position.y=jump;group.rotation.set(0,yaw,0);group.scale.setScalar(scale);
  segment(torso,0,hip,hipZ,0,shoulderY,shoulderZ,1,1);pelvis.position.set(0,hip,hipZ);
  segment(neck,0,1.44-crouch,shoulderZ,0,1.58-crouch,shoulderZ,.047);
  head.position.set(0,1.665-crouch,shoulderZ);nose.position.set(0,1.66-crouch,shoulderZ+.103);
  for(let n=0;n<limbs.length;n++){
   const limb=limbs[n],side=limb.side,hipX=side*.095,kneeX=side*(.12+.025*bend+stance*.5);
   const lift=Math.max(0,side*stepLift),kneeY=.49-.35*crouch+.6*lift;
   const kneeZ=.18*bend+side*stride*.5,ankleX=side*(.13+.035*bend+stance),ankleY=.095+lift,ankleZ=side*stride;
   limb.shoulder.position.set(side*.18,shoulderY,shoulderZ);
   limb.hip.position.set(hipX,hip,hipZ);limb.knee.position.set(kneeX,kneeY,kneeZ);limb.ankle.position.set(ankleX,ankleY,ankleZ);
   segment(limb.thigh,hipX,hip,hipZ,kneeX,kneeY,kneeZ,.09);
   segment(limb.shorts,hipX,hip+.03,hipZ,hipX+(kneeX-hipX)*.34,hip+(kneeY-hip)*.34,hipZ+(kneeZ-hipZ)*.34,.105);
   segment(limb.shin,kneeX,kneeY,kneeZ,ankleX,ankleY,ankleZ,.067);
   limb.foot.position.set(ankleX,.055+lift,ankleZ+.065);
  }
 }
 function setArm(n,elbowX,elbowY,elbowZ,handX,handY,handZ,pitch=0,palmTilt=0,fan=0,handYaw=0){
  const limb=limbs[n],side=limb.side;
  limb.elbow.position.set(elbowX,elbowY,elbowZ);
  segment(limb.upperArm,side*.18,shoulderY,shoulderZ,elbowX,elbowY,elbowZ,.06);
  segment(limb.forearm,elbowX,elbowY,elbowZ,handX,handY,handZ,.047);
  limb.palm.position.set(handX,handY,handZ);limb.palm.rotation.set(pitch,handYaw,palmTilt,'YXZ');
  const cosine=Math.cos(pitch),sine=Math.sin(pitch),cy=Math.cos(handYaw),sy=Math.sin(handYaw);
  for(let finger=0;finger<4;finger++){
   const dx=(finger-1.5)*.021,tip=.085-Math.max(0,Math.abs(finger-1.5)-.5)*.008;
   const tipX=dx*1.3+side*.025*fan,startZ=.035*sine,tipZ=tip*sine+.015*cosine;
   segment(limb.fingers[finger],handX+dx*cy+startZ*sy,handY+.035*cosine,handZ-dx*sy+startZ*cy,handX+tipX*cy+tipZ*sy,handY+tip*cosine-.015*sine,handZ-tipX*sy+tipZ*cy,.009);
  }
  const startX=-side*.032,startZ=-.01*sine,tipX=-side*.068,tipZ=.022*sine+.012*cosine;
  segment(limb.thumb,handX+startX*cy+startZ*sy,handY-.01*cosine,handZ-startX*sy+startZ*cy,handX+tipX*cy+tipZ*sy,handY+.022*cosine-.012*sine,handZ-tipX*sy+tipZ*cy,.013);
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
 return {group,updateBody,setArm,measureHeight,get height(){return height;}};
}
