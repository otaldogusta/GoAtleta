import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { VideoScoutingReview } from '../video/VideoScoutingReview.web';
import { newVideoDocument } from '../../../core/scouting-video';
import type { ScoutingRally } from '../../../core/models';
import { emptyScoutingVideoLinks, savePointVideoLink } from '../../../core/scouting-video-links';
const mockBuildAlignment = jest.fn();
const mockAcceptSuggestions = jest.fn();
let mockLocalVideoAiAvailable = true;
jest.mock('../../../api/scouting-video-ai', () => ({ localVideoAiAvailable: () => mockLocalVideoAiAvailable }));
let mockEvidence = { observations: [], loading: false, error: '', retry: jest.fn() };
jest.mock('../video/use-video-alignment-evidence', () => ({ useVideoAlignmentEvidence: () => mockEvidence }));
let mockVisual = { visualRallies: [], loading: false, error: '', processedSeconds: 0, run: jest.fn(), cancel: jest.fn() };
jest.mock('../video/use-video-visual-alignment', () => ({ useVideoVisualAlignment: () => mockVisual }));
jest.mock('../video/use-video-review-preferences', () => ({ useVideoReviewPreferences: () => {
    const React = jest.requireActual('react');
    const [format, setFormat] = React.useState(''), [sides, setSides] = React.useState({} as Record<string, 'near' | 'far'>);
    return { format, sides, loading: false, error: '', retry: jest.fn(), setFormat, setSide: (key: string, side: '' | 'near' | 'far') => setSides((current: Record<string, 'near' | 'far'>) => { const next = { ...current }; if (side) next[key] = side; else delete next[key]; return next; }) };
} }));
jest.mock('../../../core/scouting-video-alignment', () => ({
    buildScoutingVideoAlignment: (...args: unknown[]) => mockBuildAlignment(...args),
    acceptScoutingVideoSuggestions: (...args: unknown[]) => mockAcceptSuggestions(...args),
}));
const mockSave = jest.fn().mockResolvedValue(true);
const mockPoint = (id: string, seconds: number): ScoutingRally => ({ id, sessionId: 'source', setNumber: 1, number: 1, won: true, serve: 'us', rotation: null, scoreUs: 1, scoreThem: 0, contacts: [], createdAt: new Date(Date.UTC(2026,10,1,12,0,seconds)).toISOString() });
const mockSource = { session: { id: 'source', title: 'Set 1', date: '2026-11-01', opponent: 'Voleibarra RJ', createdAt: '2026-11-01T12:00:00Z' }, rallies: [mockPoint('p1', 0), mockPoint('p2', 30)] };
let mockSources = [mockSource], mockReviewLoading=false, mockReviewError='';
let mockLinks = { ...emptyScoutingVideoLinks(), sessionIds: ['source'] };
jest.mock('../video/use-video-scouting-links', () => ({ useVideoScoutingLinks: () => ({ links: mockLinks, available: [], sources: mockSources, loading: mockReviewLoading, saving: false, error: mockReviewError, save: mockSave, retry: jest.fn() }) }));
jest.mock('../video/StudioUI.web', () => ({ StudioAction: (props: unknown) => jest.requireActual('react').createElement('button', props as object) }));
const doc = newVideoDocument({ fingerprint: 'video', name: 'game', duration: 600, width: 1920, height: 1080 }, 'v1');
let view: ReactTestRenderer;
beforeEach(() => { jest.clearAllMocks(); mockLocalVideoAiAvailable=true;mockSources=[mockSource];mockReviewLoading=false;mockReviewError='';mockEvidence = { observations: [], loading: false, error: '', retry: jest.fn() }; mockVisual = { visualRallies: [], loading: false, error: '', processedSeconds: 0, run: jest.fn(), cancel: jest.fn() }; mockSave.mockResolvedValue(true); mockBuildAlignment.mockReturnValue({ suggestions: [], unresolved: [], preserved: 0 }); mockAcceptSuggestions.mockReset(); mockLinks = { ...emptyScoutingVideoLinks(), sessionIds: ['source'] }; });
afterEach(() => { act(() => view?.unmount()); });
function mount(disabled = false, video = doc) {
    const onSeek = jest.fn();
    act(() => { view = create(createElement(VideoScoutingReview, { user: 'user', org: 'org', classId: 'class', sessionId: 'review', opponent: 'Voleibarra RJ', date: '2026-11-01', doc: video, time: 40, focus: null, onSeek, disabled })); });
    return onSeek;
}
test('point-only collection stays partial; linking records only a reference to the current frame', async () => {
    const original = JSON.stringify(mockSource);
    mount();
    expect(view.root.findAllByType('p').some(p => p.children.join('').includes('Somente placar registrado'))).toBe(true);
    await act(async () => { await view.root.findByProps({ label: 'Vincular ponto ao instante atual do vídeo' }).props.onPress(); });
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ links: [expect.objectContaining({ rallyId: 'p1', time: 40, videoRallyId: 'v1', missing: false })] }));
    expect(JSON.stringify(mockSource)).toBe(original);
});
test('missing footage is explicit and does not fabricate a video timestamp', async () => {
    mount();
    await act(async () => { await view.root.findByProps({ label: 'Marcar ponto sem imagem no vídeo' }).props.onPress(); });
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ links: [expect.objectContaining({ time: null, videoRallyId: null, missing: true })] }));
});
test('clock estimate only seeks for review and never confirms another point implicitly', () => {
    mockLinks = savePointVideoLink(mockLinks, mockSource.rallies[0], doc, 20);
    const onSeek = mount();
    act(() => view.root.findByProps({ 'aria-label': 'Ponto registrado' }).props.onChange({ target: { value: 'p2' } }));
    act(() => view.root.findByProps({ label: 'Ver sugestão de correspondência' }).props.onPress());
    expect(onSeek).toHaveBeenCalledWith(50);
    expect(mockSave).not.toHaveBeenCalled();
});

