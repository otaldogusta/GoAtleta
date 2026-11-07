import {webcrypto} from 'node:crypto';
import {Blob as NodeBlob,Buffer} from 'node:buffer';
import {createLiveVideoReceiver} from '../live/live-video-transfer';
import {appendVideoPart,appendVideoParts,beginVideo,completeVideo,importLocalVideo,listVideoStatuses,liveVideoKey,loadVideoBlob,loadVideoStatus,parseVideoOffer,videoPartHash,LIVE_VIDEO_PART_SIZE} from '../live/live-video-storage';

const scope={userId:'user',org:'org',classId:'class'};
const session={id:'session-1',recordingId:'recording-1',scope,ended:true,recordingState:'stopped' as const};
const bytes=(length:number,fill=7)=>new Uint8Array(length).fill(fill).buffer;
const offer=(size=8195)=>({kind:'video-offer',transferId:'transfer-1',recordingId:session.recordingId,mimeType:'video/webm',bytes:size,partSize:LIVE_VIDEO_PART_SIZE,partCount:Math.ceil(size/LIVE_VIDEO_PART_SIZE)});
async function part(index:number,data:ArrayBuffer){return {kind:'video-part',transferId:'transfer-1',recordingId:session.recordingId,index,data:Buffer.from(data).toString('base64'),sha256:await videoPartHash(data)};}
async function batch(start:number,count:number){return {kind:'video-parts',transferId:'transfer-1',recordingId:session.recordingId,parts:await Promise.all(Array.from({length:count},async(_,offset)=>{const {index,data,sha256}=await part(start+offset,bytes(8192,(start+offset)%251));return {index,data,sha256};}))};}
function memoryIdb(){
    const databases=new Map<string,Map<string,Map<string,any>>>(),state={failPut:false,failPartIndex:null as number|null,afterCommit:null as (()=>void)|null,rejectPartGetAll:false,beforeRead:null as (()=>void)|null,stallPartRead:false};
    const factory={open:(name:string)=>{
        let stores=databases.get(name),fresh=!stores;if(!stores){stores=new Map();databases.set(name,stores);}
        const db={close(){},objectStoreNames:{contains:(name:string)=>stores!.has(name)},createObjectStore:(name:string)=>{stores!.set(name,new Map());return{createIndex(){}};},transaction:(names:string[])=>{
            let outstanding=0,aborted=false,completed=false;const copies=new Map(names.map(name=>[name,new Map(stores!.get(name))]));
            const tx:any={error:null,abort:()=>{if(aborted||completed)return;aborted=true;queueMicrotask(()=>tx.onabort?.());},objectStore:(name:string)=>{
                const values=copies.get(name)!;
                function request(operation:()=>unknown,stall=false){const req:any={};outstanding++;queueMicrotask(()=>{if(aborted||stall)return;try{req.result=operation();req.onsuccess?.();}catch(error){req.error=tx.error=error;req.onerror?.();tx.onerror?.();tx.abort();}outstanding--;queueMicrotask(()=>{if(!outstanding&&!aborted&&!completed){completed=true;copies.forEach((value,key)=>stores!.set(key,value));state.afterCommit?.();tx.oncomplete?.();}});});return req;}
                return {get:(key:string)=>request(()=>{state.beforeRead?.();return values.get(key);},name==='parts'&&state.stallPartRead),getAll:()=>request(()=>[...values.values()]),put:(value:any,key:string)=>request(()=>{if(state.failPut||name==='parts'&&value.index===state.failPartIndex){const error=new Error('Quota');error.name='QuotaExceededError';throw error;}values.set(key,value);return key;}),index:()=>({getAll:(owner:string)=>request(()=>{if(state.rejectPartGetAll)throw new Error('Full video getAll forbidden');return [...values.values()].filter(value=>value.owner===owner);}),count:(owner:string)=>request(()=>{state.beforeRead?.();return [...values.values()].filter(value=>value.owner===owner).length;})})};
            }};return tx;
        }};
        const req:any={result:db};queueMicrotask(()=>{if(fresh)req.onupgradeneeded?.();req.onsuccess?.();});return req;
    }};
    return {factory,state,databases};
}
const originalIdb=Object.getOwnPropertyDescriptor(globalThis,'indexedDB'),originalCrypto=Object.getOwnPropertyDescriptor(globalThis,'crypto'),originalBlob=Object.getOwnPropertyDescriptor(globalThis,'Blob');
let memory:ReturnType<typeof memoryIdb>;
beforeEach(()=>{memory=memoryIdb();Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:memory.factory});Object.defineProperty(globalThis,'crypto',{configurable:true,value:webcrypto});Object.defineProperty(globalThis,'Blob',{configurable:true,value:NodeBlob});});
afterEach(()=>{for(const[name,descriptor]of [['indexedDB',originalIdb],['crypto',originalCrypto],['Blob',originalBlob]] as const){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);}});
function receiver(){const send=jest.fn(),onProgress=jest.fn(),resolveSession=jest.fn(async()=>session as typeof session|null);return {send,onProgress,resolveSession,receiver:createLiveVideoReceiver({scope,send,onProgress,resolveSession})};}

