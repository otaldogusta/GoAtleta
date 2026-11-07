import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import LiveCameraConnection, { type LiveCameraConnectionProps } from '../live/LiveCameraConnection.web';

jest.mock('react-native', () => {
    const React = jest.requireActual('react');
    return { Platform: { OS: 'web', select: (options: Record<string, unknown>) => options.web }, View: React.forwardRef(function MockAnchor(props: Record<string, unknown>, ref: unknown) { return React.createElement('anchor-view', { ...props, ref }, props.children); }) };
});
jest.mock('../../../ui/app-theme', () => ({ useAppTheme: () => ({ colors: { card: '#172237', inputBg: '#121c30', text: '#f0f4fb', muted: '#9aaac1', border: '#283548', primaryBg: '#36d986', dangerText: '#ffb5b5', warningText: '#ffd293' } }) }));
jest.mock('../../../observability/perf', () => ({ markRender: () => {}, measureAsync: (_name: string, work: () => Promise<unknown>) => work() }));
jest.mock('../../../ui/Pressable', () => ({ Pressable: (props: Record<string, unknown>) => jest.requireActual('react').createElement('button', props, props.children) }));
jest.mock('../../../ui/icon-registry', () => ({ GoAtletaIcon: (props: object) => jest.requireActual('react').createElement('icon', props) }));
jest.mock('../video/StudioUI.web', () => ({ StudioAction: (props: Record<string, unknown>) => jest.requireActual('react').createElement('button', props, props.children) }));
jest.mock('../../../ui/AnchoredDropdown', () => ({ AnchoredDropdown: (props: Record<string, unknown>) => props.visible && props.layout ? jest.requireActual('react').createElement('dropdown', props, props.children) : null }));

let view: ReactTestRenderer | undefined, props: LiveCameraConnectionProps;
let detailsNode: { open: boolean; querySelector: () => { focus: typeof summaryFocus } };
const triggerFocus = jest.fn(), dialogFocus = jest.fn(), summaryFocus = jest.fn();
const addListener = window.addEventListener, removeListener = window.removeEventListener;
let listeners: Map<string, Set<(event: unknown) => void>>;
const localCameraUrl = 'http://localhost:8096/camera#room=local-room&token=private-capability';
const nodeText = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : nodeText(child)).join('');
const action = (name: string) => view!.root.findAllByType('button').find(node => node.props.accessibilityLabel === name || node.props['aria-label'] === name || node.props.label === name)!;
const dialog = () => view!.root.findAllByProps({ role: 'dialog' });
const feedback = () => view!.root.findAll(node => node.type === 'p' && (node.props.role === 'status' || node.props.role === 'alert'));
const openHelp = () => act(() => action('Ajuda da conexão da câmera').props.onPress());
const update = (values: Partial<LiveCameraConnectionProps>) => act(() => { props = { ...props, ...values }; view!.update(createElement(LiveCameraConnection, props)); });
const mount = (values: Partial<LiveCameraConnectionProps> = {}) => {
    props = { hasRoom: true, qr: 'data:image/svg+xml,test', localCameraUrl, cameraReady: true, connected: false, capturePending: false, interrupted: false, checking: false, checkResult: null, checkDisabled: false, onCheck: jest.fn(), onCopy: jest.fn(async () => true), ...values };
    act(() => { view = create(createElement(LiveCameraConnection, props), { createNodeMock: node => node.type === 'anchor-view'
        ? { measureInWindow: (done: (x: number, y: number, width: number, height: number) => void) => done(200, 120, 44, 44), querySelector: () => ({ focus: triggerFocus }) }
        : node.type === 'details' ? (detailsNode = { open: !!node.props.open, querySelector: () => ({ focus: summaryFocus }) })
        : node.props.role === 'dialog' ? { focus: dialogFocus } : null }); });
};

beforeEach(() => {
    jest.clearAllMocks(); listeners = new Map();
    window.addEventListener = jest.fn((name, callback) => { const registered = listeners.get(name) ?? new Set(); registered.add(callback as (event: unknown) => void); listeners.set(name, registered); });
    window.removeEventListener = jest.fn((name, callback) => { listeners.get(name)?.delete(callback as (event: unknown) => void); });
});
afterEach(() => { if (view) act(() => { view!.unmount(); view = undefined; }); window.addEventListener = addListener; window.removeEventListener = removeListener; jest.useRealTimers(); });

