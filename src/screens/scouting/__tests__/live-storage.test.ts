import {deleteLiveHostSession,liveHostSessionKey,loadLiveHostSessions,parseLiveHostSession,restoreLiveHostSession,saveLiveHostSession,type LiveHostSession} from '../live/live-storage';
const scope={userId:'user',org:'org',classId:'class'};
const session:LiveHostSession={version:1,id:'live-session',scope,recordingId:'recording-1',createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-01T12:00:00Z',setNumber:1,className:'Sub19',mimeType:'video/webm',ended:false,gaps:[],points:[{id:'point-1',recordingId:'recording-1',timeMs:5000,won:true,setNumber:1,scoreUs:1,scoreThem:0,uncertaintyMs:500,clockMode:'estimated',createdAtHostEpochMs:1762000000000}]};
test('live manifests have separate scoped identity and preserve originals during parsing',()=>{
    const before=JSON.stringify(session), parsed=parseLiveHostSession(session,scope);
    expect(parsed).toEqual({...session,delivery:{pending:[{kind:'point',point:session.points[0]}],acknowledged:[]}});expect(parsed.points).not.toBe(session.points);expect(JSON.stringify(session)).toBe(before);
    const key=liveHostSessionKey(scope,session.id);
    expect(key).toContain('scouting-live');expect(key).not.toContain('scouting-video');
    for(const different of [{...scope,userId:'other'},{...scope,org:'other'},{...scope,classId:'other'}])expect(liveHostSessionKey(different,session.id)).not.toBe(key);
});
test('durable camera delivery rejects replay across recordings and keeps acknowledgement state separate',()=>{
    const delivery={pending:[{kind:'undo-point' as const,id:session.points[0].id,recordingId:session.recordingId}],acknowledged:[{kind:'point' as const,id:session.points[0].id}]};
    expect(parseLiveHostSession({...session,points:[],delivery},scope).delivery).toEqual(delivery);
    expect(()=>parseLiveHostSession({...session,delivery:{...delivery,pending:[{...delivery.pending[0],recordingId:'foreign'}]}},scope)).toThrow('outra gravação');
    expect(()=>parseLiveHostSession({...session,delivery:{...delivery,pending:[delivery.pending[0],delivery.pending[0]]}},scope)).toThrow('duplicada');
});
test('foreign account, organization and class cannot expose a saved live manifest',()=>{
    for(const different of [{...scope,userId:'other'},{...scope,org:'other'},{...scope,classId:'other'}])expect(()=>parseLiveHostSession(session,different)).toThrow('turma');
});
test('a marker cannot silently switch recording identity or duplicate an existing point',()=>{
    expect(()=>parseLiveHostSession({...session,points:[{...session.points[0],recordingId:'foreign'}]},scope)).toThrow('outra gravação');
    expect(()=>parseLiveHostSession({...session,points:[session.points[0],session.points[0]]},scope)).toThrow('outra gravação');
    expect(()=>parseLiveHostSession({...session,gaps:[{startHostEpochMs:2000,endHostEpochMs:1000}]},scope)).toThrow('Interrupções');
});

function isolatedIdb() {
    const records=new Map<string,unknown>(), opened:string[]=[];
    const state={failPut:false};
    const database={close:jest.fn(),transaction:()=>{
        let aborted=false,completed=false,outstanding=0;
        const changes=new Map<string,unknown>();
        const tx:any={abort:()=>{if(aborted||completed)return;aborted=true;queueMicrotask(()=>tx.onabort?.());},objectStore:()=>({
            get:(key:string)=>request(()=>records.get(key)),getAll:()=>request(()=>[...records.values()]),
            put:(value:unknown,key:string)=>request(()=>{if(state.failPut)throw new Error('Disk full');changes.set(key,value);return key;}),
        })};
        function request(read:()=>unknown){
            const req:any={};outstanding++;
            queueMicrotask(()=>{
                if(aborted)return;
                try{req.result=read();req.onsuccess?.();}catch{req.onerror?.();tx.abort();}
                outstanding--;
                queueMicrotask(()=>{if(!aborted&&!completed&&!outstanding){completed=true;changes.forEach((value,key)=>records.set(key,value));tx.oncomplete?.();}});
            });return req;
        }
        return tx;
    }};
    const indexedDB={open:(name:string)=>{opened.push(name);const req:any={};queueMicrotask(()=>{req.result=database;req.onsuccess?.();});return req;}};
    return{records,opened,state,indexedDB};
}
const originalIdb=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');
let isolated:ReturnType<typeof isolatedIdb>;
beforeEach(()=>{isolated=isolatedIdb();Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:isolated.indexedDB});});
afterEach(()=>{if(originalIdb)Object.defineProperty(globalThis,'indexedDB',originalIdb);else Reflect.deleteProperty(globalThis,'indexedDB');});
const finished=():LiveHostSession=>({...session,ended:true,durationMs:15000,recordingState:'stopped',delivery:{pending:[],acknowledged:[{kind:'point',id:session.points[0].id}]}});