test('point navigation opens a confirmed video association without changing official records', () => {
    mockLinks = savePointVideoLink(mockLinks, mockSource.rallies[1], doc, 50);
    const onSeek = mount();
    act(() => view.root.findByProps({ label: 'Próximo ponto registrado' }).props.onPress());
    expect(onSeek).toHaveBeenCalledWith(50);
    expect(view.root.findByProps({ 'aria-label': 'Ponto registrado' }).props.value).toBe('p2');
    expect(mockSave).not.toHaveBeenCalled();
});

test('watching a linked point uses the explicit play action at its original timestamp without changing the link',()=>{
    mockLinks=savePointVideoLink(mockLinks,mockSource.rallies[0],doc,62.64);const original=JSON.stringify(mockLinks);
    const onSeek=mount(),onPlay=jest.fn(),props=view.root.findByType(VideoScoutingReview).props;
    act(()=>view.update(createElement(VideoScoutingReview,{...props,onPlay})));
    act(()=>view.root.findByProps({label:'Ver ponto vinculado no vídeo'}).props.onPress());
    expect(onPlay).toHaveBeenCalledWith(62.64);expect(onSeek).not.toHaveBeenCalled();expect(mockSave).not.toHaveBeenCalled();expect(JSON.stringify(mockLinks)).toBe(original);
});

test('source configuration is tucked away until explicitly opened', () => {
    mount();
    expect(view.root.findAllByProps({ label: 'Salvar análises vinculadas ao vídeo' })).toHaveLength(0);
    act(() => view.root.findByProps({ label: 'Escolher análises dos sets' }).props.onPress());
    expect(view.root.findByProps({ label: 'Salvar análises vinculadas ao vídeo' })).toBeTruthy();
});

