import { createLiveDatabaseConnection } from './live-idb-connection';
import type { LiveHostScope } from './live-storage';
import { liveVideoKey, videoPartHash, type LiveVideoStatus } from './live-video-storage';

export const NATIVE_ORIGINAL_MAX_BYTES = 24 * 1024 ** 3;
export const NATIVE_ORIGINAL_LIVE_BLOCK = 256 * 1024;
export const NATIVE_ORIGINAL_FINAL_BLOCK = 1024 * 1024;
const DIRECTORY = 'goatleta-native-live-original-v1';
const MANIFESTS = 'originals';
const OPFS_ERROR = 'Armazenamento de vídeo local indisponível neste navegador.';
const database = createLiveDatabaseConnection(DIRECTORY, db => db.createObjectStore(MANIFESTS));

export type NativeOriginalIdentity = {
    scope: LiveHostScope; roomId: string; sessionId: string; recordingId: string;
};
type Manifest = NativeOriginalIdentity & {
    version: 1; receivedBytes: number; verifiedBytes: number; totalBytes: number; finalized: boolean; ready: boolean;
};
export type NativeOriginalDisk = {
    size(): Promise<number>;
    truncate(size: number): Promise<void>;
    hash(offset: number, length: number): Promise<string>;
    write(offset: number, bytes: ArrayBuffer, sha256: string): Promise<void>;
    close(): Promise<void>;
};
export type NativeOriginalReadiness = {
    state:'estimate-ok'|'low-space'|'unconfirmed'|'unavailable';
    requiredBytes:number;
    availableBytes:number|null;
    persisted:boolean|null;
    error?:string;
};
type DiskCommand =
    | {kind:'open'; name:string}
    | {kind:'size'|'close'|'probe'}
    | {kind:'truncate'; size:number}
    | {kind:'hash'; offset:number; length:number}
    | {kind:'write'; offset:number; length:number; bytes:ArrayBuffer; sha256:string};

export const nativeOriginalId = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,128}$/.test(value);
export const nativeOriginalSize = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= NATIVE_ORIGINAL_MAX_BYTES;
const sameScope = (a: LiveHostScope, b: LiveHostScope) => a.userId === b.userId && a.org === b.org && a.classId === b.classId;
const keyFor = ({scope, sessionId, recordingId}: NativeOriginalIdentity) => liveVideoKey(scope, sessionId, recordingId);
// A scoped recording always acquires the same exclusive file lock. The manifest then binds its room.
const fileName = async (key: string) => `${await videoPartHash(new TextEncoder().encode(key).buffer)}.mp4`;
const supportsLocalDisk = () => typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';

function parseManifest(value: unknown, scope: LiveHostScope, key?: string): Manifest {
    const m = value as (Omit<Manifest,'verifiedBytes'>&{verifiedBytes?:number}) | null;
    if (!m || m.version !== 1 || !m.scope || !sameScope(scope, m.scope) || !nativeOriginalId(m.roomId) || !nativeOriginalId(m.recordingId)
        || !nativeOriginalSize(m.totalBytes) || !nativeOriginalSize(m.receivedBytes)
        || m.receivedBytes > m.totalBytes || typeof m.finalized !== 'boolean' || typeof m.ready !== 'boolean'
        || (m.finalized ? !m.totalBytes : m.totalBytes % NATIVE_ORIGINAL_LIVE_BLOCK !== 0 || m.receivedBytes % NATIVE_ORIGINAL_LIVE_BLOCK !== 0)
        || m.ready && (!m.finalized || m.receivedBytes !== m.totalBytes)) {
        throw new Error('Identidade ou progresso do vídeo local inválidos.');
    }
    const storedKey = keyFor(m);
    if (key !== undefined && storedKey !== key) throw new Error('Identidade do vídeo local inválida.');
    // Original manifests have no verification cursor. A ready copy already verified its whole file.
    const verifiedBytes=m.verifiedBytes===undefined?(m.ready?m.totalBytes:0):m.verifiedBytes;
    if (!nativeOriginalSize(verifiedBytes)||verifiedBytes>m.receivedBytes||!m.finalized&&verifiedBytes!==0
        ||verifiedBytes!==m.totalBytes&&verifiedBytes%NATIVE_ORIGINAL_FINAL_BLOCK!==0||m.ready&&verifiedBytes!==m.totalBytes) {
        throw new Error('Progresso de verificação do vídeo local inválido.');
    }
    return {...m,verifiedBytes};
}

