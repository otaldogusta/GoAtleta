import * as THREE from './three.module.min.js';
// Articulated blocker: shoulders share the body's vertical plane; hands stay in court space.
export function createBlocker(parent,textures){
 const group=new THREE.Group();group.scale.setScalar(.95);parent.add(group);
 const material=new THREE.MeshBasicMaterial({color:0xe8757c});
 const sphere=new THREE.SphereGeometry(1,12,8),cylinder=new THREE.CylinderGeometry(.75,1,1,12);
 function oval(scale){const m=new THREE.Mesh(sphere,material);m.scale.set(...scale);group.add(m);return m;}
 // Reuse the same human body silhouette as the other players; only arms are articulated.
 // The material masks the original arms during rendering; source textures are unchanged.
 const bodyMaterial=new THREE.MeshBasicMaterial({map:textures.ready,color:0xe8757c,transparent:true,alphaTest:.04,depthWrite:false,side:THREE.DoubleSide});
 const dimensions={value:new THREE.Vector2(.6,1.8)};
 bodyMaterial.onBeforeCompile=shader=>{shader.uniforms.bodyDimensions=dimensions;shader.fragmentShader='uniform vec2 bodyDimensions;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 float bodyX=abs(vMapUv.x-.5)*bodyDimensions.x;
 float bodyY=vMapUv.y*bodyDimensions.y;
 float silhouetteEdge=mix(.23,.17,smoothstep(.90,1.12,bodyY));
 if(bodyY>.60 && bodyY<1.48 && bodyX>silhouetteEdge) discard;`);};
 // Face only the camera's azimuth. A full billboard tilts the torso away from
 // its 3D arms when the camera rises, separating the shoulders on screen.
 const body=new THREE.Mesh(new THREE.PlaneGeometry(1,1).translate(0,.5,0),bodyMaterial);group.add(body);
 const segments=[];
 function segment(radius){const m=new THREE.Mesh(cylinder,material);group.add(m);segments.push({m,radius});return segments.length-1;}
 const arms=[segment(.055),segment(.043),segment(.055),segment(.043)];
 const shoulders=[oval([.065,.075,.05]),oval([.065,.075,.05])];
 const elbows=[oval([.052,.052,.045]),oval([.052,.052,.045])];
 const palms=[oval([.045,.065,.026]),oval([.045,.065,.026])];
 const fingers=Array.from({length:10},()=>segment(.009));
 const from=new THREE.Vector3(),to=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 const bodyRight=new THREE.Vector3(1,0,0),bodyNormal=new THREE.Vector3(0,0,1),inverse=new THREE.Quaternion();
 function place(index,a,b){const {m,radius}=segments[index];from.set(...a);to.set(...b);direction.subVectors(to,from);m.position.copy(from).add(to).multiplyScalar(.5);m.scale.set(radius,direction.length(),radius);m.quaternion.setFromUnitVectors(up,direction.normalize());}
 function update({jump=0,crouch=0,extension=0,handAngle=0},camera){
  group.position.y=jump;group.rotation.set(0,handAngle*Math.PI/180,0);const shoulder=1.43-crouch;
  if(camera){
   group.getWorldQuaternion(inverse).invert();
   bodyRight.setFromMatrixColumn(camera.matrixWorld,0);bodyRight.y=0;bodyRight.normalize().applyQuaternion(inverse);
  }else bodyRight.set(1,0,0);
  bodyNormal.crossVectors(bodyRight,up).normalize();body.rotation.y=Math.atan2(-bodyRight.z,bodyRight.x);
  const texture=crouch>.08?textures.load:textures.ready,height=1.8-crouch;
  const width=height*(texture.image?texture.image.width/texture.image.height:1/3);
  body.material.map=texture;body.scale.set(width,height,1);dimensions.value.set(width,height);
  for(let n=0;n<2;n++){
   const side=n?1:-1;
   const elbow=[side*(.28+.04*extension),shoulder-.12+.40*extension,.025+.15*extension];
   const hand=[side*(.34+.11*extension),shoulder+.12+.51*extension,.04+.40*extension];
   shoulders[n].position.copy(bodyRight).multiplyScalar(side*.13).addScaledVector(bodyNormal,.025);shoulders[n].position.y+=shoulder;elbows[n].position.set(...elbow);
   place(arms[n*2],shoulders[n].position.toArray(),elbow);place(arms[n*2+1],elbow,hand);palms[n].position.set(...hand);palms[n].rotation.z=-side*.28*extension;palms[n].rotation.y=handAngle*Math.PI/180*extension;
   for(let f=0;f<5;f++){const dx=(f-2)*.018;place(fingers[n*5+f],[hand[0]+dx,hand[1]+.035,hand[2]],[hand[0]+dx*1.3+side*.025*extension,hand[1]+.085-Math.abs(f-2)*.008,hand[2]+.015]);}
  }
 }
 update({});return {group,update};
}
