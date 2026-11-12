import * as THREE from './three.module.min.js';

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
export function pickCourtObject(ray,roots,frame){
 const hit=ray.intersectObjects(roots,true).find(hit=>visibleObject(hit.object)&&selectableObject(hit.object.userData.objectId,frame));
 return hit?.object.userData.objectId||null;
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