test('offers bound MIME, size and identity and local storage never crosses user, organization or class',async()=>{
    for(const change of [{mimeType:'text/html'},{bytes:0},{bytes:Infinity},{partSize:16384},{partCount:0},{mimeType:'video/webm;<script>'}])expect(()=>parseVideoOffer({...offer(),...change})).toThrow();
    await beginVideo(scope,session.id,session.recordingId,offer());
    for(const foreign of [{...scope,userId:'other'},{...scope,org:'other'},{...scope,classId:'other'}]){expect(await loadVideoStatus(foreign,session.id,session.recordingId)).toBeNull();expect(await listVideoStatuses(foreign)).toEqual([]);expect(liveVideoKey(foreign,session.id,session.recordingId)).not.toBe(liveVideoKey(scope,session.id,session.recordingId));}
    expect(await loadVideoBlob(scope,session.id,session.recordingId)).toBeNull();
});

test('every ACK follows committed bytes and playback waits for the complete verified video',async()=>{
    const r=receiver();await r.receiver.handle(offer());expect(r.send).toHaveBeenLastCalledWith({kind:'video-accept',transferId:'transfer-1',recordingId:session.recordingId,nextPart:0,partsPerMessage:4,maxInFlight:8});
    await r.receiver.handle(await part(0,bytes(8192,7)));expect((await loadVideoStatus(scope,session.id,session.recordingId))?.receivedBytes).toBe(8192);
    expect(r.send).toHaveBeenLastCalledWith({kind:'video-ack',transferId:'transfer-1',recordingId:session.recordingId,index:0,nextPart:1});
    expect(await loadVideoBlob(scope,session.id,session.recordingId)).toBeNull();
    await r.receiver.handle(await part(1,bytes(3,9)));expect((await loadVideoStatus(scope,session.id,session.recordingId))?.state).toBe('receiving');
    await r.receiver.handle({kind:'video-complete',transferId:'transfer-1',recordingId:session.recordingId});
    const blob=await loadVideoBlob(scope,session.id,session.recordingId);expect(blob?.size).toBe(8195);expect(Array.from(new Uint8Array(await blob!.arrayBuffer())).slice(-3)).toEqual([9,9,9]);
    expect(r.send).toHaveBeenLastCalledWith({kind:'video-saved',transferId:'transfer-1',recordingId:session.recordingId,nextPart:2});
});

test('resuming accepts only matching metadata and duplicate parts must retain the same digest',async()=>{
    const first=receiver();await first.receiver.handle(offer());const frame=await part(0,bytes(8192));await first.receiver.handle(frame);await first.receiver.handle(frame);
    expect((await loadVideoStatus(scope,session.id,session.recordingId))?.nextPart).toBe(1);first.receiver.dispose();
    const second=receiver();await second.receiver.handle({...offer(),transferId:'transfer-2'});expect(second.send).toHaveBeenLastCalledWith({kind:'video-accept',transferId:'transfer-2',recordingId:session.recordingId,nextPart:1,partsPerMessage:4,maxInFlight:8});
    await expect(beginVideo(scope,session.id,session.recordingId,offer(8196))).rejects.toThrow('outra cópia');
    await expect(appendVideoPart(scope,session.id,session.recordingId,0,bytes(8192,2),'0'.repeat(64))).rejects.toThrow('divergente');
    expect((await loadVideoStatus(scope,session.id,session.recordingId))?.receivedBytes).toBe(8192);
});

