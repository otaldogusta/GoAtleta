import assert from 'node:assert/strict';
import test from 'node:test';
import {sampleReception} from './reception-motion.js';
import {effectiveRotation,receptionDestinations,receptionFormation,receptionReceiver} from './formations.js';
import * as reference from '../__tests__/fixtures/court-reference/formations.mjs';

const scenarios=[
  {name:'default',server:[1.7,0,-10.44],landing:[-1.45,6.65]},
  {name:'custom',server:[-4.8,0,-11.2],landing:[2.4,5.6]},
];
const distance=(a,b)=>Math.hypot(...a.map((value,i)=>value-b[i]));
const near=(actual,expected,tolerance=1e-9)=>assert.ok(distance(actual,expected)<tolerance,`${actual} != ${expected}`);
function configFor(system,rotation,serve,scenario){
  return {system,rotation,serve,landing:[...scenario.landing],bases:[...receptionFormation(system,rotation),[...scenario.server]]};
}
function eachScenario(check){
  for(const system of ['5-1','6-2'])for(let rotation=0;rotation<6;rotation++)for(const serve of ['Float','Topspin'])for(const scenario of scenarios){
    check(configFor(system,rotation,serve,scenario),`${system}/${rotation}/${serve}/${scenario.name}`);
  }
}

test('5–1 and 6–2 preserve the original reception bases, release paths and seam choices',()=>{
  eachScenario(({system,rotation,landing})=>{
    const bases=receptionFormation(system,rotation);
    assert.equal(effectiveRotation(system,rotation),reference.effectiveRotation(system,rotation));
    assert.deepEqual(bases,reference.receptionFormation(system,rotation));
    assert.deepEqual(receptionDestinations(system,rotation),reference.receptionDestinations(system,rotation));
    assert.equal(receptionReceiver(bases,landing),reference.receptionReceiver(bases,landing));
  });
});

test('the setter holds its authored base until the server releases the toss in every rotation',()=>{
  eachScenario((config,label)=>{
    const initial=sampleReception(0,config),base=config.bases[0];
    assert.ok(Number.isFinite(initial.tossStart),`${label}: missing toss event`);
    const tossFlight=(initial.serveContact-initial.tossStart)*initial.duration;
    near([tossFlight],[config.serve==='Float'?.60:1.10]);
    for(const progress of [0,initial.tossStart-.01/initial.duration,initial.tossStart]){
      near(sampleReception(progress,config).actors[0].position,base);
    }
  });
});

test('the standing float leaves the palm continuously and peaks just above striking height',()=>{
  for(const scenario of scenarios){
    const config=configFor('5-1',0,'Float',scenario);
    const {duration,tossStart,serveContact}=sampleReception(0,config);
    const release=tossStart*duration,hit=serveContact*duration;
    const at=second=>sampleReception(second/duration,config).ball;
    const delta=.001,before=at(release-delta),ball=at(release),after=at(release+delta);
    const velocityChange=ball.map((coordinate,i)=>(after[i]-2*coordinate+before[i])/delta);
    assert.ok(Math.hypot(...velocityChange)<.08,'the rising ball keeps its speed and direction at release');
    const heights=Array.from({length:61},(_,i)=>at(release+(hit-release)*i/60)[1]);
    const peak=Math.max(...heights);
    assert.ok(peak>at(hit)[1]+.25&&peak<at(hit)[1]+.40,'short toss above the open striking hand');
    assert.ok(heights[0]<heights.at(-1)&&heights.at(-2)>heights.at(-1));
  }
});

test('the jump serve releases forward and upward off the moving palm, then accelerates its spin on contact',()=>{
  for(const scenario of scenarios){
    const config=configFor('5-1',0,'Topspin',scenario);
    const {duration,tossStart,serveContact}=sampleReception(0,config);
    const at=seconds=>sampleReception(seconds/duration,config);
    const release=tossStart*duration,strike=serveContact*duration,dt=.001;
    const ball=at(release).ball,before=at(release-dt).ball,after=at(release+dt).ball;
    const velocity=after.map((coordinate,i)=>(coordinate-ball[i])/dt);
    const mismatch=velocity.map((value,i)=>value-(ball[i]-before[i])/dt);
    assert.ok(velocity[1]>5&&Math.hypot(velocity[0],velocity[2])>1);
    assert.ok(Math.hypot(...mismatch)<.35,'free flight continues the guide hand motion');
    assert.ok(at(release).ballSpin<1e-7);
    const spin=at(strike).ballSpin;
    assert.ok(spin>0&&at(strike+dt).ballSpin-spin>2*(spin-at(strike-dt).ballSpin));
  }
});

