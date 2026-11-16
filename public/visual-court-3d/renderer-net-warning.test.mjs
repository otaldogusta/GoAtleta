import test from 'node:test';
import assert from 'node:assert/strict';
import {renderedNetContact,showsNetWarning,netWarningLayout} from './renderer-net-warning.mjs';
import {trajectoryStroke} from './renderer-trajectory.mjs';
import {previewCourtObjects} from './renderer-elevation.mjs';
const p=(x,y,z)=>({x,y,z});

test('contact follows the actual mesh and finite tape volumes, in either direction',()=>{
 for(const direction of [1,-1]){
  const mesh=renderedNetContact([p(0,2,direction),p(0,2,-direction)]);assert.equal(mesh.part,'mesh');assert.equal(mesh.point.z,0);
  const tape=renderedNetContact([p(5.265,2.45,direction),p(5.265,2.45,-direction)]);assert.equal(tape.part,'top-tape');assert.ok(Math.abs(tape.point.z)<=.0175+1e-9);
  assert.equal(renderedNetContact([p(0,1.42,direction),p(0,1.42,-direction)]).part,'bottom-tape');
 }
});
test('above, below and outside the visible net are negative; this does not classify a volleyball fault',()=>{
 for(const [x,y] of [[0,2.463],[0,1.417],[5.276,2.43],[5.26,2],[0,.025]])assert.equal(renderedNetContact([p(x,y,1),p(x,y,-1)]),null);
 assert.equal(renderedNetContact([p(0,2,.02),p(0,2,1)]),null);
 assert.equal(renderedNetContact([p(0,2,1),p(0,2,1)]),null);
});
test('endpoint and coplanar contact count only inside the actual mesh or tape',()=>{
 assert.equal(renderedNetContact([p(0,2,1),p(0,2,0)]).part,'mesh');
 assert.equal(renderedNetContact([p(-6,2,0),p(6,2,0)]).part,'mesh');
 for(const points of [[p(-6,3,0),p(6,3,0)],[p(6,1.5,0),p(8,2,0)],[p(-6,1,0),p(6,1,0)]])assert.equal(renderedNetContact(points),null);
});
test('one arrow yields one contact even when its path crosses the mesh repeatedly',()=>{
 const contact=renderedNetContact([p(-1,2,2),p(0,2,-2),p(1,2,2),p(2,2,-2)]);assert.equal(contact.segment,0);assert.equal(contact.point.x,-.5);
});
test('the same sampled author arc and linked-ball preview enter and leave the net',()=>{
 const drawing={id:'arrow',kind:'arrow',startBallId:'ball',points:[p(0,1.62,3),p(0,.025,-5)],trajectoryHeights:{start:1.62,middle:1.82,end:.025}};
 assert.ok(renderedNetContact(trajectoryStroke(drawing)));
 assert.equal(renderedNetContact(trajectoryStroke({...drawing,trajectoryHeights:{...drawing.trajectoryHeights,middle:2.82}})),null);
 const frame={actors:[],drawings:[drawing,{id:'ball',kind:'ball',elevation:1.5,points:[p(0,1.62,3)]}]};
 const raised=previewCourtObjects(frame,null,{id:'ball',value:8});assert.equal(renderedNetContact(trajectoryStroke(raised.drawings[0])),null);
});
test('only visible author arrows and curves on the visible net show warnings',()=>{
 const drawing={kind:'arrow'},frame={net:true,hide:[]},packet={active:true,plain:false};assert.equal(showsNetWarning(drawing,frame,packet),true);
 for(const change of [{hidden:true},{simulated:true},{kind:'pen'},{kind:'area'}])assert.equal(showsNetWarning({...drawing,...change},frame,packet),false);
 assert.equal(showsNetWarning(drawing,{...frame,net:false},packet),false);assert.equal(showsNetWarning(drawing,{...frame,hide:['drawings']},packet),false);
 assert.equal(showsNetWarning(drawing,frame,{...packet,plain:true}),false);assert.equal(showsNetWarning(drawing,frame,{...packet,active:false}),false);
});
test('compact labels avoid host actions, 44 px handles and previous warnings on mobile',()=>{
 const viewport={width:379,height:819,topInset:144,bottomInset:120},point={x:218,y:430,visible:true},obstacles=[{x:194,y:308,width:48,height:178},{x:120,y:350,width:44,height:44}];
 const first=netWarningLayout(point,viewport,obstacles);assert.ok(first);assert.ok(first.y+first.height<point.y);
 const second=netWarningLayout(point,viewport,[...obstacles,first]);assert.ok(second);assert.notDeepEqual(second,first);
 for(const at of [first,second]){assert.ok(at.x>=0&&at.x+at.width<=379);assert.ok(at.y>=144&&at.y+at.height<=699);}
 assert.equal(netWarningLayout({...point,visible:false},viewport,[]),null);
});
test('a selected mobile arrow keeps the warning above contact even when a closer gap is below it',()=>{
 const point={x:199.74,y:372.79,visible:true},viewport={width:379,height:819,topInset:144,bottomInset:120};
 const obstacles=[{x:142.84,y:322.68,width:44,height:44},{x:167.49,y:365.47,width:44,height:44},{x:124.27,y:451.21,width:44,height:44},{x:250,y:203,width:44,height:178}];
 const at=netWarningLayout(point,viewport,obstacles);assert.ok(at);assert.ok(at.y+at.height<=point.y-6);
 for(const other of obstacles)assert.ok(at.x+at.width<=other.x-4||at.x>=other.x+other.width+4||at.y+at.height<=other.y-4||at.y>=other.y+other.height+4);
 const nearTop=netWarningLayout({x:200,y:150,visible:true},viewport,[]);assert.ok(nearTop);assert.ok(nearTop.y>=148);
});