test('finished duration and terminal state remain additive and reject malformed metadata',()=>{
    expect(parseLiveHostSession(finished(),scope)).toMatchObject({durationMs:15000,recordingState:'stopped'});
    expect(parseLiveHostSession(session,scope)).not.toHaveProperty('durationMs');
    expect(()=>parseLiveHostSession({...finished(),durationMs:-1},scope)).toThrow();
    expect(()=>parseLiveHostSession({...finished(),recordingState:'recording'},scope)).toThrow();
});

test('notebook deletion is recoverable and touches only the exact scoped ended manifest',async()=>{
    const value=finished(),before=JSON.stringify(value);
    await saveLiveHostSession(value,scope);
    const other={...value,id:'other-session',recordingId:'other-recording',points:[],delivery:{pending:[],acknowledged:[]}};
    const foreignScope={...scope,org:'foreign'};
    await saveLiveHostSession(other,scope);await saveLiveHostSession({...value,scope:foreignScope},foreignScope);
    await deleteLiveHostSession(scope,value.id,value.recordingId);
    expect((await loadLiveHostSessions(scope)).map(item=>item.id)).toEqual(['other-session']);
    expect((await loadLiveHostSessions(foreignScope)).map(item=>item.id)).toEqual([value.id]);
    expect(isolated.records.get(liveHostSessionKey(scope,value.id))).toMatchObject({deletedAt:expect.any(String),points:value.points});
    await restoreLiveHostSession(scope,value.id,value.recordingId);
    expect((await loadLiveHostSessions(scope)).find(item=>item.id===value.id)).toMatchObject({durationMs:15000,points:value.points});
    expect(JSON.stringify(value)).toBe(before);expect(new Set(isolated.opened)).toEqual(new Set(['goatleta-scouting-live-host-v1']));
});

test('deletion rejects active, pending, foreign scope and mismatched recording IDs',async()=>{
    await saveLiveHostSession(session,scope);
    await expect(deleteLiveHostSession(scope,session.id,session.recordingId)).rejects.toThrow('encerrada');
    await saveLiveHostSession({...finished(),delivery:{pending:[{kind:'point',point:session.points[0]}],acknowledged:[]}},scope);
    await expect(deleteLiveHostSession(scope,session.id,session.recordingId)).rejects.toThrow('pendentes');
    await saveLiveHostSession(finished(),scope);
    for(const foreign of [{...scope,userId:'foreign'},{...scope,org:'foreign'},{...scope,classId:'foreign'}])await expect(deleteLiveHostSession(foreign,session.id,session.recordingId)).rejects.toThrow();
    await expect(deleteLiveHostSession(scope,session.id,'other-recording')).rejects.toThrow();
    expect(await loadLiveHostSessions(scope)).toHaveLength(1);
});

test('an aborted deletion preserves the visible manifest and stale writes cannot resurrect a deleted copy',async()=>{
    await saveLiveHostSession(finished(),scope);isolated.state.failPut=true;
    await expect(deleteLiveHostSession(scope,session.id,session.recordingId)).rejects.toThrow();
    expect(await loadLiveHostSessions(scope)).toHaveLength(1);
    isolated.state.failPut=false;await deleteLiveHostSession(scope,session.id,session.recordingId);
    await expect(saveLiveHostSession(finished(),scope)).rejects.toThrow('excluída');
    expect(await loadLiveHostSessions(scope)).toEqual([]);
});