test('corrupt or missing data never becomes a playable complete video',async()=>{
    const r=receiver();await r.receiver.handle(offer());const frame=await part(0,bytes(8192));await r.receiver.handle({...frame,data:Buffer.from(bytes(8192,3)).toString('base64')});
    expect((await loadVideoStatus(scope,session.id,session.recordingId))?.receivedBytes).toBe(0);expect(r.send.mock.calls.at(-1)?.[0].kind).toBe('video-transfer-error');
    await expect(completeVideo(scope,session.id,session.recordingId)).rejects.toThrow('completo');
    await beginVideo(scope,session.id,session.recordingId,offer());await appendVideoPart(scope,session.id,session.recordingId,0,bytes(8192),'1'.repeat(64));await appendVideoPart(scope,session.id,session.recordingId,1,bytes(3),'2'.repeat(64));
    memory.databases.get('goatleta-scouting-live-videos-v1')!.get('parts')!.clear();
    await expect(completeVideo(scope,session.id,session.recordingId)).rejects.toThrow('ausentes');expect(await loadVideoBlob(scope,session.id,session.recordingId)).toBeNull();
});

test('quota failure preserves the last prefix and reports failure instead of false completion',async()=>{
    const r=receiver();await r.receiver.handle(offer());await r.receiver.handle(await part(0,bytes(8192)));memory.state.failPut=true;
    await r.receiver.handle(await part(1,bytes(3)));memory.state.failPut=false;
    expect((await loadVideoStatus(scope,session.id,session.recordingId))?.receivedBytes).toBe(8192);expect(await loadVideoBlob(scope,session.id,session.recordingId)).toBeNull();
    expect(r.send.mock.calls.at(-1)?.[0]).toMatchObject({kind:'video-transfer-error',error:expect.stringContaining('espaço')});
});

test('authorization is rechecked at each part and disposal rejects delayed work',async()=>{
    const r=receiver();await r.receiver.handle(offer());r.resolveSession.mockResolvedValue(null);await r.receiver.handle(await part(0,bytes(8192)));expect((await loadVideoStatus(scope,session.id,session.recordingId))?.receivedBytes).toBe(0);
    const disposed=receiver();let release!:(value:typeof session)=>void;disposed.resolveSession.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));const pending=disposed.receiver.handle({...offer(),recordingId:'recording-2'});for(let i=0;i<4;i++)await Promise.resolve();disposed.receiver.dispose();release({...session,recordingId:'recording-2'});await pending;
    expect(await loadVideoStatus(scope,session.id,'recording-2')).toBeNull();expect(disposed.send).not.toHaveBeenCalled();
});

test('active, deleted and foreign sessions cannot receive video and extra offer fields are rejected',async()=>{
    for(const value of [{...session,ended:false},{...session,deletedAt:'2026-11-03T00:00:00Z'},{...session,scope:{...scope,org:'other'}}]){const r=receiver();r.resolveSession.mockResolvedValue(value);await r.receiver.handle(offer());expect(await listVideoStatuses(scope)).toEqual([]);expect(r.send.mock.calls.at(-1)?.[0].kind).toBe('video-transfer-error');}
    const r=receiver();await r.receiver.handle({...offer(),userId:'injected'});expect(await listVideoStatuses(scope)).toEqual([]);
});

test('explicit file import persists a reusable blob and checks the prior prefix before resuming',async()=>{
    const file=new NodeBlob([new Uint8Array(bytes(8192)),new Uint8Array(bytes(3,9))],{type:'video/webm'}) as unknown as Blob;
    const ready=await importLocalVideo(scope,session.id,session.recordingId,file);expect(ready.state).toBe('ready');expect((await loadVideoBlob(scope,session.id,session.recordingId))?.size).toBe(file.size);
    await beginVideo(scope,'second','second-rec',offer());await appendVideoPart(scope,'second','second-rec',0,bytes(8192,3),await videoPartHash(bytes(8192,3)));
    await expect(importLocalVideo(scope,'second','second-rec',file)).rejects.toThrow('divergente');expect((await loadVideoStatus(scope,'second','second-rec'))?.receivedBytes).toBe(8192);
});