function status(m: Manifest): LiveVideoStatus {
    return {
        sessionId:m.sessionId, recordingId:m.recordingId, mimeType:'video/mp4', state:m.ready?'ready':'receiving',
        receivedBytes:m.receivedBytes, totalBytes:m.totalBytes,
        ...(m.finalized?{verifiedBytes:m.verifiedBytes}:{}),
        nextPart:Math.floor(m.receivedBytes / NATIVE_ORIGINAL_LIVE_BLOCK), partCount:Math.ceil(m.totalBytes / NATIVE_ORIGINAL_LIVE_BLOCK),
    };
}

async function manifestOperation<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const tx = await database.transaction(MANIFESTS, mode);
    return new Promise((resolve, reject) => {
        let result: T;
        const timer = setTimeout(() => { try { tx.abort(); } catch { reject(new Error(OPFS_ERROR)); } }, 10000);
        tx.oncomplete = () => { clearTimeout(timer); resolve(result); };
        tx.onabort = tx.onerror = () => {
            clearTimeout(timer);
            reject(new Error(tx.error?.name === 'QuotaExceededError' ? 'Sem espaço neste notebook para salvar o vídeo.' : OPFS_ERROR));
        };
        try {
            const req = run(tx.objectStore(MANIFESTS));
            req.onsuccess = () => { result = req.result; };
        } catch (error) {
            try { tx.abort(); } catch { clearTimeout(timer); }
            reject(error);
        }
    });
}

async function readManifest(scope: LiveHostScope, key: string): Promise<Manifest | null> {
    const value = await manifestOperation('readonly', store => store.get(key));
    return value === undefined ? null : parseManifest(value, scope, key);
}

function createDiskWorker() {
    if (typeof Worker !== 'function' || !supportsLocalDisk()) throw new Error(OPFS_ERROR);
    const worker = new Worker('/scouting-live/native-live-original.worker.js');
    let nextId = 0, ended = false;
    let pending: {id:number; resolve:(value:unknown) => void; reject:(error:Error) => void; timeout:ReturnType<typeof setTimeout>} | undefined;
    const settle = () => {
        const current = pending;
        pending = undefined;
        if (current) clearTimeout(current.timeout);
        return current;
    };
    const terminate = () => {
        ended = true;
        settle()?.reject(new Error(OPFS_ERROR));
        worker.terminate();
    };
    worker.onerror = worker.onmessageerror = terminate;
    worker.onmessage = ({data}) => {
        if (!pending || data?.id !== pending.id) return;
        const current = settle()!;
        if (typeof data.error === 'string') current.reject(new Error(data.error));
        else current.resolve(data.value);
    };
    const command = <T,>(value: DiskCommand, transfer: Transferable[] = []) => new Promise<T>((resolve, reject) => {
        if (ended || pending) { reject(new Error(OPFS_ERROR)); return; }
        const id = ++nextId;
        pending = {id, resolve:result => resolve(result as T), reject, timeout:setTimeout(terminate, 12000)};
        try { worker.postMessage({id, ...value}, transfer); }
        catch { terminate(); }
    });
    const close=async()=>{
        if (ended) return;
        try { if (!pending) await command({kind:'close'}); }
        finally { terminate(); }
    };
    return {command,terminate,close};
}

async function openDisk(name: string): Promise<NativeOriginalDisk> {
    const {command,terminate,close}=createDiskWorker();
    try { await command({kind:'open', name}); }
    catch (error) { terminate(); throw error; }
    return {
        size:() => command<number>({kind:'size'}),
        truncate:size => command({kind:'truncate', size}),
        hash:(offset, length) => command<string>({kind:'hash', offset, length}),
        write:(offset, bytes, sha256) => command({kind:'write', offset, length:bytes.byteLength, bytes, sha256}, [bytes]),
        close,
    };
}

