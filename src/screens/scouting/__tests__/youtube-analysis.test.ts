import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { YouTubeAnalysis } from '../video/YouTubeAnalysis.web';
import { analyzeYouTube } from '../../../api/scouting-video-ai';
import { newVideoDocument } from '../../../core/scouting-video';
import { loadAiCheckpoints, saveAiCheckpoints } from '../video/video-analysis-checkpoints';
jest.mock('../../../api/scouting-video-ai', () => ({ analyzeYouTube: jest.fn() }));
jest.mock('../video/StudioUI.web', () => ({ StudioDialog: ({ children }: { children: unknown }) => children, StudioAction: (props: unknown) => jest.requireActual('react').createElement('button', props as object) }));
jest.mock('../video/video-analysis-checkpoints', () => ({ loadAiCheckpoints: jest.fn().mockResolvedValue([]), saveAiCheckpoints: jest.fn().mockResolvedValue(undefined) }));
const doc = newVideoDocument({ youtubeId: 'mdfgd1K3HTc', fingerprint: 'youtube:mdfgd1K3HTc', duration: 60, width: 1280, height: 720, name: 'Video' }, 'first');

beforeEach(() => { jest.clearAllMocks(); (loadAiCheckpoints as jest.Mock).mockResolvedValue([]); });

test('completed analysis replaces progress with success and a direct route to review', async () => {
    (loadAiCheckpoints as jest.Mock).mockResolvedValue([{ videoId: doc.media.youtubeId, model: 'test', start: 0, end: 60, rallies: [{ start: 15, end: 25, evidence: 'Visible' }], contacts: [], limitations: [] }]);
    const onReview = jest.fn(); let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(YouTubeAnalysis, { doc, scope: 'test-scope', onApply: jest.fn(), onCuts: jest.fn(), onTracking: jest.fn(), onReview })); });
    expect(view.root.findAllByProps({ 'aria-label': 'Progresso da análise do YouTube' })).toHaveLength(0);
    expect(view.root.findByProps({ className: 'sv-job-complete' }).props.role).toBe('status');
    act(() => view.root.findByProps({ label: 'Revisar recortes gerados' }).props.onPress());
    expect(onReview).toHaveBeenCalledTimes(1);
    act(() => view.unmount());
});

test('a failed checkpoint save cannot present a success confirmation', async () => {
    (saveAiCheckpoints as jest.Mock).mockRejectedValueOnce(new Error('Falha ao salvar'));
    (analyzeYouTube as jest.Mock).mockResolvedValue({ videoId: doc.media.youtubeId, model: 'test', start: 0, end: 60, rallies: [], contacts: [], limitations: [] });
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(YouTubeAnalysis, { doc, scope: 'test-scope', onApply: jest.fn(), onCuts: jest.fn(), onTracking: jest.fn() })); });
    await act(async () => { view.root.findByProps({ label: 'Iniciar análise do YouTube' }).props.onPress(); });
    expect(view.root.findAllByProps({ className: 'sv-job-complete' })).toHaveLength(0);
    expect(view.root.findByProps({ role: 'alert' }).children).toContain('Falha ao salvar');
    act(() => view.unmount());
});

test('collapsing analysis preserves an active request and recent cuts can seek the visible video', async () => {
    let finish!: (value: unknown) => void;
    let signal!: AbortSignal;
    (analyzeYouTube as jest.Mock).mockImplementation((_id, _start, _end, requestSignal: AbortSignal) => { signal = requestSignal; return new Promise(resolve => { finish = resolve; }); });
    const onSeek = jest.fn(); let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(YouTubeAnalysis, { doc, scope: 'test-scope', onApply: jest.fn(), onCuts: jest.fn(), onTracking: jest.fn(), onSeek })); });
    act(() => view.root.findByProps({ label: 'Iniciar análise do YouTube' }).props.onPress());
    act(() => view.root.findByProps({ label: 'Recolher análise automática' }).props.onPress());
    expect(signal.aborted).toBe(false);
    expect(view.root.findByProps({ label: 'Cancelar análise do YouTube' })).toBeTruthy();
    await act(async () => { finish({ videoId: doc.media.youtubeId, model: 'test', start: 0, end: 60, rallies: [{ start: 15, end: 25, evidence: 'Visible' }], contacts: [], limitations: [] }); });
    act(() => view.root.findByProps({ label: 'Expandir análise automática' }).props.onPress());
    act(() => view.root.findByProps({ label: 'Ver recorte em 00:15' }).props.onPress());
    expect(onSeek).toHaveBeenCalledWith(15);
    expect(view.root.findAllByType('dialog')).toHaveLength(0);
    act(() => view.unmount());
});

