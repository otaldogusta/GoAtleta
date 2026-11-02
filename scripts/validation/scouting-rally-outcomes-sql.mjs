import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

// In-memory PostgreSQL and synthetic identities only. No Supabase connection,
// application credentials, remote migration or service-role capability.
const db=new PGlite(),hostedCompat=process.argv.includes('--hosted-compat');
const org='20000000-0000-0000-0000-000000000001',other='20000000-0000-0000-0000-000000000002';
const admin='10000000-0000-0000-0000-000000000001',trainer='10000000-0000-0000-0000-000000000002',outsider='10000000-0000-0000-0000-000000000003';
const migration=name=>readFile(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8');
const fn=(source,name)=>{const start=source.indexOf(`create or replace function public.${name}(`);assert.ok(start>=0);return source.slice(start,source.indexOf('$$;',start)+3);};
const asUser=async user=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');};
const revisions=new Map();let sequence=0;
const command=async(name,payload={},options={})=>{
    const session=options.session??'game';
    const result=(await db.query('select public.apply_scouting_command($1,$2,$3,$4,$5,$6::jsonb) result',[
        session,options.org??org,options.revision??revisions.get(session)??0,options.request??`outcome-request-${++sequence}`,name,JSON.stringify(payload),
    ])).rows[0].result;
    revisions.set(session,result.session.revision);return result;
};
const detail=async(session='game')=>(await db.query('select public.get_scouting_detail($1,$2) result',[session,org])).rows[0].result;
const contact=(resultKey,extra={})=>({fundamental:'ataque',phase:'transicao',resultKey,studentId:'student',...extra});
const start=(serve='them',session='game')=>command('start_set',{setNumber:1,scoreUs:0,scoreThem:0,serve,rotation:1},{session});
const unchangedAfter=async(run,pattern,session='game')=>{const before=await detail(session);await assert.rejects(run,pattern);assert.deepEqual(await detail(session),before);};
const privileged=async run=>{await db.exec('reset role');try{return await run();}finally{await asUser(trainer);}};

try{
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      create table auth.users(id uuid primary key); insert into auth.users values('${admin}'),('${trainer}'),('${outsider}');
      create table organizations(id uuid primary key); insert into organizations values('${org}'),('${other}');
      create table organization_members(organization_id uuid,user_id uuid,role_level int);
      insert into organization_members values('${org}','${admin}',50),('${org}','${trainer}',10);
      create table classes(id text primary key,organization_id uuid,owner_id uuid);
      insert into classes values('class','${org}','${admin}'),('foreign-class','${other}','${outsider}');
      create table class_staff(class_id text,organization_id uuid,user_id uuid); insert into class_staff values('class','${org}','${trainer}');
      create table class_staff_substitutions(organization_id uuid,class_id text,absent_user_id uuid,replacement_user_id uuid,status text,starts_on date,ends_on date);
      create table students(id text primary key,name text,organization_id uuid,classid text);
      insert into students values('student','Ana','${org}','class'),('foreign','Other','${other}','foreign-class');
      create table student_class_enrollments(student_id text,organization_id uuid,class_id text,status text);
      grant usage on schema public,auth to authenticated,anon; grant select on all tables in schema public to authenticated;
    `);
    await db.exec(fn(await migration('2026021002_fix_org_member_policies.sql'),'is_org_admin'));
    const permissions=await migration('20260921114136_class_staff_history_and_transitions.sql');
    await db.exec(fn(permissions,'can_manage_class'));await db.exec(fn(permissions,'is_class_staff'));
    const logs=await migration('2026010601_create_scouting_logs.sql');
    await db.exec(logs.match(/create table if not exists public\.scouting_logs \([\s\S]*?\n\);/)[0]);
    await db.exec('alter table scouting_logs add column organization_id uuid, add column client_id text unique, add column mode text;');
    if(hostedCompat)await db.exec(await readFile(new URL('./fixtures/scouting-hosted-compat.sql',import.meta.url),'utf8'));
    await db.exec(await migration('202606030700_create_scouting_sessions_actions.sql'));
    await db.exec(await migration('20261007112922_scouting_rallies.sql'));
    await db.exec(`
      insert into scouting_sessions(id,organization_id,classid,type,date) values
       ('history','${org}','class','jogo','2026-10-06'),('game','${org}','class','jogo','2026-11-02'),
       ('new-results','${org}','class','jogo','2026-11-02'),('training','${org}','class','treino','2026-11-02'),
       ('ace-consistency','${org}','class','jogo','2026-11-02');
      insert into scouting_rallies(id,session_id,organization_id,classid,set_number,number,won,serve,rotation,score_us,score_them,contacts)
       select 'historical-'||n,'history','${org}','class',1,n,true,'us',1,n,0,'[]'::jsonb from generate_series(1,99) n;
      insert into scouting_actions(id,session_id,organization_id,classid,fundamental,phase,result_key,result_label,result_level,rally_event_id,contact_index,rubric_version)
       values('historical-block','history','${org}','class','ataque','side_out','bloqueado','Bloqueado',1,'historical-1',0,2);
    `);
    const historical=(await db.query("select to_jsonb(r) row from scouting_rallies r where session_id='history' order by number")).rows.map(r=>r.row);
    const oldAction=(await db.query("select to_jsonb(a) row from scouting_actions a where id='historical-block'")).rows[0].row;
    const reviewedLinks=historical.map((row,n)=>({sessionId:'history',rallyId:row.id,videoRallyId:`video-${n+1}`,time:n+1,missing:false}));
    const reviewedRaw=JSON.stringify(reviewedLinks);
    await db.exec(await migration('20261102163000_scouting_rally_outcomes.sql'));
    assert.deepEqual((await db.query("select to_jsonb(r)-'outcome' row from scouting_rallies r where session_id='history' order by number")).rows.map(r=>r.row),historical);
    assert.equal((await db.query("select count(*)::integer n from scouting_rallies where session_id='history' and outcome is null")).rows[0].n,99);
    assert.deepEqual((await db.query("select to_jsonb(a) row from scouting_actions a where id='historical-block'")).rows[0].row,oldAction);
    assert.equal(JSON.stringify(reviewedLinks),reviewedRaw);

    await db.exec('set role anon');await assert.rejects(command('complete'),/permission denied/);
    await asUser(outsider);await assert.rejects(command('complete'),/access denied/);
    await asUser(trainer);await assert.rejects(command('complete',{}, {org:other}),/access denied/);
    await assert.rejects(db.query('select scouting_normalize_rally_outcome($1::jsonb)',['{"kind":"ace","team":"us"}']),/permission denied/);
    let saved=await start();assert.equal(saved.captureVersion,3);assert.equal(saved.session.match_state.recoveredOutcome,null);
    const ace={kind:'ace',team:'them'},payload={contacts:[],winner:'them',outcome:ace};
    const beforeAce=revisions.get('game');saved=await command('point',payload,{request:'ace-original-0001'});
    assert.deepEqual(saved.rallies[0].outcome,ace);assert.equal(saved.actions.length,0);assert.equal(saved.session.match_state.scoreThem,1);
    assert.equal((await command('point',payload,{request:'ace-original-0001',revision:beforeAce})).rallies.length,1);
    await unchangedAfter(()=>command('point',{...payload,outcome:null},{request:'ace-original-0001'}),/reused/);
    saved=await command('reopen_point',{rallyId:saved.rallies[0].id});
    assert.deepEqual(saved.session.match_state.recoveredOutcome,ace);assert.deepEqual(saved.session.match_state.recoveredDraft,[]);
    await unchangedAfter(()=>command('complete'),/Resolve scouting draft/);
    await unchangedAfter(()=>command('start_set',{setNumber:2,scoreUs:0,scoreThem:0,serve:'us',rotation:1}),/unavailable/);
    await unchangedAfter(()=>command('point',{contacts:[],winner:'us'}),/outcome contradicts/);
    // Old clients omit outcome on redo; preserving it must not require their update.
    saved=await command('point',{contacts:[],winner:'them'});
    assert.deepEqual(saved.rallies[0].outcome,ace);assert.equal(saved.session.match_state.recoveredOutcome,null);
    saved=await command('reopen_point',{rallyId:saved.rallies[0].id});
    assert.equal((await command('point',payload,{request:'ace-original-0001'})).rallies.length,0);
    saved=await command('point',{contacts:[],winner:'us',outcome:null});
    assert.equal(saved.rallies[0].outcome,null);assert.equal(saved.session.match_state.rotation,6);

    const invalid=[{},[],true,{kind:'ace',team:'other'},{kind:'ace',team:'us',reason:'rede'},
      {kind:'falta',team:'us'},{kind:'falta',team:'us',reason:'unknown'},
      {kind:'falta',team:'us',reason:'rede',studentId:'student'},{kind:'ace',team:'them',athlete:'x'}];
    for(const outcome of invalid)await unchangedAfter(()=>command('point',{contacts:[],winner:'them',outcome}),/Invalid scouting/);
    await unchangedAfter(()=>command('point',{contacts:[],winner:'us',outcome:{kind:'falta',team:'us',reason:'rede'}}),/outcome contradicts/);
    await unchangedAfter(()=>command('point',{contacts:[],winner:'us',outcome:{kind:'ace',team:'them'}}),/outcome contradicts/);
    await unchangedAfter(()=>command('point',{contacts:[],winner:'them',outcome:ace}),/ace contradicts serve/);
    await unchangedAfter(()=>command('point',{contacts:[contact('continuidade',{studentId:'foreign'})],winner:'them',outcome:{kind:'falta',team:'us',reason:'rede'}}),/outside class/);
    for(const reason of ['rede','dois_toques','invasao','quatro_toques','rodizio','outra']){
        const outcome={kind:'falta',team:'us',reason};saved=await command('point',{contacts:[],winner:'them',outcome});
        assert.deepEqual(saved.rallies.at(-1).outcome,outcome);
    }
    saved=await command('point',{contacts:[],winner:'us',outcome:{kind:'falta',team:'them',reason:'rede'}});
    assert.equal(saved.actions.length,0);assert.equal(saved.session.match_state.serve,'us');
    saved=await command('point',{contacts:[],winner:'us',outcome:{kind:'ace',team:'us'}});
    saved=await command('reopen_point',{rallyId:saved.rallies.at(-1).id});
    saved=await command('discard_draft');assert.equal(saved.session.match_state.recoveredOutcome,null);
    saved=await command('start_set',{setNumber:2,scoreUs:0,scoreThem:0,serve:'them',rotation:2});
    assert.equal(saved.session.match_state.recoveredOutcome,null);

    const consistency='ace-consistency',theirAce={kind:'ace',team:'them'},ourAce={kind:'ace',team:'us'};
    await start('them',consistency);
    const reception=key=>contact(key,{fundamental:'recepcao',phase:'side_out'});
    const setting=contact('organizou',{fundamental:'levantamento',phase:'side_out'});
    for(const contacts of [[reception('b_medio')],[reception('b_medio'),setting,contact('erro')],[reception('erro'),setting]]){
        await unchangedAfter(()=>command('point',{winner:'them',contacts,outcome:theirAce},{session:consistency}),/ace contradicts contacts/,consistency);
    }
    saved=await command('point',{winner:'them',contacts:[reception('erro')],outcome:theirAce},{session:consistency});
    assert.equal(saved.rallies.at(-1).contacts.length,1);
    assert.equal(saved.rallies.at(-1).contacts[0].fundamental,'recepcao');assert.equal(saved.rallies.at(-1).contacts[0].resultKey,'erro');
    await command('point',{winner:'us',contacts:[]},{session:consistency});
    for(const contacts of [[contact('ponto')],[contact('entrou',{fundamental:'saque'})],[reception('b_medio'),setting,contact('ponto')]]){
        await unchangedAfter(()=>command('point',{winner:'us',contacts,outcome:ourAce},{session:consistency}),/ace contradicts contacts/,consistency);
    }
    saved=await command('point',{winner:'us',contacts:[contact('ace',{fundamental:'saque',phase:'saque'})],outcome:ourAce},{session:consistency});
    assert.equal(saved.rallies.at(-1).contacts.length,1);assert.equal(saved.rallies.at(-1).contacts[0].resultKey,'ace');
    await unchangedAfter(()=>command('point',{winner:'us',contacts:[],outcome:{kind:'falta',team:'them',reason:'linha_saque'}},{session:consistency}),/service fault contradicts serve/,consistency);
    await command('point',{winner:'them',contacts:[],outcome:{kind:'falta',team:'us',reason:'linha_saque'}},{session:consistency});
    await unchangedAfter(()=>command('point',{winner:'them',contacts:[],outcome:{kind:'falta',team:'us',reason:'linha_saque'}},{session:consistency}),/service fault contradicts serve/,consistency);
    await command('point',{winner:'us',contacts:[],outcome:{kind:'falta',team:'them',reason:'linha_saque'}},{session:consistency});
    // Partial scouting can include both phases of a longer rally; no generic three-contact cap or double-touch judgement.
    const longRally=[reception('b_medio'),setting,contact('continuidade'),contact('defesa_boa',{fundamental:'defesa'})];
    saved=await command('point',{winner:'us',contacts:longRally},{session:consistency});
    assert.equal(saved.rallies.at(-1).contacts.length,4);

    await start('us','new-results');
    saved=await command('point',{winner:'us',contacts:[contact('freeball_devolvida'),contact('bloqueio_continua'),contact('ponto')]},{session:'new-results'});
    assert.equal(saved.actions.length,3);
    assert.deepEqual(saved.actions.filter(a=>a.rubric_version===3).map(a=>a.result_key).sort(),['bloqueio_continua','freeball_devolvida']);
    assert.deepEqual(saved.actions.filter(a=>a.rubric_version===3).map(a=>[a.result_key,a.result_label,a.result_level]).sort(),[
        ['bloqueio_continua','Bloqueado, continuou',2],['freeball_devolvida','Freeball devolvida',1],
    ]);
    assert.equal(saved.actions.find(a=>a.result_key==='ponto').rubric_version,2);
    const legacy=await privileged(()=>db.query("select attack_send_0,attack_send_1,attack_send_2 from scouting_logs where id='legacy_new-results'"));
    assert.deepEqual(legacy.rows[0],{attack_send_0:0,attack_send_1:1,attack_send_2:1});
    await unchangedAfter(()=>command('point',{winner:'them',contacts:[contact('bloqueio_ponto'),contact('bloqueio_continua')]}),/contradicts/);

    // A failure after the rally insert must roll back outcome, actions, state and receipt.
    await privileged(()=>db.exec('alter table scouting_actions add constraint outcome_test_atomic check(capture_zone is distinct from 6)'));
    const failedRequest='atomic-outcome-0001';
    await unchangedAfter(()=>command('point',{winner:'them',contacts:[contact('continuidade',{zone:6})],outcome:{kind:'falta',team:'us',reason:'rede'}},{request:failedRequest}),/outcome_test_atomic/);
    assert.equal((await privileged(()=>db.query('select count(*)::integer n from scouting_mutations where request_id=$1',[failedRequest]))).rows[0].n,0);
    await unchangedAfter(()=>command('point',{contacts:[],winner:'us'},{revision:0}),/revision conflict/);
    await assert.rejects(db.exec("update scouting_sessions set match_state='{}' where id='game'"),/Use scouting command/);
    await assert.rejects(db.exec('delete from scouting_rallies'),/permission denied/);
    await command('complete');await assert.rejects(command('point',{contacts:[],winner:'us'}),/completed/);
    saved=await command('action',{contacts:[{fundamental:'recepcao',phase:'side_out',resultKey:'a_alto',studentId:'student'}]},{session:'training'});
    assert.equal(saved.actions[0].rubric_version,2);
    assert.equal((await command('undo_action',{actionId:saved.actions[0].id},{session:'training'})).actions.length,0);
    assert.equal((await detail('history')).rallies.length,99);
    assert.equal(JSON.stringify(reviewedLinks),reviewedRaw);
    console.log(`scouting-rally-outcomes-sql: passed (${hostedCompat?'hosted compatibility':'clean'}; strict outcomes, ace serve, old-client reopen/redo, atomicity, scope, rubric, legacy, 99 historical IDs)`);
}finally{await db.close();}
