import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { CameraPreviewSampler, bootCamera, cameraCaptureConstraints, chooseRecordingMime, chooseRecordingProfile, collectCameraQuality, configureCameraPreview } from '../../public/scouting-live/camera.js';

const high='video/mp4;codecs=avc1.64002A',main='video/mp4;codecs=avc1.4D402A',baseline='video/mp4;codecs=avc1.42E02A';
const Recorder={isTypeSupported:()=>true};
const capable={supported:true,smooth:true,powerEfficient:true};
function fakeTimers(){let next=0;const timers=new Map();return {timers,setTimer:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id),fire(){assert.equal(timers.size,1);[...timers.values()][0].fn();}};}

test('1080p60 profile is selected only when recording capabilities support smooth efficient encoding',async()=>{
  const queries=[],profile=await chooseRecordingProfile(Recorder,{async encodingInfo(config){queries.push(config);return capable;}});
  assert.equal(profile.mimeType,high);assert.equal(profile.videoBitsPerSecond,12000000);assert.equal(profile.capabilityVerified,true);
  assert.equal(queries.length,3);
  assert.deepEqual(queries[0],{type:'record',video:{contentType:high,width:1920,height:1080,bitrate:12000000,framerate:60}});
  assert.equal(chooseRecordingMime(Recorder),'video/webm;codecs=vp8,opus','legacy API retains its compatibility priority');
});

for(const flag of ['supported','smooth','powerEfficient'])test(`AVC is not forced when ${flag} is false`,async()=>{
  const profile=await chooseRecordingProfile(Recorder,{encodingInfo:async()=>({...capable,[flag]:false})});
  const {codecSupport,...selection}=profile;
  assert.deepEqual(selection,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:6000000,capabilityVerified:false});
  assert.equal(JSON.parse(codecSupport).every(row=>row.state==='queried'&&row[flag]===false),true);
});

test('profile queries honor codec support, portrait dimensions and candidate preference',async()=>{
  const queries=[];
  const profile=await chooseRecordingProfile({isTypeSupported:type=>type!==high},{async encodingInfo(config){queries.push(config);return config.video.contentType===main?{...capable,smooth:false}:capable;}},{width:1080,height:1920});
  assert.equal(profile.mimeType,baseline);assert.equal(queries.length,2);
  assert.equal(JSON.parse(profile.codecSupport)[0].state,'mime-unsupported');
  assert.equal(queries[0].video.width,1080);assert.equal(queries[0].video.height,1920);
});

test('missing, rejected and malformed record capabilities permit an unverified accepted AVC trial',async()=>{
  for(const mediaCapabilities of [undefined,{encodingInfo:async()=>{throw new TypeError('unsupported');}},{encodingInfo:async()=>({supported:true})}]){
    const profile=await chooseRecordingProfile(Recorder,mediaCapabilities);
    assert.equal(profile.capabilityVerified,false);assert.equal(profile.mimeType,high);assert.equal(profile.videoBitsPerSecond,12000000);assert.equal(profile.powerEfficient,undefined);
    assert.equal(JSON.parse(profile.codecSupport).every(row=>row.state==='query-error'),true);
    assert.ok(profile.codecSupport.length<=1200);
  }
  const profile=await chooseRecordingProfile({isTypeSupported:()=>false},{encodingInfo:async()=>capable});assert.equal(profile.mimeType,'');
  const legacy=await chooseRecordingProfile({isTypeSupported:type=>type==='video/webm'},undefined);assert.equal(legacy.mimeType,'video/webm');assert.equal(legacy.videoBitsPerSecond,6000000);
});

test('all capability queries share one deadline and retain completed candidates when another hangs',async()=>{
  const timers=fakeTimers(),queries=[];
  const pending=chooseRecordingProfile(Recorder,{encodingInfo(config){queries.push(config);return config.video.contentType===main?Promise.resolve(capable):new Promise(()=>{});}},{...timers});
  await setImmediate();assert.equal(queries.length,3);assert.equal([...timers.timers.values()][0].ms,1200);
  timers.fire();const profile=await pending;assert.equal(profile.mimeType,main);assert.equal(timers.timers.size,0);
  assert.deepEqual(JSON.parse(profile.codecSupport).map(row=>row.state),['timeout','queried','timeout']);
});

