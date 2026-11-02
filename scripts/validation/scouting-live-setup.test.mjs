import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { privateLiveHost, prepareLiveTls } from '../scouting-live-setup.mjs';

test('local certificates validate a private host with an explicit test CA without installing global trust',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'goatleta-live-cert-'));
  let server;
  try {
    const result=prepareLiveTls({host:'192.168.1.10',directory});
    assert.equal(result.trustInstalled,false);assert.equal(prepareLiveTls({host:'192.168.1.10',directory}).reused,true);
    server=https.createServer({key:readFileSync(result.key),cert:readFileSync(result.cert)},(_req,res)=>res.end('camera'));
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    const response=await new Promise((done,fail)=>https.get({hostname:'127.0.0.1',port:server.address().port,ca:readFileSync(result.ca)},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>done(text));}).on('error',fail));
    assert.equal(response,'camera');
    assert.throws(()=>prepareLiveTls({host:'192.168.1.20',directory}),/incompatível/);
  } finally {
    if(server)await new Promise(done=>server.close(done));
    assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});
  }
});
test('preparation refuses public hosts, path-shaped addresses and invalid IPv4',()=>{
  for(const host of ['goatleta.com','8.8.8.8','192.168.0.1/../../x','192.168.0.999'])assert.equal(privateLiveHost(host),false);
  assert.throws(()=>prepareLiveTls({host:'goatleta.com'}));
});
