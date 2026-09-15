// Isolated Auth/PostgREST smoke. Never targets a remote URL or the primary database.
const { execFileSync } = require('node:child_process');
const { randomUUID, createHmac } = require('node:crypto');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const dbName = 'family_access_qa_verified_20260914';
const dbContainer = 'supabase_db_hgmdpetpwclucvquoklv';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 8e6 });
const inspect = name => JSON.parse(docker('inspect', name))[0];
const sql = text => execFileSync('docker', ['exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', dbName, '-q', '-v', 'ON_ERROR_STOP=1'], { input: text, encoding: 'utf8' });
async function main() {
  const suffix = randomUUID().slice(0, 8);
  const names = [];
  let proxy;
  try {
    // Copy only Auth's internal migration ledger, never users or credentials.
    const ledger = docker('exec', dbContainer, 'sh', '-c', 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U supabase_admin -d postgres --data-only --table=auth.schema_migrations');
    execFileSync('docker',['exec','-i',dbContainer,'sh','-c',`PGPASSWORD="$POSTGRES_PASSWORD" psql -U supabase_admin -d ${dbName} -q -v ON_ERROR_STOP=1`],{input:`truncate auth.schema_migrations;\n${ledger}`,encoding:'utf8'});
    for (const [source, port, databaseKey] of [
      ['supabase_auth_hgmdpetpwclucvquoklv',55432,'GOTRUE_DB_DATABASE_URL'],
      ['supabase_rest_hgmdpetpwclucvquoklv',55431,'PGRST_DB_URI'],
    ]) {
      const original = inspect(source);
      const env = Object.fromEntries(original.Config.Env.map(v => [v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));
      const uri = new URL(env[databaseKey]); uri.pathname = `/${dbName}`; env[databaseKey] = uri.toString();
      if (databaseKey === 'PGRST_DB_URI') env.PGRST_DB_SCHEMAS = 'public'; // GraphQL is deliberately excluded from the isolated schema clone.
      if (databaseKey.startsWith('GOTRUE')) {
        env.GOTRUE_SITE_URL = 'http://localhost:8081'; env.API_EXTERNAL_URL = 'http://127.0.0.1:55432';
        env.GOTRUE_MAILER_AUTOCONFIRM = 'true'; env.GOTRUE_EXTERNAL_PHONE_ENABLED = 'false';
        env.GOTRUE_EXTERNAL_APPLE_ENABLED = 'false';
      }
      const name = `family-qa-${port}-${suffix}`; names.push(name);
      docker('run','-d','--name',name,'--network',Object.keys(original.NetworkSettings.Networks)[0],
        '-p',`127.0.0.1:${port}:${port===55432?9999:3000}`,
        ...Object.entries(env).flatMap(([k,v])=>['-e',`${k}=${v}`]),original.Config.Image);
    }
    for (let i=0;i<30;i++) {
      try { if ((await fetch('http://127.0.0.1:55432/health')).ok && (await fetch('http://127.0.0.1:55431/')).ok) break; } catch {}
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    const accounts = [];
    for (const role of ['parent','athlete','coord']) {
      const email = `qa-${role}-${suffix}@example.invalid`;
      const password = `Qa!${randomUUID()}`;
      const response = await fetch('http://127.0.0.1:55432/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      const data = await response.json();
      assert.equal(response.status,200,`Local signup failed (${data.code || data.error_code || response.status})`);
      assert.ok(data.access_token,'Local signup did not return session');
      const login = await fetch('http://127.0.0.1:55432/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      const session = await login.json(); assert.equal(login.status,200,'Existing account login');
      accounts.push({id:data.user.id, token:session.access_token,email,password});
    }
    const [parent,athlete,coord]=accounts; const org=randomUUID(); const student=randomUUID(); const classId=randomUUID();
    sql(`update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}')||jsonb_build_object('email_verified_hybrid_at',now()) where id in('${parent.id}','${athlete.id}','${coord.id}');
      insert into organizations(id,name,created_by) values('${org}','Fictitious API QA','${coord.id}');
      insert into organization_members(organization_id,user_id,role_level) values('${org}','${coord.id}',50) on conflict do nothing;
      insert into classes(id,name,ageband,daysperweek,goal,equipment,level,organization_id) values('${classId}','QA','test',1,'','',1,'${org}');
      insert into students(id,name,classid,age,phone,createdat,organization_id) values('${student}','Fictitious API athlete','${classId}',18,'',now(),'${org}');`);
    const rpc=async(account,name,payload)=>{
      const res=await fetch(`http://127.0.0.1:55431/rpc/${name}`,{method:'POST',headers:{Authorization:`Bearer ${account.token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const value=await res.json(); assert.ok(res.ok,`RPC ${name} failed (${value.code || res.status})`); return value;
    };
    const request=await rpc(parent,'request_family_access',{p_org_id:org,p_kind:'guardian',p_student_name:'Fictitious API athlete',p_relationship_label:'Pai'});
    const repeats=await Promise.all(Array.from({length:4},()=>rpc(parent,'request_family_access',{p_org_id:org,p_kind:'guardian',p_student_name:'Fictitious API athlete',p_relationship_label:'Pai'})));
    assert.ok(repeats.every(id=>id===request),'Concurrent requests deduplicated');
    const candidates=await rpc(coord,'list_family_request_candidates',{p_request_id:request}); assert.equal(candidates.length,1);
    const reviewKey=randomUUID();
    const reviews=await Promise.all(Array.from({length:4},()=>rpc(coord,'review_family_access_request',{p_request_id:request,p_decision:'approved',p_student_id:student,p_idempotency_key:reviewKey})));
    assert.equal(reviews.filter(Boolean).length,1,'Only one concurrent approval mutates');
    const overview=await rpc(parent,'get_my_family_overview_v1',{}); assert.equal(overview.length,1); assert.equal(overview[0].student_id,student);
    const denied=await fetch(`http://127.0.0.1:55431/rpc/list_family_request_candidates`,{method:'POST',headers:{Authorization:`Bearer ${athlete.token}`,'Content-Type':'application/json'},body:JSON.stringify({p_request_id:request})});
    assert.ok(!denied.ok,'Unrelated athlete must not list candidates');
    // Run the actual Edge entrypoints against the isolated Auth/PostgREST services.
    // This gateway is temporary and never forwards to production.
    proxy = http.createServer((req, res) => {
      const cors = {'Access-Control-Allow-Origin':'http://localhost:8082','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS'};
      if(req.method === 'OPTIONS') { res.writeHead(204,cors); res.end(); return; }
      const isAuth = req.url.startsWith('/auth/v1/');
      const edgeName = req.url.startsWith('/functions/v1/') ? req.url.split('/')[3] : null;
      const edgePort = {'create-student-relationship-invite':55433,'claim-student-relationship-invite':55434,'validate-student-relationship-invite':55435}[edgeName];
      const prefix = edgePort ? `/functions/v1/${edgeName}` : isAuth ? '/auth/v1' : '/rest/v1';
      if (!edgePort && !req.url.startsWith(prefix + '/')) { res.writeHead(404,cors); res.end(); return; }
      const upstream = http.request({ hostname: '127.0.0.1', port: edgePort || (isAuth ? 55432 : 55431),
        method: req.method, path: req.url.slice(prefix.length) || '/', headers: { ...req.headers, host: 'localhost' } }, reply => {
        res.writeHead(reply.statusCode, {...reply.headers,...cors}); reply.pipe(res);
      });
      upstream.on('error', () => { res.writeHead(502); res.end(); });
      req.pipe(upstream);
    });
    await new Promise(resolve => proxy.listen(55430, '127.0.0.1', resolve));
    const restEnv = Object.fromEntries(inspect('supabase_rest_hgmdpetpwclucvquoklv').Config.Env.map(v => [v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));
    const jwtPart = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const localSigningKey = JSON.parse(restEnv.PGRST_JWT_SECRET).keys.find(key => key.kty === 'oct');
    assert.ok(localSigningKey?.k, 'Local symmetric QA signing key unavailable');
    const jwtInput = `${jwtPart({alg:'HS256',typ:'JWT',...(localSigningKey.kid ? {kid:localSigningKey.kid} : {})})}.${jwtPart({role:'service_role',iss:'supabase',exp:Math.floor(Date.now()/1000)+1800})}`;
    const serviceKey = `${jwtInput}.${createHmac('sha256',Buffer.from(localSigningKey.k,'base64url')).update(jwtInput).digest('base64url')}`;
    for (const [functionName,port] of [['create-student-relationship-invite',55433],['claim-student-relationship-invite',55434],['validate-student-relationship-invite',55435]]) {
      const name = `family-qa-edge-${port}-${suffix}`; names.push(name);
      docker('run','-d','--name',name,'-p',`127.0.0.1:${port}:9000`,
        '-v',`${path.resolve('supabase/functions')}:/functions:ro`,
        '-e','SUPABASE_URL=http://host.docker.internal:55430','-e','SUPABASE_ANON_KEY=local-qa',
        '-e',`SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`,'-e','SUPABASE_ENV=local','-e','APP_INVITE_URL=http://localhost:8081',
        'public.ecr.aws/supabase/edge-runtime:v1.74.3','start','--main-service',`/functions/${functionName}`);
      let ready = false;
      for (let i=0;i<60;i++) {
        try { if ((await fetch(`http://127.0.0.1:${port}`,{method:'OPTIONS'})).ok) { ready=true; break; } } catch {}
        await new Promise(resolve=>setTimeout(resolve,500));
      }
      assert.ok(ready,`Local Edge ${functionName} did not start`);
    }
    const edge = async (port, account, payload) => {
      const response = await fetch(`http://127.0.0.1:${port}`,{method:'POST',headers:{Authorization:`Bearer ${account.token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      return {status:response.status,data:await response.json()};
    };
    const invitePayload = {issuer:'guardian',organizationId:org,studentId:student,invitedEmail:athlete.email,relationshipKind:'athlete',invitedVia:'link'};
    let invite = await edge(55433,parent,invitePayload);
    assert.equal(invite.status,200,`Create Edge: ${invite.data.code}`);
    assert.ok(invite.data.inviteUrl.startsWith('http://localhost:8081/family-invite/'));
    const mismatch = await edge(55434,coord,{token:invite.data.token});
    if (mismatch.status === 500) {
      const diagnostic = await fetch('http://127.0.0.1:55431/rpc/claim_student_relationship_invite_v1', {method:'POST',headers:{Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify({p_token_hash:'0'.repeat(64),p_user_id:coord.id,p_user_email:coord.email})});
      const detail = await diagnostic.json();
      console.error('Local claim diagnostic:', diagnostic.status, detail.code, detail.message);
    }
    assert.equal(mismatch.status,403); assert.equal(mismatch.data.code,'INVITE_EMAIL_MISMATCH');
    sql(`update student_relationship_invites set created_at=now()-interval '1 day',expires_at=now()-interval '1 minute' where id='${invite.data.inviteId}';`);
    const expired = await edge(55434,athlete,{token:invite.data.token});
    assert.equal(expired.status,400); assert.equal(expired.data.code,'INVITE_EXPIRED');
    invite = await edge(55433,parent,invitePayload); assert.equal(invite.status,200);
    sql(`update student_relationship_invites set revoked_at=now(),revoked_by='${coord.id}' where id='${invite.data.inviteId}';`);
    const revoked = await edge(55434,athlete,{token:invite.data.token});
    assert.equal(revoked.status,400); assert.equal(revoked.data.code,'INVITE_REVOKED');
    const forbidden = await edge(55433,athlete,invitePayload);
    assert.equal(forbidden.status,403);
    invite = await edge(55433,parent,invitePayload); assert.equal(invite.status,200);
    if (process.argv.includes('--browser')) {
      console.log(JSON.stringify({localOnly:true,email:athlete.email,password:athlete.password,url:`http://localhost:8082/family-invite/${invite.data.token}`}));
      console.log('Local browser QA ready; Ctrl+C closes temporary services.');
      await new Promise(resolve => { process.once('SIGINT',resolve); process.once('SIGTERM',resolve); });
      return;
    }
    const accepted = await edge(55434,athlete,{token:invite.data.token});
    assert.equal(accepted.status,200,`Claim Edge: ${accepted.data.code}`);
    assert.equal(accepted.data.receipt.studentId,student);
    const replay = await edge(55434,athlete,{token:invite.data.token});
    assert.equal(replay.status,200); assert.equal(replay.data.receipt.status,'already_claimed');
    console.log('PASS: actual local Edge runtime create, wrong-recipient/unauthorized denial, expiry, revocation, claim and replay; no remote writes.');
    console.log('PASS: real local signup/login, PostgREST concurrent request/review deduplication, family overview and unauthorized candidate denial. Fictitious fixtures retained only in isolated QA database.');
  } finally {
    if (proxy) await new Promise(resolve => proxy.close(resolve));
    for (const name of names) { try { docker('stop',name); } catch {} }
  }
}
main().catch(error=>{ console.error(error.message.startsWith('Command failed')?'Local QA infrastructure command failed (details suppressed to protect local credentials).':error.message); process.exitCode=1; });