async function storageInformation<T>(read: () => Promise<T>): Promise<T | null> {
    let timer:ReturnType<typeof setTimeout>|undefined;
    try {
        return await Promise.race([read(),new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),3000);})]);
    } catch { return null; }
    finally { if(timer!==undefined)clearTimeout(timer); }
}

/** A small round trip and browser-reported quota cannot certify an individual large file or OS disk space. */
export async function checkNativeOriginalReadiness(requiredBytes=NATIVE_ORIGINAL_MAX_BYTES): Promise<NativeOriginalReadiness> {
    if (!Number.isSafeInteger(requiredBytes)||requiredBytes<=0) throw new Error('Tamanho de gravação inválido.');
    const unknown={requiredBytes,availableBytes:null,persisted:null};
    try {
        if (typeof indexedDB==='undefined'||!globalThis.crypto?.subtle) throw new Error(OPFS_ERROR);
        const {command,terminate}=createDiskWorker();
        try {
            const checks=await Promise.allSettled([
                command({kind:'probe'}),
                manifestOperation('readonly',store=>store.get('storage-probe')),
            ]);
            const failed=checks.find(result=>result.status==='rejected');
            if(failed?.status==='rejected')throw failed.reason;
        } finally { terminate(); }
    } catch (error) {
        return {...unknown,state:'unavailable',error:error instanceof Error?error.message:OPFS_ERROR};
    }
    const storage=navigator.storage;
    const [estimate,persisted]=await Promise.all([
        storageInformation(()=>storage.estimate()),
        storageInformation(()=>storage.persisted()),
    ]);
    const {quota,usage}=estimate??{};
    const availableBytes=typeof quota==='number'&&Number.isSafeInteger(quota)&&quota>=0
        &&typeof usage==='number'&&Number.isSafeInteger(usage)&&usage>=0 ? Math.max(0,quota-usage) : null;
    return {requiredBytes,availableBytes,persisted,
        state:availableBytes===null?'unconfirmed':availableBytes<requiredBytes?'low-space':persisted===true?'estimate-ok':'unconfirmed'};
}