test('sender abort releases only the matching transfer so the next saved video can arrive without reconnecting',async()=>{
    const r=receiver();r.resolveSession.mockImplementation(async recordingId=>recordingId===session.recordingId?session:{...session,id:'session-2',recordingId});
    await r.receiver.handle(offer());await r.receiver.handle(await part(0,bytes(8192)));
    const replies=r.send.mock.calls.length;
    await r.receiver.handle({kind:'video-abort',transferId:'transfer-1',recordingId:session.recordingId,error:'O computador não confirmou a cópia.'});
    expect(r.send).toHaveBeenCalledTimes(replies);expect((await loadVideoStatus(scope,session.id,session.recordingId))).toMatchObject({state:'error',nextPart:1,receivedBytes:8192});
    await r.receiver.handle({...offer(3),transferId:'transfer-2',recordingId:'recording-2'});
    expect(r.send).toHaveBeenLastCalledWith({kind:'video-accept',transferId:'transfer-2',recordingId:'recording-2',nextPart:0,partsPerMessage:4,maxInFlight:8});
    await r.receiver.handle({kind:'video-abort',transferId:'transfer-1',recordingId:session.recordingId,error:'Delayed duplicate'});
    await r.receiver.handle({...await part(0,bytes(3)),transferId:'transfer-2',recordingId:'recording-2'});
    await r.receiver.handle({kind:'video-complete',transferId:'transfer-2',recordingId:'recording-2'});
    expect((await loadVideoStatus(scope,'session-2','recording-2'))?.state).toBe('ready');
    expect((await loadVideoStatus(scope,session.id,session.recordingId))?.receivedBytes).toBe(8192);
});

test('playback reads ordered parts into bounded Blob batches without materializing every ArrayBuffer',async()=>{
    const size=8192*256+3,spec=offer(size);await beginVideo(scope,session.id,session.recordingId,spec);
    for(let index=0;index<spec.partCount;index++)await appendVideoPart(scope,session.id,session.recordingId,index,bytes(index===spec.partCount-1?3:8192,index%251),'a'.repeat(64));
    await completeVideo(scope,session.id,session.recordingId);memory.state.rejectPartGetAll=true;
    const BlobConstructor=globalThis.Blob,batchSizes:number[]=[];
    class BoundedBlob extends NodeBlob{
        constructor(parts:any[]=[],options?:any){if(parts.length&&parts[0] instanceof ArrayBuffer)batchSizes.push(parts.reduce((sum:number,p:ArrayBuffer)=>sum+p.byteLength,0));super(parts,options);}
    }
    Object.defineProperty(globalThis,'Blob',{configurable:true,value:BoundedBlob});
    let saved:Blob|null;
    try{saved=await loadVideoBlob(scope,session.id,session.recordingId);}finally{Object.defineProperty(globalThis,'Blob',{configurable:true,value:BlobConstructor});}
    expect(saved!.size).toBe(size);expect(saved!.type).toBe('video/webm');expect(batchSizes).toEqual([1048576,1048576,3]);
    expect(Array.from(new Uint8Array(await saved!.slice(8192*128,8192*128+2).arrayBuffer()))).toEqual([128,128]);
    const parts=memory.databases.get('goatleta-scouting-live-videos-v1')!.get('parts')!,key=liveVideoKey(scope,session.id,session.recordingId);
    const missing=JSON.stringify([key,129]),original=parts.get(missing);parts.delete(missing);
    parts.set('unexpected',{...original,key:'unexpected',index:999}); // Keep total count; exact ordered reads must still reject the gap.
    await expect(loadVideoBlob(scope,session.id,session.recordingId)).rejects.toThrow('ausentes');
});