test('a timed-out query cannot retroactively replace the chosen recorder profile',async()=>{
  const timers=fakeTimers();let resolve;
  const pending=chooseRecordingProfile(Recorder,{encodingInfo:()=>new Promise(done=>{resolve=done;})},{...timers});
  await setImmediate();timers.fire();const profile=await pending;resolve(capable);await setImmediate();
  assert.equal(profile.capabilityVerified,false);assert.equal(profile.mimeType,high);
  assert.equal(JSON.parse(profile.codecSupport).every(row=>row.state==='timeout'),true);
});

test('unknown AVC trials never override an explicit negative capability result for that candidate',async()=>{
  const profile=await chooseRecordingProfile(Recorder,{async encodingInfo(config){if(config.video.contentType===high)return {supported:false};throw new TypeError('record configuration unavailable');}});
  assert.equal(profile.mimeType,main);assert.equal(profile.capabilityVerified,false);assert.equal(JSON.parse(profile.codecSupport)[0].supported,false);
  const invalid=await chooseRecordingProfile(Recorder,undefined,{width:0,height:1080});assert.equal(invalid.mimeType,'video/webm;codecs=vp8,opus');
});

test('codec support summary uses only fixed codec names, enumerated states and boolean capability flags',async()=>{
  for(const recorder of [Recorder,{isTypeSupported:type=>!type.includes('avc1.')},{isTypeSupported(type){if(type.includes('avc1.'))throw new Error('private-device-secret');return true;}}]){
    const profile=await chooseRecordingProfile(recorder,{encodingInfo:async()=>{throw new Error('private-device-secret');}});
    const rows=JSON.parse(profile.codecSupport);assert.equal(rows.length,3);assert.ok(profile.codecSupport.length<=1200);assert.equal(profile.codecSupport.includes('secret'),false);
    for(const row of rows){assert.ok(['avc1.64002A','avc1.4D402A','avc1.42E02A'].includes(row.codec));assert.ok(['mime-unsupported','queried','query-error','timeout'].includes(row.state));assert.ok(Object.keys(row).every(key=>['codec','state','supported','smooth','powerEfficient'].includes(key)));}
    if(recorder!==Recorder)assert.equal(profile.mimeType,'video/webm;codecs=vp8,opus');
  }
});

test('preview encoder is bounded without changing, cloning or constraining the full-quality source',async()=>{
  for(const [width,height]of [[1920,1080],[1080,1920],[640,480]]){
    const calls=[],source={kind:'video',getSettings:()=>({width,height,frameRate:60}),applyConstraints(){assert.fail('source constraints changed');},clone(){assert.fail('source cloned');}};
    const original={transactionId:'transaction',encodings:[{rid:'original',active:true}],codecs:[{mimeType:'video/VP8'}]};
    const sender={track:source,getParameters:()=>structuredClone(original),setParameters:async parameters=>calls.push(parameters)};
    const audio={track:{kind:'audio'},getParameters(){assert.fail('audio changed');}};
    assert.deepEqual(await configureCameraPreview({getSenders:()=>[sender,audio]}),[true]);
    assert.deepEqual(calls[0],{...original,encodings:[{rid:'original',active:true,scaleResolutionDownBy:Math.max(1,Math.max(width,height)/640),maxFramerate:60,maxBitrate:1200000}]});
    assert.equal(sender.track,source);assert.deepEqual(source.getSettings(),{width,height,frameRate:60});
  }
});

test('preview encoder failure, missing encodings and a stuck browser remain nonfatal and bounded',async()=>{
  const video={kind:'video',getSettings:()=>({width:1920,height:1080})};
  assert.deepEqual(await configureCameraPreview({getSenders:()=>[{track:video,getParameters:()=>({encodings:[]}),setParameters:()=>assert.fail('encoding count changed')}]}),[false]);
  assert.deepEqual(await configureCameraPreview({getSenders:()=>[{track:video,getParameters:()=>({encodings:[{}]}),setParameters:async()=>{throw new Error('unsupported');}}]}),[false]);
  const timers=fakeTimers(),pending=configureCameraPreview({getSenders:()=>[{track:video,getParameters:()=>({encodings:[{}]}),setParameters:()=>new Promise(()=>{})}]},timers);
  await setImmediate();timers.fire();assert.deepEqual(await pending,[]);assert.equal(timers.timers.size,0);
});

