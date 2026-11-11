export type PhoneVideoOffer = { name: string; bytes: number };
export type PhoneVideoReceived = { file: File; storageId: string; release: () => Promise<void> };

type Progress = (bytes: number, total: number) => void;
type Payload = string | ArrayBuffer;
const DIRECTORY = 'goatleta-phone-video-v1';
const MAX_BYTES = 24 * 1024 ** 3;
const BLOCK_BYTES = 1024 * 1024;
const FRAGMENT_BYTES = 32 * 1024;
const CONTROL_BYTES = 2048;
const PAUSE_BYTES = 256 * 1024;
const WAIT_MS = 45000;
const CONSENT_MS = 180000;

const messages = {
    canceled: 'Envio cancelado.',
    declined: 'O notebook recusou o vídeo.',
    disconnected: 'A conexão foi interrompida. Abra um novo envio para tentar novamente.',
    invalid: 'Não foi possível conferir os dados do vídeo enviado.',
    storage: 'O notebook não conseguiu guardar o vídeo. Confira o espaço disponível no navegador.',
    timeout: 'O envio ficou sem resposta. Abra um novo envio para tentar novamente.',
} as const;

type FailureCode = keyof typeof messages;
class TransferError extends Error {
    constructor(readonly code: FailureCode) { super(messages[code]); }
}

function wireFor(channel: RTCDataChannel, signal: AbortSignal) {
    if (!channel.ordered || channel.maxPacketLifeTime != null || channel.maxRetransmits != null) {
        throw new TransferError('invalid');
    }
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = PAUSE_BYTES / 2;
    const queue: Payload[] = [];
    let queuedBytes = 0;
    let failure: TransferError | undefined;
    let notify: (() => void) | undefined;
    const wake = () => notify?.();
    const fail = (code: FailureCode) => { failure ??= new TransferError(code); wake(); };
    const cancel = () => fail('canceled');
    const disconnect = () => fail('disconnected');
    const size = (value: Payload) => typeof value === 'string' ? value.length * 2 : value.byteLength;
    const incoming = ({data}: MessageEvent<unknown>) => {
        if (failure) return;
        if (!(typeof data === 'string' && data.length <= CONTROL_BYTES)
            && !(data instanceof ArrayBuffer && data.byteLength > 0 && data.byteLength <= FRAGMENT_BYTES)) {
            fail('invalid');
            return;
        }
        if (queuedBytes + size(data) > BLOCK_BYTES + 2 * CONTROL_BYTES || queue.length >= BLOCK_BYTES / FRAGMENT_BYTES + 4) {
            fail('invalid');
            return;
        }
        queuedBytes += size(data);
        queue.push(data);
        wake();
    };
    channel.addEventListener('message', incoming);
    channel.addEventListener('open', wake);
    channel.addEventListener('bufferedamountlow', wake);
    channel.addEventListener('close', disconnect);
    channel.addEventListener('error', disconnect);
    signal.addEventListener('abort', cancel);
    if (signal.aborted) cancel();
    if (channel.readyState === 'closed' || channel.readyState === 'closing') disconnect();

    const waitFor = <T,>(read: () => T | undefined, timeout = WAIT_MS): Promise<T> => new Promise((resolve, reject) => {
        const timer = setTimeout(() => { notify = undefined; reject(new TransferError('timeout')); }, timeout);
        notify = () => {
            const value = failure ? undefined : read();
            if (value === undefined && !failure) return;
            clearTimeout(timer);
            notify = undefined;
            if (failure) reject(failure);
            else resolve(value as T);
        };
        wake();
    });
    const assertOpen = () => {
        if (failure) throw failure;
        if (channel.readyState !== 'open') throw new TransferError('disconnected');
    };

    return {
        ready: () => waitFor(() => channel.readyState === 'open' ? true : undefined),
        assertOpen,
        async consent(decision: Promise<boolean>) {
            let result: boolean | undefined;
            void decision.then(accepted => { result = accepted === true; wake(); }, () => fail('canceled'));
            return waitFor(() => result, CONSENT_MS);
        },
        async read(timeout?: number) {
            const value = await waitFor(() => queue.shift(), timeout);
            queuedBytes -= size(value);
            return value;
        },
        async send(value: Payload) {
            await waitFor(() => channel.bufferedAmount <= PAUSE_BYTES ? true : undefined);
            assertOpen();
            if (typeof value === 'string') channel.send(value);
            else channel.send(value);
        },
        notifyFailure(code: FailureCode) {
            if (channel.readyState === 'open') {
                try { channel.send(JSON.stringify({kind:'error', code})); } catch { /* The peer is already leaving. */ }
            }
        },
        dispose() {
            channel.removeEventListener('message', incoming);
            channel.removeEventListener('open', wake);
            channel.removeEventListener('bufferedamountlow', wake);
            channel.removeEventListener('close', disconnect);
            channel.removeEventListener('error', disconnect);
            signal.removeEventListener('abort', cancel);
        },
    };
}

