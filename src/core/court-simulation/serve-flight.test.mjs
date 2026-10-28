import assert from 'node:assert/strict';
import test from 'node:test';
import {createServeFlight,sampleServeFlight,receiveFlightFraction} from './serve-flight.js';

const close=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);
const base=[1.7,0,-10.44];
const target=[-1.45,6.65];
const plain=(path,u)=>sampleServeFlight(path,u,{wobble:false});

test('contact starts at the target-relative hand and the predictive guide reaches the floor marker',()=>{
  const server=[0,0,-10],landing=[0,6],path=createServeFlight(server,landing);
  assert.deepEqual(path.start,[.03,2.28,-9.62]);
  assert.deepEqual(path.end,[0,.12,6]);
  assert.deepEqual(plain(path,0),path.start);
  assert.deepEqual(plain(path,1),path.end);
  assert.deepEqual(server,[0,0,-10]);
  assert.deepEqual(landing,[0,6]);
  for(const u of [.1,.3,.6,.9]){
    const point=plain(path,u);
    close(point[0],.03*(1-u));
    close(point[2],-9.62+15.62*u);
  }
});

test('normal Float peaks at the net while Topspin peaks earlier and clears higher',()=>{
  const floating=createServeFlight(base,target,'Float'),spinning=createServeFlight(base,target,'Topspin');
  close(floating.apexFraction,floating.netFraction);
  close(floating.apexHeight,2.83);
  close(floating.netHeight,2.83);
  close(spinning.apexFraction,.75*spinning.netFraction);
  close(spinning.netHeight,3.38);
  assert.ok(spinning.apexHeight>spinning.netHeight);
  assert.equal(floating.apexAdjusted,false);
  assert.equal(spinning.apexAdjusted,false);
  assert.ok(spinning.duration<floating.duration);
});

test('both quadratics meet continuously with a horizontal tangent at their apex',()=>{
  for(const kind of ['Float','Topspin'])for(const landing of [target,[0,1],[4,9]]){
    const path=createServeFlight(base,landing,kind),p=path.apexFraction,e=1e-6;
    const at=plain(path,p)[1],before=plain(path,p-e)[1],after=plain(path,p+e)[1];
    close(at,path.apexHeight);
    close(before,at,1e-8);
    close(after,at,1e-8);
    close((at-before)/e,0,1e-3);
    close((after-at)/e,0,1e-3);
    assert.ok(plain(path,p-.01)[1]<at);
    assert.ok(plain(path,p+.01)[1]<at);
  }
});

test('the complete ball clears the rendered tape for short, deep, lateral and moved serves',()=>{
  const servers=[base,[-5,0,-8],[5,0,-12.5],[-4.5,0,-9.2]];
  const targets=[[-4.5,0],[4.5,1],[-4,1.5],[0,3],target,[4.5,9]];
  const centerMinimum=2.43+.0325+.12+.035;
  for(const server of servers)for(const landing of targets)for(const kind of ['Float','Topspin']){
    const path=createServeFlight(server,landing,kind);
    let crossingSamples=0;
    for(let i=0;i<=6000;i++){
      const ball=sampleServeFlight(path,i/6000);
      assert.ok(ball.every(Number.isFinite));
      // Test the physical ball volume around the tape, not only its center at z=0.
      if(Math.abs(ball[2])<=.12+.0325){
        crossingSamples++;
        assert.ok(ball[1]>=centerMinimum-1e-9,`${kind}/${server}/${landing}: ${ball}`);
      }
    }
    assert.ok(crossingSamples>0);
    assert.ok(path.apexHeight<=4.5+1e-9,'short serve must not become an excessive lob');
  }
});

test('short saved floor targets move to a valid marker and use a bounded natural apex',()=>{
  const path=createServeFlight(base,[8,0],'Topspin');
  assert.deepEqual(path.requestedTarget,[8,0]);
  assert.deepEqual(path.target,[4.5,1]);
  assert.deepEqual(path.end,[4.5,.12,1]);
  assert.equal(path.targetAdjusted,true);
  assert.equal(path.apexAdjusted,true);
  close(path.nominalNetMargin,.30);
  assert.ok(path.apexFraction>path.preferredApexFraction);
  assert.ok(path.apexFraction<path.netFraction);
  assert.ok(path.apexHeight<=4.5+1e-9);
});

