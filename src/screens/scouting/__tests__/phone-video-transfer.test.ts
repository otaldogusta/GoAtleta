import { Buffer, File as NodeFile } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { readStoredPhoneVideo, receivePhoneVideo, removeStoredPhoneVideo, sendPhoneVideo } from '../video/phone-video-transfer.web';

type Packet = string | ArrayBuffer;
type Listener = (event: {data?: Packet}) => void;

function connectedChannels() {
    function end() {
        const listeners = new Map<string, Set<Listener>>();
        const transcript: Packet[] = [];
        let inject: ((data: Packet) => Packet) | undefined;
        let sendTo: (event: {data: Packet}) => void;
        const emit = (name: string, event: {data?: Packet} = {}) => listeners.get(name)?.forEach(listener => listener(event));
        const channel = {
            readyState:'open', ordered:true, maxPacketLifeTime:null, maxRetransmits:null, bufferedAmount:0,
            addEventListener(name: string, listener: Listener) {
                if (!listeners.has(name)) listeners.set(name, new Set());
                listeners.get(name)!.add(listener);
            },
            removeEventListener(name: string, listener: Listener) { listeners.get(name)?.delete(listener); },
            send(value: Packet) {
                const packet = typeof value === 'string' ? value : Uint8Array.from(new Uint8Array(value)).buffer;
                transcript.push(packet);
                queueMicrotask(() => sendTo({data:inject?.(packet) ?? packet}));
            },
        } as unknown as RTCDataChannel;
        return {
            channel, transcript, emit,
            connect(other: ReturnType<typeof end>) { sendTo = event => other.emit('message', event); },
            transform(change: (data: Packet) => Packet) { inject = change; },
        };
    }
    const mobile = end(), notebook = end();
    mobile.connect(notebook);
    notebook.connect(mobile);
    return {mobile, notebook};
}

function storageFixture() {
    const files = new Map<string, {parts: ArrayBuffer[]}>();
    const calls = {created:0, wrote:0, closed:0, aborted:0, failWrite:false};
    const directory = {
        async getFileHandle(name: string, options?: {create:boolean}) {
            let file = files.get(name);
            if (!file) {
                if (!options?.create) throw new DOMException('Arquivo ausente.', 'NotFoundError');
                calls.created++;
                file = {parts:[] as ArrayBuffer[]};
                files.set(name, file);
            }
            const parts = file.parts;
            return {
                async createWritable() {
                    return {
                        async write(value: ArrayBuffer) {
                            if (calls.failWrite) throw new DOMException('Disco cheio.', 'QuotaExceededError');
                            parts.push(value);
                            calls.wrote++;
                        },
                        async close() { calls.closed++; },
                        async abort() { calls.aborted++; },
                    };
                },
                async getFile() { return new NodeFile(parts, name); },
            };
        },
        async removeEntry(name: string) {
            if (!files.delete(name)) throw new DOMException('Arquivo ausente.', 'NotFoundError');
        },
    };
    const getDirectory = async () => ({getDirectoryHandle:async () => directory});
    return {files, calls, getDirectory};
}

const saved = new Map(['navigator', 'crypto', 'File'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let storage: ReturnType<typeof storageFixture>;
beforeEach(() => {
    storage = storageFixture();
    const globals = {navigator:{storage:{getDirectory:storage.getDirectory}}, crypto:webcrypto, File:NodeFile};
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, {configurable:true, value});
});
afterEach(() => {
    for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
    }
});

const fileFrom = (bytes: Uint8Array<ArrayBuffer>) => new NodeFile([bytes], 'Partida.mp4', {type:'video/mp4'}) as unknown as File;

