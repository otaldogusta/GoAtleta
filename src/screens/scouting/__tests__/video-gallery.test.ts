import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { VideoGallery } from '../video/VideoGallery.web';
import { videoThumbnail } from '../video/video-media.web';
import { newVideoDocument, type VideoContact } from '../../../core/scouting-video';
import { StudioSelect } from '../video/StudioSelect.web';
import AsyncStorage from '@react-native-async-storage/async-storage';
jest.mock('@react-native-async-storage/async-storage',()=>({__esModule:true,default:{getItem:jest.fn(),getAllKeys:jest.fn(),setItem:jest.fn(),removeItem:jest.fn()}}));
jest.mock('../video/video-media.web', () => ({ videoThumbnail: jest.fn().mockResolvedValue('data:image/jpeg;base64,fixture') }));
jest.mock('../video/StudioUI.web', () => ({ StudioAction: (props: object) => jest.requireActual('react').createElement('button', props) }));
const originalObserver = globalThis.IntersectionObserver;
beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(videoThumbnail).mockResolvedValue('data:image/jpeg;base64,fixture');
    const cache=new Map<string,string>();
    jest.mocked(AsyncStorage.getItem).mockImplementation(async key=>cache.get(key)??null);
    jest.mocked(AsyncStorage.getAllKeys).mockImplementation(async()=>[...cache.keys()]);
    jest.mocked(AsyncStorage.setItem).mockImplementation(async(key,value)=>{cache.set(key,value);});
    jest.mocked(AsyncStorage.removeItem).mockImplementation(async key=>{cache.delete(key);});
    globalThis.IntersectionObserver = class {
        constructor(private callback: (entries: unknown[]) => void) {}
        observe() { this.callback([{ isIntersecting: true }]); }
        disconnect() {}
    } as unknown as typeof IntersectionObserver;
});
afterEach(() => { globalThis.IntersectionObserver = originalObserver; });
test('thumbnails are the default and list toggling preserves focused identity, downloads and the source document',async()=>{
    const doc=newVideoDocument({fingerprint:'views',name:'Jogo',duration:40,width:640,height:360},'r1');doc.rallies.push({id:'r2',start:20,winner:null,reviewed:false});
    const before=JSON.stringify(doc),onFocus=jest.fn(),onDownload=jest.fn();let view!:ReactTestRenderer;
    await act(async()=>{view=create(createElement(VideoGallery,{doc,source:'',focus:'r2',teams:{us:'A',them:'B'},onFocus,onDownload,onExport:jest.fn(),onImport:jest.fn()}));});
    expect(view.root.findByProps({'aria-label':'Galeria de rallies'}).props['data-layout']).toBe('thumbnails');
    act(()=>view.root.findByProps({label:'Lista compacta'}).props.onPress());
    expect(view.root.findByProps({'aria-label':'Galeria de rallies'}).props['data-layout']).toBe('list');
    expect(view.root.findByProps({label:'Abrir rally 2'}).props.active).toBe(true);expect(onFocus).not.toHaveBeenCalled();
    act(()=>view.root.findByProps({label:'Baixar rally 2'}).props.onPress());expect(onDownload).toHaveBeenCalledWith(['r2']);
    act(()=>view.root.findByProps({label:'Miniaturas em duas colunas'}).props.onPress());expect(JSON.stringify(doc)).toBe(before);act(()=>view.unmount());
});

test('bench keeps the focused rally and its original download identity while tools and full-video entry stay accessible',async()=>{
    const doc=newVideoDocument({fingerprint:'bench',name:'Jogo',duration:40,width:640,height:360},'first');
    doc.rallies.push({id:'selected',start:20,winner:null,reviewed:false});
    const before=JSON.stringify(doc),onDownload=jest.fn(),onOpenTools=jest.fn(),onFocus=jest.fn();let view!:ReactTestRenderer;
    await act(async()=>{view=create(createElement(VideoGallery,{bench:true,doc,source:'',focus:'selected',teams:{us:'A',them:'B'},onFocus,onDownload,onOpenTools,onExport:jest.fn(),onImport:jest.fn()}));});
    expect(view.root.findByProps({'aria-label':'Galeria de rallies'}).props['data-bench']).toBe(true);
    expect(view.root.findAllByType('button').filter(node=>node.props.label==='Abrir vídeo completo')).toHaveLength(1);
    act(()=>view.root.findByProps({label:'Ferramentas do vídeo'}).props.onPress());expect(onOpenTools).toHaveBeenCalledTimes(1);
    act(()=>view.root.findByProps({label:'Lista compacta'}).props.onPress());
    act(()=>view.root.findByProps({label:'Baixar rally 2'}).props.onPress());expect(onDownload).toHaveBeenCalledWith(['selected']);
    expect(view.root.findByProps({label:'Abrir rally 2'}).props.active).toBe(true);
    act(()=>view.root.findByProps({label:'Miniaturas em faixa'}).props.onPress());
    expect(onFocus).not.toHaveBeenCalled();expect(JSON.stringify(doc)).toBe(before);act(()=>view.unmount());
});