test('authorized linked-session projection is read-only and does not repeat on player ticks or callback identity',()=>{
    const onSourcesChange=jest.fn();mount();
    const props=view.root.findByType(VideoScoutingReview).props;
    act(()=>view.update(createElement(VideoScoutingReview,{...props,onSourcesChange})));
    expect(onSourcesChange).toHaveBeenCalledTimes(1);
    expect(onSourcesChange).toHaveBeenCalledWith([{id:'source',title:'Set 1',date:'2026-11-01'}]);
    const replacement=jest.fn();
    act(()=>view.update(createElement(VideoScoutingReview,{...props,time:41,onSourcesChange:replacement})));
    expect(replacement).not.toHaveBeenCalled();
    mockSources=[{...mockSource,session:{...mockSource.session,title:'Set 1 conferido'}}];
    act(()=>view.update(createElement(VideoScoutingReview,{...props,time:42,onSourcesChange:replacement})));
    expect(replacement).toHaveBeenCalledTimes(1);expect(replacement.mock.calls[0][0][0].title).toBe('Set 1 conferido');
    expect(mockSave).not.toHaveBeenCalled();expect(mockVisual.run).not.toHaveBeenCalled();
});

test('linked-session observer waits for successful loading and does not emit an empty cleanup',()=>{
    mockReviewLoading=true;const observer=jest.fn();mount();const props=view.root.findByType(VideoScoutingReview).props;
    act(()=>view.update(createElement(VideoScoutingReview,{...props,onSourcesChange:observer})));expect(observer).not.toHaveBeenCalled();
    mockReviewLoading=false;mockReviewError='Falha de leitura';
    act(()=>view.update(createElement(VideoScoutingReview,{...props,onSourcesChange:observer})));expect(observer).not.toHaveBeenCalled();
    mockReviewError='';act(()=>view.update(createElement(VideoScoutingReview,{...props,onSourcesChange:observer})));
    expect(observer).toHaveBeenCalledTimes(1);
    act(()=>view.unmount());expect(observer).toHaveBeenCalledTimes(1);expect(mockSave).not.toHaveBeenCalled();
});

test('video association actions precede contacts in the review reading order', () => {
    mount();
    const sections = view.root.findAllByType('section').map(node => node.props.className);
    expect(sections.indexOf('sv-review-video')).toBeLessThan(sections.indexOf('sv-review-contacts'));
});

test('point selection and footage precede the collapsed synchronization controls', () => {
    mount(false,{...doc,media:{...doc.media,youtubeId:'abcdefghijk'}});
    const disclosure=view.root.findByProps({'aria-label':'Sincronização e conferência'});
    expect(disclosure.type).toBe('details');expect(disclosure.props.open).not.toBe(true);
    expect(disclosure.findByType('summary').findByType('span').children.join('')).toBe('Sincronização e conferência');
    expect(disclosure.findByType('summary').findByType('small').children.join('')).toBe('2 pendentes');
    const sections=view.root.findAllByType('section').map(node=>node.props.className);
    expect(sections.indexOf('sv-review-video')).toBeLessThan(sections.indexOf('sv-review-alignment'));
    expect(sections.indexOf('sv-review-contacts')).toBeLessThan(sections.indexOf('sv-review-alignment'));
    expect(disclosure.findByProps({'aria-label':'Formato do jogo'})).toBeTruthy();
    expect(disclosure.findByProps({'aria-label':'Nossa equipe neste trecho'})).toBeTruthy();
    expect(mockVisual.run).not.toHaveBeenCalled();expect(mockSave).not.toHaveBeenCalled();
});

test('a running visual review remains mounted inside the collapsed disclosure', () => {
    mockVisual.loading=true;mockVisual.processedSeconds=60;
    mount(false,{...doc,media:{...doc.media,youtubeId:'abcdefghijk'}});
    const disclosure=view.root.findByProps({'aria-label':'Sincronização e conferência'});
    expect(disclosure.props.open).not.toBe(true);
    expect(disclosure.findByType('summary').findByType('small').children.join('')).toBe('Em andamento');
    expect(disclosure.findByProps({label:'Cancelar conferência visual'})).toBeTruthy();
    expect(mockVisual.cancel).not.toHaveBeenCalled();expect(mockSave).not.toHaveBeenCalled();
});

