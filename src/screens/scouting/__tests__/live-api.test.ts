import { createLiveRoom, liveLocalAvailable, pollLiveSignals, sendLiveSignal } from '../live/live-api';

const roomId = '11111111-1111-4111-8111-111111111111';
const hostToken = 'a'.repeat(64);
const cameraToken = 'b'.repeat(64);
const fragment = `#room=${roomId}&token=${cameraToken}`;
const room = {
    roomId, hostToken, cameraToken, expiresAt: 2000000,
    localCameraUrl: `http://localhost:8096/camera${fragment}`,
    cameraUrl: `https://192.168.1.10:8097/camera${fragment}`,
};
const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
const request = jest.fn();

function setOrigin(origin: string) {
    Object.defineProperty(window, 'location', { configurable: true, value: { origin } });
}

beforeEach(() => {
    setOrigin('https://goatleta.com');
    request.mockReset().mockResolvedValue({ ok: true, json: async () => room });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: request });
});

afterEach(() => {
    if (originalLocation) Object.defineProperty(window, 'location', originalLocation);
    else Reflect.deleteProperty(window, 'location');
    if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
    else Reflect.deleteProperty(globalThis, 'fetch');
});

test('the hosted Studio creates a local room without sending browser credentials', async () => {
    const { signal } = new AbortController();
    await expect(createLiveRoom(signal)).resolves.toEqual(room);
    expect(request).toHaveBeenCalledWith('http://127.0.0.1:8096/rooms', expect.objectContaining({
        signal, method: 'POST', targetAddressSpace: 'loopback', credentials: 'omit', redirect: 'error',
        headers: { 'Content-Type': 'application/json', 'X-GoAtleta-Live': '1' }, body: '{}',
    }));
});

test('local development still allows the companion without LAN HTTPS', async () => {
    setOrigin('http://localhost:8081');
    const localRoom = { ...room, cameraUrl: null };
    request.mockResolvedValue({ ok: true, json: async () => localRoom });
    await expect(createLiveRoom(new AbortController().signal)).resolves.toEqual(localRoom);
    expect(JSON.stringify(request.mock.calls)).not.toContain(hostToken);
});

test('signaling keeps host capabilities in headers and preserves the negotiation generation', async () => {
    request.mockResolvedValue({ ok: true, json: async () => ({ cursor: 2, signals: [] }) });
    const { signal } = new AbortController();
    await pollLiveSignals(room, 2, signal);
    const answer = { type: 'answer', sdp: 'v=0', generation: 3 } as const;
    await sendLiveSignal(room, answer, signal);
    expect(request).toHaveBeenLastCalledWith(`http://127.0.0.1:8096/rooms/${roomId}/signals`, expect.objectContaining({
        headers: expect.objectContaining({ 'X-GoAtleta-Live-Role': 'host', 'X-GoAtleta-Live-Token': hostToken }),
        body: JSON.stringify(answer),
    }));
    expect(request.mock.calls.every(([url]) => !url.includes(hostToken))).toBe(true);
});

test.each(['https://www.goatleta.com', 'https://goatleta.com.example', 'http://goatleta.com'])('rejects the notebook API on %s', async origin => {
    setOrigin(origin);
    expect(liveLocalAvailable()).toBe(false);
    await expect(createLiveRoom(new AbortController().signal)).rejects.toThrow('Abra o Estúdio');
    expect(request).not.toHaveBeenCalled();
});

test.each([null, `https://goatleta.com:8097/camera${fragment}`, `https://192.168.1.10:8098/camera${fragment}`, `https://192.168.1.10:8097/camera${fragment}&token=${cameraToken}`, `https://192.168.1.10:8097/camera?token=private${fragment}`, `https://192.168.1.10:8097/camera#room=foreign&token=${cameraToken}`])('rejects an invalid camera QR from the hosted helper', async cameraUrl => {
    request.mockResolvedValue({ ok: true, json: async () => ({ ...room, cameraUrl }) });
    await expect(createLiveRoom(new AbortController().signal)).rejects.toThrow();
});
