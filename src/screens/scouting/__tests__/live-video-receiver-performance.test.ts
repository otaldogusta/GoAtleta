import { Buffer, Blob as NodeBlob } from 'node:buffer';
import { createHash, webcrypto } from 'node:crypto';
import { createLiveVideoReceiver } from '../live/live-video-transfer';
import { LIVE_VIDEO_PART_SIZE, liveVideoKey, loadVideoBlob } from '../live/live-video-storage';

const scope = { userId: 'performance-user', org: 'performance-org', classId: 'performance-class' };
const session = { id: 'performance-session', recordingId: 'performance-recording', scope, ended: true, recordingState: 'stopped' as const };

/** A deterministic I/O service-time model, not a claim of physical browser throughput.
 * Each read costs 2 ms and each committed transaction costs 3 ms. Requests retain
 * their real async event ordering; overlays copy only touched keys and commit atomically.
 */
function latencyIdb() {
    const databases = new Map<string, Map<string, Map<string, any>>>();
    const metrics = { simulatedMs: 0, reads: 0, puts: 0, commits: 0, transactions: 0, authorizationReads: 0, opens: 0 };
    const clone = (value: any): any => value instanceof ArrayBuffer ? value.slice(0)
        : Array.isArray(value) ? value.map(clone)
        : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) : value;
    const factory = { open(name: string) {
        metrics.opens++;
        let stores = databases.get(name);
        const fresh = !stores;
        if (!stores) { stores = new Map(); databases.set(name, stores); }
        const database = {
            close() {},
            objectStoreNames: { contains: (store: string) => stores!.has(store) },
            createObjectStore(store: string) { stores!.set(store, new Map()); return { createIndex() {} }; },
            transaction(names: string[]) {
                metrics.transactions++;
                const overlay = new Map(names.map(store => [store, new Map<string, any>()]));
                let outstanding = 0, aborted = false, committed = false;
                const tx: any = {
                    error: null,
                    abort() { if (aborted || committed) return; aborted = true; queueMicrotask(() => tx.onabort?.()); },
                    objectStore(store: string) {
                        if (!overlay.has(store)) throw new Error('Store outside transaction scope');
                        const pending = overlay.get(store)!;
                        function request(operation: () => unknown, read = true) {
                            const req: any = {}; outstanding++;
                            queueMicrotask(() => {
                                if (aborted) return;
                                try {
                                    if (read) { metrics.reads++; metrics.simulatedMs += 2; }
                                    req.result = operation(); req.onsuccess?.();
                                } catch (error) { req.error = tx.error = error; req.onerror?.(); tx.onerror?.(); tx.abort(); }
                                outstanding--;
                                queueMicrotask(() => {
                                    if (outstanding || aborted || committed) return;
                                    committed = true;
                                    overlay.forEach((changes, key) => changes.forEach((value, record) => stores!.get(key)!.set(record, value)));
                                    metrics.commits++; metrics.simulatedMs += 3; tx.oncomplete?.();
                                });
                            });
                            return req;
                        }
                        return {
                            get: (key: string) => request(() => clone(pending.has(key) ? pending.get(key) : stores!.get(store)!.get(key))),
                            put: (value: any, key: string) => request(() => { metrics.puts++; pending.set(key, clone(value)); return key; }, false),
                            index: () => ({ count: (owner: string) => request(() => {
                                let count = 0;
                                stores!.get(store)!.forEach((value, key) => { if (!pending.has(key) && value.owner === owner) count++; });
                                pending.forEach(value => { if (value.owner === owner) count++; });
                                return count;
                            }) }),
                        };
                    },
                };
                return tx;
            },
        };
        const req: any = { result: database };
        queueMicrotask(() => { if (fresh) req.onupgradeneeded?.(); req.onsuccess?.(); });
        return req;
    } };
    return { factory, metrics, databases };
}

test.each(['legacy','batch'] as const)('receiver %s measures a 4 MiB committed copy with declared IDB latency and bounded part windows', async mode => {
    const descriptors = Object.fromEntries(['indexedDB', 'crypto', 'Blob'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    const memory = latencyIdb(), partCount = 512, bytes = partCount * LIVE_VIDEO_PART_SIZE;
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: memory.factory });
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
    Object.defineProperty(globalThis, 'Blob', { configurable: true, value: NodeBlob });
    const replies: Record<string, unknown>[] = [], unsafeAcks: unknown[] = [];
    const key = liveVideoKey(scope, session.id, session.recordingId);
    const receiver = createLiveVideoReceiver({ scope,
        resolveSession: async () => {
            // Equivalent to loadLiveHostSession's one get plus completed readonly tx.
            memory.metrics.authorizationReads++; memory.metrics.simulatedMs += 5;
            await Promise.resolve(); return session;
        },
        send: message => {
            replies.push(message);
            if (message.kind === 'video-ack') {
                const committed = memory.databases.get('goatleta-scouting-live-videos-v1')?.get('videos')?.get(key);
                if (!committed || committed.nextPart < Number(message.nextPart)) unsafeAcks.push(message);
            }
        },
    });
    try {
        await receiver.handle({ kind: 'video-offer', transferId: 'performance-transfer', recordingId: session.recordingId,
            mimeType: 'video/webm', bytes, partSize: LIVE_VIDEO_PART_SIZE, partCount });
        const expectedHash = createHash('sha256');
        const frames = Array.from({ length: partCount }, (_, index) => {
            const data = Buffer.alloc(LIVE_VIDEO_PART_SIZE, index % 251);
            expectedHash.update(data);
            return { kind: 'video-part', transferId: 'performance-transfer', recordingId: session.recordingId,
                index, data: data.toString('base64'), sha256: createHash('sha256').update(data).digest('hex') };
        });
        const window = mode === 'batch' ? 8 : 4;
        for (let index = 0; index < partCount; index += window) {
            const pending = frames.slice(index, index + window);
            const messages = mode === 'legacy' ? pending : [0,4].map(offset => ({kind:'video-parts',transferId:'performance-transfer',recordingId:session.recordingId,
                parts:pending.slice(offset,offset+4).map(({index,data,sha256})=>({index,data,sha256}))}));
            await Promise.all(messages.map(message => receiver.handle(message)));
        }
        await receiver.handle({ kind: 'video-complete', transferId: 'performance-transfer', recordingId: session.recordingId });
        const measured = { ...memory.metrics };
        expect(unsafeAcks).toEqual([]);
        expect(replies.at(-1)).toMatchObject({ kind: 'video-saved', nextPart: partCount });
        expect(memory.databases.get('goatleta-scouting-live-videos-v1')?.get('parts')?.size).toBe(partCount);
        expect(measured.authorizationReads).toBe(mode === 'legacy' ? 1540 : 388);
        expect(measured.commits).toBe(mode === 'legacy' ? 514 : 130);
        expect(measured.simulatedMs).toBe(mode === 'legacy' ? 10272 : 2592);
        const saved = await loadVideoBlob(scope, session.id, session.recordingId);
        expect(saved?.size).toBe(bytes);
        const restored = Buffer.from(await saved!.arrayBuffer());
        expect(createHash('sha256').update(restored).digest('hex')).toBe(expectedHash.digest('hex'));
        console.info('receiver-io-benchmark', JSON.stringify({ mode, bytes, partCount, window, readMs: 2, commitMs: 3, ...measured,
            simulatedMiBPerSecond: Number(((bytes / 1048576) / (measured.simulatedMs / 1000)).toFixed(3)) }));
    } finally {
        receiver.dispose();
        for (const name of ['indexedDB', 'crypto', 'Blob']) {
            const descriptor = descriptors[name];
            if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
        }
    }
});
