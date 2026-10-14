import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { DriveTrackingSetup } from '../video/DriveTrackingSetup.web';
import { getDriveTrackingHealth, inspectDriveVideo, trackDriveVideo } from '../../../api/scouting-video-drive';
import { newVideoDocument, type VideoDocument } from '../../../core/scouting-video';
import { processScoutingVideoUrl } from '../video/video-processing.web';
import { isSessionIdentityCurrent } from '../../../auth/session';
import { createHash } from 'crypto';
import { TextEncoder } from 'util';
jest.mock('../../../api/scouting-video-drive', () => ({ getDriveTrackingHealth: jest.fn(), inspectDriveVideo: jest.fn(), trackDriveVideo: jest.fn(), configureDriveTrackingCredential: jest.fn() }));
jest.mock('../../../auth/session', () => ({ getSessionIdentity: () => ({ userId: 'coach', generation: 1 }), isSessionIdentityCurrent: jest.fn(() => true) }));
jest.mock('../video/video-processing.web', () => ({ processScoutingVideoUrl: jest.fn() }));
jest.mock('../video/StudioUI.web', () => ({ StudioDialog: ({ children }: { children: unknown }) => children, StudioAction: (props: object) => jest.requireActual('react').createElement('button', props) }));
const media = { fingerprint: 'a'.repeat(64), name: 'Vídeo do Drive.mp4', duration: 60, width: 640, height: 480 };
const candidate = { fileId: 'exampleVideoFileIdentifier', media, playbackUrl: 'https://drive.usercontent.google.com/download?id=exampleVideoFileIdentifier&export=download&confirm=t' };
const result = { media, provider: 'roboflow', model: 'volleyball_v2/3', sampledFps: 30, predictions: { frame_offset: [30], time_offset: [1], volleyball_v2: [{ predictions: [{ class: 'ball', confidence: .9, x: 100, y: 200, width: 8, height: 8 }] }] } };
const scope = { userId: 'coach', org: 'org', classId: 'class', sessionId: 'session', targetFingerprint: 'youtube:abcdefghijk' };
const doc = (): VideoDocument => ({ ...newVideoDocument({ youtubeId: 'abcdefghijk', fingerprint: scope.targetFingerprint, name: 'Jogo', duration: 60, width: 640, height: 480 }, 'rally'), contacts: [{ id: 'contact', time: 2, team: 'us', skill: 'Saque', athlete: '', studentId: null, outcome: '' }] });
let view: ReactTestRenderer | undefined;
const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto'), encoderDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'TextEncoder');
beforeEach(() => {
    jest.clearAllMocks(); (getDriveTrackingHealth as jest.Mock).mockResolvedValue({ ready: true }); (inspectDriveVideo as jest.Mock).mockResolvedValue(candidate); (trackDriveVideo as jest.Mock).mockResolvedValue(result);
    (isSessionIdentityCurrent as jest.Mock).mockReturnValue(true);
    Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder });
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { subtle: { digest: jest.fn(async (_algorithm, bytes) => Uint8Array.from(createHash('sha256').update(bytes).digest()).buffer) } } });
});
afterEach(() => {
    act(() => view?.unmount()); view = undefined;
    if (cryptoDescriptor) Object.defineProperty(globalThis, 'crypto', cryptoDescriptor); else Reflect.deleteProperty(globalThis, 'crypto');
    if (encoderDescriptor) Object.defineProperty(globalThis, 'TextEncoder', encoderDescriptor); else Reflect.deleteProperty(globalThis, 'TextEncoder');
});
function mount(document = doc(), props: object = {}) {
    const onApply = jest.fn(), onPlayback = jest.fn();
    act(() => { view = create(createElement(DriveTrackingSetup, { doc: document, scope, onApply, onPlayback, onClose: jest.fn(), ...props })); });
    return { onApply, onPlayback, document };
}
const button = (label: string) => view!.root.findByProps({ label });
async function select() {
    act(() => view!.root.findByProps({ 'aria-label': 'Link do vídeo no Drive' }).props.onChange({ target: { value: 'https://drive.google.com/file/d/exampleVideoFileIdentifier/view' } }));
    await act(async () => { button('Conferir vídeo do Drive').props.onPress(); });
}
const confirm = () => act(() => view!.root.findAllByType('input').find(node => node.props.type === 'checkbox')!.props.onChange({ target: { checked: true } }));