test('set and fundamental filters use actual metadata and retain original rally numbering and media bounds',async()=>{
    const doc=newVideoDocument({fingerprint:'filters',name:'Jogo',duration:40,width:640,height:360},'r1');doc.rallies.push({id:'r2',start:10,winner:null,reviewed:false},{id:'r3',start:20,winner:null,reviewed:false});
    doc.contacts.push({id:'manual',time:2,skill:'Saque',team:'us',athlete:'',studentId:null,outcome:'Em jogo'});
    const onFocus=jest.fn(),before=JSON.stringify(doc);let view!:ReactTestRenderer;
    await act(async()=>{view=create(createElement(VideoGallery,{doc,source:'',focus:'r1',teams:{us:'A',them:'B'},onFocus,onDownload:jest.fn(),onExport:jest.fn(),onImport:jest.fn(),rallyMetadata:{r2:{setNumber:1,scoreUs:8,scoreThem:7,fundamentals:['Comunicação']},r3:{setNumber:2,fundamentals:['Defesa']}},canDownloadRally:id=>id!=='r3'}));});
    const filter=(label:string)=>view.root.findAllByType(StudioSelect).find(node=>node.props.label===label)!;
    act(()=>filter('Filtrar rallies por set').props.onChange('2'));
    expect(view.root.findAllByType('button').filter(node=>node.props.label?.startsWith('Abrir rally')).map(node=>node.props.label)).toEqual(['Abrir rally 3']);
    expect(view.root.findByProps({label:'Baixar rally 3'}).props.disabled).toBe(true);expect(onFocus).not.toHaveBeenCalled();
    act(()=>filter('Filtrar rallies por fundamento').props.onChange('Comunicação'));expect(view.root.findByProps({role:'status'}).children).toContain('Nenhum rally neste filtro.');
    act(()=>filter('Filtrar rallies por set').props.onChange('all'));expect(view.root.findByProps({label:'Abrir rally 2'})).toBeDefined();
    act(()=>filter('Filtrar rallies por fundamento').props.onChange('all'));act(()=>filter('Filtrar rallies por set').props.onChange('unset'));
    expect(view.root.findAllByType('button').filter(node=>node.props.label?.startsWith('Abrir rally')).map(node=>node.props.label)).toEqual(['Abrir rally 1']);
    expect(view.root.findByProps({label:'Abrir vídeo completo'})).toBeDefined();expect(JSON.stringify(doc)).toBe(before);act(()=>view.unmount());
});

test('a traditional document has no invented set filter and read-only layouts expose no editing or downloads',async()=>{
    const doc=newVideoDocument({fingerprint:'no-set',name:'Arquivo',duration:40,width:640,height:360},'r1');let view!:ReactTestRenderer;
    await act(async()=>{view=create(createElement(VideoGallery,{doc,source:'',focus:null,teams:{us:'A',them:'B'},readOnly:true,onFocus:jest.fn(),onDownload:jest.fn(),onExport:jest.fn(),onImport:jest.fn()}));});
    expect(view.root.findAllByType(StudioSelect)).toHaveLength(0);expect(view.root.findAllByProps({'aria-label':'Opções dos rallies'})).toHaveLength(0);
    act(()=>view.root.findByProps({label:'Lista compacta'}).props.onPress());expect(view.root.findAllByType('button').some(node=>node.props.label?.startsWith('Baixar'))).toBe(false);act(()=>view.unmount());
});

