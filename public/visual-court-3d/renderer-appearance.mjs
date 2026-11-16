import * as THREE from './three.module.min.js';

/** Lighting is reserved for solid objects; annotation ink and player sprites stay unlit. */
export function courtSolidMaterial(color,kind='material',map=null){
 const ball=kind==='ball',post=kind==='post';
 return new THREE.MeshStandardMaterial({color,map,roughness:ball?.58:post?.58:.78,metalness:post?.12:0,
  emissive:color,emissiveMap:map,emissiveIntensity:ball?.08:.035});
}

let shadowTexture;
function contactTexture(){
 if(shadowTexture)return shadowTexture;
 const size=64,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const radius=Math.hypot((x+.5-size/2)/(size/2),(y+.5-size/2)/(size/2));
  const edge=Math.min(1,Math.max(0,(1-radius)/.28)),smooth=edge*edge*(3-2*edge);
  data[(y*size+x)*4+3]=Math.round(255*Math.exp(-3*radius*radius)*smooth);
 }
 shadowTexture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
 shadowTexture.magFilter=THREE.LinearFilter;shadowTexture.minFilter=THREE.LinearFilter;shadowTexture.needsUpdate=true;
 return shadowTexture;
}

/** One shared radial texture, with no shadow-map pass or continuously running animation. */
export function createContactShadow(kind,size=.28){
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({
  map:contactTexture(),transparent:true,opacity:0,depthWrite:false,toneMapped:false,
 }));
 shadow.rotation.x=-Math.PI/2;shadow.userData.interactionIgnore=true;
 shadow.userData.contactKind=kind;shadow.userData.contactSize=size;
 return shadow;
}

export function contactShadowProfile(kind,size=.28,height=0){
 const rise=Number.isFinite(height)?Math.max(0,Math.min(8,height)):0;
 const unit=Number.isFinite(size)?Math.max(.12,Math.min(.8,size)):.28;
 const [x,z,opacity]=kind==='actor'?[.4,.3,.34]:kind==='ball'?[.21,.21,.38]:kind==='ladder'?[unit*.85,unit*2.2,.28]:kind==='target'?[unit*1.15,unit*1.15,.25]:[unit*.8,unit*.8,.34];
 const spread=1+rise*.16;
 return {x:x*spread,z:z*spread,opacity:opacity/(1+rise*.38)};
}

/** Parent may be elevated: only the projected shadow stays on the floor. */
export function updateContactShadow(shadow,parentHeight,height=parentHeight,rotation=0){
 const profile=contactShadowProfile(shadow.userData.contactKind,shadow.userData.contactSize,height);
 shadow.position.y=.009-parentHeight;
 shadow.scale.set(profile.x,profile.z,1);shadow.material.opacity=profile.opacity;
 shadow.rotation.z=-rotation*Math.PI/180;
}