test('long playback loading rearms its inactivity timer on progress but still rejects a stalled part',async()=>{
    await beginVideo(scope,session.id,session.recordingId,offer());
    await appendVideoPart(scope,session.id,session.recordingId,0,bytes(8192),'a'.repeat(64));
    await appendVideoPart(scope,session.id,session.recordingId,1,bytes(3),'b'.repeat(64));
    await completeVideo(scope,session.id,session.recordingId);
    jest.useFakeTimers({doNotFake:['queueMicrotask','nextTick']});
    try{
        const started=Date.now();memory.state.beforeRead=()=>jest.advanceTimersByTime(10000);
        const saved=await loadVideoBlob(scope,session.id,session.recordingId);
        expect(Date.now()-started).toBeGreaterThan(15000);expect(saved?.size).toBe(8195);
        memory.state.beforeRead=null;memory.state.stallPartRead=true;
        const failed=expect(loadVideoBlob(scope,session.id,session.recordingId)).rejects.toThrow('Tempo esgotado');
        for(let index=0;index<10;index++)await Promise.resolve();
        jest.advanceTimersByTime(15001);await failed;
    }finally{jest.useRealTimers();}
});

test('the actual camera sender interoperates with resumable receiver across original chunk boundaries and ready reoffers',async()=>{
    const {CameraVideoSender}=jest.requireActual('../../../../public/scouting-live/camera.js');
    const source=[new NodeBlob([new Uint8Array(bytes(5000,2))]),new NodeBlob([new Uint8Array(bytes(4500,9))])],all=new NodeBlob(source,{type:'video/webm'});
    const spec={...offer(all.size)},prefix=await all.slice(0,8192).arrayBuffer();
    await beginVideo(scope,session.id,session.recordingId,spec);await appendVideoPart(scope,session.id,session.recordingId,0,prefix,await videoPartHash(prefix));
    let finish!:()=>void,done=new Promise<void>(resolve=>{finish=resolve;}),sender:any;
    const received:any[]=[];
    const r=createLiveVideoReceiver({scope,resolveSession:async()=>session,send:message=>{received.push(message);sender.handle(message);}});
    sender=new CameraVideoSender({roomId:'room-1',crypto:webcrypto,store:{get:async()=>({id:session.recordingId,roomId:'room-1',bytes:all.size,chunkCount:2,state:'stopped',mimeType:'video/webm'}),getChunk:async(_id:string,index:number)=>source[index]?{recordingId:session.recordingId,index,blob:source[index]}:null},send:(message:unknown)=>{void r.handle(message);return true;},onState:(value:any)=>{if(value.state==='ready')finish();}});
    await sender.enqueue(session.recordingId);await done;
    expect(received[0]).toMatchObject({kind:'video-accept',nextPart:1});
    expect(Buffer.from(await (await loadVideoBlob(scope,session.id,session.recordingId))!.arrayBuffer())).toEqual(Buffer.from(await all.arrayBuffer()));
    done=new Promise<void>(resolve=>{finish=resolve;});await sender.enqueue(session.recordingId,{force:true});await done;
    expect(received.slice(-2)).toEqual([expect.objectContaining({kind:'video-accept',nextPart:2}),expect.objectContaining({kind:'video-saved',nextPart:2})]);
    sender.clearWait();r.dispose();
});


test('video persistence shares one connection while transactions retain fresh manifests and versionchange reopens safely',async()=>{
    const open=jest.spyOn(memory.factory,'open');
    await beginVideo(scope,session.id,session.recordingId,offer());
    await appendVideoPart(scope,session.id,session.recordingId,0,bytes(8192),'a'.repeat(64));
    expect((await loadVideoStatus(scope,session.id,session.recordingId))?.nextPart).toBe(1);
    await appendVideoPart(scope,session.id,session.recordingId,1,bytes(3),'b'.repeat(64));await completeVideo(scope,session.id,session.recordingId);
    expect((await loadVideoBlob(scope,session.id,session.recordingId))?.size).toBe(8195);expect(open).toHaveBeenCalledTimes(1);
    const db=open.mock.results[0].value.result as any;db.onversionchange();
    expect((await loadVideoStatus(scope,session.id,session.recordingId))?.state).toBe('ready');expect(open).toHaveBeenCalledTimes(2);
});