test('next pending skips confirmed footage and explicit missing footage without writing', () => {
    const original = mockSource.rallies;
    mockSource.rallies = [...original, { ...mockPoint('p3', 60), number: 3 }];
    try {
        mockLinks = savePointVideoLink(mockLinks, mockSource.rallies[0], doc, null);
        mockLinks = savePointVideoLink(mockLinks, mockSource.rallies[1], doc, 50);
        const sourceBefore = JSON.stringify(mockSource);
        const onSeek = mount();
        expect(view.root.findByProps({ className: 'sv-review-progress' }).findByType('small').children.join('')).toBe('1 com vídeo · 1 sem imagem · 1 pendente');
        act(() => view.root.findByProps({ label: 'Próximo ponto sem vínculo no vídeo' }).props.onPress());
        expect(view.root.findByProps({ 'aria-label': 'Ponto registrado' }).props.value).toBe('p3');
        expect(onSeek).not.toHaveBeenCalled();
        expect(mockSave).not.toHaveBeenCalled();
        expect(JSON.stringify(mockSource)).toBe(sourceBefore);
    } finally { mockSource.rallies = original; }
});

test('next pending wraps to the first unresolved point in the selected set', () => {
    const original = mockSource.rallies;
    mockSource.rallies = [...original, { ...mockPoint('p3', 60), number: 3 }];
    try {
        mockLinks = savePointVideoLink(mockLinks, mockSource.rallies[0], doc, null);
        mount();
        act(() => view.root.findByProps({ 'aria-label': 'Ponto registrado' }).props.onChange({ target: { value: 'p3' } }));
        act(() => view.root.findByProps({ label: 'Próximo ponto sem vínculo no vídeo' }).props.onPress());
        expect(view.root.findByProps({ 'aria-label': 'Ponto registrado' }).props.value).toBe('p2');
        expect(mockSave).not.toHaveBeenCalled();
    } finally { mockSource.rallies = original; }
});

test('missing footage resolves the point and disables pending navigation when all are resolved', () => {
    mockLinks = savePointVideoLink(mockLinks, mockSource.rallies[0], doc, null);
    mockLinks = savePointVideoLink(mockLinks, mockSource.rallies[1], doc, null);
    mount();
    expect(view.root.findByProps({ label: 'Próximo ponto sem vínculo no vídeo' }).props.disabled).toBe(true);
    expect(mockSave).not.toHaveBeenCalled();
});

test('a reference from another set cannot hide a pending point or inflate current-set progress', () => {
    mockLinks.links = [{ sessionId: 'other', rallyId: 'p1', videoRallyId: 'v1', time: 20, missing: false }];
    mount();
    expect(view.root.findByProps({ className: 'sv-review-progress' }).findByType('small').children.join('')).toBe('0 com vídeo · 2 pendentes');
    expect(mockSave).not.toHaveBeenCalled();
});

const candidate = (rallyId: string, confidence: 'high' | 'review') => ({ sessionId: 'source', rallyId, videoRallyId: 'v1', time: 50, confidence, reasons: ['Sequência e contatos compatíveis.'] });

test('alignment runs from the loaded video and scouting without writing or seeking', () => {
    const before = JSON.stringify({ doc, source: mockSource, links: mockLinks });
    mockBuildAlignment.mockReturnValue({ suggestions: [candidate('p1', 'review')], unresolved: [{ sessionId: 'source', rallyId: 'p2', reason: 'Relógio inconsistente.' }], preserved: 0 });
    const onSeek = mount();
    expect(mockBuildAlignment).toHaveBeenCalledWith({ video: { media: doc.media, rallies: doc.rallies, contacts: doc.contacts }, points: mockSource.rallies, links: mockLinks, observations: [], visualRallies: [], regulation: undefined });
    expect(view.root.findByProps({ 'aria-label': 'Sincronização com o vídeo' }).findAllByType('p')[0].children.join('')).toContain('1 para conferir');
    expect(mockSave).not.toHaveBeenCalled();
    expect(onSeek).not.toHaveBeenCalled();
    expect(JSON.stringify({ doc, source: mockSource, links: mockLinks })).toBe(before);
});

