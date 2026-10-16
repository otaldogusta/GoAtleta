import * as THREE from './three.module.min.js';

const vector=point=>new THREE.Vector3(point.x,point.y,point.z);
/** Only geometry construction. Every curve, contact and wall comes from the host. */
export function createSimulationGuides(data){
 const group=new THREE.Group();group.name='simulation-guides';
 for(const path of data.paths||[]){
  const points=path.points.map(vector);if(points.length<2)continue;
  const options={color:path.color,transparent:true,opacity:path.opacity,depthWrite:false};
  const object=path.dashed
   ? new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({...options,dashSize:.15,gapSize:.11}))
   : new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(24,points.length-1),.022,6,false),new THREE.MeshBasicMaterial(options));
  object.name=path.id;if(path.dashed)object.computeLineDistances();group.add(object);
  if(path.arrow!==undefined&&points.length>2){const index=Math.min(points.length-2,Math.max(1,path.arrow)),direction=points[index+1].clone().sub(points[index-1]).normalize(),arrow=new THREE.Mesh(new THREE.ConeGeometry(.075,.24,12),new THREE.MeshBasicMaterial(options));arrow.position.copy(points[index]);arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);group.add(arrow);}
 }
 for(const marker of data.markers||[]){
  let object;
  const options={color:marker.color,transparent:true,opacity:.85,depthWrite:false};
  if(marker.kind==='cross'){const p=marker.point;object=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p.x-.14,.025,p.z-.14),new THREE.Vector3(p.x+.14,.025,p.z+.14),new THREE.Vector3(p.x-.14,.025,p.z+.14),new THREE.Vector3(p.x+.14,.025,p.z-.14)]),new THREE.LineBasicMaterial(options));}
  else{object=new THREE.Mesh(marker.kind==='ring'?new THREE.TorusGeometry(.115,.018,6,24):new THREE.SphereGeometry(.075,12,8),new THREE.MeshBasicMaterial(options));object.position.copy(vector(marker.point));}
  object.name=marker.id;object.userData.contactTime=marker.contactTime;group.add(object);
 }
 for(const wall of data.walls||[]){
  const geometry=new THREE.PlaneGeometry(wall.width,wall.height),plane=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xe8757c,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));
  plane.position.copy(vector(wall.center));plane.rotation.y=wall.angle*Math.PI/180;group.add(plane);
  const outline=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineDashedMaterial({color:0xe89095,dashSize:.09,gapSize:.07,transparent:true,opacity:.45,depthWrite:false}));outline.position.copy(plane.position);outline.rotation.copy(plane.rotation);outline.computeLineDistances();group.add(outline);
 }
 return group;
}