test('cloud processing requires same-edit confirmation and returns a separate explicit Apply action', async () => {
    const { onApply, document } = mount(); await select();
    expect(trackDriveVideo).not.toHaveBeenCalled();
    expect(button('Gerar tracking na nuvem pelo Drive').props.disabled).toBe(true);
    confirm(); await act(async () => { button('Gerar tracking na nuvem pelo Drive').props.onPress(); });
    expect(onApply).not.toHaveBeenCalled();
    expect(view!.root.findAllByType('input').some(node => node.props.type === 'file')).toBe(false);
    act(() => button('Aplicar tracking do Drive').props.onPress());
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ model: 'roboflow-volleyball-v2-3', source: expect.objectContaining({ fingerprint: media.fingerprint }) }), media, candidate.playbackUrl);
    expect(document.contacts).toHaveLength(1); expect(document.rallies).toHaveLength(1); expect(document.analysis).toBeUndefined();
});

test('existing tracking playback requires explicit confirmation and does not regenerate or apply analysis', async () => {
    const document = doc();
    document.analysis = { model: 'vballnet-v2b-local', sampledFps: 30, positions: [{ time: 1, x: .2, y: .3 }], cuts: [], source: { ...media, fingerprint: 'b'.repeat(64), offsetSeconds: 0 } };
    const { onApply, onPlayback } = mount(document); await select();
    expect(button('Reproduzir Drive com tracking existente').props.disabled).toBe(true);
    confirm(); act(() => button('Reproduzir Drive com tracking existente').props.onPress());
    expect(onPlayback).toHaveBeenCalledWith(media, candidate.playbackUrl);
    expect(trackDriveVideo).not.toHaveBeenCalled(); expect(onApply).not.toHaveBeenCalled();
    expect(document.analysis.source?.fingerprint).toBe('b'.repeat(64));
});

test('unmount aborts the cloud job and never applies a late result', async () => {
    let jobSignal: AbortSignal | undefined, complete!: (value: unknown) => void;
    (trackDriveVideo as jest.Mock).mockImplementation((_candidate, _scope, signal) => { jobSignal = signal; return new Promise(resolve => { complete = resolve; }); });
    const { onApply } = mount(); await select(); confirm();
    act(() => button('Gerar tracking na nuvem pelo Drive').props.onPress());
    await act(async () => view!.unmount()); view = undefined;
    expect(jobSignal?.aborted).toBe(true);
    await act(async () => complete(result)); expect(onApply).not.toHaveBeenCalled();
});

test('scope changes discard a completed candidate and do not apply it to another session', async () => {
    const { onApply } = mount(); await select(); confirm();
    await act(async () => { button('Gerar tracking na nuvem pelo Drive').props.onPress(); });
    act(() => view!.update(createElement(DriveTrackingSetup, { doc: doc(), scope: { ...scope, sessionId: 'other' }, onApply, onClose: jest.fn() })));
    expect(view!.root.findAllByProps({ label: 'Aplicar tracking do Drive' })).toHaveLength(0);
    expect(onApply).not.toHaveBeenCalled();
});

