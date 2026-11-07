import { getScoutingResultOptions } from '../../../core/scouting';
import type { ScoutingActionFundamental } from '../../../core/models';
import type { LiveCaptureStamp } from '../../../core/scouting-live';
import type { LiveTimelineClip, LiveTimelineRecording } from '../live/live-scouting-contract';
import { changeLiveVideoDocument, editLiveVideoDraft, liveVideoDraftKey, liveVideoSourceContacts, mergeLiveVideoRally, newLiveVideoDraft, parseLiveVideoDraft, reconcileLiveVideoDraft, resizeLiveVideoRally, serializeLiveVideoDraft, splitLiveVideoRally, undoLiveVideoDraft, type LiveVideoDraftOwner } from '../live/live-video-draft';

const owner:LiveVideoDraftOwner={userId:'user',org:'org',classId:'class',analysisSessionId:'analysis',hostSessionId:'host',recordingId:'recording'};
const media={durationSeconds:40,width:1920,height:1080,availableUntilMs:40000};
const stamp=(timeMs:number):LiveCaptureStamp=>({scope:{userId:owner.userId,org:owner.org,classId:owner.classId},hostSessionId:owner.hostSessionId,recordingId:owner.recordingId,segmentId:'segment-0',epoch:1,peerGeneration:1,timeMs,uncertaintyMs:250,mode:'estimated'});
const clip=(id='capture-one',startMs=10000,endMs=20000):LiveTimelineClip=>({...owner,id,requestId:id,rallyId:`official-${id}`,kind:'point',contacts:[{id:`mark-${id}`,actionId:`action-${id}`,stamp:stamp(startMs+2000),contact:{fundamental:'recepcao',phase:'side_out',resultKey:'a_alto',athleteName:'Atleta',studentId:'student',zone:6}}],pointStamp:stamp(endMs-1500),startMs,endMs,uncertaintyMs:250,setNumber:1,scoreUs:1,scoreThem:0,won:true,active:true,createdAt:'2026-11-04T12:00:00Z'});
const recording=(clips:LiveTimelineClip[]=[clip()]):LiveTimelineRecording=>({analysisSessionId:owner.analysisSessionId,hostSessionId:owner.hostSessionId,recordingId:owner.recordingId,clips,updatedAt:'2026-11-04T12:00:00Z'});
const make=()=>newLiveVideoDraft(owner,recording(),media);

test('projects exact independent gaps and overlaps, equal starts and point ownership without changing the source',()=>{
    const source=recording([clip('z-first',0,16000),clip('a-second',0,19000),clip('c',15000,22000),clip('d',30000,38000)]),before=JSON.stringify(source);
    const state=newLiveVideoDraft(owner,source,media);
    expect(state.present.document.rallies.map(row=>row.id)).toEqual(['z-first','a-second','c','d']);
    expect(state.present.ranges).toEqual({'z-first':[0,16],'a-second':[0,19],c:[15,22],d:[30,38]});
    expect(state.present.document.rallies[1].pointTime).toBe(17.5);
    expect(state.present.document.rallies[0].winner).toBe('us');
    expect(state.present.document.contacts).toEqual([]);expect(JSON.stringify(source)).toBe(before);
    expect(parseLiveVideoDraft(serializeLiveVideoDraft(state),owner)).toEqual(state);
});

test('unknown and mixed clocks stay pending with null source-contact time and no invented rally',()=>{
    const unknown={...clip('unknown'),startMs:null,endMs:null};
    const mixed=clip('mixed');mixed.contacts[0].stamp={...mixed.contacts[0].stamp!,peerGeneration:2};
    const source=recording([unknown,mixed]),state=newLiveVideoDraft(owner,source,media),view=liveVideoSourceContacts(state,source);
    expect(state.present.document.rallies).toEqual([]);expect(view.pendingCount).toBe(2);
    expect(view.sourceContacts.map(row=>row.time)).toEqual([null,null]);
    expect(parseLiveVideoDraft(serializeLiveVideoDraft(state),owner).present.document.rallies).toEqual([]);
});

test('all nine official fundamentals/results/phases remain generic read-only presentation data',()=>{
    const fundamentals:ScoutingActionFundamental[]=['saque','recepcao','levantamento','ataque','bloqueio','defesa','cobertura','transicao','comunicacao'];
    const source=recording([clip()]);source.clips[0].contacts=fundamentals.map((fundamental,index)=>({id:`mark-${index}`,actionId:`action-${index}`,stamp:stamp(12000+index*100),contact:{fundamental,phase:'pressao',resultKey:getScoutingResultOptions(fundamental)[0].key,athleteName:`Atleta ${index}`,zone:6}}));
    const state=newLiveVideoDraft(owner,source,media),view=liveVideoSourceContacts(state,source);
    expect(view.sourceContacts).toHaveLength(9);expect(state.present.document.contacts).toEqual([]);
    expect(view.sourceContacts.map(row=>row.skill)).toEqual(['Saque','Recepção','Levantamento','Ataque','Bloqueio','Defesa','Cobertura','Transição','Comunicação']);
    expect(view.sourceContacts[8]).toMatchObject({id:'action-8',rallyId:'capture-one',detail:'Pressão · Zona 6',athlete:'Atleta 8',result:'Falhou'});
});