test('four verified parts commit together, retain the legacy part size and acknowledge only the committed boundary',async()=>{
    const r=receiver();await r.receiver.handle(offer(8192*8));
    await r.receiver.handle(await batch(0,4));
    expect(r.resolveSession).toHaveBeenCalledTimes(5); // Two offer checks plus three fresh checks for the batch.
    expect(await loadVideoStatus(scope,session.id,session.recordingId)).toMatchObject({nextPart:4,receivedBytes:32768,state:'receiving'});
    expect(r.send).toHaveBeenLastCalledWith({kind:'video-ack',transferId:'transfer-1',recordingId:session.recordingId,index:3,nextPart:4});
    await r.receiver.handle(await batch(4,4));await r.receiver.handle({kind:'video-complete',transferId:'transfer-1',recordingId:session.recordingId});
    const saved=await loadVideoBlob(scope,session.id,session.recordingId);
    expect(saved?.size).toBe(8192*8);expect(Array.from(new Uint8Array(await saved!.slice(8192*7,8192*7+3).arrayBuffer()))).toEqual([7,7,7]);
});

test.each(['corrupt','gap','duplicate','oversized','extra','too-many'] as const)('a %s batch cannot partially advance the saved prefix',async invalid=>{
    const r=receiver();await r.receiver.handle(offer(8192*8));const message=await batch(0,invalid==='too-many'?5:4);
    if(invalid==='corrupt')message.parts[2].sha256='0'.repeat(64);
    if(invalid==='gap')message.parts[2].index=6;
    if(invalid==='duplicate')message.parts[2].index=1;
    if(invalid==='oversized')message.parts[2].data=Buffer.from(bytes(8193)).toString('base64');
    if(invalid==='extra')Object.assign(message.parts[2],{userId:'foreign'});
    await r.receiver.handle(message);
    expect(await loadVideoStatus(scope,session.id,session.recordingId)).toMatchObject({nextPart:0,receivedBytes:0,state:'error'});
    expect(memory.databases.get('goatleta-scouting-live-videos-v1')!.get('parts')!.size).toBe(0);
    expect(r.send).toHaveBeenLastCalledWith(expect.objectContaining({kind:'video-transfer-error'}));
});

test('quota failure on the second fresh part rolls back the whole batch and preserves the prior prefix',async()=>{
    const r=receiver();await r.receiver.handle(offer(8192*8));await r.receiver.handle(await part(0,bytes(8192,0)));
    memory.state.failPartIndex=2;await r.receiver.handle(await batch(1,4));memory.state.failPartIndex=null;
    expect(await loadVideoStatus(scope,session.id,session.recordingId)).toMatchObject({nextPart:1,receivedBytes:8192,state:'error'});
    expect(memory.databases.get('goatleta-scouting-live-videos-v1')!.get('parts')!.size).toBe(1);
    expect(r.send).toHaveBeenLastCalledWith(expect.objectContaining({kind:'video-transfer-error',error:expect.stringContaining('espaço')}));
});

test('an overlapping resumed batch verifies every duplicate before appending any new part',async()=>{
    await beginVideo(scope,session.id,session.recordingId,offer(8192*8));
    for(let index=0;index<2;index++){const data=bytes(8192,index);await appendVideoPart(scope,session.id,session.recordingId,index,data,await videoPartHash(data));}
    const r=receiver();await r.receiver.handle(offer(8192*8));await r.receiver.handle(await batch(0,4));
    expect(await loadVideoStatus(scope,session.id,session.recordingId)).toMatchObject({nextPart:4,receivedBytes:32768});
    const divergent=await batch(2,4),replacement=await part(2,bytes(8192,99));divergent.parts[0]={index:replacement.index,data:replacement.data,sha256:replacement.sha256};
    await r.receiver.handle(divergent);
    expect(await loadVideoStatus(scope,session.id,session.recordingId)).toMatchObject({nextPart:4,receivedBytes:32768,state:'error'});
    expect(memory.databases.get('goatleta-scouting-live-videos-v1')!.get('parts')!.size).toBe(4);
    expect(r.send).toHaveBeenLastCalledWith(expect.objectContaining({kind:'video-transfer-error',error:expect.stringContaining('divergente')}));
});

