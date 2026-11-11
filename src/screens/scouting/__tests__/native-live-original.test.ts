import { Blob as NodeBlob, Buffer } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TextEncoder as NodeTextEncoder } from 'node:util';
import { runInNewContext } from 'node:vm';
import { createNativeOriginalReceiver } from '../live/native-live-original-receiver';
import {
    checkNativeOriginalReadiness, listNativeOriginalStatuses, loadNativeOriginalBlob, openNativeOriginal, NATIVE_ORIGINAL_LIVE_BLOCK,
    type NativeOriginalDisk,
} from '../live/native-live-original-storage';
import { liveVideoKey, videoPartHash } from '../live/live-video-storage';
import type { LiveHostSession } from '../live/live-storage';
import { createMemoryIdb } from './fixtures/memory-idb';

const scope = {userId:'user', org:'org', classId:'class'};
const session = {id:'session', recordingId:'recording', scope, ended:false} as LiveHostSession;
const roomId = 'paired-room';
const liveBlock = NATIVE_ORIGINAL_LIVE_BLOCK;
const directory = 'goatleta-native-live-original-v1';

function diskFixture() {
    const files = new Map<string, Uint8Array<ArrayBuffer>>();
    const locked = new Set<string>();
    const events: {afterFlush?:() => void} = {};
    const open = async (name: string): Promise<NativeOriginalDisk> => {
        if (locked.has(name)) throw new Error('Arquivo aberto em outra aba.');
        locked.add(name);
        if (!files.has(name)) files.set(name, new Uint8Array());
        const contents = () => files.get(name)!;
        return {
            size:async () => contents().length,
            async truncate(size) { files.set(name, contents().slice(0, size)); },
            hash:(offset, length) => videoPartHash(contents().slice(offset, offset + length).buffer),
            async write(offset, bytes, sha256) {
                if (await videoPartHash(bytes) !== sha256) throw new Error('Hash divergente.');
                const next = new Uint8Array(Math.max(contents().length, offset + bytes.byteLength));
                next.set(contents());
                next.set(new Uint8Array(bytes), offset);
                files.set(name, next);
                events.afterFlush?.();
            },
            async close() { locked.delete(name); },
        };
    };
    const getDirectory = async () => ({getDirectoryHandle:async () => ({getFileHandle:async (name: string) => ({
        getFile:async () => new NodeBlob([files.get(name)!], {type:'video/mp4'}),
    })})});
    return {open, getDirectory, files, locked, events};
}

const globals = new Map(['indexedDB', 'crypto', 'TextEncoder', 'navigator', 'Worker'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
let memory: ReturnType<typeof createMemoryIdb>, disk: ReturnType<typeof diskFixture>;
beforeEach(() => {
    memory = createMemoryIdb();
    disk = diskFixture();
    for (const [name, value] of Object.entries({indexedDB:memory.factory, crypto:webcrypto, TextEncoder:NodeTextEncoder, navigator:{storage:{getDirectory:disk.getDirectory}}})) {
        Object.defineProperty(globalThis, name, {configurable:true, value});
    }
});
afterEach(() => {
    for (const [name, descriptor] of globals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
    }
});

const message = (kind: string, details: object, transferId = 'transfer') => ({kind:`native-original-${kind}`, recordingId:session.recordingId, transferId, ...details});
const offer = (bytes: number, finalized = false, transferId?: string) => message('offer', {bytes, finalized}, transferId);
function harness() {
    let authorized: {session:LiveHostSession; roomId:string} | null = {session, roomId};
    const send = jest.fn(), onProgress = jest.fn();
    const receiver = createNativeOriginalReceiver({scope, resolveSession:async () => authorized, send, onProgress,
        open:(identity, ensure) => openNativeOriginal(identity, ensure, disk.open),
    });
    const finishPhone = () => { authorized = {session:{...session, ended:true, recordingState:'stopped'}, roomId}; };
    const setAuthorization = (value: {session:LiveHostSession; roomId:string} | null) => { authorized = value; };
    return {receiver, send, onProgress, finishPhone, setAuthorization};
}
async function deliver(receiver: ReturnType<typeof createNativeOriginalReceiver>, offset: number, bytes: Uint8Array<ArrayBuffer>, transferId?: string, sha256?: string) {
    const fragment = 32 * 1024;
    for (let start = 0; start < bytes.length; start += fragment) {
        await receiver.handle(message('data', {offset:offset + start, data:Buffer.from(bytes.subarray(start, start + fragment)).toString('base64')}, transferId));
    }
    await receiver.handle(message('commit', {offset, bytes:bytes.length, sha256:sha256 ?? await videoPartHash(bytes.buffer)}, transferId));
}

test('final MP4 ranges replace mutated provisional bytes and expose only the fully verified original', async () => {
    const {receiver, send, onProgress, finishPhone} = harness();
    const draft = new Uint8Array(liveBlock).fill(7);
    await receiver.handle(offer(draft.length));
    await deliver(receiver, 0, draft);
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({offset:liveBlock, verified:0}));
    expect(await loadNativeOriginalBlob(scope, session.id, session.recordingId)).toBeNull();

    const final = new Uint8Array(liveBlock + 40).fill(7);
    final[0] = 11;
    const sha256 = await videoPartHash(final.buffer);
    finishPhone();
    await receiver.handle(offer(final.length, true));
    await receiver.handle(message('check', {offset:0, bytes:final.length, sha256}));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({offset:liveBlock, verified:0, needsData:true}));
    await deliver(receiver, 0, final);
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({state:'ready', receivedBytes:final.length}));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({offset:final.length, verified:final.length}));
    expect(disk.locked.size).toBe(0);
    expect(memory.databases.get(directory)?.get('originals')?.size).toBe(1);
    const result = await loadNativeOriginalBlob(scope, session.id, session.recordingId);
    expect(await videoPartHash(await result!.arrayBuffer())).toBe(sha256);
    expect(await loadNativeOriginalBlob({...scope, org:'foreign'}, session.id, session.recordingId)).toBeNull();
    expect(await listNativeOriginalStatuses({...scope, userId:'foreign'})).toEqual([]);
});