test('streaming processing is an explicit separate choice and preserves annotations until Apply', async () => {
    const local = { model: 'vballnet-v2b-browser-1', sampledFps: 30, positions: [{ time: 1, x: .3, y: .4 }], cuts: [20] };
    (processScoutingVideoUrl as jest.Mock).mockResolvedValue(local);
    const { onApply, document } = mount(); await select();
    expect(processScoutingVideoUrl).not.toHaveBeenCalled();
    expect(button('Processar neste aparelho sem salvar vídeo').props.disabled).toBe(true);
    confirm(); await act(async () => button('Processar neste aparelho sem salvar vídeo').props.onPress());
    expect(processScoutingVideoUrl).toHaveBeenCalledWith(candidate.playbackUrl, media.duration, expect.any(AbortSignal), expect.any(Function), { resumeKey: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(trackDriveVideo).not.toHaveBeenCalled(); expect(onApply).not.toHaveBeenCalled();
    act(() => button('Aplicar tracking do Drive').props.onPress());
    expect(onApply.mock.calls[0][0].model).toBe('vballnet-v2b-browser-1');
    expect(onApply.mock.calls[0][0].source.fingerprint).toBe(media.fingerprint);
    expect(document.contacts).toHaveLength(1); expect(document.rallies).toHaveLength(1);
});

test('a cancelled streaming run ignores late positions without trying a cloud fallback', async () => {
    let signal: AbortSignal | undefined, complete!: (value: unknown) => void;
    (processScoutingVideoUrl as jest.Mock).mockImplementation((_url, _duration, run) => { signal = run; return new Promise(resolve => { complete = resolve; }); });
    const { onApply } = mount(); await select(); confirm();
    expect(view!.root.findByType('video').props.src).toBe(candidate.playbackUrl);
    await act(async () => button('Processar neste aparelho sem salvar vídeo').props.onPress());
    expect(view!.root.findAllByType('video')).toHaveLength(0);
    act(() => button('Cancelar tracking do Drive').props.onPress());
    expect(signal?.aborted).toBe(true);
    await act(async () => complete({ model: 'vballnet-v2b-browser-1', sampledFps: 30, positions: [{ time: 1, x: .2, y: .3 }], cuts: [] }));
    expect(view!.root.findByType('video').props.src).toBe(candidate.playbackUrl);
    expect(view!.root.findAllByProps({ label: 'Aplicar tracking do Drive' })).toHaveLength(0);
    expect(trackDriveVideo).not.toHaveBeenCalled(); expect(onApply).not.toHaveBeenCalled();
});

test('changing session identity while computing the resume scope never starts streaming or exposes a partial candidate', async () => {
    let complete!: (value: ArrayBuffer) => void;
    (crypto.subtle.digest as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    (processScoutingVideoUrl as jest.Mock).mockClear();
    const { onApply } = mount(); await select(); confirm();
    act(() => button('Processar neste aparelho sem salvar vídeo').props.onPress());
    (isSessionIdentityCurrent as jest.Mock).mockReturnValue(false);
    await act(async () => complete(new Uint8Array(32).buffer));
    expect(processScoutingVideoUrl).not.toHaveBeenCalled(); expect(onApply).not.toHaveBeenCalled();
    expect(view!.root.findAllByProps({ label: 'Aplicar tracking do Drive' })).toHaveLength(0);
});


test('embedded Drive uses the shared link field and changing it discards the inspected candidate', async () => {
    const onApply = jest.fn(), onBusyChange = jest.fn();
    const props = { doc: doc(), scope, embedded: true, inputLink: 'https://drive.google.com/file/d/exampleVideoFileIdentifier/view', onApply, onBusyChange, onClose: jest.fn() };
    act(() => { view = create(createElement(DriveTrackingSetup, props)); });
    expect(view!.root.findAllByType('input').filter(n => n.props.type === 'url')).toHaveLength(0);
    let finish!: (value: unknown) => void;
    (inspectDriveVideo as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    act(() => button('Conferir vídeo do Drive').props.onPress());
    expect(onBusyChange).toHaveBeenCalledWith(true);
    await act(async () => finish(candidate));
    expect(inspectDriveVideo).toHaveBeenCalledWith(props.inputLink, scope, expect.any(AbortSignal), expect.any(Function));
    expect(onBusyChange).toHaveBeenCalledWith(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(view!.root.findAllByType('video')).toHaveLength(1);
    act(() => view!.update(createElement(DriveTrackingSetup, { ...props, inputLink: 'https://drive.google.com/file/d/anotherVideoFileIdentifier/view' })));
    expect(view!.root.findAllByType('video')).toHaveLength(0);
    expect(view!.root.findAllByProps({ label: 'Aplicar tracking do Drive' })).toHaveLength(0);
    expect(onApply).not.toHaveBeenCalled();
});


test('editing the shared link immediately hides an error belonging to its previous value', async () => {
    const props = { doc: doc(), scope, embedded: true, inputLink: 'https://drive.google.com/drive/folders/example', onApply: jest.fn(), onClose: jest.fn() };
    (inspectDriveVideo as jest.Mock).mockRejectedValueOnce(new Error('Use o link do arquivo, não da pasta.'));
    act(() => { view = create(createElement(DriveTrackingSetup, props)); });
    await act(async () => button('Conferir vídeo do Drive').props.onPress());
    expect(view!.root.findAllByProps({ role: 'alert' })).toHaveLength(1);
    act(() => view!.update(createElement(DriveTrackingSetup, { ...props, inputLink: 'https://drive.google.com/file/d/exampleVideoFileIdentifier/view' })));
    expect(view!.root.findAllByProps({ role: 'alert' })).toHaveLength(0);
    expect(props.onApply).not.toHaveBeenCalled();
});