test('batch authorization is refreshed after hashing and after commit before acknowledging or publishing completion',async()=>{
    const r=receiver();await r.receiver.handle(offer(8192*8));r.resolveSession.mockResolvedValueOnce(session).mockResolvedValueOnce(null);
    await r.receiver.handle(await batch(0,4));expect(await loadVideoStatus(scope,session.id,session.recordingId)).toMatchObject({nextPart:0});
    const resumed=receiver();await resumed.receiver.handle(offer(8192*8));
    memory.state.afterCommit=()=>resumed.resolveSession.mockResolvedValue(null);
    await resumed.receiver.handle(await batch(0,4));memory.state.afterCommit=null;
    expect(await loadVideoStatus(scope,session.id,session.recordingId)).toMatchObject({nextPart:4,state:'error'});
    expect(resumed.send.mock.calls.map(([message])=>message.kind)).not.toContain('video-ack');
    expect(resumed.send.mock.calls.map(([message])=>message.kind)).not.toContain('video-saved');
});

test('disposing while the post-hash authorization is pending suppresses the entire uncommitted batch',async()=>{
    const r=receiver();await r.receiver.handle(offer(8192*8));const message=await batch(0,4);
    let release!:(value:typeof session)=>void,arrived!:()=>void;const waiting=new Promise<void>(resolve=>{arrived=resolve;});
    r.resolveSession.mockResolvedValueOnce(session).mockImplementationOnce(()=>{arrived();return new Promise(resolve=>{release=resolve;});});
    const pending=r.receiver.handle(message);await waiting;r.receiver.dispose();release(session);await pending;
    expect(await loadVideoStatus(scope,session.id,session.recordingId)).toMatchObject({nextPart:0});
    expect(r.send).toHaveBeenCalledTimes(1);
});

test('replenishing the eight-part window synchronously from an ACK cannot falsely overflow the bounded receiver',async()=>{
    const messages=await Promise.all([batch(0,4),batch(4,4),batch(8,4)]),replies:Record<string,unknown>[]=[];
    let refill:Promise<void>|undefined;
    const r=createLiveVideoReceiver({scope,resolveSession:async()=>session,send:message=>{
        replies.push(message);if(message.kind==='video-ack'&&message.nextPart===4)refill=r.handle(messages[2]);
    }});
    await r.handle(offer(8192*12));await Promise.all([r.handle(messages[0]),r.handle(messages[1])]);await refill;
    expect(replies.some(message=>message.kind==='video-transfer-error')).toBe(false);
    expect(await loadVideoStatus(scope,session.id,session.recordingId)).toMatchObject({nextPart:12,receivedBytes:8192*12});r.dispose();
});

test('the receiver accepts eight one-part negotiated messages but rejects a ninth queued part without unbounded work',async()=>{
    const messages=await Promise.all(Array.from({length:9},(_,index)=>batch(index,1))),r=receiver();await r.receiver.handle(offer(8192*12));
    await Promise.all(messages.map(message=>r.receiver.handle(message)));
    expect(r.send.mock.calls.filter(([message])=>message.kind==='video-transfer-error')).toHaveLength(1);
    expect(await loadVideoStatus(scope,session.id,session.recordingId)).toMatchObject({nextPart:8,receivedBytes:8192*8});
});

test('foreign transfer batches cannot mutate the active video and persistence rejects oversized or noncontiguous batches directly',async()=>{
    const r=receiver();await r.receiver.handle(offer(8192*8));const message=await batch(0,4);
    await r.receiver.handle({...message,recordingId:'foreign',transferId:'foreign'});
    expect(await loadVideoStatus(scope,session.id,session.recordingId)).toMatchObject({nextPart:0,state:'receiving'});
    const data=bytes(8192),entry={index:0,data,sha256:await videoPartHash(data)};
    await expect(appendVideoParts(scope,session.id,session.recordingId,Array(5).fill(entry))).rejects.toThrow('Lote');
    await expect(appendVideoParts(scope,session.id,session.recordingId,[entry,{...entry,index:2}])).rejects.toThrow('Trecho');
    await r.receiver.handle(message);expect(await loadVideoStatus(scope,session.id,session.recordingId)).toMatchObject({nextPart:4});
});