test('a flushed block with a failed manifest commit is truncated to the acknowledged prefix on retry', async () => {
    const {receiver, send} = harness();
    await receiver.handle(offer(2 * liveBlock));
    await deliver(receiver, 0, new Uint8Array(liveBlock).fill(1));
    memory.state.failWrite = () => Object.assign(new Error('Quota'), {name:'QuotaExceededError'});
    await deliver(receiver, liveBlock, new Uint8Array(liveBlock).fill(2));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({offset:liveBlock, error:expect.stringContaining('Sem espaço')}));
    expect([...disk.files.values()][0].length).toBe(2 * liveBlock);
    memory.state.failWrite = null;
    await receiver.handle(offer(2 * liveBlock, false, 'retry'));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({transferId:'retry', offset:liveBlock}));
    expect([...disk.files.values()][0].length).toBe(liveBlock);
    receiver.dispose();
});

test('another room, a corrupt block and an unconfirmed stop cannot advance or publish the original', async () => {
    const {receiver, send, setAuthorization} = harness();
    await receiver.handle(offer(liveBlock));
    await deliver(receiver, 0, new Uint8Array(liveBlock).fill(2), undefined, '1'.repeat(64));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({offset:0, error:'Hash divergente.'}));
    await receiver.handle(offer(liveBlock, true, 'premature'));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({transferId:'premature', error:expect.stringContaining('fim da gravação')}));
    setAuthorization({session, roomId:'another-room'});
    await receiver.handle(offer(liveBlock, false, 'other-room'));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({transferId:'other-room', offset:0, error:expect.stringContaining('outro pareamento')}));
    expect([...disk.files.values()][0].length).toBe(0);
    expect(await loadNativeOriginalBlob(scope, session.id, session.recordingId)).toBeNull();
    receiver.dispose();
});

test.each([false,true])('a replacement channel resumes at the durable final cursor (uncommitted tail: %s)', async extraTail => {
    const first = harness();
    const prefix = new Uint8Array(4 * liveBlock).fill(10), tail = new Uint8Array(36).fill(42);
    await first.receiver.handle(offer(prefix.length));
    for (let offset = 0; offset < prefix.length; offset += liveBlock) {
        await deliver(first.receiver, offset, prefix.slice(offset, offset + liveBlock));
    }
    first.finishPhone();
    const bytes = prefix.length + tail.length;
    const prefixCheck = {offset:0, bytes:prefix.length, sha256:await videoPartHash(prefix.buffer)};
    await first.receiver.handle(offer(bytes, true));
    await first.receiver.handle(message('check', prefixCheck));
    expect(first.send).toHaveBeenLastCalledWith(expect.objectContaining({offset:prefix.length, verified:prefix.length}));
    expect(await loadNativeOriginalBlob(scope, session.id, session.recordingId)).toBeNull();
    await first.receiver.dispose();
    if(extraTail){
        const [name]=[...disk.files][0];
        disk.files.set(name, new Uint8Array(Buffer.concat([prefix,tail.slice(0,12)])));
    }

    const second = harness();
    second.finishPhone();
    await second.receiver.handle(offer(bytes, true, 'retry'));
    expect(second.send).toHaveBeenLastCalledWith(expect.objectContaining({offset:prefix.length, verified:prefix.length}));
    expect([...disk.files.values()][0].length).toBe(prefix.length);
    await second.receiver.handle(message('check', {offset:prefix.length, bytes:tail.length, sha256:await videoPartHash(tail.buffer)}, 'retry'));
    expect(second.send).toHaveBeenLastCalledWith(expect.objectContaining({offset:prefix.length, verified:prefix.length, needsData:true}));
    await deliver(second.receiver, prefix.length, tail, 'retry');
    const result = await loadNativeOriginalBlob(scope, session.id, session.recordingId);
    expect(Buffer.from(await result!.arrayBuffer()).equals(Buffer.concat([prefix, tail]))).toBe(true);
    await second.receiver.dispose();
});