test('batch association passes only higher-confidence proposals and preserves existing links', async () => {
    mockLinks = savePointVideoLink(mockLinks, mockSource.rallies[0], doc, null);
    const original = JSON.stringify(mockLinks);
    const high = candidate('p2', 'high'), uncertain = candidate('other-pending', 'review');
    const next = { ...mockLinks, links: [...mockLinks.links, { sessionId: 'source', rallyId: 'p2', videoRallyId: 'v1', time: 50, missing: false }] };
    mockBuildAlignment.mockReturnValue({ suggestions: [high, uncertain], unresolved: [], preserved: 1 });
    mockAcceptSuggestions.mockReturnValue(next);
    mount();
    await act(async () => { await view.root.findByProps({ label: 'Associar sugestões confiáveis' }).props.onPress(); });
    expect(mockAcceptSuggestions).toHaveBeenCalledWith(mockLinks, doc, mockSource.rallies, [high], [], [], undefined);
    expect(mockSave).toHaveBeenCalledWith(next);
    expect(JSON.stringify(mockLinks)).toBe(original);
    expect(next.links[0]).toEqual(mockLinks.links[0]);
});

test('an uncertain proposal can be watched freely and is saved only after explicit confirmation', async () => {
    const uncertain = candidate('p1', 'review');
    mockBuildAlignment.mockReturnValue({ suggestions: [uncertain], unresolved: [], preserved: 0 });
    mockAcceptSuggestions.mockReturnValue(savePointVideoLink(mockLinks, mockSource.rallies[0], doc, 50));
    const onSeek = mount();
    expect(view.root.findAllByProps({ label: 'Associar sugestões confiáveis' })).toHaveLength(0);
    act(() => view.root.findByProps({ label: 'Assistir sugestão em 00:50' }).props.onPress());
    expect(onSeek).toHaveBeenCalledWith(50);
    expect(mockSave).not.toHaveBeenCalled();
    await act(async () => { await view.root.findByProps({ label: 'Confirmar sugestão em 00:50' }).props.onPress(); });
    expect(mockAcceptSuggestions).toHaveBeenCalledWith(mockLinks, doc, mockSource.rallies, [uncertain], [], [], undefined);
    expect(mockSave).toHaveBeenCalledTimes(1);
});

test('review-next opens the proposed point and its video without confirming the match', () => {
    mockBuildAlignment.mockReturnValue({ suggestions: [candidate('p2', 'review')], unresolved: [], preserved: 0 });
    const onSeek = mount();
    act(() => view.root.findByProps({ label: 'Conferir próxima sugestão de sincronização' }).props.onPress());
    expect(view.root.findByProps({ 'aria-label': 'Ponto registrado' }).props.value).toBe('p2');
    expect(onSeek).toHaveBeenCalledWith(50);
    expect(mockSave).not.toHaveBeenCalled();
});

test('stale proposal failure remains visible and never reaches persistence', async () => {
    mockBuildAlignment.mockReturnValue({ suggestions: [candidate('p1', 'high')], unresolved: [], preserved: 0 });
    mockAcceptSuggestions.mockImplementation(() => { throw new Error('A sugestão mudou. Confira novamente.'); });
    mount();
    await act(async () => { await view.root.findByProps({ label: 'Associar sugestões confiáveis' }).props.onPress(); });
    expect(view.root.findByProps({ role: 'alert' }).children.join('')).toContain('A sugestão mudou');
    expect(mockSave).not.toHaveBeenCalled();
});

test('disabled review cannot accept proposals even when a callback is invoked', async () => {
    mockBuildAlignment.mockReturnValue({ suggestions: [candidate('p1', 'review')], unresolved: [], preserved: 0 });
    mount(true);
    const action = view.root.findByProps({ label: 'Confirmar sugestão em 00:50' });
    expect(action.props.disabled).toBe(true);
    await act(async () => { await action.props.onPress(); });
    expect(mockAcceptSuggestions).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
});