test('quality diagnostics distinguish real media source fps from the 30fps preview encoder and omit identifiers',async()=>{
  const report=new Map([
    ['source',{id:'private-camera',type:'media-source',kind:'video',framesPerSecond:59.94,frames:600,timestamp:10000,trackIdentifier:'private-device'}],
    ['out',{id:'private-ssrc',type:'outbound-rtp',kind:'video',framesPerSecond:30,framesEncoded:300,timestamp:10000,encoderImplementation:'hardware encoder',ssrc:12345}],
    ['audio',{type:'media-source',kind:'audio',framesPerSecond:100}],
  ]);
  const evidence=await collectCameraQuality({getStats:async()=>report});
  assert.deepEqual(evidence.metrics,{sourceFps:59.94,previewFps:30,encoderImplementation:'hardware encoder'});
  assert.equal(JSON.stringify(evidence).includes('private-'),false);assert.equal(JSON.stringify(evidence).includes('12345'),false);
});

test('quality diagnostics use frame deltas, reject invalid values and bound failed getStats',async()=>{
  const previous={source:{frames:600,timestamp:10000},preview:{frames:300,timestamp:10000}};
  const rows=[{type:'media-source',kind:'video',framesPerSecond:30,frames:720,timestamp:12000},{type:'outbound-rtp',kind:'video',framesEncoded:360,timestamp:12000,encoderImplementation:'bad\nvalue'}];
  const evidence=await collectCameraQuality({getStats:async()=>new Map(rows.map((row,index)=>[index,row]))},previous);
  assert.deepEqual(evidence.metrics,{sourceFps:60,previewFps:30});
  assert.deepEqual((await collectCameraQuality({getStats:async()=>{throw new Error('closed');}})).metrics,{});
  assert.deepEqual((await collectCameraQuality({getStats:async()=>new Map([[0,{type:'media-source',kind:'video',framesPerSecond:Infinity}]])})).metrics,{});
  const timers=fakeTimers(),pending=collectCameraQuality({getStats:()=>new Promise(()=>{})},{},timers);
  await setImmediate();assert.equal([...timers.timers.values()][0].ms,1000);timers.fire();assert.deepEqual((await pending).metrics,{});assert.equal(timers.timers.size,0);
});

test('local preview sampling counts total frames including dropped frames independently of RTC',()=>{
  let now=0,total=30,dropped=5;const source={},video={srcObject:source,paused:false,getVideoPlaybackQuality:()=>({totalVideoFrames:total,droppedVideoFrames:dropped})};
  const sampler=new CameraPreviewSampler(video,{now:()=>now});sampler.reset(source);
  now=1000;total=90;assert.equal(sampler.sample(source),null,'short windows do not claim a rate');
  now=3000;total=210;dropped=65;assert.deepEqual(sampler.sample(source),{metrics:{localFps:60,localSampleMs:3000},method:'playback-quality',qualityFrames:180});
  sampler.clear();assert.equal(sampler.sample(source),null);
});

test('local preview callback fallback counts presentedFrames gaps and cancels stale callbacks',()=>{
  let now=0,id=0;const callbacks=new Map(),source={},video={srcObject:source,paused:false,getVideoPlaybackQuality:()=>({totalVideoFrames:0}),requestVideoFrameCallback:fn=>{callbacks.set(++id,fn);return id;},cancelVideoFrameCallback:key=>callbacks.delete(key)};
  const sampler=new CameraPreviewSampler(video,{now:()=>now}),frame=frames=>{const[key,callback]=[...callbacks][0];callbacks.delete(key);callback(now,{presentedFrames:frames,mediaTime:now/1000});};
  sampler.reset(source);frame(1);now=3000;frame(181);
  assert.deepEqual(sampler.sample(source),{metrics:{localPresentedFps:60,localSampleMs:3000},method:'video-frame-callback',presentedFrames:180});
  const stale=[...callbacks.values()][0];sampler.clear();assert.equal(callbacks.size,0);stale(now,{presentedFrames:999});assert.equal(callbacks.size,0);assert.equal(sampler.sample(source),null);
});

