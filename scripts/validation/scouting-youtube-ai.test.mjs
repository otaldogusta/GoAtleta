import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createService, validateRequest, validateOutput, analyze } from '../scouting-youtube-service.mjs';
const request = { videoId: 'mdfgd1K3HTc', start: 0, end: 60 };
test('rejects arbitrary URLs, excessive duration and invalid ranges', () => {
  for (const value of [{...request,videoId:'https://internal/'},{...request,end:1000},{...request,start:-1},{...request,start:61}]) assert.throws(()=>validateRequest(value));
  assert.deepEqual(validateRequest(request),request);
});
test('requires visual access and bounded, supported observations', () => {
  assert.throws(()=>validateOutput({video_accessible:false},request));
  const valid={video_accessible:true,rallies:[],contacts:[],limitations:[]};
  assert.equal(validateOutput(valid,request).videoId,request.videoId);
  assert.throws(()=>validateOutput({...valid,contacts:[{time:65,skill:'Saque',side:'near',evidence:''}]},request));
});
test('keeps valid observations and reports discarded out-of-window rows without clamping times',()=>{
  const result=validateOutput({video_accessible:true,rallies:[{start:12,end:20,evidence:'Observed'}],contacts:[{time:60,skill:'Saque',side:'near',evidence:'Outside'}],limitations:[]},request);
  assert.equal(result.rallies.length,1);assert.equal(result.contacts.length,0);
  assert.match(result.limitations[0],/1 sugestões inválidas/);
});
test('uses fixed host, clipped video and secret header; maps quota failure safely', async()=>{
  await assert.rejects(analyze(request,'fake-test-secret',undefined,async(url,options)=>{
    assert.match(url,/^https:\/\/generativelanguage.googleapis.com\//);
    assert.equal(options.headers['x-goog-api-key'],'fake-test-secret');
    assert.equal(JSON.parse(options.body).contents[0].parts[0].videoMetadata.endOffset,'60s');
    return {ok:false,status:429};
  }),/Limite do Gemini/);
});
test('blocks foreign origins, rebinding and requests missing CSRF header', async()=>{
  const server=createService('fake-test-secret','unused');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const url=`http://127.0.0.1:${server.address().port}/analyze`;
    for(const headers of [{Origin:'https://evil.invalid',Host:'127.0.0.1:8094'},{Origin:'http://localhost:8081',Host:'evil.invalid'},{Origin:'http://localhost:8081',Host:'127.0.0.1:8094'}]) {
      const r=await fetch(url,{method:'POST',headers});assert.equal(r.status,403);
    }
  } finally {await new Promise(resolve=>server.close(resolve));}
});
test('retries explicit 503 only once and never retries a timeout', async()=>{
  let calls=0;
  await assert.rejects(analyze(request,'fake-test-secret',undefined,async()=>{calls++;return {ok:false,status:503};}),/indisponível/);
  assert.equal(calls,2);
  calls=0;
  await assert.rejects(analyze(request,'fake-test-secret',undefined,async()=>{calls++;throw new DOMException('Timeout','TimeoutError');}),/Timeout/);
  assert.equal(calls,1);
});
test('async job can reattach, complete and reuse cache without another provider call', async()=>{
  const folder=mkdtempSync(join(tmpdir(),'goatleta-ai-test-'));
  let finish, calls=0;
  const server=createService('fake-test-secret',folder,()=>{calls++;return new Promise(resolve=>{finish=resolve;});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const headers={Host:'127.0.0.1:8094',Origin:'http://localhost:8081','Content-Type':'application/json','X-GoAtleta-Analysis':'1'};
  const start=()=>fetch(base+'/analyze',{method:'POST',headers,body:JSON.stringify(request)});
  try {
    const first=await start(); assert.equal(first.status,202);const {jobId}=await first.json();
    assert.equal((await (await start()).json()).jobId,jobId);
    const result={...request,model:'test',rallies:[],contacts:[],limitations:[]};finish(result);
    await new Promise(resolve=>setImmediate(resolve));
    const done=await fetch(base+'/jobs/'+jobId,{headers});assert.equal(done.status,200);assert.deepEqual(await done.json(),result);
    const cached=await start();assert.equal(cached.status,200);assert.equal(calls,1);
  } finally {await new Promise(resolve=>server.close(resolve));rmSync(folder,{recursive:true});}
});
test('splits a truncated result into smaller clips without accepting partial JSON', async()=>{
  const ranges=[];
  const value=await analyze(request,'fake-test-secret',undefined,async(_url,options)=>{
    const clip=JSON.parse(options.body).contents[0].parts[0].videoMetadata;
    ranges.push([clip.startOffset,clip.endOffset]);
    const first=ranges.length===1;
    return {ok:true,status:200,json:async()=>({candidates:[{finishReason:first?'MAX_TOKENS':'STOP',content:{parts:[{text:first?'{':JSON.stringify({video_accessible:true,rallies:[],contacts:[],limitations:[]})}]}}],usageMetadata:{totalTokenCount:10}})};
  });
  assert.deepEqual(ranges,[['0s','60s'],['0s','30s'],['30s','60s']]);
  assert.equal(value.usage.totalTokenCount,30);
  assert.equal(value.end,60);
});
