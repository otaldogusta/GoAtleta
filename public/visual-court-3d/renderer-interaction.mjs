import * as THREE from './three.module.min.js';

/** Match the existing 1.9 m pick cylinder to the raised body, not empty floor space. */
export function updateActorPickVolume(pick,totalHeight,jump=0){
 const rise=Number.isFinite(jump)?Math.max(0,jump):0;
 const bodyHeight=Number.isFinite(totalHeight)&&totalHeight>rise?totalHeight-rise:1.9;
 pick.position.y=rise+bodyHeight/2;pick.scale.y=bodyHeight/1.9;
}

/** A local, non-rendered hit surface: depth still comes from the actual court plane. */
export function targetPickSurface(radius,id){
 const pick=new THREE.Mesh(new THREE.CircleGeometry(radius+.018,48),new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide,depthWrite:false}));
 pick.rotation.x=-Math.PI/2;pick.userData.objectId=id;pick.userData.pickOnly=true;return pick;
}
function visibleObject(object){
 for(let current=object;current;current=current.parent)if(!current.visible||current.userData.interactionIgnore)return false;
 return true;
}
function selectableObject(id,frame){
 if(!frame||!id)return null;
 const actor=frame.actors.find(item=>item.id===id),drawing=frame.drawings.find(item=>item.id===id),object=actor||drawing;
 return object&&!object.hidden&&!(frame.hide||[]).includes(actor?'actors':'drawings')?object:null;
}
export function pickCourtHit(ray,roots,frame){
 const hit=ray.intersectObjects(roots,true).find(hit=>visibleObject(hit.object)&&selectableObject(hit.object.userData.objectId,frame));
 return hit?{id:hit.object.userData.objectId,point:hit.point.clone(),distance:hit.distance}:null;
}
export function pickCourtObject(ray,roots,frame){
 return pickCourtHit(ray,roots,frame)?.id||null;
}

/** Expand only solid objects for a finger. Exact visible geometry always wins;
 * annotations retain their own hit geometry instead of acquiring a large box.
 * Screen-space tolerance remains the same after zoom, rotation and elevation.
 */
export function pickCourtTouchHit(ray,roots,frame,camera,pointer,viewport,radius=22){
 const exact=pickCourtHit(ray,roots,frame);if(exact)return exact;
 if(![pointer?.x,pointer?.y,viewport?.width,viewport?.height,radius].every(Number.isFinite)||viewport.width<=0||viewport.height<=0||radius<0)return null;
 const solidKinds=new Set(['ball','cone','target','ladder']),bounds=new Map();
 for(const root of roots)root.traverse(object=>{
  const id=object.userData.objectId,entry=selectableObject(id,frame);
  if(!entry||!visibleObject(object)||!object.geometry||!frame.actors.some(actor=>actor.id===id)&&!solidKinds.has(entry.kind))return;
  if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();
  if(!object.geometry.boundingBox||object.geometry.boundingBox.isEmpty())return;
  const world=object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
  if(bounds.has(id))bounds.get(id).union(world);else bounds.set(id,world);
 });
 let nearest=null;
 for(const [id,box] of bounds){
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,visible=true;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
   const projected=new THREE.Vector3(x,y,z).project(camera);
   if(projected.z < -1||projected.z > 1||!Number.isFinite(projected.x+projected.y)){visible=false;continue;}
   const sx=(projected.x*.5+.5)*viewport.width,sy=(.5-projected.y*.5)*viewport.height;
   left=Math.min(left,sx);right=Math.max(right,sx);top=Math.min(top,sy);bottom=Math.max(bottom,sy);
  }
  if(!visible)continue;
  const miss=Math.hypot(Math.max(left-pointer.x,0,pointer.x-right),Math.max(top-pointer.y,0,pointer.y-bottom));
  if(miss>Math.min(radius,22))continue;
  const point=box.getCenter(new THREE.Vector3()),distance=ray.ray.origin.distanceTo(point);
  if(!nearest||miss<nearest.miss-1e-6||Math.abs(miss-nearest.miss)<=1e-6&&distance<nearest.distance)nearest={id,point,distance,miss};
 }
 return nearest?{id:nearest.id,point:nearest.point,distance:nearest.distance}:null;
}
export function courtHoverState(id,frame,packet,pointerType='mouse',busy=false){
 if(pointerType==='touch'||busy||!packet||packet.active===false||packet.disabled||!['select','animate'].includes(packet.tool||'select'))return null;
 const object=selectableObject(id,frame);return object?{id:object.id,cursor:object.locked?'pointer':'grab'}:null;
}

/** Reversible material tint; it neither creates outlines nor touches authored frame data. */
export function createCourtHoverPainter(){
 let restore=[];const tint=new THREE.Color('#b9e0ff'),lightTint=new THREE.Color('#72b6ef');
 const clear=()=>{for(const item of restore){item.material.color.copy(item.color);item.material.opacity=item.opacity;}restore=[];};
 return {clear,paint(root){
  clear();if(!root)return;
  const materials=new Set();root.traverse(object=>{
   if(!visibleObject(object)||object.userData.pickOnly)return;
   for(const material of [].concat(object.material||[]))if(material.visible&&material.color&&!materials.has(material)){
    materials.add(material);restore.push({material,color:material.color.clone(),opacity:material.opacity});
    const light=Math.min(material.color.r,material.color.g,material.color.b)>.7;
    material.color.lerp(light?lightTint:tint,light?.48:.22);if(material.transparent)material.opacity=Math.min(1,material.opacity+.08);
   }
  });
 }};
}