test.each(['legacy manifest','shortened OPFS file'])('%s safely resets final verification', async reason => {
    const first=harness(), prefix=new Uint8Array(4*liveBlock), total=prefix.length+16;
    await first.receiver.handle(offer(prefix.length));
    for(let offset=0;offset<prefix.length;offset+=liveBlock)await deliver(first.receiver,offset,prefix.slice(offset,offset+liveBlock));
    first.finishPhone();
    await first.receiver.handle(offer(total,true));
    await first.receiver.handle(message('check',{offset:0,bytes:prefix.length,sha256:await videoPartHash(prefix.buffer)}));
    expect(first.send).toHaveBeenLastCalledWith(expect.objectContaining({verified:prefix.length}));
    await first.receiver.dispose();
    if(reason==='legacy manifest'){
        const manifests=memory.databases.get(directory)!.get('originals')!;
        const key=liveVideoKey(scope,session.id,session.recordingId);
        delete manifests.get(key).verifiedBytes;
    }else{
        const [name,file]=[...disk.files][0];
        disk.files.set(name,file.slice(0,file.length-1));
    }
    const second=harness();second.finishPhone();
    await second.receiver.handle(offer(total,true,'resumed'));
    expect(second.send).toHaveBeenLastCalledWith(expect.objectContaining({offset:reason==='legacy manifest'?prefix.length:0,verified:0}));
    await second.receiver.dispose();
});

test('a committed final range can publish on re-offer if the ready receipt failed',async()=>{
    const first=harness(), bytes=new Uint8Array(20).fill(16);
    const sha256=await videoPartHash(bytes.buffer);
    first.finishPhone();
    await first.receiver.handle(offer(bytes.length,true));
    await first.receiver.handle(message('check',{offset:0,bytes:bytes.length,sha256}));
    memory.state.failWrite=(database,_store,_key,value)=>database===directory&&value.ready?new Error('Ready receipt failed'):null;
    await deliver(first.receiver,0,bytes);
    expect(first.send).toHaveBeenLastCalledWith(expect.objectContaining({offset:bytes.length,verified:bytes.length,error:expect.any(String)}));
    expect(await loadNativeOriginalBlob(scope,session.id,session.recordingId)).toBeNull();
    await first.receiver.dispose();
    memory.state.failWrite=null;
    const second=harness();second.finishPhone();
    await second.receiver.handle(offer(bytes.length,true,'ready-retry'));
    expect(second.send).toHaveBeenLastCalledWith(expect.objectContaining({transferId:'ready-retry',offset:bytes.length,verified:bytes.length}));
    expect(second.onProgress).toHaveBeenLastCalledWith(expect.objectContaining({state:'ready'}));
    await second.receiver.dispose();
});

test('authorization lost after disk flush prevents the durable receipt and hides the former prefix', async () => {
    const {receiver, send, onProgress, setAuthorization} = harness();
    await receiver.handle(offer(2 * liveBlock));
    await deliver(receiver, 0, new Uint8Array(liveBlock).fill(1));
    disk.events.afterFlush = () => setAuthorization(null);
    await deliver(receiver, liveBlock, new Uint8Array(liveBlock).fill(2));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({offset:0, error:expect.stringContaining('indisponível')}));
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({receivedBytes:liveBlock}));
    expect(await listNativeOriginalStatuses(scope)).toEqual([expect.objectContaining({receivedBytes:liveBlock})]);
    expect(disk.locked.size).toBe(0);
    await receiver.dispose();
});