test('saving failure does not report an accepted alignment', async () => {
    mockBuildAlignment.mockReturnValue({ suggestions: [candidate('p1', 'high')], unresolved: [], preserved: 0 });
    mockAcceptSuggestions.mockReturnValue(savePointVideoLink(mockLinks, mockSource.rallies[0], doc, 50));
    mockSave.mockResolvedValue(false);
    mount();
    await act(async () => { await view.root.findByProps({ label: 'Associar sugestões confiáveis' }).props.onPress(); });
    expect(view.root.findAllByProps({ role: 'status' })).toHaveLength(0);
});

test('a checkpoint read failure offers retry and leaves manual association usable', async () => {
    mockEvidence.error = 'Não foi possível carregar as observações salvas.';
    mount();
    expect(mockBuildAlignment).not.toHaveBeenCalled();
    expect(view.root.findByProps({ role: 'alert' }).children.join('')).toContain('observações salvas');
    act(() => view.root.findByProps({ label: 'Recarregar observações do vídeo' }).props.onPress());
    expect(mockEvidence.retry).toHaveBeenCalledTimes(1);
    await act(async () => { await view.root.findByProps({ label: 'Vincular ponto ao instante atual do vídeo' }).props.onPress(); });
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockAcceptSuggestions).not.toHaveBeenCalled();
});

test('loading checkpoints does not block manual point review or imply alignment completion', async () => {
    mockEvidence.loading = true;
    mount();
    expect(mockBuildAlignment).not.toHaveBeenCalled();
    expect(view.root.findByProps({ role: 'status' }).children.join('')).toBe('Carregando observações do vídeo…');
    expect(view.root.findAllByProps({ label: 'Associar sugestões confiáveis' })).toHaveLength(0);
    await act(async () => { await view.root.findByProps({ label: 'Marcar ponto sem imagem no vídeo' }).props.onPress(); });
    expect(mockSave).toHaveBeenCalledTimes(1);
});

test('player time and unrelated trajectory changes do not rebuild alignment', () => {
    mount();
    const count = mockBuildAlignment.mock.calls.length;
    const props = view.root.findByType(VideoScoutingReview).props;
    act(() => { view.update(createElement(VideoScoutingReview, { ...props, time: 41, doc: { ...doc, corrections: [...doc.corrections] } })); });
    expect(mockBuildAlignment).toHaveBeenCalledTimes(count);
});

const youtubeDoc = { ...doc, media: { ...doc.media, youtubeId: 'abcdefghijk' } };

test('production hides local analysis actions while preserving preferences, saved suggestions and manual linking', async () => {
    mockLocalVideoAiAvailable = false;
    Object.assign(mockVisual, { failedWindows: 1 });
    mockBuildAlignment.mockReturnValue({ suggestions: [{ sessionId: 'source', rallyId: 'p1', videoRallyId: 'v1', time: 40, confidence: 'review', reasons: [] }], unresolved: [], preserved: 0 });
    const original = JSON.stringify(mockSource);
    mount(false, youtubeDoc);
    expect(view.root.findAllByProps({ label: 'Analisar pendências deste set' })).toHaveLength(0);
    expect(view.root.findAllByProps({ label: 'Reanalisar trechos sem leitura' })).toHaveLength(0);
    expect(view.root.findByProps({ label: 'Conferir próxima sugestão de sincronização' })).toBeTruthy();
    act(() => view.root.findByProps({ 'aria-label': 'Formato do jogo' }).props.onChange({ target: { value: '21-23' } }));
    act(() => view.root.findByProps({ 'aria-label': 'Nossa equipe neste trecho' }).props.onChange({ target: { value: 'far' } }));
    expect(view.root.findByProps({ 'aria-label': 'Formato do jogo' }).props.value).toBe('21-23');
    expect(view.root.findByProps({ 'aria-label': 'Nossa equipe neste trecho' }).props.value).toBe('far');
    await act(async () => { await view.root.findByProps({ label: 'Vincular ponto ao instante atual do vídeo' }).props.onPress(); });
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockVisual.run).not.toHaveBeenCalled();
    expect(JSON.stringify(mockSource)).toBe(original);
});

