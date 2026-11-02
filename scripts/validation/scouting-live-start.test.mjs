import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseLiveLocalConfig, probeLiveService, startOrReuseLiveService, liveStartOptions } from '../start-scouting-live.mjs';

const configFile=join(tmpdir(),'goatleta-live-helper','local-config.json');
const directory=dirname(configFile),config={host:'192.168.1.20',directory,ca:join(directory,'ca.crt'),cert:join(directory,'camera.crt'),key:join(directory,'camera.key'),fingerprint:'PUBLIC-FINGERPRINT',reused:false,trustInstalled:false};

test('config accepts only private LAN setup and certificate paths within its own directory',()=>{
  assert.deepEqual(parseLiveLocalConfig(config,configFile),{host:config.host,ca:config.ca,cert:config.cert,key:config.key});
  for(const changed of [{...config,host:'8.8.8.8'},{...config,key:'../outside.key'},{...config,directory:tmpdir()},{...config,key:''},{...config,privateKey:'never-print-this'}])assert.throws(()=>parseLiveLocalConfig(changed,configFile));
  assert.deepEqual(parseLiveLocalConfig({...config,ca:'ca.crt',cert:'camera.crt',key:'camera.key'},configFile),{host:config.host,ca:config.ca,cert:config.cert,key:config.key});
});

test('an expected active service is reused without reading keys, spawning processes or restarting anything',async()=>{
  let reads=0,spawns=0;
  const result=await startOrReuseLiveService({probe:async()=>({cameraReady:true}),readConfig:()=>{reads++;throw new Error('must not read');},spawnProcess:()=>{spawns++;throw new Error('must not spawn');}});
  assert.deepEqual(result,{reused:true,cameraReady:true,child:null});assert.equal(reads,0);assert.equal(spawns,0);
});

test('a free port starts the existing companion using separate arguments and local config, with no shell',async()=>{
  const calls=[];const child={fixture:true};
  const result=await startOrReuseLiveService({configFile,probe:async()=>null,readConfig:path=>{assert.equal(path,configFile);return config;},spawnProcess:(...args)=>{calls.push(args);return child;}});
  assert.equal(result.child,child);assert.equal(result.cameraReady,true);assert.equal(result.reused,false);
  assert.equal(calls.length,1);assert.equal(calls[0][0],process.execPath);assert.equal(calls[0][2].shell,false);assert.equal(calls[0][2].windowsHide,true);
  const args=calls[0][1];assert.match(args[0],/scouting-live-service\.mjs$/);assert.equal(args[args.indexOf('--public-host')+1],config.host);assert.equal(args[args.indexOf('--key')+1],config.key);
  assert.equal(args.includes('--ca'),true);assert.equal(args.some(arg=>arg.includes('never-print-this')),false);
});

test('explicit loopback smoke does not prepare or read certificates and never enables a LAN camera URL',async()=>{
  let read=false,args;
  const result=await startOrReuseLiveService({loopbackOnly:true,probe:async()=>null,readConfig:()=>{read=true;},spawnProcess:(_node,value)=>{args=value;return {};}});
  assert.equal(read,false);assert.equal(result.cameraReady,false);assert.equal(args.includes('--cert'),false);assert.equal(args.includes('--public-host'),false);
});

test('an occupied or unresponsive service blocks startup instead of stopping it',async()=>{
  let spawned=false;
  await assert.rejects(startOrReuseLiveService({probe:async()=>{throw new Error('occupied');},spawnProcess:()=>{spawned=true;}}),/occupied/);
  assert.equal(spawned,false);
});

test('probe sends only local-origin handshake and verifies the configured service shape',async t=>{
  const server=http.createServer((req,res)=>{
    assert.equal(req.url,'/config');assert.equal(req.headers.origin,'http://localhost:8081');assert.equal(req.headers['x-goatleta-live'],'1');
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({cameraReady:true,cameraOrigin:'https://192.168.1.20:8097',localCameraOrigin:`http://localhost:${req.socket.localPort}`,roomTtlMs:7200000}));
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));t.after(()=>new Promise(done=>server.close(done)));
  assert.equal((await probeLiveService({port:server.address().port})).cameraReady,true);
});

test('probe rejects unrelated service responses without launching a process',async t=>{
  const server=http.createServer((_req,res)=>res.end('{"application":"unrelated"}'));
  await new Promise(done=>server.listen(0,'127.0.0.1',done));t.after(()=>new Promise(done=>server.close(done)));
  await assert.rejects(probeLiveService({port:server.address().port}),/não reconhecido/);
});

test('start arguments are explicit and do not allow hidden options or repeated flags',()=>{
  assert.deepEqual(liveStartOptions(['--loopback-only']),{loopbackOnly:true});
  assert.equal(liveStartOptions(['--config',configFile]).configFile,configFile);
  for(const args of [['--trust'],['--config'],['--loopback-only','--loopback-only'],['--config',configFile,'--config',configFile]])assert.throws(()=>liveStartOptions(args));
});