test('resumes a full match beyond 30 minutes without requesting completed chunks again', async () => {
    const match = { ...doc, media: { ...doc.media, duration: 1860.5 } };
    const saved = Array.from({ length: 31 }, (_, i) => ({ videoId: doc.media.youtubeId, model: 'test', start: i * 60, end: (i + 1) * 60, rallies: [], contacts: [], limitations: [] }));
    (loadAiCheckpoints as jest.Mock).mockResolvedValue(saved);
    (analyzeYouTube as jest.Mock).mockResolvedValue({ ...saved[0], start: 1860, end: 1860.5 });
    const onCuts = jest.fn(); let view: ReactTestRenderer;
    await act(async () => { view = create(createElement(YouTubeAnalysis, { doc: match, scope: 'scoped', onApply: jest.fn(), onCuts, onTracking: jest.fn(), onClose: jest.fn() })); });
    await act(async () => { await view.root.findByProps({ label: 'Iniciar análise do YouTube' }).props.onPress(); });
    expect(analyzeYouTube).toHaveBeenCalledTimes(1);
    expect(analyzeYouTube).toHaveBeenCalledWith(doc.media.youtubeId, 1860, 1860.5, expect.any(AbortSignal));
    expect(onCuts).toHaveBeenCalledTimes(32);
    expect(saveAiCheckpoints).toHaveBeenCalledWith('scoped', expect.arrayContaining(saved));
    act(() => view.unmount());
});
test('does not apply automatically and requires explicit team mapping', async () => {
    (analyzeYouTube as jest.Mock).mockResolvedValue({ videoId: 'mdfgd1K3HTc', model: 'test', start: 0, end: 60, rallies: [{ start: 15, end: 25, evidence: 'Visible' }], contacts: [], limitations: [] });
    const onApply = jest.fn(); let view: ReactTestRenderer;
    act(() => { view = create(createElement(YouTubeAnalysis, { doc, scope: 'test-scope', onApply, onCuts: jest.fn(), onTracking: jest.fn(), onClose: jest.fn() })); });
    await act(async () => {});
    await act(async () => { await view.root.findByProps({ label: 'Iniciar análise do YouTube' }).props.onPress(); });
    expect(onApply).not.toHaveBeenCalled();
    expect(view!.root.findByProps({ label: 'Aplicar sugestões do YouTube' }).props.disabled).toBe(true);
    act(() => view.root.findByProps({ 'aria-label': 'Lado da nossa equipe' }).props.onChange({ target: { value: 'us' } }));
    act(() => view.root.findByProps({ label: 'Aplicar sugestões do YouTube' }).props.onPress());
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(doc.rallies).toHaveLength(1);
    act(() => view.unmount());
});
test('shows provider error without modifying draft', async () => {
    (analyzeYouTube as jest.Mock).mockRejectedValue(new Error('Gemini indisponível'));
    const onApply = jest.fn(); let view: ReactTestRenderer;
    act(() => { view = create(createElement(YouTubeAnalysis, { doc, scope: 'test-scope', onApply, onCuts: jest.fn(), onTracking: jest.fn(), onClose: jest.fn() })); });
    await act(async () => {});
    await act(async () => { await view.root.findByProps({ label: 'Iniciar análise do YouTube' }).props.onPress(); });
    expect(view!.root.findByProps({ role: 'alert' }).children).toContain('Gemini indisponível');
    expect(onApply).not.toHaveBeenCalled();
    act(() => view.unmount());
});
test('closing during analysis aborts the request without applying results', async () => {
    let signal: AbortSignal | undefined;
    (analyzeYouTube as jest.Mock).mockImplementation((_id, _start, _end, requestSignal: AbortSignal) => {
        signal = requestSignal;
        return new Promise((_resolve, reject) => requestSignal.addEventListener('abort', () => reject(new Error('Cancelled'))));
    });
    const onApply = jest.fn(); let view: ReactTestRenderer;
    act(() => { view = create(createElement(YouTubeAnalysis, { doc, scope: 'test-scope', onApply, onCuts: jest.fn(), onTracking: jest.fn(), onClose: jest.fn() })); });
    await act(async () => {});
    act(() => view.root.findByProps({ label: 'Iniciar análise do YouTube' }).props.onPress());
    await act(async () => view.unmount());
    expect(signal?.aborted).toBe(true);
    expect(onApply).not.toHaveBeenCalled();
});