test('changing video source cannot retain hidden set or skill filters and hide its rallies',async()=>{
    const doc=newVideoDocument({fingerprint:'filter-source-a',name:'Jogo',duration:40,width:640,height:360},'r1');
    doc.rallies.push({id:'r2',start:20,winner:null,reviewed:false});
    const props={doc,source:'',focus:null,teams:{us:'A',them:'B'},onFocus:jest.fn(),onDownload:jest.fn(),onExport:jest.fn(),onImport:jest.fn()};
    let view!:ReactTestRenderer;
    await act(async()=>{view=create(createElement(VideoGallery,{...props,rallyMetadata:{r1:{setNumber:1,fundamentals:['Saque']},r2:{setNumber:2,fundamentals:['Defesa']}}}));});
    const filter=(label:string)=>view.root.findAllByType(StudioSelect).find(node=>node.props.label===label)!;
    act(()=>filter('Filtrar rallies por set').props.onChange('2'));act(()=>filter('Filtrar rallies por fundamento').props.onChange('Defesa'));
    const other=newVideoDocument({fingerprint:'filter-source-b',name:'Outro arquivo',duration:30,width:640,height:360},'other-1');other.rallies.push({id:'other-2',start:10,winner:null,reviewed:false});
    await act(async()=>{view.update(createElement(VideoGallery,{...props,doc:other}));});
    expect(view.root.findAllByType(StudioSelect)).toHaveLength(0);
    expect(view.root.findAllByType('button').filter(node=>/^Abrir rally/.test(node.props.label??''))).toHaveLength(2);
    expect(props.onFocus).not.toHaveBeenCalled();expect(props.onDownload).not.toHaveBeenCalled();act(()=>view.unmount());
});

test('a filter whose option disappears falls back to all without changing rally identity',async()=>{
    const doc=newVideoDocument({fingerprint:'filter-options',name:'Jogo',duration:40,width:640,height:360},'r1');doc.rallies.push({id:'r2',start:20,winner:null,reviewed:false});
    const props={doc,source:'',focus:'r2',teams:{us:'A',them:'B'},onFocus:jest.fn(),onDownload:jest.fn(),onExport:jest.fn(),onImport:jest.fn()};
    let view!:ReactTestRenderer;await act(async()=>{view=create(createElement(VideoGallery,{...props,rallyMetadata:{r1:{setNumber:1,fundamentals:['Saque']},r2:{setNumber:2,fundamentals:['Defesa']}}}));});
    const filter=(label:string)=>view.root.findAllByType(StudioSelect).find(node=>node.props.label===label)!;
    act(()=>filter('Filtrar rallies por set').props.onChange('2'));act(()=>filter('Filtrar rallies por fundamento').props.onChange('Defesa'));
    await act(async()=>{view.update(createElement(VideoGallery,{...props,rallyMetadata:{r1:{setNumber:1,fundamentals:['Saque']},r2:{setNumber:1,fundamentals:['Saque']}}}));});
    expect(filter('Filtrar rallies por set').props.value).toBe('all');expect(filter('Filtrar rallies por fundamento').props.value).toBe('all');
    expect(view.root.findByProps({label:'Abrir rally 2'}).props.active).toBe(true);expect(props.onFocus).not.toHaveBeenCalled();act(()=>view.unmount());
});