export async function openNativeOriginal(identity: NativeOriginalIdentity, ensure: () => Promise<void>, open = openDisk) {
    const key = keyFor(identity);
    if (!nativeOriginalId(identity.roomId) || !nativeOriginalId(identity.recordingId)) throw new Error('Identidade da cópia nativa inválida.');
    const name = await fileName(key);
    const previous = await readManifest(identity.scope, key);
    if (previous && previous.roomId !== identity.roomId) throw new Error('Este vídeo pertence a outro pareamento.');
    await ensure();
    const disk = await open(name);
    try {
        let manifest = await readManifest(identity.scope, key) ?? {
            ...identity, version:1 as const, receivedBytes:0, verifiedBytes:0, totalBytes:0, finalized:false, ready:false,
        };
        if (manifest.roomId !== identity.roomId) throw new Error('Este vídeo pertence a outro pareamento.');
        const save = async (next: Manifest, guard: () => boolean) => {
            await ensure();
            await manifestOperation('readwrite', store => {
                if (!guard()) throw new Error('Cópia do vídeo cancelada.');
                return store.put(next, key);
            });
            manifest = next;
        };
        const size = await disk.size();
        if (manifest.ready && size !== manifest.receivedBytes) throw new Error('O original salvo neste notebook está incompleto.');
        // A flush can succeed before a manifest commit. Re-offer starts at the last durable receipt.
        const offset = size < manifest.receivedBytes ? 0 : manifest.receivedBytes;
        if (size !== offset) { await ensure(); await disk.truncate(offset); }
        if (offset !== manifest.receivedBytes) manifest = {...manifest, receivedBytes:offset, verifiedBytes:0};
        return {
            status:() => status(manifest),
            get offset() { return manifest.receivedBytes; },
            get verified() { return manifest.verifiedBytes; },
            get ready() { return manifest.ready; },
            get finalized() { return manifest.finalized; },
            async offer(bytes: number, finalized: boolean, guard: () => boolean) {
                if (!guard()) throw new Error('Cópia do vídeo cancelada.');
                if (manifest.finalized && (!finalized || manifest.totalBytes !== bytes)) throw new Error('O tamanho do original finalizado mudou.');
                if (!finalized && bytes < manifest.totalBytes) throw new Error('O tamanho da gravação em andamento diminuiu.');
                if (manifest.ready) return;
                const receivedBytes = Math.min(bytes, manifest.receivedBytes);
                if (receivedBytes !== manifest.receivedBytes) await disk.truncate(receivedBytes);
                await save({...manifest, receivedBytes, totalBytes:bytes, finalized}, guard);
            },
            async write(offset: number, data: ArrayBuffer, sha256: string, guard: () => boolean) {
                if (!guard() || manifest.ready) throw new Error('Cópia do vídeo cancelada.');
                const end = offset + data.byteLength;
                const expected=manifest.finalized?manifest.verifiedBytes:manifest.receivedBytes;
                if(offset!==expected||offset>manifest.receivedBytes||end>manifest.totalBytes) throw new Error('Faixa de vídeo fora de ordem.');
                await disk.write(offset, data, sha256);
                await save({...manifest, receivedBytes:Math.max(end, manifest.receivedBytes), verifiedBytes:manifest.finalized?end:0}, guard);
            },
            hash:(offset: number, length: number) => offset + length <= manifest.receivedBytes ? disk.hash(offset, length) : Promise.resolve(null),
            async verify(offset:number, length:number, guard:()=>boolean) {
                const end=offset+length;
                if(!manifest.finalized||manifest.ready||offset!==manifest.verifiedBytes||end>manifest.receivedBytes
                    ||length!==Math.min(NATIVE_ORIGINAL_FINAL_BLOCK,manifest.totalBytes-offset)) throw new Error('Faixa de vídeo fora de ordem.');
                await save({...manifest,verifiedBytes:end},guard);
            },
            async complete(guard: () => boolean) {
                if (!manifest.finalized || !manifest.totalBytes || manifest.receivedBytes !== manifest.totalBytes
                    || manifest.verifiedBytes !== manifest.totalBytes || await disk.size() !== manifest.totalBytes) {
                    throw new Error('O vídeo ainda não chegou completo.');
                }
                await save({...manifest, ready:true}, guard);
                await disk.close();
            },
            close:() => disk.close(),
        };
    } catch (error) {
        await disk.close().catch(() => undefined);
        throw error;
    }
}

export async function listNativeOriginalStatuses(scope: LiveHostScope): Promise<LiveVideoStatus[]> {
    if (!supportsLocalDisk()) return [];
    const values = await manifestOperation('readonly', store => store.getAll());
    return (values as Manifest[]).filter(m => m.scope && sameScope(scope, m.scope)).map(value => status(parseManifest(value, scope)));
}

export async function loadNativeOriginalStatus(scope: LiveHostScope, sessionId: string, recordingId: string): Promise<LiveVideoStatus | null> {
    if (!supportsLocalDisk()) return null;
    const manifest = await readManifest(scope, liveVideoKey(scope, sessionId, recordingId));
    return manifest ? status(manifest) : null;
}

export async function loadNativeOriginalBlob(scope: LiveHostScope, sessionId: string, recordingId: string): Promise<Blob | null> {
    if (!supportsLocalDisk()) return null;
    const key = liveVideoKey(scope, sessionId, recordingId);
    const manifest = await readManifest(scope, key);
    if (!manifest?.ready) return null;
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle(DIRECTORY);
    const handle = await directory.getFileHandle(await fileName(key));
    const file = await handle.getFile();
    if (file.size !== manifest.totalBytes) throw new Error('O original salvo neste notebook está incompleto.');
    return file.type === 'video/mp4' ? file : file.slice(0, file.size, 'video/mp4');
}
