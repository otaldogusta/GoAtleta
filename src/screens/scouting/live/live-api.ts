export type LiveServiceConfig = { cameraReady: boolean; cameraOrigin: string | null; hostOrigin: string; roomTtlMs: number };
export type LiveRoom = { roomId: string; hostToken: string; cameraToken: string; cameraUrl: string | null; localCameraUrl: string; expiresAt: number };
export type LiveSignal = { sequence: number; from: 'camera' | 'host'; type: 'offer' | 'answer' | 'ice'; generation: number; sdp?: string; candidate?: RTCIceCandidateInit | null };
export type LiveRoomStatus = { expiresAt: number; cameraConnected: boolean; cameraClientId: string | null; generation: number; closed: boolean };
export type LiveSignalInput = { type: 'answer'; sdp: string; generation: number } | { type: 'ice'; candidate: RTCIceCandidateInit | null; generation: number };
const BASE = 'http://127.0.0.1:8096';
const roomId = /^[a-f0-9-]{36}$/;

export function liveLocalAvailable() {
    return typeof window !== 'undefined' && __DEV__ && ['http://localhost:8081','http://127.0.0.1:8081'].includes(window.location.origin);
}
async function request(path: string, signal: AbortSignal, room?: LiveRoom, body?: unknown, method?: string): Promise<unknown> {
    if (!liveLocalAvailable()) throw new Error('O modo ao vivo está disponível neste computador de desenvolvimento.');
    try {
        const response = await fetch(`${BASE}${path}`, { signal, method: method ?? (body === undefined ? 'GET' : 'POST'), headers: {
            'Content-Type': 'application/json', 'X-GoAtleta-Live': '1', ...(room ? { 'X-GoAtleta-Live-Role': 'host', 'X-GoAtleta-Live-Token': room.hostToken } : {}),
        }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        const value = await response.json();
        if (!response.ok) throw new Error(typeof value.error === 'string' ? value.error : 'Não foi possível conectar a câmera.');
        return value;
    } catch (failure) {
        if (signal.aborted || failure instanceof Error && failure.name !== 'TypeError') throw failure;
        throw new Error('Serviço ao vivo desconectado. Inicie o serviço local para conectar a câmera.');
    }
}
function path(room: LiveRoom) {
    if (!roomId.test(room.roomId)) throw new Error('Conexão ao vivo inválida.');
    return `/rooms/${room.roomId}`;
}
export async function getLiveServiceConfig(signal: AbortSignal): Promise<LiveServiceConfig> {
    const value = await request('/config', signal) as LiveServiceConfig;
    if (typeof value.cameraReady !== 'boolean' || value.cameraOrigin !== null && (typeof value.cameraOrigin !== 'string' || !value.cameraOrigin.startsWith('https://')) || !Number.isFinite(value.roomTtlMs)) throw new Error('Configuração de câmera inválida.');
    return value;
}
export async function createLiveRoom(signal: AbortSignal): Promise<LiveRoom> {
    const value = await request('/rooms', signal, undefined, {}) as LiveRoom;
    if (!value || !roomId.test(value.roomId) || !/^[a-f0-9]{64}$/.test(value.hostToken) || !/^[a-f0-9]{64}$/.test(value.cameraToken) || !Number.isFinite(value.expiresAt)) throw new Error('O serviço retornou uma conexão inválida.');
    for (const [address,local] of [[value.cameraUrl,false],[value.localCameraUrl,true]] as const) {
        if (address === null && !local) continue;
        if (typeof address !== 'string') throw new Error('Endereço de câmera inválido.');
        const camera = new URL(address), fragment = new URLSearchParams(camera.hash.slice(1));
        if (local ? camera.origin !== 'http://localhost:8096' && camera.origin !== BASE : camera.protocol !== 'https:') throw new Error('Endereço seguro da câmera inválido.');
        if (camera.pathname !== '/camera' || camera.search || fragment.get('room') !== value.roomId || fragment.get('token') !== value.cameraToken) throw new Error('Endereço seguro da câmera inválido.');
    }
    return value;
}
export async function pollLiveSignals(room: LiveRoom, after: number, signal: AbortSignal): Promise<{cursor: number; signals: LiveSignal[]}> {
    const value = await request(`${path(room)}/signals?after=${after}`, signal, room) as {cursor: number; signals: LiveSignal[]};
    if (!Number.isSafeInteger(value.cursor) || value.cursor < after || !Array.isArray(value.signals) || value.signals.length > 128 || value.signals.some(item => !Number.isSafeInteger(item.sequence) || !Number.isSafeInteger(item.generation) || item.generation < 1 || item.from !== 'camera' || !['offer','answer','ice'].includes(item.type))) throw new Error('Resposta de conexão inválida.');
    return value;
}
export const sendLiveSignal = (room: LiveRoom, body: LiveSignalInput, signal: AbortSignal) => request(`${path(room)}/signals`, signal, room, body);
export const heartbeatLiveRoom = (room: LiveRoom, signal: AbortSignal) => request(`${path(room)}/heartbeat`, signal, room, {});
export const closeLiveRoom = (room: LiveRoom, signal: AbortSignal) => request(path(room), signal, room, undefined, 'DELETE');
export const getLiveRoomStatus = async (room: LiveRoom, signal: AbortSignal) => request(`${path(room)}/status`, signal, room) as Promise<LiveRoomStatus>;
