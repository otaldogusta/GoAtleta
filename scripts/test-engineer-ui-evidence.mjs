import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {capture, validateScenario, redactError} from './engineer_ui_evidence.mjs';

test('console diagnostics redact URLs and bearer tokens', () => {
  const text=redactError('Failed https://example.com/?token=secret Bearer hidden');
  assert.equal(text.includes('secret'),false); assert.equal(text.includes('hidden'),false);
});

test('local scenario accepts bounded focus without form submission', () => {
  assert.equal(validateScenario({url:'http://localhost:8081/login',steps:[{action:'focus',selector:'input'}]}).steps.length,1);
});
test('external host, credentials, query and wrong port are rejected', () => {
  for (const url of ['https://example.com','http://u:p@localhost:8081/login',
    'http://localhost:8081/login?token=secret','http://localhost:8082/login'])
    assert.throws(() => validateScenario({url,steps:[]}));
});
test('click, fill, Enter and shell actions are not accepted', () => {
  for (const action of ['click','fill','shell','press'])
    assert.throws(() => validateScenario({url:'http://localhost:8081/login',steps:[{action,selector:'input',key:'Enter'}]}));
});
test('unbounded interaction lists are rejected', () => {
  assert.throws(() => validateScenario({url:'http://localhost:8081/login',steps:Array(11).fill({action:'focus',selector:'input'})}));
});
test('missing browser runtime produces UNVERIFIED and preserves exclusive evidence', async () => {
  const run=await fs.mkdtemp(path.join(os.tmpdir(),'engineer-ui-test-'));
  const scenario=path.join(run,'scenario.json');
  const saved=process.env.ENGINEER_PLAYWRIGHT_MODULE;
  try {
    await fs.writeFile(path.join(run,'manifest.json'),JSON.stringify({vnext:true,filesystem_policy:'read_only',visual_policy:{ui:true}}));
    await fs.writeFile(scenario,JSON.stringify({url:'http://localhost:8081/login',steps:[]}));
    process.env.ENGINEER_PLAYWRIGHT_MODULE=path.join(run,'missing-module.mjs');
    assert.equal(await capture(run,scenario),'UNVERIFIED');
    const result=JSON.parse(await fs.readFile(path.join(run,'evidence/capture.json'),'utf8'));
    assert.equal(result.failure,'CAPTURE_FAILED');
    assert.equal(result.artifacts.length,0);
    await assert.rejects(capture(run,scenario));
  } finally {
    if(saved===undefined) delete process.env.ENGINEER_PLAYWRIGHT_MODULE; else process.env.ENGINEER_PLAYWRIGHT_MODULE=saved;
    for(const name of ['evidence/capture.json','manifest.json','scenario.json']) await fs.unlink(path.join(run,name)).catch(()=>{});
    await fs.rmdir(path.join(run,'evidence')).catch(()=>{});
    await fs.rmdir(run);
  }
});
