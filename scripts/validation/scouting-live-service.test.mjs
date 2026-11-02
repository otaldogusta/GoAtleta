import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLiveService, validateLiveSignal, liveCliOptions, privateIpv4 } from '../scouting-live-service.mjs';

const headers = { Origin:'http://localhost:8081','X-GoAtleta-Live':'1','Content-Type':'application/json' };
const sdp = 'v=0\r\no=- 123 1 IN IP4 127.0.0.1\r\ns=Fixture\r\nt=0 0\r\n';
const rawHttp = (url,{method='GET',headers:requestHeaders={},body}={}) => new Promise((resolve,reject)=>{
  const request=http.request(url,{method,headers:requestHeaders},response=>{
    const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:new Headers(response.headers),text:Buffer.concat(chunks).toString('utf8')}));response.on('error',reject);
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

test('HTTPS handler checks configured LAN authority, origin and role independently of the host UI',async t=>{
  const f=await fixture(t,{cameraOrigin:'https://192.168.1.20:8097'}),room=await f.room();
  assert.equal(new URL(room.cameraUrl).origin,'https://192.168.1.20:8097');assert.equal((await f.request('/config')).value.cameraReady,true);
  // Handler integration uses an isolated HTTP loopback listener, not a claim of TLS validation.
  const server=http.createServer(f.service.cameraHandler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(extra={})=>rawHttp(base+`/rooms/${room.roomId}/join`,{method:'POST',headers:{...headers,Host:'192.168.1.20:8097',Origin:'https://192.168.1.20:8097','X-GoAtleta-Live-Role':'camera','X-GoAtleta-Live-Token':room.cameraToken,...extra},body:'{}'});
  assert.equal((await call()).status,200);assert.equal((await call({Origin:'https://evil.example'})).status,403);assert.equal((await call({Host:'evil.example:8097'})).status,403);assert.equal((await call({'X-GoAtleta-Live-Role':'host','X-GoAtleta-Live-Token':room.hostToken})).status,403);
});

test('CLI refuses public hosts, partial TLS configuration, invalid ports and secrets posing as certificate',()=>{
  assert.equal(privateIpv4('192.168.1.10'),true);assert.equal(privateIpv4('172.20.0.2'),true);assert.equal(privateIpv4('8.8.8.8'),false);assert.equal(privateIpv4('127.0.0.1'),false);
  assert.deepEqual(liveCliOptions([]),{httpPort:8096,httpsPort:8097,assetsDirectory:join(process.cwd(),'public/scouting-live')});
  assert.equal(liveCliOptions(['--cert','public.pem','--key','private.pem','--public-host','192.168.1.20']).publicHost,'192.168.1.20');
  for(const args of [['--cert','x'],['--public-host','192.168.1.20'],['--cert','x','--key','y','--public-host','example.com'],['--http-port','80'],['--http-port','8097'],['--http-port','9000','--http-port','9001'],['--unknown','x']]) assert.throws(()=>liveCliOptions(args));
  assert.throws(()=>createLiveService({certificate:'-----BEGIN PRIVATE KEY-----'}));
});
