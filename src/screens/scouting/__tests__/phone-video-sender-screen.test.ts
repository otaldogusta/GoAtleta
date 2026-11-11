import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import PhoneVideoSenderScreen from '../video/PhoneVideoSenderScreen.web';
import { connectPhoneVideoSender } from '../video/phone-video-pairing.web';
import { sendPhoneVideo } from '../video/phone-video-transfer.web';

jest.mock('../video/phone-video-pairing.web', () => ({ connectPhoneVideoSender: jest.fn() }));
jest.mock('../video/phone-video-transfer.web', () => ({ ...jest.requireActual('../video/phone-video-transfer.web'), sendPhoneVideo: jest.fn() }));
jest.mock('../../../ui/app-theme', () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock('../../../observability/perf', () => ({
    markRender: jest.fn(),
    measureAsync: (_name: string, work: () => Promise<unknown>) => work(),
}));
jest.mock('../video/studio-styles', () => ({ studioStyles: '' }));
jest.mock('../video/StudioUI.web', () => ({ StudioAction: (props: object) => jest.requireActual('react').createElement('button', props) }));

const id = '12345678-1234-1234-1234-123456789abc';
const code = 'a'.repeat(64);
const savedLocation = Object.getOwnPropertyDescriptor(window, 'location');
const savedHistory = Object.getOwnPropertyDescriptor(window, 'history');
const savedDocument = Object.getOwnPropertyDescriptor(window, 'document');
const savedAdd = window.addEventListener, savedRemove = window.removeEventListener;
const replaceState = jest.fn();
let view: ReactTestRenderer;

function mount(hash: string) {
    Object.defineProperty(window, 'location', { configurable: true, value: { hash, pathname: '/scouting/enviar-video', search: '' } });
    Object.defineProperty(window, 'history', { configurable: true, value: { state: null, replaceState } });
    window.addEventListener = jest.fn(); window.removeEventListener = jest.fn();
    act(() => { view = create(createElement(PhoneVideoSenderScreen)); });
}

beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'document', { configurable: true, value: {} });
});
afterEach(() => {
    act(() => view.unmount());
    if (savedLocation) Object.defineProperty(window, 'location', savedLocation);
    else Reflect.deleteProperty(window, 'location');
    if (savedHistory) Object.defineProperty(window, 'history', savedHistory);
    else Reflect.deleteProperty(window, 'history');
    if (savedDocument) Object.defineProperty(window, 'document', savedDocument);
    else Reflect.deleteProperty(window, 'document');
    window.addEventListener = savedAdd; window.removeEventListener = savedRemove;
});

test('removes the QR credential before connecting and sends only the MP4 chosen by the user', async () => {
    mount(`#id=${id}&code=${code}`);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/scouting/enviar-video');
    expect(connectPhoneVideoSender).not.toHaveBeenCalled();
    const file = { name: 'jogo.mp4', size: 500 } as File, channel = { close: jest.fn() };
    (connectPhoneVideoSender as jest.Mock).mockResolvedValue(channel);
    (sendPhoneVideo as jest.Mock).mockImplementation(async (_channel, _file, options) => options.onProgress(500, 500));
    const input = view.root.findByType('input');
    expect(input.props.accept).toBe('video/mp4,.mp4');
    act(() => input.props.onChange({ target: { files: [file], value: 'picked' } }));
    expect(connectPhoneVideoSender).not.toHaveBeenCalled();
    await act(async () => { view.root.findByProps({ label: 'Enviar MP4' }).props.onPress(); });
    expect(connectPhoneVideoSender).toHaveBeenCalledWith(id, code, expect.any(AbortSignal));
    expect(sendPhoneVideo).toHaveBeenCalledWith(channel, file, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(view.root.findByProps({ role: 'status' }).children.join('')).toContain('Original entregue');
});

test('rejects a malformed QR without reusing an earlier QR in the same document', () => {
    mount(`#id=${id}&code=${code}`);
    expect(view.root.findByProps({ label: 'Escolher MP4' })).toBeDefined();
    act(() => view.unmount());
    replaceState.mockClear();

    mount(`#id=${id}&code=${code}&code=${code}`);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/scouting/enviar-video');
    expect(view.root.findByProps({ role: 'alert' }).children.join('')).toContain('Abra um novo QR');
    expect(view.root.findAllByType('input')).toHaveLength(0);
    expect(connectPhoneVideoSender).not.toHaveBeenCalled();
});

test('keeps the initial QR across route remounts and requires a new QR in a fresh document', () => {
    Object.defineProperty(window, '__goAtletaPhoneVideoFragment', {
        configurable: true, value: `#id=${id}&code=${code}`,
    });
    mount('');
    expect(view.root.findByProps({ label: 'Escolher MP4' })).toBeDefined();
    expect(Reflect.has(window, '__goAtletaPhoneVideoFragment')).toBe(false);

    act(() => view.unmount());
    mount('');
    expect(view.root.findByProps({ label: 'Escolher MP4' })).toBeDefined();

    act(() => view.unmount());
    Object.defineProperty(window, 'document', { configurable: true, value: {} });
    mount('');
    expect(view.root.findByProps({ role: 'alert' }).children.join('')).toContain('Abra um novo QR');
    expect(view.root.findAllByType('input')).toHaveLength(0);
    expect(connectPhoneVideoSender).not.toHaveBeenCalled();
});

test('keeps the selected MP4 when a hash change has no new QR', () => {
    Object.defineProperty(window, '__goAtletaPhoneVideoFragment', {
        configurable: true, value: `#id=${id}&code=${code}`,
    });
    mount('');
    act(() => view.root.findByType('input').props.onChange({
        target: { files: [{ name: 'jogo.mp4', size: 500 }], value: 'picked' },
    }));
    const listener = jest.mocked(window.addEventListener).mock.calls.find(([type]) => type === 'hashchange')?.[1];
    if (typeof listener !== 'function') throw new Error('Expected a hashchange listener');
    act(() => listener(new Event('hashchange')));
    expect(view.root.findByProps({ label: 'Enviar MP4' })).toBeDefined();
    expect(connectPhoneVideoSender).not.toHaveBeenCalled();
});

test('rejects an oversized MP4 without consuming the QR capability', () => {
    mount(`#id=${id}&code=${code}`);
    act(() => view.root.findByType('input').props.onChange({ target: { files: [{ name: 'jogo.mp4', size: 24 * 1024 ** 3 + 1 }], value: 'picked' } }));
    expect(view.root.findByProps({ role: 'alert' }).children.join('')).toContain('24 GiB');
    expect(view.root.findAllByProps({ label: 'Enviar MP4' })).toHaveLength(0);
    expect(connectPhoneVideoSender).not.toHaveBeenCalled();
});