test('thumbnail cache separates the corrected source offset from the previous alignment',async()=>{
    const doc=newVideoDocument({fingerprint:'offset-cache',name:'Jogo',duration:40,width:640,height:360},'r1');doc.rallies[0].start=12;
    const props={doc,source:'blob:original',bench:true,thumbnailScope:'private-scope',focus:null,teams:{us:'A',them:'B'},onFocus:jest.fn(),onDownload:jest.fn(),onExport:jest.fn(),onImport:jest.fn()};
    jest.mocked(videoThumbnail).mockResolvedValueOnce('data:image/jpeg;base64,old').mockResolvedValueOnce('data:image/jpeg;base64,new');
    let view!:ReactTestRenderer;await act(async()=>{view=create(createElement(VideoGallery,{...props,offsetSeconds:2}),{createNodeMock:()=>({})});});
    expect(videoThumbnail).toHaveBeenLastCalledWith('blob:original',10,expect.any(AbortSignal));
    const oldKey=jest.mocked(AsyncStorage.getItem).mock.calls.at(-1)![0];
    await act(async()=>{view.update(createElement(VideoGallery,{...props,offsetSeconds:8}));});
    expect(videoThumbnail).toHaveBeenCalledTimes(2);expect(videoThumbnail).toHaveBeenLastCalledWith('blob:original',4,expect.any(AbortSignal));
    expect(jest.mocked(AsyncStorage.getItem).mock.calls.at(-1)![0]).not.toBe(oldKey);
    expect(view.root.findAllByType('img').map(node=>node.props.src)).toContain('data:image/jpeg;base64,new');act(()=>view.unmount());
});
test('local independent ranges drive captions, thumbnails and coverage downloads',async()=>{
    const doc=newVideoDocument({fingerprint:'local',name:'Ao vivo',duration:20,width:640,height:360},'r1');doc.rallies.push({id:'r2',start:0,winner:null,reviewed:false});
    const ranges={r1:[3,8],r2:[0,12]} as const;let view!:ReactTestRenderer;
    await act(async()=>{view=create(createElement(VideoGallery,{doc,source:'blob:local',focus:null,teams:{us:'A',them:'B'},offsetSeconds:2,availableUntilSeconds:10,canDownloadOriginal:false,canDownloadRally:id=>id==='r1',rangeResolver:(_,id)=>id?ranges[id as keyof typeof ranges]:[0,20],onFocus:jest.fn(),onDownload:jest.fn(),onExport:jest.fn(),onImport:jest.fn()}),{createNodeMock:()=>({})});});
    expect(videoThumbnail).toHaveBeenCalledWith('blob:local',1,expect.any(AbortSignal));
    expect(view.root.findAllByType('small').map(node=>node.children.join(''))).toContain('00:03 – 00:08');
    expect(view.root.findAllByType('button').find(node=>node.props.label==='Baixar rally 2')!.props.disabled).toBe(true);
    expect(view.root.findAllByType('button').find(node=>node.props.label==='Baixar vídeo completo')!.props.disabled).toBe(true);
    act(()=>view.unmount());
});
test('YouTube poster is limited to the full video; rally thumbnails require the original', async () => {
    const doc = newVideoDocument({ youtubeId: 'abcdefghijk', fingerprint: 'youtube:abcdefghijk', name: 'Jogo', duration: 60, width: 640, height: 360 }, 'r1');
    doc.rallies.push({ id: 'r2', start: 15, winner: null, reviewed: false });
    const props = { doc, source: 'youtube:abcdefghijk', focus: null, teams: { us: 'Equipe', them: 'Adversário' }, localMedia: false, onFocus: jest.fn(), onDownload: jest.fn(), onExport: jest.fn(), onImport: jest.fn() };
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(VideoGallery, props), { createNodeMock: () => ({}) }); });
    expect(videoThumbnail).not.toHaveBeenCalled();
    const full = view.root.findByProps({ label: 'Abrir vídeo completo' });
    expect(full.props.active).toBe(true);
    act(() => view.root.findByProps({ label: 'Abrir rally 2' }).props.onPress());
    expect(props.onFocus).toHaveBeenLastCalledWith('r2');
    act(() => full.props.onPress());
    expect(props.onFocus).toHaveBeenLastCalledWith(null);
    expect(view.root.findAllByType('img')).toHaveLength(1);
    expect(view.root.findAllByProps({ className: 'sv-thumb-unavailable' })).toHaveLength(2);
    await act(async () => { view.update(createElement(VideoGallery, { ...props, thumbnailSource: 'https://media.example/original.mp4', offsetSeconds: 8 })); });
    expect(videoThumbnail).toHaveBeenCalledTimes(1);
    expect(videoThumbnail).toHaveBeenCalledWith('https://media.example/original.mp4', 7, expect.any(AbortSignal));
    expect(view.root.findAllByType('img').map(n => n.props.src)).toContain('data:image/jpeg;base64,fixture');
    expect(view.root.findAllByType('button').some(b => b.props.label?.startsWith('Baixar'))).toBe(false);
    expect(props.onDownload).not.toHaveBeenCalled();
    act(() => view.unmount());
});