test('resize, split, merge and undo/redo preserve independent ranges together with the document',()=>{
    const initial=make(),resized=resizeLiveVideoRally(initial,'capture-one',9,21);
    expect(resized.present.ranges['capture-one']).toEqual([9,21]);
    expect(undoLiveVideoDraft(resized).present).toEqual(initial.present);
    expect(undoLiveVideoDraft(undoLiveVideoDraft(resized),true).present).toEqual(resized.present);
    const split=splitLiveVideoRally(resized,15,'manual-part');
    expect(split.present.ranges).toEqual({'capture-one':[9,15],'manual-part':[15,21]});
    expect(split.present.document.rallies[1].pointTime).toBe(18.5);
    expect(split.present.links['capture-one']).toEqual(['capture-one','manual-part']);
    const merged=mergeLiveVideoRally(split,'manual-part');
    expect(merged.present.ranges).toEqual({'capture-one':[9,21]});
    expect(undoLiveVideoDraft(merged).present).toEqual(split.present);
});

test('source contacts follow a manual split and merge without rewriting official contact data',()=>{
    const source=recording(),state=make();source.clips[0].contacts[0].stamp=stamp(17000);
    const split=splitLiveVideoRally(state,15,'manual-part');
    expect(liveVideoSourceContacts(split,source).sourceContacts[0].rallyId).toBe('manual-part');
    expect(liveVideoSourceContacts(mergeLiveVideoRally(split,'manual-part'),source).sourceContacts[0].rallyId).toBe('capture-one');
    expect(source.clips[0].contacts[0].stamp?.timeMs).toBe(17000);
});

test('splitting a selected overlapping rally changes that range while every other overlap remains intact',()=>{
    const state=newLiveVideoDraft(owner,recording([clip('a',0,16000),clip('b',0,19000)]),media);
    const before=JSON.stringify(state),split=splitLiveVideoRally(state,10,'manual-part','a');
    expect(split.present.ranges).toEqual({a:[0,10],b:[0,19],'manual-part':[10,16]});
    expect(split.present.links.a).toEqual(['a','manual-part']);expect(split.present.links.b).toEqual(['b']);
    expect(split.present.document.rallies.find(row=>row.id==='b')).toEqual(state.present.document.rallies.find(row=>row.id==='b'));
    expect(undoLiveVideoDraft(split).present).toEqual(state.present);expect(JSON.stringify(state)).toBe(before);
});

test('an invalid selected rally never falls back to another overlapping range',()=>{
    const state=newLiveVideoDraft(owner,recording([clip('a',0,16000),clip('b',0,19000)]),media),before=JSON.stringify(state);
    for(const selected of ['missing',''])expect(()=>splitLiveVideoRally(state,10,'manual-part',selected)).toThrow(/instante dentro/);
    expect(()=>splitLiveVideoRally(state,17,'manual-part','a')).toThrow(/instante dentro/);
    expect(JSON.stringify(state)).toBe(before);
});

test('human contact edits and deletion of a projected rally do not reappear on ticks or reload',()=>{
    let state=make();state=changeLiveVideoDocument(state,{...state.present.document,contacts:[{id:'manual-contact',time:12.5,skill:'Saque',team:'us',athlete:'Manual',studentId:null,outcome:'Em jogo'}]},'Contato');
    state=changeLiveVideoDocument(state,{...state.present.document,rallies:[]},'Excluir rally');
    const updated=reconcileLiveVideoDraft(state,recording(),{...media,durationSeconds:60,availableUntilMs:60000});
    expect(updated.present.document.rallies).toEqual([]);expect(updated.present.document.contacts[0].athlete).toBe('Manual');
    const restored=parseLiveVideoDraft(serializeLiveVideoDraft(updated),owner);
    expect(reconcileLiveVideoDraft(restored,recording(),media).present.document.rallies).toEqual([]);
    expect(undoLiveVideoDraft(restored).present.document.rallies[0].id).toBe('capture-one');
});

