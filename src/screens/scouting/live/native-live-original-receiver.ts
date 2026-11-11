import type { LiveHostScope, LiveHostSession } from './live-storage';
import type { LiveVideoStatus } from './live-video-storage';
import {
    NATIVE_ORIGINAL_FINAL_BLOCK, NATIVE_ORIGINAL_LIVE_BLOCK, nativeOriginalId, nativeOriginalSize, openNativeOriginal,
} from './native-live-original-storage';

export type NativeOriginalSession = {session: LiveHostSession; roomId: string};
const MAX_FRAGMENT_BYTES = 32 * 1024;
const MAX_ENCODED_FRAGMENT = 4 * Math.ceil(MAX_FRAGMENT_BYTES / 3);
const MAX_QUEUED_BYTES = 2 * NATIVE_ORIGINAL_FINAL_BLOCK;
const BAD_RANGE = 'Faixa inválida na cópia do vídeo original.';
const CANCELED = 'Cópia do vídeo cancelada.';
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
type File = Awaited<ReturnType<typeof openNativeOriginal>>;
type Range = {offset:number; bytes:number; sha256:string};
type Fragments = {bytes:Uint8Array<ArrayBuffer>; written:number};
type Transfer = {
    recordingId:string; transferId:string; roomId:string; sessionId:string;
    file?:File; bytes:number; finalized:boolean; verified:number; repair?:Range; fragments?:Fragments;
};

const messageFields: Record<string, readonly string[]> = {
    'native-original-offer':['bytes','finalized'],
    'native-original-data':['offset','data'],
    'native-original-commit':['offset','bytes','sha256'],
    'native-original-check':['offset','bytes','sha256'],
};
const envelopeFields = ['kind','recordingId','transferId'];
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const asRange = (value: Record<string, unknown>, offset: number, bytes: number): Range => {
    if (value.offset !== offset || value.bytes !== bytes || bytes <= 0 || typeof value.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(value.sha256)) throw new Error(BAD_RANGE);
    return {offset, bytes, sha256:value.sha256};
};