test('straight sprints keep their player role and ground marks as the capture gains and loses weight',()=>{
  // Setter and libero in P4, then both wings covering in P1.
  for(const [rotation,slot] of [[3,0],[3,4],[0,3],[0,5]]){
    const config=configFor('5-1',rotation,'Float',scenarios[0]);
    const frames=Array.from({length:501},(_,i)=>sampleReception(i/500,config).actors[slot]);
    const moving=frames.filter(actor=>actor.runCycle!==undefined);
    assert.ok(moving.length>50);
    assert.ok(moving[0].runDrive<.03&&moving.at(-1).runDrive<.03);
    assert.ok(moving.some(actor=>actor.runDrive>.65&&actor.feet.every(foot=>foot[1]>0)));
    assert.ok(frames.every(actor=>actor.role===frames[0].role));
    const first=frames.indexOf(moving[0]),last=frames.indexOf(moving.at(-1));
    assert.ok(frames.slice(first-1,last+2).every(actor=>actor.plantedStance));
    near(frames[first-1].feet[1],moving[0].feet[1]);
    const support=moving.at(-1).feet.findIndex(foot=>foot[1]===0);
    assert.notEqual(support,-1);
    const landed=moving.at(-1).feet[support],rest=frames[last+1].feet[support];
    near(landed.slice(0,3),rest.slice(0,3));
    near([Math.cos(landed[3]),Math.sin(landed[3])],[Math.cos(rest[3]),Math.sin(rest[3])]);
  }
});

test('both systems finish with all four attack lanes open and both feet planted before the set',()=>{
  eachScenario(config=>{
    const timing=sampleReception(0,config),pass=sampleReception(timing.receiveContact,config);
    assert.ok(pass.actors.every(actor=>actor.attackReadiness===undefined));
    const options=[1,2,3,5],destinations=receptionDestinations(config.system,config.rotation);
    const settling=sampleReception(1-.28/timing.duration,config);
    const planted=sampleReception(1-.09/timing.duration,config),finish=sampleReception(1,config);
    for(const slot of options){
      const actor=finish.actors[slot],[x,z]=destinations[slot],dx=actor.facing[0]-x,dz=actor.facing[1]-z;
      assert.ok(settling.actors[slot].attackReadiness>0&&settling.actors[slot].attackReadiness<1);
      assert.equal(actor.attackReadiness,1);
      assert.equal(actor.role,pass.actors[slot].role);
      assert.equal(actor.plantedStance,true);
      near(actor.position,[x,0,z]);
      assert.deepEqual(actor.feet,planted.actors[slot].feet);
      assert.deepEqual(actor.facing,planted.actors[slot].facing);
      const [lead,trail]=actor.feet;
      assert.equal(lead[1],0);assert.equal(trail[1],0);
      near([(lead[0]-trail[0])*dx+(lead[2]-trail[2])*dz],[.28]);
      near([Math.sin(lead[3]),Math.cos(lead[3])],[dx,dz]);
      // Ahead is toward the net; toward the inside is always toward the setter.
      assert.ok(dz<0&&dx*(destinations[0][0]-x)>0);
    }
    assert.ok([0,4,6].every(slot=>finish.actors[slot].attackReadiness===undefined));
    near(finish.ball,finish.setHand);
  });
});

test('an attacker already at the opening mark repositions each shoe through the air, including left-handed stances',()=>{
  const config=configFor('5-1',0,'Float',scenarios[0]),[x,z]=receptionDestinations('5-1',0)[1];
  config.bases[1]=[x,0,z];
  config.attackHands=[,'left'];
  const {receiveContact}=sampleReception(0,config);
  const at=t=>sampleReception(t,config).actors[1];
  let previous=at(receiveContact);
  const lifts=new Set();
  for(let j=1;j<=200;j++){
    const actor=at(receiveContact+(1-receiveContact)*j/200);
    near(actor.position,[x,0,z]);
    actor.feet.forEach((foot,side)=>{
      if(foot[1]>.01)lifts.add(side);
      if(foot[1]===0&&previous.feet[side][1]===0)near(foot,previous.feet[side]);
    });
    assert.ok(actor.feet.some(foot=>foot[1]===0));
    previous=actor;
  }
  assert.equal(lifts.size,2);
  assert.equal(previous.attackReadyLeft,true);
  const [a,b]=previous.feet,[tx,tz]=previous.facing;
  near([(a[0]-b[0])*(tx-x)+(a[2]-b[2])*(tz-z)],[-.28]);
});

