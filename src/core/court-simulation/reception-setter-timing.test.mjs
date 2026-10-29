import assert from 'node:assert/strict';
import test from 'node:test';
import {sampleReception} from './reception-motion.js';
import {effectiveRotation,receptionDestinations,receptionFormation} from './formations.js';

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

test('the setter holds its authored base until the server releases the toss in every rotation',()=>{
  eachScenario((config,label)=>{
    const initial=sampleReception(0,config),base=config.bases[0];
    assert.ok(Number.isFinite(initial.tossStart),`${label}: missing toss event`);
    assert.ok(Math.abs(initial.tossStart*initial.duration-.4)<1e-9,`${label}: toss event must follow the release clock`);
    for(const progress of [0,initial.tossStart-.01/initial.duration,initial.tossStart]){
      near(sampleReception(progress,config).actors[0].position,base);
    }
  });
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

// Synthetic checkpoints captured before the setter-onset correction. The ball
// retains the already validated toss, serve flight and pass while only Lv moves earlier.
const ballCheckpoints={
  'Float/default':[[1.6628485757002514,3.6926612237672716,-10.072935192542607],[.3245857182945813,2.7519673047466244,-2.3168953575435323],[-.026152841720606723,4.4544317137225224,3.3010029749059187]],
  'Float/custom':[[-4.62746909309736,3.709550424576153,-10.873585614952479],[-1.2542378232584077,2.7401499721928486,-3.197818649113476],[1.72144754156434,4.430877987520084,2.8805959638817082]],
  'Topspin/default':[[1.6629981201677708,3.627115420289929,-10.073746530621943],[.2264183621728728,3.644450458306359,-2.356039444274889],[.07909530970748535,4.522315496241021,3.1435190425988395]],
  'Topspin/custom':[[-4.627818484800378,3.6452955022995184,-10.874400862259522],[-1.3539726910662426,3.7639134308102142,-3.199979391377222],[1.7043795581424401,4.509247300826351,2.7110512977092176]],
};
test('moving the setter earlier preserves the ball through toss, flight and pass',()=>{
  for(const serve of ['Float','Topspin'])for(const scenario of scenarios){
    const config=configFor('5-1',0,serve,scenario),expected=ballCheckpoints[`${serve}/${scenario.name}`];
    [.2,.5,.8].forEach((progress,index)=>near(sampleReception(progress,config).ball,expected[index]));
  }
});