export function createNativeOriginalReceiver({scope, resolveSession, send, onProgress, open = openNativeOriginal}: {
    scope:LiveHostScope;
    resolveSession:(recordingId:string) => Promise<NativeOriginalSession|null>;
    send:(value:Record<string, unknown>) => void;
    onProgress:(value:LiveVideoStatus) => void;
    open?:typeof openNativeOriginal;
}) {
    let active: Transfer | undefined, disposed = false, queuedBytes = 0;
    let chain = Promise.resolve();
    const current = (owner: Transfer) => !disposed && active === owner;
    const authorize = async (recordingId: string, owner?: Transfer) => {
        const target = await resolveSession(recordingId);
        if (disposed || owner && !current(owner)) throw new Error(CANCELED);
        const session = target?.session;
        if (!target || !session || !nativeOriginalId(target.roomId) || session.recordingId !== recordingId || session.deletedAt || session.recordingState === 'error'
            || session.scope.userId !== scope.userId || session.scope.org !== scope.org || session.scope.classId !== scope.classId
            || owner && (owner.roomId !== target.roomId || owner.sessionId !== session.id)) throw new Error('Gravação indisponível para esta conexão.');
        if (owner?.finalized && (!session.ended || session.recordingState !== 'stopped')) throw new Error('Aguarde a confirmação do fim da gravação.');
        return target;
    };
    const ack = (owner: Transfer, extra: {needsData?:true; error?:string} = {}) => {
        if (current(owner)) send({kind:'native-original-ack', recordingId:owner.recordingId, transferId:owner.transferId, offset:owner.file?.offset ?? 0, verified:owner.verified, ...extra});
    };
    const publish = (owner: Transfer) => { if (current(owner) && owner.file) onProgress(owner.file.status()); };

    async function acceptOffer(value: Record<string, unknown>, recordingId: string, transferId: string) {
        if (!nativeOriginalSize(value.bytes) || typeof value.finalized !== 'boolean' || (value.finalized ? value.bytes === 0 : value.bytes % NATIVE_ORIGINAL_LIVE_BLOCK !== 0)) throw new Error('Tamanho do original inválido.');
        const {session, roomId} = await authorize(recordingId);
        if (value.finalized && (!session.ended || session.recordingState !== 'stopped')) throw new Error('Aguarde a confirmação do fim da gravação.');
        if (!value.finalized && session.ended) throw new Error('Aguarde o original finalizado.');
        let owner = active;
        if (owner?.recordingId !== recordingId || owner.roomId !== roomId || owner.sessionId !== session.id || !owner.file) {
            await owner?.file?.close();
            if (disposed) return;
            owner = {recordingId, transferId, roomId, sessionId:session.id, bytes:value.bytes, finalized:value.finalized, verified:0};
            active = owner;
            const own = owner;
            const file = await open({scope, roomId, sessionId:session.id, recordingId}, async () => { await authorize(recordingId, own); });
            if (!current(owner)) { await file.close(); return; }
            owner.file = file;
        }
        owner.transferId = transferId;
        owner.finalized = value.finalized;
        owner.bytes = value.bytes;
        owner.repair = undefined;
        owner.fragments = undefined;
        const file = owner.file!;
        await authorize(recordingId, owner);
        await file.offer(value.bytes, value.finalized, () => current(owner));
        owner.verified = file.verified;
        if (file.ready) {
            await file.close();
        } else if (owner.finalized && owner.verified === owner.bytes) {
            // The final range can commit immediately before a channel closes.
            await file.complete(() => current(owner));
        }
        await authorize(recordingId, owner);
        publish(owner);
        ack(owner);
    }

    function appendFragment(owner: Transfer, value: Record<string, unknown>) {
        const expected = owner.finalized ? owner.repair : {offset:owner.file!.offset, bytes:NATIVE_ORIGINAL_LIVE_BLOCK};
        const {data} = value;
        if (!expected || expected.offset + expected.bytes > owner.bytes || typeof data !== 'string' || !data.length
            || data.length > MAX_ENCODED_FRAGMENT || !BASE64.test(data)) throw new Error(BAD_RANGE);
        const written = owner.fragments?.written ?? 0;
        const decoded = atob(data);
        if (!decoded.length || decoded.length > MAX_FRAGMENT_BYTES || value.offset !== expected.offset + written || written + decoded.length > expected.bytes) throw new Error(BAD_RANGE);
        const fragments = owner.fragments ??= {bytes:new Uint8Array(expected.bytes), written:0};
        for (let index = 0; index < decoded.length; index++) fragments.bytes[written + index] = decoded.charCodeAt(index);
        fragments.written += decoded.length;
    }

    async function finishRange(owner: Transfer) {
        owner.verified = owner.file!.verified;
        if (owner.verified === owner.bytes) await owner.file!.complete(() => current(owner));
        await authorize(owner.recordingId, owner);
        publish(owner);
        ack(owner);
    }

    async function commit(owner: Transfer, value: Record<string, unknown>) {
        const file = owner.file!;
        const repair = owner.repair;
        if (owner.finalized && !repair) throw new Error(BAD_RANGE);
        const range = asRange(value, repair?.offset ?? file.offset, repair?.bytes ?? NATIVE_ORIGINAL_LIVE_BLOCK);
        const fragments = owner.fragments;
        if (!fragments || fragments.written !== range.bytes || range.offset + range.bytes > owner.bytes || repair && repair.sha256 !== range.sha256) throw new Error(BAD_RANGE);
        owner.fragments = undefined;
        owner.repair = undefined;
        await authorize(owner.recordingId, owner);
        await file.write(range.offset, fragments.bytes.buffer, range.sha256, () => current(owner));
        if (owner.finalized) await finishRange(owner);
        else {
            await authorize(owner.recordingId, owner);
            publish(owner);
            ack(owner);
        }
    }

    async function check(owner: Transfer, value: Record<string, unknown>) {
        if (!owner.finalized || owner.repair || owner.fragments) throw new Error(BAD_RANGE);
        const range = asRange(value, owner.verified, Math.min(NATIVE_ORIGINAL_FINAL_BLOCK, owner.bytes - owner.verified));
        await authorize(owner.recordingId, owner);
        const hash = await owner.file!.hash(range.offset, range.bytes);
        if (hash === range.sha256) {
            await owner.file!.verify(range.offset,range.bytes,()=>current(owner));
            await finishRange(owner);
        } else {
            await authorize(owner.recordingId, owner);
            owner.repair = range;
            ack(owner, {needsData:true});
        }
    }

    async function process(value: Record<string, unknown>, recordingId: string, transferId: string) {
        if (disposed) return;
        try {
            if (value.kind === 'native-original-offer') { await acceptOffer(value, recordingId, transferId); return; }
            const owner = active;
            if (!owner?.file || owner.recordingId !== recordingId || owner.transferId !== transferId || owner.file.ready) return;
            if (value.kind === 'native-original-data') appendFragment(owner, value);
            else if (value.kind === 'native-original-commit') await commit(owner, value);
            else await check(owner, value);
        } catch (failure) {
            if (disposed) return;
            const error = (failure instanceof Error ? failure.message : 'Não foi possível receber o vídeo original.').slice(0, 250);
            const owner = active;
            if (owner?.recordingId === recordingId && owner.transferId === transferId) {
                const authorized = await authorize(recordingId, owner).then(() => true, () => false);
                if (!current(owner)) return;
                if (authorized) {
                    const progress = owner.file?.status();
                    if (progress && progress.state !== 'ready') onProgress({...progress, state:'error', error});
                    ack(owner, {error});
                } else send({kind:'native-original-ack', recordingId, transferId, offset:0, verified:0, error:'Gravação indisponível para esta conexão.'});
                active = undefined;
                await owner.file?.close().catch(() => undefined);
            } else send({kind:'native-original-ack', recordingId, transferId, offset:0, verified:0, error});
        }
    }

    return {
        handle(value: unknown): Promise<void> {
            if (disposed || !isObject(value) || typeof value.kind !== 'string' || !Object.hasOwn(messageFields, value.kind)
                || !nativeOriginalId(value.recordingId) || !nativeOriginalId(value.transferId)) return Promise.resolve();
            const {kind, recordingId, transferId} = value;
            if (Object.keys(value).some(key => !envelopeFields.includes(key) && !messageFields[kind].includes(key))
                || 'offset' in value && typeof value.offset !== 'number' || 'bytes' in value && typeof value.bytes !== 'number'
                || 'finalized' in value && typeof value.finalized !== 'boolean' || 'data' in value && typeof value.data !== 'string'
                || 'sha256' in value && (typeof value.sha256 !== 'string' || value.sha256.length > 64)) return Promise.resolve();
            const size = 512 + (typeof value.data === 'string' ? value.data.length : 0);
            if (size > MAX_ENCODED_FRAGMENT + 512 || queuedBytes + size > MAX_QUEUED_BYTES) return Promise.resolve();
            queuedBytes += size;
            const next = chain.then(() => process(value, recordingId, transferId));
            chain = next.catch(() => undefined).finally(() => { queuedBytes -= size; });
            return chain;
        },
        dispose() {
            disposed = true;
            const file = active?.file;
            active = undefined;
            return Promise.all([chain, file?.close().catch(() => undefined)]).then(() => undefined);
        },
    };
}