test('total-frame and presented-frame measurements remain distinct when the compositor drops frames',()=>{
  let now=0,total=0,callback;const source={},video={srcObject:source,paused:false,getVideoPlaybackQuality:()=>({totalVideoFrames:total}),requestVideoFrameCallback:fn=>{callback=fn;return 1;},cancelVideoFrameCallback(){}};
  const sampler=new CameraPreviewSampler(video,{now:()=>now});sampler.reset(source);callback(now,{presentedFrames:1});
  now=3000;total=180;callback(now,{presentedFrames:91});
  assert.deepEqual(sampler.sample(source),{metrics:{localFps:60,localPresentedFps:30,localSampleMs:3000},method:'both',qualityFrames:180,presentedFrames:90});
  sampler.clear();
});

test('overlong local sample windows reset without sending an out-of-contract duration',()=>{
  let now=0,total=0;const source={},video={srcObject:source,paused:false,getVideoPlaybackQuality:()=>({totalVideoFrames:total})},sampler=new CameraPreviewSampler(video,{now:()=>now});
  sampler.reset(source);now=61000;total=3660;assert.equal(sampler.sample(source),null);now=64000;total=3840;assert.equal(sampler.sample(source).metrics.localSampleMs,3000);
});

test('local preview sampling rejects changed sources, counter resets, pauses and unsupported APIs',()=>{
  let now=0,total=100;const source={},video={srcObject:source,paused:false,getVideoPlaybackQuality:()=>({totalVideoFrames:total})},sampler=new CameraPreviewSampler(video,{now:()=>now});
  sampler.reset(source);now=3000;total=280;video.paused=true;assert.equal(sampler.sample(source),null);video.paused=false;
  video.srcObject={};assert.equal(sampler.sample(source),null);video.srcObject=source;
  total=2;assert.equal(sampler.sample(source),null,'reloaded counters start a new baseline');now=6000;total=182;assert.equal(sampler.sample(source).metrics.localFps,60);
  const unsupported=new CameraPreviewSampler({srcObject:source},{now:()=>now});unsupported.reset(source);now=9000;assert.equal(unsupported.sample(source),null);
});

function captureFixture({encodingInfo=async()=>capable,sourceFps=59.94}={}){
  const nodes=new Map(),timers=new Map(),messages=[],recorders=[],records=new Map(),requests=[],listeners=new Map();let timerId=0,onState,now=0;
  class Node{
    constructor(){this.children=[];this.dataset={};this.hidden=false;this.listeners=new Map();this.paused=false;}
    setAttribute(name,value){this[name]=value;}append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}focus(){}
    querySelectorAll(){return [];}addEventListener(name,callback){this.listeners.set(name,callback);}
    async play(){this.videoWidth=1920;this.videoHeight=1080;this.paused=false;}pause(){this.paused=true;}
    getVideoPlaybackQuality(){return {totalVideoFrames:this.totalVideoFrames??0,droppedVideoFrames:this.droppedVideoFrames??0};}
  }
  const document={hidden:false,getElementById(id){if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);},createElement:()=>new Node(),addEventListener(name,fn){listeners.set(name,fn);}};
  const track=new EventTarget();Object.assign(track,{kind:'video',readyState:'live',getSettings:()=>({width:1920,height:1080,frameRate:59.94}),stop(){this.readyState='ended';this.dispatchEvent(new Event('ended'));}});
  const source={getTracks:()=>[track],getVideoTracks:()=>[track]};
  class MediaRecorder extends EventTarget{
    static isTypeSupported(){return true;}
    constructor(stream,options){super();this.stream=stream;this.options=options;this.mimeType=options.mimeType;this.state='inactive';recorders.push(this);}
    start(){this.state='recording';queueMicrotask(()=>this.onstart?.());}stop(){this.state='inactive';queueMicrotask(()=>this.dispatchEvent(new Event('stop')));}
  }
  const store={list:async()=>[],get:async id=>records.get(id),create:async meta=>records.set(meta.id,meta),update:async(id,fn)=>{const meta=fn(records.get(id));records.set(id,meta);return meta;}};
  const session=new Map(),window={document,performance:{now:()=>now},isSecureContext:true,location:{hash:`#room=11111111-1111-4111-8111-111111111111&token=${'a'.repeat(64)}`,pathname:'/camera'},history:{replaceState(){}},sessionStorage:{setItem:(key,value)=>session.set(key,value),getItem:key=>session.get(key)},crypto:{randomUUID:()=>`test-${records.size}`},navigator:{mediaCapabilities:{encodingInfo},mediaDevices:{getUserMedia:async constraints=>{requests.push(constraints);return source;}}},MediaRecorder,RTCPeerConnection:class{},screen:{},addEventListener(){},setInterval(){},setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)};
  const stats=()=>new Map([[0,{type:'media-source',kind:'video',framesPerSecond:sourceFps}],[1,{type:'outbound-rtp',kind:'video',framesPerSecond:30}]]);
  const transport={peer:{getStats:async()=>stats(),sctp:{maxMessageSize:65536}},connect:async()=>onState('connected'),send:message=>{messages.push(message);return true;},disconnect(){}};
  const app=bootCamera(document,window,{store,transportFactory:(_pair,options)=>{onState=options.onState;return transport;}});
  return {app,document,window,nodes,track,source,recorders,records,requests,timers,messages,advance(ms){now+=ms;},dispatch:name=>listeners.get(name)?.(),runTimer(ms){const[id,timer]=[...timers].find(([,value])=>value.ms===ms)??[];assert.ok(timer,`timer ${ms}`);timers.delete(id);timer.fn();}};
}