test('the native path resumes a contiguous offset beyond the legacy four GiB ceiling', async () => {
    let size = 0;
    const writes: number[] = [];
    const sparseDisk = async (): Promise<NativeOriginalDisk> => ({
        size:async () => size, truncate:async value => { size = value; }, hash:async () => '', close:async () => {},
        async write(offset, bytes, sha256) {
            if (offset !== size || await videoPartHash(bytes) !== sha256) throw new Error('Faixa inválida.');
            writes.push(offset);
            size += bytes.byteLength;
        },
    });
    const send = jest.fn(), createReceiver = () => createNativeOriginalReceiver({
        scope, resolveSession:async () => ({session, roomId}), send, onProgress:jest.fn(),
        open:(identity, ensure) => openNativeOriginal(identity, ensure, sparseDisk),
    });
    const first = createReceiver(), prefix = 5 * 1024 ** 3, total = prefix + liveBlock;
    await first.handle(offer(total));
    await first.dispose();
    const manifests = memory.databases.get(directory)!.get('originals')!;
    const key = liveVideoKey(scope, session.id, session.recordingId);
    manifests.set(key, {...manifests.get(key), receivedBytes:prefix});
    size = prefix;
    const resumed = createReceiver();
    await resumed.handle(offer(total, false, 'sparse'));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({offset:prefix}));
    await deliver(resumed, prefix, new Uint8Array(liveBlock), 'sparse');
    expect(writes).toEqual([prefix]);
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({offset:total, verified:0}));
    await resumed.dispose();
});

test.each([
    {quota:30,used:2,persisted:true,state:'estimate-ok',available:28},
    {quota:10,used:2,persisted:false,state:'low-space',available:8},
    {quota:30,used:2,persisted:false,state:'unconfirmed',available:28},
])('readiness reports only the profile estimate and durable-storage grant ($state)',async sample=>{
    const gib=1024**3, commands:unknown[]=[];
    const terminate=jest.fn();
    class ProbeWorker {
        onmessage?: (event:{data:{id:number}})=>void;
        postMessage(message:{id:number;kind:string}){commands.push(message.kind);queueMicrotask(()=>this.onmessage?.({data:{id:message.id}}));}
        terminate=terminate;
    }
    Object.defineProperty(globalThis,'Worker',{configurable:true,value:ProbeWorker});
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{getDirectory:disk.getDirectory,
        estimate:async()=>({quota:sample.quota*gib,usage:sample.used*gib}),persisted:async()=>sample.persisted,
    }}});
    await expect(checkNativeOriginalReadiness()).resolves.toEqual({requiredBytes:24*gib,availableBytes:sample.available*gib,persisted:sample.persisted,state:sample.state});
    expect(commands).toEqual(['probe']);
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(memory.databases.get(directory)?.get('originals')?.size).toBe(0);
});

test('the worker proves a tiny write and reports a short video write without confirming it', async () => {
    let probe=true;
    const contents=new Uint8Array(4), close=jest.fn(), flush=jest.fn(), removeEntry=jest.fn(async()=>undefined);
    const handle={
        getSize:()=>0,close,flush,
        write:(input:Uint8Array|ArrayBuffer)=>{if(!probe)return 0;contents.set(input as Uint8Array);return contents.length;},
        read:(target:Uint8Array)=>{target.set(contents);return contents.length;},
    };
    let complete:(value:{error?:string})=>void;
    const self={onmessage:(value:unknown)=>{void value;},postMessage:(message:{error?:string})=>complete(message)};
    const sandbox={self,crypto:webcrypto,ArrayBuffer,Uint8Array,navigator:{storage:{getDirectory:async()=>({getDirectoryHandle:async()=>({
        removeEntry,getFileHandle:async()=>({createSyncAccessHandle:async()=>handle}),
    })})}}};
    const source=readFileSync(resolve(__dirname,'../../../../public/scouting-live/native-live-original.worker.js'),'utf8');
    runInNewContext(source,sandbox);
    const call=(data:object)=>new Promise<{error?:string}>(done=>{complete=done;self.onmessage({data});});
    expect((await call({kind:'probe'})).error).toBeUndefined();
    expect(flush).toHaveBeenCalledTimes(1);expect(close).toHaveBeenCalledTimes(1);
    expect(removeEntry).toHaveBeenCalledWith(expect.stringMatching(/^probe-/));
    probe=false;
    await call({kind:'open',name:'0'.repeat(64)+'.mp4'});
    const bytes=new Uint8Array([1,2,3,4]).buffer;
    const response=await call({kind:'write',offset:0,length:bytes.byteLength,bytes,sha256:await videoPartHash(bytes)});
    expect(response.error).toMatch(/perfil normal do Chrome.*último trecho confirmado/);
    expect(flush).toHaveBeenCalledTimes(1);
});