test('authored server positions remain attached to the actor beyond the reference bounds',()=>{
  const server=[-5,0,-8],path=createServeFlight(server,[3,6]);
  assert.deepEqual(path.server,server);
  assert.equal(path.serverAdjusted,false);
  close(Math.hypot(path.start[0]-server[0],path.start[2]-server[2]),Math.hypot(.38,.03));
  const invalid=createServeFlight([2,0,3],target);
  assert.deepEqual(invalid.server,[2,0,-.5]);
  assert.equal(invalid.serverAdjusted,true);
  assert.ok(plain(invalid,.5).every(Number.isFinite));
});

test('the reception root is on the descending branch and exactly meets the chosen height',()=>{
  for(const kind of ['Float','Topspin'])for(const landing of [[0,1],target,[4,9]]){
    const path=createServeFlight(base,landing,kind);
    for(const height of [.5,1.05,1.6]){
      const fraction=receiveFlightFraction(path,height);
      assert.ok(fraction>path.apexFraction&&fraction<1);
      close(plain(path,fraction)[1],height);
      assert.ok(plain(path,fraction-.001)[1]>height);
      assert.ok(plain(path,fraction+.001)[1]<height);
    }
    close(path.receiveFraction,receiveFlightFraction(path));
    assert.ok(plain(path,path.receiveFraction)[2]<path.end[2]);
    assert.ok(plain(path,path.receiveFraction)[2]>0);
  }
});

test('duration follows horizontal speed with a depth-dependent minimum until reception',()=>{
  for(const kind of ['Float','Topspin'])for(const landing of [[0,1],target,[4,9]]){
    const path=createServeFlight(base,landing,kind),speed=kind==='Float'?14:17.5;
    const minimum=(kind==='Float'?1.2:1)+.08*(3-landing[1]);
    close(path.nominalSpeed,speed);
    close(path.minimumReceiveDuration,minimum);
    assert.ok(path.duration>=path.horizontalDistance/speed-1e-12);
    assert.ok(path.receiveDuration>=minimum-1e-12);
    close(path.receiveDuration,path.duration*path.receiveFraction);
    assert.ok(Math.abs(path.duration-path.horizontalDistance/speed)<1e-9||Math.abs(path.receiveDuration-minimum)<1e-9);
  }
  close(createServeFlight(base,[0,1],'Float').receiveDuration,1.36);
  close(createServeFlight(base,[0,1],'Topspin').receiveDuration,1.16);
});

test('Float adds bounded smooth flutter while Topspin remains stable',()=>{
  const floating=createServeFlight(base,target,'Float'),spinning=createServeFlight(base,target,'Topspin');
  let largestLateral=0,largestVertical=0;
  for(let i=0;i<=1000;i++){
    const u=i/1000,ball=sampleServeFlight(floating,u),guide=plain(floating,u);
    const lateral=Math.hypot(ball[0]-guide[0],ball[2]-guide[2]),vertical=Math.abs(ball[1]-guide[1]);
    const envelope=Math.sin(Math.PI*u);
    assert.ok(lateral<=.16*envelope+1e-12);
    assert.ok(vertical<=.06*envelope+1e-12);
    largestLateral=Math.max(largestLateral,lateral);largestVertical=Math.max(largestVertical,vertical);
    assert.deepEqual(sampleServeFlight(spinning,u),plain(spinning,u));
  }
  assert.ok(largestLateral>.15);
  assert.ok(largestVertical>.055);
  for(const u of [0,1])for(let axis=0;axis<3;axis++)close(sampleServeFlight(floating,u)[axis],plain(floating,u)[axis]);
});

test('out-of-range progress and missing coordinates produce finite bounded samples',()=>{
  const path=createServeFlight([NaN,NaN,NaN],[Infinity,NaN],'unknown');
  assert.equal(path.kind,'Float');
  assert.deepEqual(plain(path,-1),path.start);
  assert.deepEqual(plain(path,2),path.end);
  assert.ok(sampleServeFlight(path,NaN).every(Number.isFinite));
  close(receiveFlightFraction(path,100),path.apexFraction);
  close(receiveFlightFraction(path,-1),1);
});