function control(payload: Payload) {
    if (typeof payload !== 'string') throw new TransferError('invalid');
    let value: Record<string, unknown>;
    try { value = JSON.parse(payload); } catch { throw new TransferError('invalid'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TransferError('invalid');
    if (value.kind === 'error' && typeof value.code === 'string' && Object.hasOwn(messages, value.code)) {
        throw new TransferError(value.code as FailureCode);
    }
    return value;
}

function mp4Offer(name: unknown, bytes: unknown): PhoneVideoOffer {
    if (typeof name !== 'string' || name.length > 180 || !/^.+\.mp4$/i.test(name)
        || /[/\\\x00-\x1f\x7f]/.test(name) || typeof bytes !== 'number' || !Number.isSafeInteger(bytes)
        || bytes < 1 || bytes > MAX_BYTES) {
        throw new Error('Escolha um MP4 de até 24 GiB.');
    }
    return {name, bytes};
}

export const phoneVideoOffer = (file: File) => mp4Offer(file.name, file.size);

async function sha256(value: ArrayBuffer) {
    const digest = await crypto.subtle.digest('SHA-256', value);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function errorCode(error: unknown, signal: AbortSignal): FailureCode {
    return signal.aborted ? 'canceled' : error instanceof TransferError ? error.code : 'invalid';
}

export async function sendPhoneVideo(channel: RTCDataChannel, file: File, options: { signal: AbortSignal; onProgress?: Progress }): Promise<void> {
    const offer = phoneVideoOffer(file);
    const wire = wireFor(channel, options.signal);
    try {
        await wire.ready();
        await wire.send(JSON.stringify({kind:'offer', ...offer}));
        const consent = control(await wire.read(CONSENT_MS));
        if (consent.kind !== 'accept') throw new TransferError('invalid');
        options.onProgress?.(0, offer.bytes);
        let offset = 0;
        while (offset < offer.bytes) {
            const end = Math.min(offset + BLOCK_BYTES, offer.bytes);
            const block = await file.slice(offset, end).arrayBuffer();
            if (block.byteLength !== end - offset) throw new TransferError('invalid');
            await wire.send(JSON.stringify({kind:'block', offset, bytes:block.byteLength, sha256:await sha256(block)}));
            for (let start = 0; start < block.byteLength; start += FRAGMENT_BYTES) {
                await wire.send(block.slice(start, start + FRAGMENT_BYTES));
            }
            const acknowledgment = control(await wire.read());
            if (acknowledgment.kind !== (end === offer.bytes ? 'received' : 'ack') || acknowledgment.offset !== end) {
                throw new TransferError('invalid');
            }
            offset = end;
            options.onProgress?.(offset, offer.bytes);
        }
        await wire.send(JSON.stringify({kind:'receipt'})).catch(() => undefined);
    } catch (error) {
        wire.notifyFailure(errorCode(error, options.signal));
        throw error;
    } finally { wire.dispose(); }
}

async function videoDirectory(create = false) {
    if (typeof navigator.storage?.getDirectory !== 'function') throw new TransferError('storage');
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(DIRECTORY, {create});
}

function storedName(storageId: string) {
    if (typeof storageId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(storageId)) {
        throw new TransferError('invalid');
    }
    return `${storageId}.mp4`;
}

async function readVideoFile(handle: FileSystemFileHandle, offer: PhoneVideoOffer) {
    const snapshot = await handle.getFile();
    if (snapshot.size !== offer.bytes) throw new TransferError('storage');
    return new File([snapshot], offer.name, {type:'video/mp4', lastModified:snapshot.lastModified});
}

export async function readStoredPhoneVideo(storageId: string, name: string, bytes: number): Promise<File> {
    const path = storedName(storageId);
    const offer = mp4Offer(name, bytes);
    const directory = await videoDirectory();
    return readVideoFile(await directory.getFileHandle(path), offer);
}

export async function removeStoredPhoneVideo(storageId: string): Promise<void> {
    const path = storedName(storageId);
    try { await (await videoDirectory()).removeEntry(path); }
    catch (error) { if (!(error instanceof Error) || error.name !== 'NotFoundError') throw error; }
}

async function videoTarget() {
    const directory = await videoDirectory(true);
    const storageId = crypto.randomUUID();
    const handle = await directory.getFileHandle(storedName(storageId), {create:true});
    let removal: Promise<void> | undefined;
    const release = () => removal ??= removeStoredPhoneVideo(storageId).catch(error => { removal = undefined; throw error; });
    return {handle, storageId, release};
}

export async function receivePhoneVideo(channel: RTCDataChannel, options: {
    signal: AbortSignal; accept: (offer: PhoneVideoOffer) => Promise<boolean>; onProgress?: Progress;
}): Promise<PhoneVideoReceived> {
    const wire = wireFor(channel, options.signal);
    let target: Awaited<ReturnType<typeof videoTarget>> | undefined;
    let output: FileSystemWritableFileStream | undefined;
    let keep = false;
    try {
        await wire.ready();
        const initial = control(await wire.read(CONSENT_MS));
        if (initial.kind !== 'offer') throw new TransferError('invalid');
        const offer = mp4Offer(initial.name, initial.bytes);
        if (!await wire.consent(options.accept(offer))) throw new TransferError('declined');
        try {
            target = await videoTarget();
            output = await target.handle.createWritable();
        } catch { throw new TransferError('storage'); }
        await wire.send(JSON.stringify({kind:'accept'}));
        options.onProgress?.(0, offer.bytes);
        let offset = 0;
        while (offset < offer.bytes) {
            const header = control(await wire.read());
            const count = Math.min(BLOCK_BYTES, offer.bytes - offset);
            if (header.kind !== 'block' || header.offset !== offset || header.bytes !== count
                || typeof header.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(header.sha256)) {
                throw new TransferError('invalid');
            }
            const block = new Uint8Array(count);
            for (let start = 0; start < count; start += FRAGMENT_BYTES) {
                const fragment = await wire.read();
                if (typeof fragment === 'string') { control(fragment); throw new TransferError('invalid'); }
                if (fragment.byteLength !== Math.min(FRAGMENT_BYTES, count - start)) throw new TransferError('invalid');
                block.set(new Uint8Array(fragment), start);
            }
            if (await sha256(block.buffer) !== header.sha256) throw new TransferError('invalid');
            wire.assertOpen();
            try { await output.write(block.buffer); } catch { throw new TransferError('storage'); }
            offset += count;
            options.onProgress?.(offset, offer.bytes);
            if (offset < offer.bytes) await wire.send(JSON.stringify({kind:'ack', offset}));
        }
        let file: File;
        try {
            await output.close();
            output = undefined;
            file = await readVideoFile(target.handle, offer);
        } catch { throw new TransferError('storage'); }
        await wire.send(JSON.stringify({kind:'received', offset}));
        try {
            if (control(await wire.read(3000)).kind !== 'receipt') throw new TransferError('invalid');
        } catch (error) {
            // The verified file is ready even if the phone leaves after the final acknowledgment.
            if (!(error instanceof TransferError) || error.code !== 'disconnected' && error.code !== 'timeout') throw error;
        }
        if (options.signal.aborted) throw new TransferError('canceled');
        keep = true;
        return {file, storageId:target.storageId, release:target.release};
    } catch (error) {
        wire.notifyFailure(errorCode(error, options.signal));
        throw error;
    } finally {
        wire.dispose();
        await output?.abort().catch(() => undefined);
        if (!keep) await target?.release().catch(() => undefined);
    }
}
