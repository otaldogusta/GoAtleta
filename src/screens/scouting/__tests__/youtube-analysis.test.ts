import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { YouTubeAnalysis } from '../video/YouTubeAnalysis.web';
import { analyzeYouTube } from '../../../api/scouting-video-ai';
import { newVideoDocument } from '../../../core/scouting-video';
jest.mock('../../../api/scouting-video-ai', () => ({ analyzeYouTube: jest.fn() }));
jest.mock('../video/StudioUI.web', () => ({ StudioDialog: ({ children }: { children: unknown }) => children, StudioAction: (props: unknown) => jest.requireActual('react').createElement('button', props as object) }));
const doc = newVideoDocument({ youtubeId: 'mdfgd1K3HTc', fingerprint: 'youtube:mdfgd1K3HTc', duration: 60, width: 1280, height: 720, name: 'Video' }, 'first');
test('does not apply automatically and requires explicit team mapping', async () => {
    (analyzeYouTube as jest.Mock).mockResolvedValue({ videoId: 'mdfgd1K3HTc', model: 'test', start: 0, end: 60, rallies: [{ start: 15, end: 25, evidence: 'Visible' }], contacts: [], limitations: [] });
    const onApply = jest.fn(); let view: ReactTestRenderer;
    act(() => { view = create(createElement(YouTubeAnalysis, { doc, onApply, onClose: jest.fn() })); });
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
    act(() => { view = create(createElement(YouTubeAnalysis, { doc, onApply, onClose: jest.fn() })); });
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
    act(() => { view = create(createElement(YouTubeAnalysis, { doc, onApply, onClose: jest.fn() })); });
    act(() => view.root.findByProps({ label: 'Iniciar análise do YouTube' }).props.onPress());
    await act(async () => view.unmount());
    expect(signal?.aborted).toBe(true);
    expect(onApply).not.toHaveBeenCalled();
});
