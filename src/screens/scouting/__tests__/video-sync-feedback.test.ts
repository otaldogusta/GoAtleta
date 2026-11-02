import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { VideoSyncConflict, VideoSyncFooter, VideoSyncNotice, videoDraftNeedsSyncRetry, type VideoSyncStatus } from '../video/VideoSyncFeedback.web';

jest.mock('../video/StudioUI.web', () => ({
    StudioAction: (props: object) => jest.requireActual('react').createElement('button', props),
}));

let view: ReactTestRenderer | undefined;
afterEach(() => { act(() => { view?.unmount(); view = undefined; }); });

test.each([
    ['synced', 'Sincronizado'],
    ['pending', 'Salvo neste aparelho · sincronização pendente'],
    ['offline', 'Salvo neste aparelho · sem conexão'],
    ['unavailable', 'Salvo neste aparelho · sincronização indisponível'],
    ['error', 'Salvo neste aparelho · sincronização pendente'],
    ['loading', 'Abrindo análise sincronizada…'],
    ['conflict', 'Há versões diferentes desta análise'],
    ['forbidden', 'Sem permissão para sincronizar'],
] as [VideoSyncStatus, string][])('shows an accurate %s state without treating local persistence as cloud acknowledgement', (status, text) => {
    act(() => { view = create(createElement(VideoSyncFooter, { status, dirty: false, saving: false })); });
    expect(view!.root.findByProps({ role: 'status' }).children.join('')).toBe(text);
});

test('unsaved edits and an ongoing save never display a synchronized claim', () => {
    act(() => { view = create(createElement(VideoSyncFooter, { status: 'synced', dirty: true, saving: false })); });
    expect(view!.root.findByProps({ role: 'status' }).children.join('')).toBe('Alterações não salvas');
    act(() => view!.update(createElement(VideoSyncFooter, { status: 'synced', dirty: false, saving: true })));
    expect(view!.root.findByProps({ role: 'status' }).children.join('')).toBe('Salvando análise…');
});

test('a conflict waits for an explicit choice and disables repeated resolution while saving', async () => {
    const onResolve = jest.fn().mockResolvedValue(true);
    act(() => { view = create(createElement(VideoSyncConflict, { writable: true, saving: false, onResolve })); });
    expect(onResolve).not.toHaveBeenCalled();
    const local = view!.root.findByProps({ label: 'Manter versão deste aparelho' });
    const remote = view!.root.findByProps({ label: 'Usar versão sincronizada' });
    await act(async () => { local.props.onPress(); });
    expect(onResolve).toHaveBeenLastCalledWith('local');
    await act(async () => { remote.props.onPress(); });
    expect(onResolve).toHaveBeenLastCalledWith('remote');
    act(() => view!.update(createElement(VideoSyncConflict, { writable: true, saving: true, onResolve })));
    expect(view!.root.findAllByType('button').every(button => button.props.disabled)).toBe(true);
});

test('read-only viewing cannot choose or mutate a conflicting version', () => {
    const onResolve = jest.fn();
    act(() => { view = create(createElement(VideoSyncConflict, { writable: false, saving: false, onResolve })); });
    expect(view!.root.findAllByType('button')).toHaveLength(0);
    expect(onResolve).not.toHaveBeenCalled();
});

test('the save action remains available for retryable sync states even after local saving', () => {
    expect((['pending', 'offline', 'error', 'unavailable'] as VideoSyncStatus[]).every(videoDraftNeedsSyncRetry)).toBe(true);
    expect((['synced', 'loading', 'conflict', 'forbidden'] as VideoSyncStatus[]).some(videoDraftNeedsSyncRetry)).toBe(false);
});

test('schema feedback stays compact without repeated alerts and exposes explicit export/retry actions', async () => {
    const onRetry = jest.fn(async () => false), onExport = jest.fn();
    const props = { code: 'server-rejected' as const, error: 'O servidor recusou a análise.', dirty: false, saving: false, firstStart: 47.640, onRetry, onExport };
    act(() => { view = create(createElement(VideoSyncNotice, props)); });
    expect(view!.root.findAllByProps({ role: 'alert' })).toHaveLength(0);
    expect(view!.root.findAllByProps({ label: 'Tentar sincronizar a análise' })).toHaveLength(0);
    expect(view!.root.findByType('small').children.join('')).toContain('Salvo neste aparelho');
    act(() => view!.root.findByProps({ label: 'Ver detalhes da sincronização' }).props.onPress());
    expect(view!.root.findAllByType('small').some(node => node.children.join('').includes('00:47.640'))).toBe(true);
    expect(onRetry).not.toHaveBeenCalled(); expect(onExport).not.toHaveBeenCalled();
    act(() => view!.root.findByProps({ label: 'Exportar cópia da análise' }).props.onPress());
    await act(async () => view!.root.findByProps({ label: 'Tentar sincronizar a análise' }).props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1); expect(onExport).toHaveBeenCalledTimes(1);
    act(() => view!.update(createElement(VideoSyncNotice, { ...props, saving: true, dirty: true })));
    expect(view!.root.findByProps({ label: 'Tentar sincronizar a análise' }).props.disabled).toBe(true);
    expect(view!.root.findAllByType('small')[0].children.join('')).toContain('Alterações ainda na tela');
});
