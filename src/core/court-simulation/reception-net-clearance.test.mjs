import assert from 'node:assert/strict';
import test from 'node:test';
import {sampleReception} from './reception-motion.js';
import {receptionFormation} from './formations.js';
import {courtFootwork,setterPenetration} from './court-footwork.js';

test('P1 plants the outside shoe before cutting inward and has flight between running steps',()=>{
 const start=[3.6,7.6],end=[1.62,.76];
 const frames=Array.from({length:1001},(_,i)=>setterPenetration(start,end,i/1000));
 const cut=frames.findIndex(frame=>frame.position[0]<start[0]-1e-6);
 assert.ok(cut>0);
 const support=frames[cut-1].feet[0];
 assert.equal(support[1],0);
 for(const frame of frames.slice(cut,cut+20))assert.deepEqual(frame.feet[0],support);
 assert.ok(frames.some(frame=>frame.jump>.02&&frame.feet.every(foot=>foot[1]>0)));
});

test('the P1 setter pushes out, lengthens the stride and brakes in the rhythm of its real foot contacts',()=>{
 const options={bases:[...receptionFormation('5-1',0),[1.7,0,-10.44]]};
 const {duration,tossStart,receiveContact}=sampleReception(0,options);
 const start=tossStart*duration,at=t=>sampleReception(t/duration,options).actors[0];
 const speed=t=>{
  const a=at(start+t),b=at(start+t+.001);
  return Math.hypot(b.position[0]-a.position[0],b.position[2]-a.position[2])/.001;
 };
 assert.ok(speed(.04)<1&&speed(.45)>3.5);
 assert.ok(at(start+.04).runDrive<.1&&at(start+.45).runDrive>.85);
 const contacts=[],air=[false,false];
 for(let ms=0;start+ms/1000<receiveContact*duration;ms++){
  const actor=at(start+ms/1000);
  if(actor.runCycle===undefined)continue;
  for(let side=0;side<2;side++){
   if(actor.feet[side][1]>0)air[side]=true;
   else if(air[side]){
    air[side]=false;
    contacts.push(ms);
    // Phase zero of the CMU run is a right landing, phase one a left landing.
    const phaseError=Math.abs(actor.runCycle-(1-side));
    assert.ok(Math.min(phaseError,2-phaseError)<.015);
   }
  }
 }
 assert.ok(contacts.length>=7&&contacts.length<=9);
 assert.ok(contacts[0]>contacts[4]-contacts[3]+35,'first push lasts longer than the racing stride');
 assert.ok(contacts.at(-1)-contacts.at(-2)>contacts[4]-contacts[3]+22,'last stride slows before gathering');
 assert.ok(speed(2)<.5&&at(start+2).runDrive<.1);
});

test('the mocap foot swing keeps the opposite shoe planted and releases cleanly at the destination',()=>{
 const path=u=>[.3,u*2.1];
 const first=courtFootwork(path,.06),second=courtFootwork(path,.12);
 assert.ok(first.feet[0][1]>.07);
 assert.equal(first.feetWeight,1);
 assert.equal(second.feetWeight,1);
 assert.deepEqual(first.feet[1],second.feet[1]);
 assert.equal(second.feet[1][1],0);
 assert.deepEqual(courtFootwork(path,0),{});
 assert.deepEqual(courtFootwork(path,1),{});
});

const basesFor=(system,rotation)=>[...receptionFormation(system,rotation),[1.7,0,-10.44]];
test('side steps lead outward and close without crossing or sliding the support shoe',()=>{
 for(const direction of [-1,1]){
  const path=u=>[direction*u*1.2,0],options={shuffle:true,facing:[direction*.6,5]};
  const lead=direction>0?1:0,trail=1-lead;
  const first=courtFootwork(path,.05,options),second=courtFootwork(path,.10,options);
  assert.ok(first.feet[lead][1]>0);
  assert.deepEqual(first.feet[trail],second.feet[trail]);
  for(let i=1;i<100;i++){
   const [left,right]=courtFootwork(path,i/100,options).feet;
   assert.ok(left[0]<right[0]);
   assert.ok(left[1]===0||right[1]===0);
  }
 }
});
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<tolerance,`${a} != ${b}`);
test('animated serves clear the physical tape across rotations and short/deep targets',()=>{
 for(const system of ['5-1','6-2'])for(let rotation=0;rotation<6;rotation++)for(const serve of ['Float','Topspin'])for(const landing of [[-4,0],[4,.4],[-1.45,3],[1.4,6.65],[0,9]]){
  const bases=basesFor(system,rotation),config={system,rotation,serve,landing,bases},start=sampleReception(0,config);
  for(let index=0;index<=240;index++){
   const p=start.serveContact+(start.receiveContact-start.serveContact)*index/240;
   const frame=sampleReception(p,config),[x,y,z]=frame.ball;
   assert.ok([x,y,z].every(Number.isFinite));
   if(Math.abs(z)<.18)assert.ok(y>2.43+.0325+.12,`${system}/${rotation}/${serve}/${landing}: ball intersects tape`);
   assert.ok(y<5,'short serve must not become a huge lob');
  }
  const guide=start.serveGuide;
  near([guide.at(-1)[0],guide.at(-1)[2]],start.serveTarget);
  assert.ok(Math.abs(guide.at(-1)[1]-.12)<1e-9);
  assert.ok(start.ballContact[2]>0);
 }
});
test('toss, contact, intercepted flight and pass are continuous when seeking both directions',()=>{
 for(const serve of ['Float','Topspin']){
  const config={system:'5-1',rotation:0,serve,landing:[-1.45,6.65],bases:basesFor('5-1',0)};
  const frame=sampleReception(0,config);
  for(const p of [frame.serveContact,frame.receiveContact])near(sampleReception(p-1e-8,config).ball,sampleReception(p+1e-8,config).ball,1e-5);
  near(sampleReception(frame.serveContact,config).ball,frame.serveGuide[0]);
  near(sampleReception(frame.receiveContact,config).ball,frame.ballContact);
  assert.equal(sampleReception(frame.serveContact,config).actors[6].pose,'contact');
  assert.equal(sampleReception(0,config).ballSpin,0);
  assert.equal(sampleReception(.5,config).ballSpin>0,serve==='Topspin');
  const sequence=[0,.15,.3,.4,.6,.8,1,.8,.4,0];
  const frames=new Map(sequence.map(p=>[p,JSON.stringify(sampleReception(p,config))]));
  for(const p of sequence)assert.equal(JSON.stringify(sampleReception(p,config)),frames.get(p));
 }
});