test('pairing keeps one QR instruction and exposes an accessible local test link without copying or starting anything', () => {
    mount();
    expect(view!.root.findByType('details').props.open).toBe(true);
    expect(view!.root.findByType('img').props.alt).toBe('QR code para conectar a câmera do celular');
    expect(view!.root.findAllByType('p').map(nodeText)).toEqual(['Leia o QR no celular.']);
    const link = view!.root.findByType('a'); expect(link.props).toMatchObject({ href: localCameraUrl, target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Testar câmera neste computador' });
    expect(action('Copiar link da câmera')).toBeDefined(); expect(action('Ajuda da conexão da câmera')).toBeDefined();
    expect(props.onCopy).not.toHaveBeenCalled(); expect(props.onCheck).not.toHaveBeenCalled();
    update({ connected: true }); expect(view!.root.findByType('details').props.open).toBe(false);
});

test('a newly generated QR reopens manually collapsed connection details without repeating on ordinary updates', () => {
    mount({ hasRoom: false, qr: '' });
    detailsNode.open = false;
    update({ checking: true }); expect(detailsNode.open).toBe(false);
    update({ hasRoom: true, qr: 'data:image/svg+xml,new-room', checking: false });
    expect(detailsNode.open).toBe(true);
    detailsNode.open = false;
    update({ checkResult: 'Serviço disponível' }); expect(detailsNode.open).toBe(false);
    update({ qr: 'data:image/svg+xml,replacement-room' }); expect(detailsNode.open).toBe(true);
    expect(props.onCheck).not.toHaveBeenCalled(); expect(props.onCopy).not.toHaveBeenCalled();
});

test('a QR update does not force open a healthy connected camera', () => {
    mount({ connected: true }); expect(detailsNode.open).toBe(false);
    update({ qr: 'data:image/svg+xml,updated' }); expect(detailsNode.open).toBe(false);
    update({ interrupted: true }); expect(detailsNode.open).toBe(true);
});

test.each([false, true])('inline pairing shows QR only when needed and restores help focus without a disclosure (connected: %s)', connected => {
    mount({ inline: true, connected, portalToBodyOnWeb: false });
    expect(view!.root.findAllByType('details')).toHaveLength(0); expect(view!.root.findAllByType('summary')).toHaveLength(0);
    expect(view!.root.findAllByType('img')).toHaveLength(connected?0:1);
    expect(view!.root.findAllByType('a')).toHaveLength(connected?0:1);
    expect(!!action('Copiar link da câmera')).toBe(!connected); expect(props.onCopy).not.toHaveBeenCalled(); expect(props.onCheck).not.toHaveBeenCalled();
    openHelp(); expect(dialog()).toHaveLength(1);
    act(() => action('Fechar ajuda da conexão').props.onClick());
    expect(dialog()).toHaveLength(0); expect(triggerFocus).toHaveBeenCalledTimes(1); expect(summaryFocus).not.toHaveBeenCalled();
});

test('a healthy connection hides pairing QR and restores it after interruption without creating another room',()=>{
    mount({inline:true,connected:true});expect(view!.root.findAllByType('img')).toHaveLength(0);
    update({interrupted:true});expect(view!.root.findAllByType('img')).toHaveLength(0);
    expect(nodeText(action('Mostrar QR code da câmera'))).toBe('Mostrar QR');
    act(()=>action('Mostrar QR code da câmera').props.onPress());expect(view!.root.findByType('img').props.src).toBe(props.qr);
    update({interrupted:false});expect(view!.root.findAllByType('img')).toHaveLength(0);
    expect(props.onCheck).not.toHaveBeenCalled();expect(props.onCopy).not.toHaveBeenCalled();
});

test('a connected camera can show and hide the same QR using its secondary icon without replacing pairing',()=>{
    mount({inline:true,connected:true});const originalQr=props.qr;
    const show=action('Mostrar QR code da câmera');expect(show.props['aria-expanded']).toBe(false);
    act(()=>show.props.onPress());expect(view!.root.findByType('img').props.src).toBe(originalQr);
    expect(action('Ocultar QR code da câmera').props['aria-expanded']).toBe(true);expect(action('Copiar link da câmera')).toBeDefined();
    act(()=>action('Ocultar QR code da câmera').props.onPress());expect(view!.root.findAllByType('img')).toHaveLength(0);
    expect(props.qr).toBe(originalQr);expect(props.onCheck).not.toHaveBeenCalled();expect(props.onCopy).not.toHaveBeenCalled();
});

test('an interrupted capture keeps its warning outside the collapsible details', () => {
    mount({ connected: true, capturePending: true, interrupted: true });
    const warning = view!.root.findByProps({ role: 'alert' });
    expect(nodeText(warning)).toBe('A gravação pode continuar no celular. Não recarregue.');
    expect(warning.parent?.type).toBe('section'); expect(view!.root.findByType('details').props.open).toBe(true);
    update({ interrupted: false }); expect(view!.root.findAllByProps({ role: 'alert' })).toHaveLength(0);
});

test('copy waits for the real promise, blocks repeat clicks and confirms success with one status and a check icon', async () => {
    let finish!: (value: boolean) => void; mount({ onCopy: jest.fn(() => new Promise<boolean>(resolve => { finish = resolve; })) });
    act(() => action('Copiar link da câmera').props.onPress());
    expect(action('Copiar link da câmera').props.disabled).toBe(true); expect(feedback().map(nodeText)).toEqual(['Copiando…']);
    act(() => action('Copiar link da câmera').props.onPress()); expect(props.onCopy).toHaveBeenCalledTimes(1);
    await act(async () => { finish(true); await Promise.resolve(); });
    expect(action('Copiar link da câmera').props.disabled).toBe(false); expect(feedback().map(nodeText)).toEqual(['Link copiado']);
    expect(action('Copiar link da câmera').findByType('icon' as never).props.name).toBe('checkmark');
});

test('false and rejected copies show a generic failure without leaking the URL or accumulating statuses', async () => {
    mount({ onCopy: jest.fn().mockResolvedValueOnce(false).mockRejectedValueOnce(new Error(localCameraUrl)) });
    for (let attempt = 0; attempt < 2; attempt++) {
        await act(async () => { action('Copiar link da câmera').props.onPress(); await Promise.resolve(); });
        expect(feedback().map(nodeText)).toEqual(['Não foi possível copiar. Tente novamente.']);
        expect(nodeText(feedback()[0])).not.toContain('private-capability'); expect(feedback()[0].props.role).toBe('alert');
    }
});

test('a pending copy from a previous QR cannot confirm success for a new pairing', async () => {
    let finish!: (value: boolean) => void; mount({ onCopy: jest.fn(() => new Promise<boolean>(resolve => { finish = resolve; })) });
    act(() => action('Copiar link da câmera').props.onPress()); update({ qr: 'data:image/svg+xml,another-room' });
    expect(action('Copiar link da câmera').props.disabled).toBe(false); expect(feedback()).toHaveLength(0);
    await act(async () => { finish(true); await Promise.resolve(); }); expect(feedback()).toHaveLength(0);
});

test('text labels appear on keyboard focus and hover in portaled tooltips that contain no links', () => {
    jest.useFakeTimers();
    mount(); act(() => action('Copiar link da câmera').props.onFocus());
    const tooltip = view!.root.findByProps({ role: 'tooltip' }); expect(nodeText(tooltip)).toBe('Copiar link'); expect(tooltip.findAllByType('a')).toHaveLength(0);
    expect(view!.root.findByType('dropdown' as never).props.portalToBodyOnWeb).toBe(true);
    act(() => action('Copiar link da câmera').props.onBlur());
    act(() => jest.advanceTimersByTime(140)); expect(view!.root.findAllByProps({ role: 'tooltip' })).toHaveLength(0);
    act(() => view!.root.findByType('a').props.onMouseEnter()); expect(nodeText(view!.root.findByProps({ role: 'tooltip' }))).toBe('Testar câmera neste computador');
    act(() => view!.root.findByType('a').props.onMouseLeave());
    act(() => jest.advanceTimersByTime(140)); expect(view!.root.findAllByProps({ role: 'tooltip' })).toHaveLength(0);
});

test('a label remains available while the pointer travels into it and dismisses on request or after leaving', () => {
    jest.useFakeTimers(); mount();
    act(() => action('Copiar link da câmera').props.onHoverIn());
    act(() => action('Copiar link da câmera').props.onHoverOut());
    act(() => jest.advanceTimersByTime(100));
    act(() => view!.root.findByProps({ role: 'tooltip' }).props.onMouseEnter());
    act(() => jest.advanceTimersByTime(500)); expect(view!.root.findAllByProps({ role: 'tooltip' })).toHaveLength(1);
    act(() => view!.root.findByProps({ role: 'tooltip' }).props.onMouseLeave());
    act(() => jest.advanceTimersByTime(140)); expect(view!.root.findAllByProps({ role: 'tooltip' })).toHaveLength(0);
    act(() => action('Copiar link da câmera').props.onFocus());
    act(() => view!.root.findByType('dropdown' as never).props.onRequestClose()); expect(view!.root.findAllByProps({ role: 'tooltip' })).toHaveLength(0);
    act(() => action('Copiar link da câmera').props.onHoverIn()); act(() => action('Copiar link da câmera').props.onHoverOut());
    act(() => { view!.unmount(); view = undefined; }); expect(jest.getTimerCount()).toBe(0);
});

test('help is an interactive dialog and pointer or focus travel does not dismiss its certificate link', () => {
    mount(); openHelp();
    const trigger = action('Ajuda da conexão da câmera'), popup = dialog()[0], dropdown = view!.root.findByType('dropdown' as never);
    expect(trigger.props['aria-expanded']).toBe(true); expect(trigger.props['aria-controls']).toBe(popup.props.id); expect(trigger.props['aria-haspopup']).toBe('dialog');
    expect(popup.props['aria-modal']).toBe('false'); expect(dialogFocus).toHaveBeenCalledTimes(1);
    expect(dropdown.props).toMatchObject({ density: 'popover', surface: 'solid', portalToBodyOnWeb: true, fitContent: true });
    act(() => trigger.props.onHoverOut()); act(() => trigger.props.onBlur()); expect(dialog()).toHaveLength(1);
    expect(popup.findAllByType('li')).toHaveLength(3); expect(nodeText(popup)).toContain('O pareamento continua entre gravações.');
    const certificate = popup.findByType('a'); expect(certificate.props).toMatchObject({ href: 'http://127.0.0.1:8096/certificate.crt', download: 'go-atleta-live-ca.crt' });
    act(() => action('Fechar ajuda da conexão').props.onClick()); expect(dialog()).toHaveLength(0); expect(triggerFocus).toHaveBeenCalledTimes(1);
});

test('Escape returns focus while outside dismissal lets focus continue naturally', () => {
    mount(); openHelp();
    act(() => { for (const callback of listeners.get('keydown') ?? []) callback({ key: 'Escape' }); view!.root.findByType('dropdown' as never).props.onRequestClose(); });
    expect(dialog()).toHaveLength(0); expect(triggerFocus).toHaveBeenCalledTimes(1);
    triggerFocus.mockClear(); openHelp(); act(() => view!.root.findByType('dropdown' as never).props.onRequestClose());
    expect(dialog()).toHaveLength(0); expect(triggerFocus).not.toHaveBeenCalled();
});

test('an enclosing camera panel can dismiss only help through its canonical close callback and restore help-trigger focus', () => {
    const onPopoverElement=jest.fn();mount({onPopoverElement});openHelp();
    const [element,close]=onPopoverElement.mock.calls.findLast(([node])=>node!==null)!;
    expect(element).toBeDefined();expect(close).toEqual(expect.any(Function));
    act(()=>close());
    expect(dialog()).toHaveLength(0);expect(triggerFocus).toHaveBeenCalledTimes(1);
    expect(onPopoverElement).toHaveBeenLastCalledWith(null,undefined);
});

test('connecting while help is open keeps its trigger visible and closing returns focus to the summary', () => {
    mount(); openHelp(); update({ connected: true });
    expect(view!.root.findByType('details').props.open).toBe(true); expect(dialog()).toHaveLength(1);
    act(() => action('Fechar ajuda da conexão').props.onClick());
    expect(view!.root.findByType('details').props.open).toBe(false); expect(dialog()).toHaveLength(0);
    expect(summaryFocus).toHaveBeenCalledTimes(1); expect(triggerFocus).not.toHaveBeenCalled();
});

test('certificate instructions depend on camera readiness and never appear in a tooltip', () => {
    mount({ cameraReady: false }); openHelp(); expect(dialog()[0].findAllByType('a')).toHaveLength(0);
    update({ cameraReady: true }); expect(dialog()[0].findByType('a').props.download).toBe('go-atleta-live-ca.crt');
});

test('without a room the service check retains real progress, disabled state, result and help', () => {
    mount({ hasRoom: false, qr: '', localCameraUrl: undefined });
    expect(view!.root.findAllByType('img')).toHaveLength(0); expect(action('Copiar link da câmera')).toBeUndefined();
    act(() => action('Verificar serviço ao vivo').props.onPress()); expect(props.onCheck).toHaveBeenCalledTimes(1);
    update({ checking: true, checkResult: 'Resultado anterior' }); expect(action('Verificar serviço ao vivo').props.disabled).toBe(true); expect(nodeText(action('Verificar serviço ao vivo'))).toBe('Verificando…'); expect(feedback()).toHaveLength(0);
    act(() => action('Verificar serviço ao vivo').props.onPress()); expect(props.onCheck).toHaveBeenCalledTimes(1);
    update({ checking: false, checkResult: 'Serviço disponível · câmera pronta.' }); expect(feedback().map(nodeText)).toEqual(['Serviço disponível · câmera pronta.']);
    update({ checkDisabled: true }); expect(action('Verificar serviço ao vivo').props.disabled).toBe(true); act(() => action('Verificar serviço ao vivo').props.onPress()); expect(props.onCheck).toHaveBeenCalledTimes(1);
    openHelp(); expect(dialog()).toHaveLength(1);
});

test('a missing camera QR exposes no dead copy action and a non-http test destination is not rendered as a link', () => {
    mount({ qr: '', localCameraUrl: 'javascript:blocked' });
    expect(action('Copiar link da câmera')).toBeUndefined();expect(props.onCopy).not.toHaveBeenCalled();
    expect(view!.root.findAllByType('a')).toHaveLength(0); expect(nodeText(view!.root.findByProps({ className: 'lc-prompt' }))).toBe('Configure o acesso seguro para usar o celular.');
});