test('offers the original before reading it, verifies bounded blocks, and keeps it until release', async () => {
    const {mobile, notebook} = connectedChannels();
    const signal = new AbortController().signal;
    const bytes = new Uint8Array(1024 ** 2 + 11);
    bytes[0] = 129;
    bytes[1024 ** 2] = 243;
    const file = fileFrom(bytes);
    const progress: number[] = [];
    const wholeRead = jest.spyOn(file, 'arrayBuffer');
    const received = receivePhoneVideo(notebook.channel, {signal, accept:async offer => {
        expect(offer).toEqual({name:'Partida.mp4', bytes:bytes.length});
        expect(storage.calls.created).toBe(0);
        expect(mobile.transcript).toHaveLength(1);
        return true;
    }});
    const sent = sendPhoneVideo(mobile.channel, file, {signal, onProgress:offset => progress.push(offset)});
    const [result] = await Promise.all([received, sent]);
    expect(result.file.name).toBe(file.name);
    expect(result.file.size).toBe(file.size);
    const original = new Uint8Array(await result.file.arrayBuffer());
    expect(original[0]).toBe(129);
    expect(original[1024 ** 2]).toBe(243);
    expect(wholeRead).not.toHaveBeenCalled();
    expect(progress).toEqual([0, 1024 ** 2, bytes.length]);
    expect(mobile.transcript.at(-1)).toBe('{"kind":"receipt"}');
    expect(mobile.transcript.filter(item => typeof item !== 'string').every(item => item.byteLength <= 32 * 1024)).toBe(true);
    expect(storage.calls).toMatchObject({created:1, wrote:2, closed:1, aborted:0});
    expect(storage.files.size).toBe(1);
    const reopened = await readStoredPhoneVideo(result.storageId, file.name, file.size);
    expect(Buffer.from(await reopened.arrayBuffer()).equals(Buffer.from(original))).toBe(true);
    await expect(readStoredPhoneVideo(result.storageId, file.name, file.size + 1)).rejects.toThrow('guardar o vídeo');
    await expect(readStoredPhoneVideo(result.storageId, '../Partida.mp4', file.size)).rejects.toThrow('Escolha um MP4');
    await expect(removeStoredPhoneVideo('../Partida.mp4')).rejects.toThrow('conferir os dados');
    expect(storage.files.size).toBe(1);
    await removeStoredPhoneVideo(result.storageId);
    await result.release();
    expect(storage.files.size).toBe(0);
    await expect(readStoredPhoneVideo(result.storageId, file.name, file.size)).rejects.toMatchObject({name:'NotFoundError'});
});

test('leaves the disk untouched when the notebook declines', async () => {
    const {mobile, notebook} = connectedChannels();
    const signal = new AbortController().signal;
    const receives = receivePhoneVideo(notebook.channel, {signal, accept:async () => false});
    const sends = sendPhoneVideo(mobile.channel, fileFrom(new Uint8Array([1, 2])), {signal});
    const results = await Promise.allSettled([receives, sends]);
    expect(results.every(item => item.status === 'rejected' && item.reason.message.includes('recusou'))).toBe(true);
    expect(storage.calls.created).toBe(0);
});

test('rejects changed bytes and removes the temporary original', async () => {
    const {mobile, notebook} = connectedChannels();
    const signal = new AbortController().signal;
    mobile.transform(packet => typeof packet === 'string' ? packet : new Uint8Array(packet.byteLength).fill(7).buffer);
    const receives = receivePhoneVideo(notebook.channel, {signal, accept:async () => true});
    const sends = sendPhoneVideo(mobile.channel, fileFrom(new Uint8Array([1, 2])), {signal});
    const results = await Promise.allSettled([receives, sends]);
    expect(results.every(item => item.status === 'rejected' && item.reason.message.includes('conferir'))).toBe(true);
    expect(storage.calls).toMatchObject({wrote:0, closed:0, aborted:1});
    expect(storage.files.size).toBe(0);
});

test('cancels and releases a partial write', async () => {
    const {mobile, notebook} = connectedChannels();
    const receiver = new AbortController();
    const receives = receivePhoneVideo(notebook.channel, {signal:receiver.signal, accept:async () => true,
        onProgress:offset => { if (offset > 0) receiver.abort(); }});
    const sends = sendPhoneVideo(mobile.channel, fileFrom(new Uint8Array(1024 ** 2 + 1)), {signal:new AbortController().signal});
    const results = await Promise.allSettled([receives, sends]);
    expect(results.every(item => item.status === 'rejected' && item.reason.message.includes('cancelado'))).toBe(true);
    expect(storage.calls).toMatchObject({wrote:1, closed:0, aborted:1});
    expect(storage.files.size).toBe(0);
});

test('reports failed storage writes to both peers', async () => {
    storage.calls.failWrite = true;
    const {mobile, notebook} = connectedChannels();
    const signal = new AbortController().signal;
    const receives = receivePhoneVideo(notebook.channel, {signal, accept:async () => true});
    const sends = sendPhoneVideo(mobile.channel, fileFrom(new Uint8Array([1, 2])), {signal});
    const results = await Promise.allSettled([receives, sends]);
    expect(results.every(item => item.status === 'rejected' && item.reason.message.includes('espaço'))).toBe(true);
    expect(storage.files.size).toBe(0);
});