test('the setter moves during the toss, keeps its destination and leaves the document bases untouched',()=>{
  eachScenario((config,label)=>{
    const before=JSON.stringify(config),initial=sampleReception(0,config),target=receptionDestinations(config.system,config.rotation)[0];
    const destination=[target[0],0,target[1]],totalDistance=distance(config.bases[0],destination);
    const early=sampleReception(initial.tossStart+.15/initial.duration,config);
    assert.ok(distance(early.actors[0].position,config.bases[0])>1e-6,`${label}: setter is still waiting after release`);
    assert.ok(early.actors[0].position.every(Number.isFinite));
    if(totalDistance>.25)assert.equal(early.actors[0].pose,'approach',`${label}: travelling setter needs its movement pose`);
    near(sampleReception(1,config).actors[0].position,destination);
    assert.equal(JSON.stringify(config),before,`${label}: sampling must not rewrite authored bases`);
  });
});

test('P1 starts forward at the toss while retaining its right-lane route before cutting to the net',()=>{
  eachScenario(config=>{
    if(effectiveRotation(config.system,config.rotation)!==0)return;
    const initial=sampleReception(0,config),early=sampleReception(initial.tossStart+.15/initial.duration,config).actors[0];
    assert.equal(early.position[0],config.bases[0][0]);
    assert.ok(early.position[2]<config.bases[0][2]);
  });
});

test('P1 settles facing the live passer before first contact and opens to the set with alternating support',()=>{
  eachScenario(config=>{
    if(effectiveRotation(config.system,config.rotation)!==0)return;
    const {receiveContact,duration,ballContact}=sampleReception(0,config);
    const setter=progress=>sampleReception(progress,config).actors[0];
    const read=setter(receiveContact),[x,,z]=read.position;
    near(setter(receiveContact-.04/duration).position,read.position);
    assert.equal(read.runCycle,undefined);
    assert.equal(read.feetWeight,1);
    assert.ok(read.feet.every(foot=>foot[1]===0));
    const wanted=Math.atan2(ballContact[0]-x,ballContact[2]-z);
    near(read.facing,[x+Math.sin(wanted),z+Math.cos(wanted)]);
    const lifts=new Set();
    for(let seconds=.04;seconds<.65;seconds+=.01){
      const a=setter(receiveContact+seconds/duration);
      assert.ok(a.feet?.some(foot=>foot[1]===0),'the adjustment keeps one shoe on the floor');
      a.feet?.forEach((foot,side)=>{if(foot[1]>.03)lifts.add(side);});
    }
    assert.equal(lifts.size,2);
    const front=setter(1);
    assert.ok(front.facing[0]<x&&Math.abs(front.facing[1]-z)<1e-9);
  });
});

test('toss onset stays continuous and the setter returns to identical frames when seeking backwards',()=>{
  eachScenario((config,label)=>{
    const initial=sampleReception(0,config),onset=initial.tossStart;
    const before=sampleReception(onset-1e-8,config),after=sampleReception(onset+1e-8,config);
    near(before.actors[0].position,after.actors[0].position,1e-6);
    const progresses=[0,onset,onset+.15/initial.duration,.3,.5,.8,1];
    const frames=progresses.map(progress=>JSON.stringify(sampleReception(progress,config)));
    for(let i=progresses.length-1;i>=0;i--)assert.equal(JSON.stringify(sampleReception(progresses[i],config)),frames[i],`${label}: reverse seeking changed the sampled frame`);
  });
});

// World-space samples from the standing float and the forward jump serve.
const ballCheckpoints={
  'Float/default':[[1.72068195638499,1.7833124987818534,-9.879764409465862],[.3245857182945813,2.7519673047466244,-2.3168953575435323],[-.026152841720606723,4.4544317137225224,3.3010029749059187]],
  'Float/custom':[[-4.477357715418226,1.81939430905183,-10.750118144431603],[-1.2542378232584077,2.7401499721928486,-3.197818649113476],[1.72144754156434,4.430877987520084,2.8805959638817082]],
  'Topspin/default':[[1.8845861546103415,3.6971159590425655,-11.002739471177927],[.2264183621728728,3.644450458306359,-2.356039444274889],[.07909530970748535,4.522315496241021,3.1435190425988395]],
  'Topspin/custom':[[-4.9528409902386565,3.72358911170286,-11.756539221409009],[-1.3539726910662426,3.7660341012986156,-3.199979391377222],[1.7043795581424401,4.509247300826351,2.7110512977092176]],
};
test('serve toss, flight and pass agree with their court-space checkpoints',()=>{
  for(const serve of ['Float','Topspin'])for(const scenario of scenarios){
    const config=configFor('5-1',0,serve,scenario),expected=ballCheckpoints[`${serve}/${scenario.name}`];
    [.2,.5,.8].forEach((progress,index)=>near(sampleReception(progress,config).ball,expected[index]));
  }
});
