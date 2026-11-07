import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Buffer } from 'node:buffer';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, symlinkSync, truncateSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLiveService, validateLiveSignal, liveCliOptions, privateIpv4 } from '../scouting-live-service.mjs';

const headers = { Origin:'http://localhost:8081','X-GoAtleta-Live':'1','Content-Type':'application/json' };
const sdp = 'v=0\r\no=- 123 1 IN IP4 127.0.0.1\r\ns=Fixture\r\nt=0 0\r\n';
const rawHttp = (url,{method='GET',headers:requestHeaders={},body,path}={}) => new Promise((resolve,reject)=>{
  const request=http.request(url,{method,headers:requestHeaders,...(path!==undefined?{path}:{})},response=>{
    const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>{const bytes=Buffer.concat(chunks);resolve({status:response.statusCode,headers:new Headers(response.headers),text:bytes.toString('utf8'),bytes});});response.on('error',reject);
  });request.on('error',reject);request.end(body);
});
async function fixture(t, options={}) {
  const assetsDirectory=mkdtempSync(join(tmpdir(),'goatleta-live-test-'));
  writeFileSync(join(assetsDirectory,'camera.html'),'<!doctype html><title>Go Atleta câmera fixture</title><script src="/camera.js"></script>');
  writeFileSync(join(assetsDirectory,'camera.js'),'// Isolated camera fixture, no capture.');
  const service=createLiveService({assetsDirectory,...options});
  await new Promise(resolve=>service.hostServer.listen(0,'127.0.0.1',resolve));
  const port=service.hostServer.address().port, base=`http://127.0.0.1:${port}`, localOrigin=`http://localhost:${port}`;
  t.after(async()=>{service.closeAll();await new Promise(resolve=>service.hostServer.close(resolve));rmSync(assetsDirectory,{recursive:true,force:true});});
  const request=async(path,{method='GET',body,extra={},raw=false}={})=>{
    const response=await rawHttp(base+path,{method,headers:{...headers,...extra},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
    return {status:response.status,headers:response.headers,value:raw?response.text:JSON.parse(response.text)};
  };
  const room=async()=>{const r=await request('/rooms',{method:'POST',body:{}});assert.equal(r.status,201);return r.value;};
  const role=(room,side='host',client)=>({'X-GoAtleta-Live-Role':side,'X-GoAtleta-Live-Token':side==='host'?room.hostToken:room.cameraToken,...(side==='camera'?{Origin:localOrigin}:{}),...(client?{'X-GoAtleta-Live-Client':client}:{})});
  const joinCamera=async(room,client)=>{const r=await request(`/rooms/${room.roomId}/join`,{method:'POST',body:{},extra:role(room,'camera',client)});assert.equal(r.status,200);return r.value;};
  return {service,request,room,role,joinCamera,base,port,localOrigin,assetsDirectory};
}

const probeName='go-atleta-camera-probe.apk',probePath=`/android/${probeName}`;
async function androidProbeFixture(t) {
  const root=mkdtempSync(join(tmpdir(),'goatleta-android-probe-test-')),directory=join(root,'probe');mkdirSync(directory);
  const nativeAssetsDirectory=join(root,'native-assets');mkdirSync(nativeAssetsDirectory);
  const f=await fixture(t,{cameraOrigin:'https://192.168.1.20:8097',androidProbeDirectory:directory,nativeAssetsDirectory});
  // Exercise the HTTPS-only handler on an isolated loopback listener; real TLS is a separate smoke.
  const server=http.createServer(f.service.cameraHandler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));rmSync(root,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`,headers={Host:'192.168.1.20:8097'};
  const request=(path=probePath,options={})=>rawHttp(base,{...options,path,headers:{...headers,...options.headers}});
  return {root,directory,nativeAssetsDirectory,file:join(directory,probeName),base,headers,request,host:f};
}

test('local capability rooms disclose no scouting identity and distinguish Wi-Fi setup from loopback smoke',async t=>{
  const f=await fixture(t), config=await f.request('/config');
  assert.equal(config.value.cameraReady,false);assert.equal(config.value.cameraOrigin,null);assert.equal(config.value.localCameraOrigin,f.localOrigin);
  const room=await f.room();
  assert.match(room.hostToken,/^[a-f0-9]{64}$/);assert.match(room.cameraToken,/^[a-f0-9]{64}$/);assert.notEqual(room.hostToken,room.cameraToken);
  assert.equal(room.cameraUrl,null);assert.equal(new URL(room.localCameraUrl).origin,f.localOrigin);
  assert.equal(new URL(room.localCameraUrl).search,'');assert.equal(new URL(room.localCameraUrl).hash,`#room=${room.roomId}&token=${room.cameraToken}`);
  const joined=await f.joinCamera(room), status=await f.request(`/rooms/${room.roomId}/status`,{extra:f.role(room,'camera',joined.cameraClientId)});
  assert.equal(status.value.cameraConnected,true);assert.equal(status.value.closed,false);assert.equal('hostToken' in status.value,false);assert.equal('cameraToken' in status.value,false);
});

test('host creation rejects other origins, omitted CSRF header, rebinding and private data payloads',async t=>{
  const f=await fixture(t);
  for(const extra of [{Origin:'https://evil.example'},{Origin:'null'},{'X-GoAtleta-Live':''},{Host:`evil.example:${f.port}`}]) assert.equal((await f.request('/rooms',{method:'POST',body:{},extra})).status,403);
  for(const body of [{organizationId:'private'},{athleteName:'private'},{title:'private'},[],null]) assert.equal((await f.request('/rooms',{method:'POST',body})).status,400);
  assert.equal(f.service.roomCount(),0);
});

test('capabilities cannot cross roles or rooms, and camera cannot close or create rooms',async t=>{
  const f=await fixture(t), a=await f.room(),b=await f.room(),joined=await f.joinCamera(a);
  assert.equal((await f.request(`/rooms/${b.roomId}/status`,{extra:f.role(a)})).status,401);
  assert.equal((await f.request(`/rooms/${a.roomId}/status`,{extra:{...f.role(a),'X-GoAtleta-Live-Token':a.cameraToken}})).status,401);
  assert.equal((await f.request(`/rooms/${a.roomId}`,{method:'DELETE',extra:f.role(a,'camera',joined.cameraClientId)})).status,405);
  assert.equal((await f.request('/rooms',{method:'POST',body:{},extra:f.role(a,'camera',joined.cameraClientId)})).status,403);
  assert.equal((await f.request(`/rooms/${a.roomId}/status`,{extra:{...f.role(a),Origin:'https://evil.example'}})).status,403);
});

test('one active camera is retained across rejoin and another is allowed only after lease expiry',async t=>{
  let now=10000;const f=await fixture(t,{now:()=>now,cameraLeaseMs:1000}),room=await f.room(),joined=await f.joinCamera(room);
  const other=await f.request(`/rooms/${room.roomId}/join`,{method:'POST',body:{},extra:f.role(room,'camera')});assert.equal(other.status,409);
  assert.equal((await f.joinCamera(room,joined.cameraClientId)).cameraClientId,joined.cameraClientId);
  now+=1001;
  assert.equal((await f.request(`/rooms/${room.roomId}/status`,{extra:f.role(room)})).value.cameraConnected,false);
  const replacement=await f.joinCamera(room);assert.notEqual(replacement.cameraClientId,joined.cameraClientId);
  assert.equal((await f.request(`/rooms/${room.roomId}/heartbeat`,{method:'POST',body:{},extra:f.role(room,'camera',joined.cameraClientId)})).status,401);
});

test('offers, answers and ICE relay only to the other role; rejoin cursor avoids old responses',async t=>{
  const f=await fixture(t),room=await f.room(),joined=await f.joinCamera(room),camera=f.role(room,'camera',joined.cameraClientId),host=f.role(room);
  const offer=await f.request(`/rooms/${room.roomId}/signals`,{method:'POST',body:{type:'offer',sdp},extra:camera});assert.deepEqual(offer.value,{sequence:1,generation:1});
  const hostPoll=await f.request(`/rooms/${room.roomId}/signals?after=0`,{extra:host});assert.equal(hostPoll.value.signals[0].from,'camera');assert.equal(hostPoll.value.signals[0].sdp,sdp);
  const answer=await f.request(`/rooms/${room.roomId}/signals`,{method:'POST',body:{type:'answer',sdp,generation:1},extra:host});assert.equal(answer.status,200);
  const cameraPoll=await f.request(`/rooms/${room.roomId}/signals?after=0`,{extra:camera});assert.equal(cameraPoll.value.signals.length,1);assert.equal(cameraPoll.value.signals[0].from,'host');
  assert.equal((await f.request(`/rooms/${room.roomId}/signals`,{method:'POST',body:{type:'ice',candidate:null,generation:1},extra:camera})).status,200);
  const rejoin=await f.joinCamera(room,joined.cameraClientId);assert.equal(rejoin.cursor,3);
});

test('new negotiation invalidates late SDP and ICE and clears prior messages without resetting cursor',async t=>{
  const f=await fixture(t),room=await f.room(),joined=await f.joinCamera(room),camera=f.role(room,'camera',joined.cameraClientId),host=f.role(room);
  for(let i=0;i<2;i++)assert.equal((await f.request(`/rooms/${room.roomId}/signals`,{method:'POST',body:{type:'offer',sdp},extra:camera})).status,200);
  const poll=await f.request(`/rooms/${room.roomId}/signals?after=0`,{extra:host});assert.equal(poll.value.cursor,2);assert.equal(poll.value.signals.length,1);assert.equal(poll.value.signals[0].generation,2);
  for(const payload of [{type:'answer',sdp,generation:1},{type:'ice',candidate:null,generation:1}]) assert.equal((await f.request(`/rooms/${room.roomId}/signals`,{method:'POST',body:payload,extra:host})).status,409);
  assert.equal((await f.request(`/rooms/${room.roomId}/signals?after=999`,{extra:host})).status,409);
});

test('room expiration and explicit close revoke both capabilities; disconnect alone keeps the room',async t=>{
  let now=10000;const f=await fixture(t,{now:()=>now,ttlMs:2000,cameraLeaseMs:1000}),room=await f.room(),joined=await f.joinCamera(room);
  now+=1100;assert.equal((await f.request(`/rooms/${room.roomId}/status`,{extra:f.role(room)})).status,200);assert.equal(f.service.roomCount(),1);
  now+=1000;assert.equal((await f.request(`/rooms/${room.roomId}/status`,{extra:f.role(room)})).status,410);
  const next=await f.room();assert.equal((await f.request(`/rooms/${next.roomId}`,{method:'DELETE',extra:f.role(next)})).status,200);
  assert.equal((await f.request(`/rooms/${next.roomId}/status`,{extra:f.role(next)})).status,410);assert.equal(f.service.roomCount(),0);
});

test('only bounded connection payloads are accepted, never media, clock, point or private fields',async t=>{
  const f=await fixture(t),room=await f.room(),joined=await f.joinCamera(room),extra=f.role(room,'camera',joined.cameraClientId);
  for(const body of [{type:'point',score:1},{type:'offer',sdp,studentId:'private'},{type:'offer',sdp:'not-sdp'},{type:'offer',sdp:'v=0'+'x'.repeat(65536)},{type:'ice',candidate:null}]) assert.equal((await f.request(`/rooms/${room.roomId}/signals`,{method:'POST',body,extra})).status,400);
  assert.equal((await f.request(`/rooms/${room.roomId}/signals`,{method:'POST',body:'x'.repeat(100000),extra})).status,413);
  assert.throws(()=>validateLiveSignal({type:'answer',sdp,generation:1},'camera'));
  assert.throws(()=>validateLiveSignal({type:'offer',sdp},'host'));
  assert.deepEqual(validateLiveSignal({type:'ice',generation:1,candidate:{candidate:''}},'camera'),{type:'ice',generation:1,candidate:{candidate:'',sdpMid:null,sdpMLineIndex:null}});
});

test('signal queue, creation and per-room negotiation limits remain bounded',async t=>{
  const f=await fixture(t),room=await f.room(),joined=await f.joinCamera(room),extra=f.role(room,'camera',joined.cameraClientId);
  for(let i=0;i<8;i++)assert.equal((await f.request(`/rooms/${room.roomId}/signals`,{method:'POST',body:{type:'offer',sdp},extra})).status,200);
  assert.equal((await f.request(`/rooms/${room.roomId}/signals`,{method:'POST',body:{type:'offer',sdp},extra})).status,429);
  for(let i=0;i<5;i++)await f.room();assert.equal((await f.request('/rooms',{method:'POST',body:{}})).status,429);
  const other=await fixture(t),r=await other.room(),j=await other.joinCamera(r),cam=other.role(r,'camera',j.cameraClientId);
  await other.request(`/rooms/${r.roomId}/signals`,{method:'POST',body:{type:'offer',sdp},extra:cam});
  for(let i=0;i<255;i++)assert.equal((await other.request(`/rooms/${r.roomId}/signals`,{method:'POST',body:{type:'ice',candidate:null,generation:1},extra:cam})).status,200);
  assert.equal((await other.request(`/rooms/${r.roomId}/signals`,{method:'POST',body:{type:'ice',candidate:null,generation:1},extra:cam})).status,429);
});

test('camera assets are allowlisted and cannot carry tokens in requests or read arbitrary files',async t=>{
  const f=await fixture(t);
  const html=await f.request('/camera',{raw:true,extra:{Origin:''}});assert.equal(html.status,200);assert.match(html.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(html.headers.get('referrer-policy'),'no-referrer');
  for(const path of ['/camera?token=secret','/camera.js?token=secret','/camera/../package.json','/package.json','/%2e%2e/package.json']) assert.notEqual((await f.request(path,{raw:true})).status,200);
  assert.equal((await f.request('/camera.js',{raw:true})).status,200);
  assert.equal((await f.request('/certificate.crt',{raw:true})).status,404);
});

test('camera fonts use exact local assets, binary MIME and same-origin policy without directory exposure',async t=>{
  const f=await fixture(t), directory=join(f.assetsDirectory,'fonts');mkdirSync(directory);
  assert.equal((await f.request('/fonts/Inter-Regular.ttf',{raw:true})).status,404);
  for(const [index,name] of ['Inter-Regular.ttf','Inter-SemiBold.ttf','Inter-Bold.ttf'].entries()) {
    const bytes=Buffer.from([0,1,0,0,128,255,index]);writeFileSync(join(directory,name),bytes);
    const response=await rawHttp(f.base+`/fonts/${name}`);
    assert.equal(response.status,200);assert.deepEqual(response.bytes,bytes);assert.equal(response.headers.get('content-type'),'font/ttf');
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('cross-origin-resource-policy'),'same-origin');
    assert.match(response.headers.get('content-security-policy'),/font-src 'self';/);assert.equal(response.headers.get('access-control-allow-origin'),null);
  }
  writeFileSync(join(directory,'Inter-Italic.ttf'),'not allowlisted');writeFileSync(join(directory,'LICENSE.txt'),'not allowlisted');
  for(const path of ['/fonts','/fonts/','/fonts/Inter-Italic.ttf','/fonts/LICENSE.txt','/fonts/Inter-Regular.ttf?token=secret','/fonts/../camera.js','/fonts/%2e%2e/camera.js']) {
    assert.notEqual((await rawHttp(f.base,{path})).status,200,path);
  }
  writeFileSync(join(directory,'Inter-Regular.ttf'),Buffer.alloc(512*1024+1));
  assert.equal((await f.request('/fonts/Inter-Regular.ttf',{raw:true})).status,503);
});

test('bundled camera typography uses unmodified local Inter weights with its original license',()=>{
  const directory=new URL('../../public/scouting-live/',import.meta.url),html=readFileSync(new URL('camera.html',directory),'utf8');
  for(const [name,weight] of [['Inter-Regular.ttf',400],['Inter-SemiBold.ttf',600],['Inter-Bold.ttf',700]]) {
    const font=readFileSync(new URL(`fonts/${name}`,directory));
    assert.ok(font.length>0&&font.length<=512*1024);assert.deepEqual(font.subarray(0,4),Buffer.from([0,1,0,0]));
    assert.ok(html.includes(`src:url('/fonts/${name}') format('truetype');font-style:normal;font-weight:${weight};font-display:swap`));
  }
  const license=readFileSync(new URL('fonts/LICENSE.txt',directory),'utf8');
  assert.match(license,/Copyright \(c\) 2016-2020 The Inter Project Authors/);assert.match(license,/SIL OPEN FONT LICENSE Version 1\.1/);assert.match(license,/OTHER DEALINGS IN THE FONT SOFTWARE\./);
  assert.doesNotMatch(html,/@import|https?:\/\/fonts\./);
});

test('HTTPS handler checks configured LAN authority, origin and role independently of the host UI',async t=>{
  const f=await fixture(t,{cameraOrigin:'https://192.168.1.20:8097'}),room=await f.room();
  assert.equal(new URL(room.cameraUrl).origin,'https://192.168.1.20:8097');assert.equal((await f.request('/config')).value.cameraReady,true);
  mkdirSync(join(f.assetsDirectory,'fonts'));const font=Buffer.from([0,1,0,0,255]);writeFileSync(join(f.assetsDirectory,'fonts/Inter-Regular.ttf'),font);
  // Handler integration uses an isolated HTTP loopback listener, not a claim of TLS validation.
  const server=http.createServer(f.service.cameraHandler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(extra={})=>rawHttp(base+`/rooms/${room.roomId}/join`,{method:'POST',headers:{...headers,Host:'192.168.1.20:8097',Origin:'https://192.168.1.20:8097','X-GoAtleta-Live-Role':'camera','X-GoAtleta-Live-Token':room.cameraToken,...extra},body:'{}'});
  assert.equal((await call()).status,200);assert.equal((await call({Origin:'https://evil.example'})).status,403);assert.equal((await call({Host:'evil.example:8097'})).status,403);assert.equal((await call({'X-GoAtleta-Live-Role':'host','X-GoAtleta-Live-Token':room.hostToken})).status,403);
  const cameraFont=await rawHttp(base+'/fonts/Inter-Regular.ttf',{headers:{Host:'192.168.1.20:8097',Origin:'https://192.168.1.20:8097'}});
  assert.equal(cameraFont.status,200);assert.deepEqual(cameraFont.bytes,font);assert.equal(cameraFont.headers.get('content-type'),'font/ttf');
  assert.equal((await rawHttp(base+'/fonts/Inter-Regular.ttf',{headers:{Host:'evil.example:8097'}})).status,403);
});

test('native test page uses isolated HTTPS assets and disallows browser capture permissions',async t=>{
  const f=await androidProbeFixture(t);
  const page='<!doctype html><script type="module" src="/native-camera.js"></script>';
  writeFileSync(join(f.host.assetsDirectory,'native-camera.html'),'// Unrelated public asset');
  assert.equal((await f.request('/native-camera')).status,404);
  writeFileSync(join(f.nativeAssetsDirectory,'native-camera.html'),page);
  writeFileSync(join(f.nativeAssetsDirectory,'native-camera.js'),'// Native preview fixture');
  const response=await f.request('/native-camera');
  assert.equal(response.status,200);
  assert.equal(response.text,page);
  assert.equal(response.headers.get('permissions-policy'),'camera=(), microphone=(), display-capture=()');
  assert.match(response.headers.get('content-security-policy'),/connect-src 'self'/);
  assert.equal((await f.request('/native-camera.js')).status,200);
  for (const path of ['/native-camera?token=fixture','/native-camera#token=fixture','//example.test/native-camera']) assert.equal((await f.request(path)).status,400);
  for (const path of ['/native-camera','/native-camera.js']) assert.equal((await f.host.request(path,{raw:true})).status,404);
});

test('only HTTPS GET and HEAD can serve the one local Android probe with exact download headers and bytes',async t=>{
  const f=await androidProbeFixture(t),apk=Buffer.alloc(1024*1024+7,0xa5);writeFileSync(f.file,apk);
  const downloaded=await f.request();assert.equal(downloaded.status,200);assert.deepEqual(downloaded.bytes,apk);
  for(const [key,value] of [['content-type','application/vnd.android.package-archive'],['content-disposition',`attachment; filename="${probeName}"`],['content-length',String(apk.length)],['cache-control','no-store'],['x-content-type-options','nosniff']])assert.equal(downloaded.headers.get(key),value);
  const head=await f.request(probePath,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),String(apk.length));assert.equal(head.bytes.length,0);
  for(const method of ['GET','HEAD'])assert.equal((await f.host.request(probePath,{method,raw:true})).status,404);
  assert.equal((await f.request(probePath,{headers:{Host:'evil.example:8097'}})).status,403);
});

test('Android probe requests cannot select another file through path, query, method or encoded variants',async t=>{
  const f=await androidProbeFixture(t);writeFileSync(f.file,'fixed probe');writeFileSync(join(f.directory,'private.apk'),'never downloadable');
  for(const path of ['/android','/android/','/android/private.apk',`${probePath}?file=private.apk`,`${probePath}?token=secret`,`${probePath}/extra`,`${probePath}#fragment`,'/android/../private.apk','/android/%2e%2e/private.apk','/%61ndroid/go-atleta-camera-probe.apk','/Android/go-atleta-camera-probe.apk','//android/go-atleta-camera-probe.apk']) {
    const response=await f.request(path);assert.equal(response.status,404,path);assert.deepEqual(JSON.parse(response.text),{error:'Arquivo indisponível.'});assert.ok(!response.text.includes(f.root));
  }
  for(const method of ['POST','PUT','DELETE'])assert.equal((await f.request(probePath,{method})).status,404);
});

test('missing, empty, non-regular and over-64-MiB Android probe files return the same generic absence',async t=>{
  const f=await androidProbeFixture(t),absent=async()=>{const response=await f.request();assert.equal(response.status,404);assert.deepEqual(JSON.parse(response.text),{error:'Arquivo indisponível.'});assert.ok(!response.text.includes(f.root));};
  await absent();writeFileSync(f.file,Buffer.alloc(0));await absent();
  truncateSync(f.file,64*1024*1024);const atCap=await f.request(probePath,{method:'HEAD'});assert.equal(atCap.status,200);assert.equal(atCap.headers.get('content-length'),String(64*1024*1024));assert.equal(atCap.bytes.length,0);
  truncateSync(f.file,64*1024*1024+1);await absent();rmSync(f.file);mkdirSync(f.file);await absent();
});

test('Android probe file symlinks cannot expose another local file',async t=>{
  const f=await androidProbeFixture(t),outside=join(f.root,'private.apk');writeFileSync(outside,'private bytes');
  try{symlinkSync(outside,f.file,'file');}catch(error){if(['EPERM','EACCES','ENOSYS'].includes(error.code)){t.skip('File symlinks unavailable to this Windows account; directory junction escape is tested separately.');return;}throw error;}
  const response=await f.request();assert.equal(response.status,404);assert.deepEqual(JSON.parse(response.text),{error:'Arquivo indisponível.'});
});

test('Android probe directory symlinks or Windows junctions cannot escape the fixed directory',async t=>{
  const f=await androidProbeFixture(t),outside=join(f.root,'elsewhere');mkdirSync(outside);writeFileSync(join(outside,probeName),'private bytes');
  assert.equal(f.directory,join(f.root,'probe'));rmSync(f.directory,{recursive:true,force:true});
  symlinkSync(outside,f.directory,process.platform==='win32'?'junction':'dir');
  const response=await f.request();assert.equal(response.status,404);assert.deepEqual(JSON.parse(response.text),{error:'Arquivo indisponível.'});
});

test('Android probe streaming tolerates a paused reader and abort without poisoning a later complete download',async t=>{
  const f=await androidProbeFixture(t),apk=Buffer.alloc(2*1024*1024+3,0x6b);writeFileSync(f.file,apk);
  await new Promise((resolve,reject)=>{
    let cancelled=false;const request=http.request(f.base,{path:probePath,headers:f.headers},response=>{
      response.on('error',error=>{if(!cancelled)reject(error);});response.once('data',()=>{cancelled=true;response.destroy();request.destroy();resolve();});
    });request.on('error',error=>{if(!cancelled)reject(error);});request.end();
  });
  const complete=await new Promise((resolve,reject)=>{
    const request=http.request(f.base,{path:probePath,headers:f.headers},response=>{
      const chunks=[];response.pause();setTimeout(()=>response.resume(),15);
      response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve(Buffer.concat(chunks)));response.on('error',reject);
    });request.on('error',reject);request.end();
  });
  assert.deepEqual(complete,apk);
});

test('CLI refuses public hosts, partial TLS configuration, invalid ports and secrets posing as certificate',()=>{
  assert.equal(privateIpv4('192.168.1.10'),true);assert.equal(privateIpv4('172.20.0.2'),true);assert.equal(privateIpv4('8.8.8.8'),false);assert.equal(privateIpv4('127.0.0.1'),false);
  assert.deepEqual(liveCliOptions([]),{httpPort:8096,httpsPort:8097,assetsDirectory:join(process.cwd(),'public/scouting-live')});
  assert.equal(liveCliOptions(['--cert','public.pem','--key','private.pem','--public-host','192.168.1.20']).publicHost,'192.168.1.20');
  for(const args of [['--cert','x'],['--public-host','192.168.1.20'],['--cert','x','--key','y','--public-host','example.com'],['--http-port','80'],['--http-port','8097'],['--http-port','9000','--http-port','9001'],['--unknown','x']]) assert.throws(()=>liveCliOptions(args));
  assert.throws(()=>createLiveService({certificate:'-----BEGIN PRIVATE KEY-----'}));
});