test('rally indicators use only the recorded winner, with team names accessible in read-only viewing', async () => {
    const doc = newVideoDocument({ youtubeId: 'abcdefghijk', fingerprint: 'youtube:abcdefghijk', name: 'Jogo', duration: 60, width: 640, height: 360 }, 'r1');
    doc.rallies.push({ id: 'r2', start: 15, winner: 'us', reviewed: true }, { id: 'r3', start: 30, winner: 'them', reviewed: true });
    doc.contacts.push({ id: 'c1', time: 2, skill: 'Ataque', team: 'us', athlete: '', studentId: null, outcome: 'Ponto de ataque' });
    const before = JSON.stringify(doc);
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(VideoGallery, { doc, source: 'youtube:abcdefghijk', focus: 'r2', teams: { us: 'ElCartel', them: 'Regenerados' }, localMedia: false, readOnly: true, onFocus: jest.fn(), onDownload: jest.fn(), onExport: jest.fn(), onImport: jest.fn() })); });
    const results = view.root.findAllByProps({ className: 'sv-rally-result' });
    expect(results).toHaveLength(3);
    expect(results.map(result => result.props['aria-label'])).toEqual([
        'ElCartel × Regenerados. Resultado não definido.',
        'ElCartel × Regenerados. Vencedor: ElCartel.',
        'ElCartel × Regenerados. Vencedor: Regenerados.',
    ]);
    expect(results.map(result => result.findAllByProps({ className: 'sv-team-dot won' }).map(dot => dot.children.join('')))).toEqual([[], ['EC'], ['R']]);
    results.forEach((result, i) => expect(view.root.findByProps({ label: `Abrir rally ${i + 1}` }).props.describedBy).toBe(result.props.id));
    expect(view.root.findByProps({ label: 'Abrir vídeo completo' }).findAllByProps({ role: 'img' })).toHaveLength(0);
    expect(JSON.stringify(doc)).toBe(before);
    act(() => view.unmount());
});

test('Space on the selected card toggles playback without selecting it again', () => {
    const doc = newVideoDocument({ youtubeId: 'abcdefghijk', fingerprint: 'youtube:abcdefghijk', name: 'Jogo', duration: 60, width: 640, height: 360 }, 'r1');
    const onPlay = jest.fn(), onFocus = jest.fn();
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(VideoGallery, { doc, source: '', focus: 'r1', teams: { us: 'A', them: 'B' }, localMedia: false, onPlay, onFocus, onDownload: jest.fn(), onExport: jest.fn(), onImport: jest.fn() })); });
    const grid = view.root.findByProps({ className: 'sv-grid' });
    const event = { code: 'Space', key: ' ', repeat: false, preventDefault: jest.fn(), stopPropagation: jest.fn(), target: { closest: () => ({}) } };
    act(() => grid.props.onKeyDownCapture(event));
    act(() => grid.props.onKeyDownCapture({ ...event, repeat: true }));
    act(() => grid.props.onKeyUpCapture(event));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onFocus).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledTimes(3);
    act(() => grid.props.onKeyDownCapture({ ...event, target: { closest: () => null } }));
    expect(onPlay).toHaveBeenCalledTimes(1);
    act(() => view.unmount());
});

test('only visible thumbnails start, leaving the panel cancels work and returning retries', async () => {
    const callbacks: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
    const options: unknown[] = [];
    globalThis.IntersectionObserver = class {
        constructor(callback: typeof callbacks[number], option: unknown) { callbacks.push(callback); options.push(option); }
        observe() {} disconnect() {}
    } as unknown as typeof IntersectionObserver;
    jest.mocked(videoThumbnail).mockImplementation(() => new Promise(() => {}));
    const doc = newVideoDocument({ youtubeId: 'abcdefghijk', fingerprint: 'youtube:abcdefghijk', name: 'Jogo', duration: 60, width: 640, height: 360 }, 'r1');
    let view!: ReactTestRenderer;
    const panel = {};
    await act(async () => { view = create(createElement(VideoGallery, { doc, source: '', thumbnailSource: 'https://media.example/original.mp4', focus: 'r1', teams: { us: 'A', them: 'B' }, localMedia: false, onFocus: jest.fn(), onDownload: jest.fn(), onExport: jest.fn(), onImport: jest.fn() }), { createNodeMock: () => ({ closest: () => panel }) }); });
    expect(videoThumbnail).not.toHaveBeenCalled();
    expect(options[0]).toEqual({ root: panel, rootMargin: '0px', threshold: .01 });
    act(() => callbacks[0]([{ isIntersecting: true }]));
    expect(videoThumbnail).toHaveBeenCalledTimes(1);
    const signal = jest.mocked(videoThumbnail).mock.calls[0][2];
    act(() => callbacks[0]([{ isIntersecting: false }]));
    expect(signal.aborted).toBe(true);
    act(() => callbacks[0]([{ isIntersecting: true }]));
    expect(videoThumbnail).toHaveBeenCalledTimes(2);
    act(() => view.unmount());
    expect(jest.mocked(videoThumbnail).mock.calls[1][2].aborted).toBe(true);
});