test('new IDs project once into every history snapshot and DVR metadata growth never undoes imports',()=>{
    const edited=resizeLiveVideoRally(make(),'capture-one',9,21),source=recording([clip(),clip('new',28000,36000)]);
    const updated=reconcileLiveVideoDraft(edited,source,{...media,durationSeconds:80,width:1080,height:1920});
    expect(updated.knownIds).toEqual(['capture-one','new']);expect(updated.past).toHaveLength(1);
    const undo=undoLiveVideoDraft(updated);
    expect(undo.present.ranges['capture-one']).toEqual([10,20]);expect(undo.present.ranges.new).toEqual([28,36]);
    expect(undo.present.document.media).toMatchObject({duration:80,width:1080,height:1920});
    expect(reconcileLiveVideoDraft(updated,source,media).present.document.rallies).toHaveLength(2);
});

test('official undo retires its source row without undo resurrecting it; redo with a new ID imports once',()=>{
    const edited=resizeLiveVideoRally(make(),'capture-one',9,21),retired=reconcileLiveVideoDraft(edited,recording([]),media);
    expect(retired.present.document.rallies).toEqual([]);expect(undoLiveVideoDraft(retired).present.document.rallies).toEqual([]);
    const redone=reconcileLiveVideoDraft(retired,recording([clip('new-request')]),media);
    expect(redone.present.document.rallies.map(row=>row.id)).toEqual(['new-request']);
});

test('official undo preserves a human-edited merge still referenced by another active source',()=>{
    const earlier={...clip('b-earlier',0,12000),pointStamp:stamp(3000)},latest={...clip('a-latest',0,12000),pointStamp:stamp(5000)};
    const initial=newLiveVideoDraft(owner,recording([latest,earlier]),media);
    const merged=mergeLiveVideoRally(initial,'b-earlier'),edited=resizeLiveVideoRally(merged,'a-latest',0,14);
    const surviving=recording([earlier]),retired=reconcileLiveVideoDraft(edited,surviving,media);
    expect(retired.present.document.rallies.map(row=>row.id)).toEqual(['a-latest']);
    expect(retired.present.ranges).toEqual({'a-latest':[0,14]});expect(retired.present.links).toEqual({'b-earlier':['a-latest']});
    expect(liveVideoSourceContacts(retired,surviving).sourceContacts[0].rallyId).toBe('a-latest');
    const undoResize=undoLiveVideoDraft(retired),undoMerge=undoLiveVideoDraft(undoResize);
    expect(undoResize.present.ranges).toEqual({'a-latest':[0,12]});
    expect(undoMerge.present.document.rallies.map(row=>row.id)).toEqual(['b-earlier']);
    expect(undoLiveVideoDraft(undoLiveVideoDraft(undoMerge,true),true).present).toEqual(retired.present);
    expect(parseLiveVideoDraft(serializeLiveVideoDraft(retired),owner)).toEqual(retired);
});

test.each(['userId','org','classId','analysisSessionId','hostSessionId','recordingId'] as const)('import rejects a changed %s and local keys never share the legacy prefix',field=>{
    const state=make(),foreign={...owner,[field]:'foreign'};
    expect(()=>parseLiveVideoDraft(serializeLiveVideoDraft(state),foreign)).toThrow();
    expect(liveVideoDraftKey(foreign)).not.toBe(liveVideoDraftKey(owner));expect(liveVideoDraftKey(owner)).not.toContain('scouting-video:v1');
});

test('the local envelope whitelists fields and rejects malicious ranges/history instead of overwriting data',()=>{
    const original=make(),raw=JSON.parse(serializeLiveVideoDraft(original));
    raw.token='secret';raw.url='blob:private';raw.present.document.media.url='https://private';
    expect(serializeLiveVideoDraft(parseLiveVideoDraft(JSON.stringify(raw),owner))).not.toMatch(/secret|blob:|https:/);
    raw.present.ranges['capture-one']=[30,10];expect(()=>parseLiveVideoDraft(JSON.stringify(raw),owner)).toThrow();
    expect(make()).toEqual(original);
});

test('an active recording with no point has a real available timeline and no fake rally',()=>{
    const state=newLiveVideoDraft(owner,recording([]),{durationSeconds:null,availableUntilMs:12500});
    expect(state.present.document.rallies).toEqual([]);expect(state.present.document.media.duration).toBe(12.5);
    expect(state.present.document.media.fingerprint).toBe('live:recording');
});

test('invalid/manual contact timestamps, source changes and out-of-range point trims are rejected',()=>{
    const state=make();
    expect(()=>changeLiveVideoDocument(state,{...state.present.document,contacts:[{id:'manual',time:NaN,skill:'Saque',team:'us',athlete:'',studentId:null,outcome:''}]},'Bad')).toThrow();
    expect(()=>reconcileLiveVideoDraft(state,{...recording(),recordingId:'foreign'},media)).toThrow();
    expect(()=>resizeLiveVideoRally(state,'capture-one',10,15)).toThrow();
    expect(()=>editLiveVideoDraft(state,{...state.present,ranges:{'capture-one':[-1,20]}},'Bad')).toThrow();
});