test('visual analysis starts only after an explicit side choice and user action', () => {
    mount(false, youtubeDoc);
    const action = () => view.root.findByProps({ label: 'Analisar pendências deste set' });
    expect(action().props.disabled).toBe(true);
    act(() => action().props.onPress());
    expect(mockVisual.run).not.toHaveBeenCalled();
    act(() => view.root.findByProps({ 'aria-label': 'Nossa equipe neste trecho' }).props.onChange({ target: { value: 'far' } }));
    expect(action().props.disabled).toBe(false);
    act(() => action().props.onPress());
    expect(mockVisual.run).toHaveBeenCalledWith({ ourSide: 'far', points: mockSource.rallies, anchors: mockLinks.links, setNumber: 1, sessionId: 'source', regulation: undefined, retryFailed: false });
    expect(mockSave).not.toHaveBeenCalled();
});

test('choosing the tournament format changes alignment constraints without editing scouting', () => {
    const before = JSON.stringify(mockSource);
    mount(false, youtubeDoc);
    act(() => view.root.findByProps({ 'aria-label': 'Formato do jogo' }).props.onChange({ target: { value: '21-23' } }));
    expect(mockBuildAlignment.mock.calls.at(-1)?.[0].regulation).toEqual({ pointsToWin: 21, cap: 23 });
    act(() => view.root.findByProps({ 'aria-label': 'Nossa equipe neste trecho' }).props.onChange({ target: { value: 'far' } }));
    act(() => view.root.findByProps({ label: 'Analisar pendências deste set' }).props.onPress());
    expect(mockVisual.run.mock.calls[0][0].regulation).toEqual({ pointsToWin: 21, cap: 23 });
    expect(JSON.stringify(mockSource)).toBe(before);
    expect(mockSave).not.toHaveBeenCalled();
});

test('visual progress can be cancelled while the reviewed links remain untouched', () => {
    mockVisual.loading = true; mockVisual.processedSeconds = 120;
    mockLinks = savePointVideoLink(mockLinks, mockSource.rallies[0], doc, 20);
    const before = JSON.stringify(mockLinks);
    mount(false, youtubeDoc);
    expect(view.root.findByProps({ role: 'status' }).children.join('')).toContain('02:00');
    expect(view.root.findByProps({ 'aria-label': 'Nossa equipe neste trecho' }).props.disabled).toBe(true);
    act(() => view.root.findByProps({ label: 'Cancelar conferência visual' }).props.onPress());
    expect(mockVisual.cancel).toHaveBeenCalledTimes(1);
    expect(mockSave).not.toHaveBeenCalled();
    expect(JSON.stringify(mockLinks)).toBe(before);
});

test('a visual service error stays visible without blocking manual association', async () => {
    mockVisual.error = 'Serviço local indisponível.';
    mount(false, youtubeDoc);
    expect(view.root.findByProps({ role: 'alert' }).children.join('')).toBe('Serviço local indisponível.');
    await act(async () => { await view.root.findByProps({ label: 'Vincular ponto ao instante atual do vídeo' }).props.onPress(); });
    expect(mockSave).toHaveBeenCalledTimes(1);
});

test('team side must be selected independently for another set', () => {
    const original = mockSource.rallies;
    mockSource.rallies = [original[0], { ...original[1], setNumber: 2 }];
    try {
        mount(false, youtubeDoc);
        act(() => view.root.findByProps({ 'aria-label': 'Nossa equipe neste trecho' }).props.onChange({ target: { value: 'far' } }));
        act(() => view.root.findByProps({ 'aria-label': 'Ponto registrado' }).props.onChange({ target: { value: 'p2' } }));
        expect(view.root.findByProps({ 'aria-label': 'Nossa equipe neste trecho' }).props.value).toBe('');
        expect(view.root.findByProps({ label: 'Analisar pendências deste set' }).props.disabled).toBe(true);
        expect(mockVisual.run).not.toHaveBeenCalled();
    } finally { mockSource.rallies = original; }
});