test('playback suspends thumbnail extraction until paused', async () => {
    const doc = newVideoDocument({ fingerprint: 'play', name: 'test', duration: 60, width: 640, height: 360 }, 'r1');
    const props = { doc, source: 'blob:test', focus: null, teams: { us: 'A', them: 'B' }, onFocus: jest.fn(), onDownload: jest.fn(), onExport: jest.fn(), onImport: jest.fn() };
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(VideoGallery, { ...props, playing: true }), { createNodeMock: () => ({}) }); });
    expect(videoThumbnail).not.toHaveBeenCalled();
    await act(async () => { view.update(createElement(VideoGallery, { ...props, playing: false })); });
    expect(videoThumbnail).toHaveBeenCalled();
    act(() => view.unmount());
});


test('120 rallies remain reachable in both views and filters preserve original IDs, selection and downloads', async () => {
    const doc = newVideoDocument({ fingerprint: 'many-rallies', name: 'Fixture local', duration: 3600, width: 1280, height: 720 }, 'rally-0');
    doc.rallies = Array.from({ length: 120 }, (_, index) => ({ id: `rally-${index}`, start: index * 30, winner: null, reviewed: false }));
    doc.contacts = doc.rallies.map((rally, index): VideoContact => ({ id: `contact-${index}`, time: rally.start + 5, skill: index % 2 ? 'Ataque' : 'Saque', team: 'us', studentId: null, athlete: '', outcome: '' }));
    const rallyMetadata = Object.fromEntries(doc.rallies.map((rally, index) => [rally.id, { setNumber: Math.floor(index / 24) + 1, fundamentals: [index % 2 ? 'Ataque' : 'Saque'] }]));
    const before = JSON.stringify({ doc, rallyMetadata }), onFocus = jest.fn(), onDownload = jest.fn();let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(VideoGallery, { bench: true, doc, rallyMetadata, source: '', focus: 'rally-119', teams: { us: 'A', them: 'B' }, onFocus, onDownload, onExport: jest.fn(), onImport: jest.fn() })); });
    const button = (label: string) => view.root.findAllByType('button').find(node => node.props.label === label)!;
    const visible = () => view.root.findAllByType('button').filter(node => /^Abrir rally \d+$/.test(node.props.label ?? '')).map(node => node.props.label);
    const filter = (label: string) => view.root.findAllByType(StudioSelect).find(node => node.props.label === label)!;
    const all = Array.from({ length: 120 }, (_, index) => `Abrir rally ${index + 1}`);
    expect(visible()).toEqual(all);
    for (let cycle = 0; cycle < 4; cycle++) {
        act(() => button('Lista compacta').props.onPress());expect(visible()).toEqual(all);
        act(() => button('Miniaturas em faixa').props.onPress());expect(visible()).toEqual(all);
    }
    expect(button('Abrir rally 120').props.active).toBe(true);expect(onFocus).not.toHaveBeenCalled();
    act(() => filter('Filtrar rallies por set').props.onChange('5'));
    act(() => filter('Filtrar rallies por fundamento').props.onChange('Saque'));
    expect(visible()).toEqual(Array.from({ length: 12 }, (_, index) => `Abrir rally ${97 + index * 2}`));
    act(() => button('Lista compacta').props.onPress());
    act(() => button('Baixar rally 119').props.onPress());expect(onDownload).toHaveBeenCalledWith(['rally-118']);
    act(() => button('Abrir rally 119').props.onPress());expect(onFocus).toHaveBeenCalledWith('rally-118');
    act(() => filter('Filtrar rallies por set').props.onChange('all'));
    act(() => filter('Filtrar rallies por fundamento').props.onChange('all'));
    expect(visible()).toEqual(all);expect(button('Abrir rally 120').props.active).toBe(true);
    expect(JSON.stringify({ doc, rallyMetadata })).toBe(before);act(() => view.unmount());
});