test('recording uses the approved profile while metadata retains the delivered source fps',async()=>{
  const fixture=captureFixture();await setImmediate();await fixture.nodes.get('prepare').onclick();assert.equal(fixture.app.getState().phase,'preview',fixture.nodes.get('error').textContent);await fixture.nodes.get('start').onclick();await setImmediate();
  const recorder=fixture.recorders[0];assert.equal(recorder.stream,fixture.source);assert.equal(recorder.options.mimeType,high);assert.equal(recorder.options.videoBitsPerSecond,12000000);
  assert.equal([...fixture.records.values()][0].frameRate,59.94);
  assert.deepEqual(fixture.requests[0].video.frameRate,{min:59.94,ideal:60,max:60});
  assert.deepEqual(cameraCaptureConstraints('portrait').video.frameRate,{min:59.94,ideal:60,max:60});
});

test('leaving the foreground during codec probing prevents creation and start of a recorder',async()=>{
  let release;const probe=new Promise(resolve=>{release=resolve;}),fixture=captureFixture({encodingInfo:()=>probe});
  await setImmediate();await fixture.nodes.get('prepare').onclick();const pending=fixture.nodes.get('start').onclick();
  await setImmediate();fixture.document.hidden=true;release(capable);await pending;
  assert.equal(fixture.recorders.length,0);assert.equal(fixture.records.size,0);assert.equal(fixture.app.getState().phase,'error');
  assert.equal(fixture.messages.find(message=>message.kind==='recording-start-error')?.reason,'camera-hidden');
});

test('capture fallback keeps the 59.94fps minimum instead of silently requesting a 30fps source',async()=>{
  const fixture=captureFixture();let attempts=0;
  fixture.window.navigator.mediaDevices.getUserMedia=async constraints=>{
    fixture.requests.push(constraints);if(++attempts===1)throw Object.assign(new Error('resolution unsupported'),{name:'OverconstrainedError'});return fixture.source;
  };
  await setImmediate();await fixture.nodes.get('prepare').onclick();assert.equal(fixture.app.getState().phase,'preview');
  assert.equal(fixture.requests.length,2);
  for(const request of fixture.requests)assert.deepEqual(request.video.frameRate,{min:59.94,ideal:60,max:60});
});

test('diagnostics cover connected preview, recording after three seconds and stop before releasing the source',async()=>{
  const fixture=captureFixture();await setImmediate();await fixture.nodes.get('prepare').onclick();await setImmediate();
  await fixture.nodes.get('start').onclick();await setImmediate();
  const timer=[...fixture.timers.values()].find(value=>value.ms===3000);assert.ok(timer);timer.fn();await setImmediate();
  await fixture.nodes.get('stop').onclick();await setImmediate();
  const diagnostics=fixture.messages.filter(message=>message.kind==='camera-diagnostics');
  assert.deepEqual(diagnostics.map(message=>message.phase),['preview','recording','stopped']);
  assert.equal(diagnostics[1].sourceFps,59.94);assert.equal(diagnostics[1].previewFps,30);assert.equal(diagnostics[1].mimeType,high);assert.equal(diagnostics[1].powerEfficient,true);assert.equal(diagnostics[2].width,1920);
  assert.equal(JSON.parse(diagnostics[1].codecSupport).every(row=>row.state==='queried'),true);
  assert.equal(fixture.track.readyState,'ended');
});

test('stopping a short recording cancels its pending diagnostic without leaving a stale sample timer',async()=>{
  const fixture=captureFixture();await setImmediate();await fixture.nodes.get('prepare').onclick();await fixture.nodes.get('start').onclick();await setImmediate();
  assert.equal([...fixture.timers.values()].filter(value=>value.ms===3000).length,1);
  await fixture.nodes.get('stop').onclick();await setImmediate();
  assert.equal([...fixture.timers.values()].filter(value=>value.ms===3000).length,0);
  assert.deepEqual(fixture.messages.filter(message=>message.kind==='camera-diagnostics').map(message=>message.phase),['preview','stopped']);
});

test('three-second local preview measurement precedes the recorder and remains separate from RTC encoding fps',async()=>{
  const fixture=captureFixture({sourceFps:30});await setImmediate();await fixture.nodes.get('prepare').onclick();await setImmediate();
  fixture.advance(3000);fixture.nodes.get('preview').totalVideoFrames=180;fixture.runTimer(3000);await setImmediate();
  const before=fixture.messages.filter(message=>message.kind==='camera-diagnostics').at(-1);
  assert.equal(fixture.recorders.length,0);assert.equal(before.phase,'preview');assert.equal(before.sourceFps,30);assert.equal(before.localFps,60);assert.equal(before.previewFps,30);
  await fixture.nodes.get('start').onclick();await setImmediate();fixture.advance(3000);fixture.nodes.get('preview').totalVideoFrames=270;fixture.runTimer(3000);await setImmediate();
  const during=fixture.messages.filter(message=>message.kind==='camera-diagnostics').at(-1);
  assert.equal(during.phase,'recording');assert.equal(during.sourceFps,30);assert.equal(during.localFps,30,'recording starts its own frame baseline');assert.equal(during.previewFps,30);
  fixture.advance(3000);fixture.nodes.get('preview').totalVideoFrames=360;await fixture.nodes.get('stop').onclick();await setImmediate();
  const stopped=fixture.messages.filter(message=>message.kind==='camera-diagnostics').at(-1);assert.equal(stopped.phase,'stopped');assert.equal(stopped.sourceFps,30);assert.equal(stopped.localFps,30);assert.equal(fixture.track.readyState,'ended');
});

test('visibility resets the local frame window and never counts frames accumulated while hidden',async()=>{
  const fixture=captureFixture();await setImmediate();await fixture.nodes.get('prepare').onclick();await setImmediate();
  fixture.advance(1000);fixture.nodes.get('preview').totalVideoFrames=60;fixture.document.hidden=true;fixture.dispatch('visibilitychange');
  assert.equal([...fixture.timers.values()].some(timer=>timer.ms===3000),false);
  fixture.advance(10000);fixture.nodes.get('preview').totalVideoFrames=660;fixture.document.hidden=false;fixture.dispatch('visibilitychange');
  fixture.advance(3000);fixture.nodes.get('preview').totalVideoFrames=750;fixture.runTimer(3000);await setImmediate();
  assert.equal(fixture.messages.filter(message=>message.kind==='camera-diagnostics').at(-1).localFps,30);
});

test('unsupported local measurement retains real RTC evidence without inventing a local frame rate',async()=>{
  const fixture=captureFixture({sourceFps:45});fixture.nodes.get('preview').getVideoPlaybackQuality=undefined;
  await setImmediate();await fixture.nodes.get('prepare').onclick();await setImmediate();fixture.advance(3000);fixture.runTimer(3000);await setImmediate();
  const diagnostic=fixture.messages.filter(message=>message.kind==='camera-diagnostics').at(-1);assert.equal(diagnostic.sourceFps,45);assert.equal(diagnostic.previewFps,30);assert.equal(diagnostic.localFps,undefined);assert.equal(diagnostic.localPresentedFps,undefined);
});
