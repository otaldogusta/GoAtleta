import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { VideoTimeline } from '../video/VideoTimeline.web';
import { timelineContactGroups, timelineLegendIndexes } from '../video/timeline-contacts';
import type { VideoDocument } from '../../../core/scouting-video';
import { contactOutcomeSummary, contactOutcomeTone } from '../video/video-contact-outcomes';
import type { StudioSourceContact } from '../video/local-studio-types';

jest.mock('../video/StudioUI.web', () => ({ StudioAction: (props: Record<string, unknown>) => jest.requireActual<typeof import('react')>('react').createElement('button', props) }));

const doc: VideoDocument = {
    version: 1, media: { fingerprint: 'fixture', name: 'fixture.mp4', duration: 900, width: 1200, height: 675 },
    rallies: [{ id: 'r1', start: 0, winner: null, reviewed: false }, { id: 'r2', start: 15, winner: null, reviewed: false }],
    contacts: [
        { id: 's', time: 3, skill: 'Saque', team: 'them', athlete: '7', studentId: null, outcome: 'Em jogo' },
        { id: 'p', time: 5, skill: 'Recepção', team: 'us', athlete: '', studentId: null, outcome: 'Controlada' },
        { id: 'a', time: 18, skill: 'Ataque', team: 'us', athlete: '', studentId: null, outcome: 'Ponto de ataque' },
    ], corrections: [],
};
const bounds = { currentTarget: { getBoundingClientRect: () => ({ left: 100, width: 20, top: 400 }) } };
let view: ReactTestRenderer;
beforeEach(() => { Object.assign(globalThis, { innerWidth: 1000, innerHeight: 704 }); });
afterEach(() => { act(() => view?.unmount()); });
function mount(focus: string | null, document = doc) {
    const onFocus = jest.fn(), onSeek = jest.fn();
    act(() => { view = create(React.createElement(VideoTimeline, { doc: document, focus, time: 5, tracking: [], teams: { us: 'El Cartel', them: 'Regenerados' }, onFocus, onSeek })); });
    return { onFocus, onSeek };
}
function button(label: string) { return view.root.findAllByType('button').find(b => b.props.label === label)!; }

test('soft presentation keeps gaps and overlapping chapter bounds and refuses unavailable official media',()=>{
    const document={...doc,contacts:[],rallies:[{id:'r1',start:3,winner:null,reviewed:false},{id:'r2',start:15,winner:null,reviewed:false},{id:'r3',start:9,winner:null,reviewed:false}]} as VideoDocument;
    const boundsById={r1:[3,11],r2:[15,23],r3:[9,18]} as const,onSeek=jest.fn(),before=JSON.stringify(document);
    act(()=>{view=create(React.createElement(VideoTimeline,{doc:document,focus:null,time:8,tracking:[],teams:{us:'A',them:'B'},onFocus:jest.fn(),onSeek,rangeResolver:(_,id)=>id?boundsById[id as keyof typeof boundsById]:[0,30],availableWindow:[7,19],sourceContacts:[{id:'official-1',rallyId:'r1',time:8,skill:'Defesa',result:'Boa',athlete:'A',detail:'',uncertaintyMs:50},{id:'official-2',rallyId:'r2',time:20,skill:'Saque',result:'Ace',athlete:'B',detail:'',uncertaintyMs:50}]}));});
    const chapters=view.root.findAll(node=>typeof node.props.className==='string'&&node.props.className.startsWith('sv-chapter'));
    expect(chapters.map(node=>node.props.style.width)).toEqual([`${8/30*100}%`,`${8/30*100}%`,`${9/30*100}%`]);
    expect(button('Saque registrado · 00:20.000 · B · Ace').props.disabled).toBe(true);
    act(()=>button('Defesa registrado · 00:08.000 · A · Boa').props.onPress());expect(onSeek).toHaveBeenCalledWith(8);
    expect(view.root.findAllByProps({'data-source-contact':true})).toHaveLength(2);expect(JSON.stringify(document)).toBe(before);
});

test('independent local ranges preserve generic official contacts without using video outcome enums',()=>{
    const document={...doc,contacts:[],rallies:[{id:'r1',start:0,winner:null,reviewed:false},{id:'r2',start:0,winner:null,reviewed:false}]} as VideoDocument;
    const onSeek=jest.fn(),sourceContacts=[{id:'s1',rallyId:'r1',time:8,skill:'Comunicação',result:'Positiva',athlete:'Ana',detail:'Aviso',uncertaintyMs:40},{id:'s2',rallyId:'r2',time:9,skill:'Transição',result:'Positiva',athlete:'Bia',detail:'Cobertura',uncertaintyMs:50}];
    act(()=>{view=create(React.createElement(VideoTimeline,{doc:document,focus:'r1',time:5,tracking:[],teams:{us:'A',them:'B'},onFocus:jest.fn(),onSeek,rangeResolver:(_,id)=>id==='r1'?[3,11]:[0,20],sourceContacts}));});
    expect(view.root.findByProps({'aria-label':'Posição no vídeo'}).props.min).toBe(3);expect(view.root.findByProps({'aria-label':'Posição no vídeo'}).props.max).toBe(11);
    expect(view.root.findAllByProps({'data-source-contact':true})).toHaveLength(1);
    act(()=>button('Comunicação registrado · 00:08.000 · Ana · Positiva').props.onPress());expect(onSeek).toHaveBeenCalledWith(8);
    expect(document.contacts).toEqual([]);
});

test('point marker is hidden in full video and kept in the selected rally', () => {
    const document = { ...doc, rallies: doc.rallies.map((r, i) => i === 0 ? { ...r, pointTime: 12.5 } : r) };
    const { onFocus, onSeek } = mount('r1', document);
    expect(button('Ponto em 00:12')).toBeDefined();
    act(() => button('Ponto · 00:12.500 · N/D').props.onPress());
    expect(onSeek).toHaveBeenCalledWith(12.5);
    expect(onFocus).not.toHaveBeenCalled();
    act(() => { view.update(React.createElement(VideoTimeline, { doc: document, focus: null, time: 12.5, tracking: [], teams: { us: 'El Cartel', them: 'Regenerados' }, onFocus, onSeek })); });
    expect(button('Ponto · 00:12.500 · N/D')).toBeUndefined();
    expect(button('Ponto em 00:12')).toBeUndefined();
    expect(document.contacts).toBe(doc.contacts);
});

test('bench markers seek directly while retaining complete labels and the legacy point control',()=>{
    const document={...doc,rallies:doc.rallies.map((r,index)=>index===0?{...r,winner:'us' as const,pointTime:12.5}:r)};
    const sourceContacts=[{id:'official',rallyId:'r1',time:6,skill:'Defesa',result:'Boa',athlete:'Ana',detail:'',uncertaintyMs:40}];
    const before=JSON.stringify({document,sourceContacts}),onSeek=jest.fn(),onPoint=jest.fn();
    const props={doc:document,focus:'r1',time:7,tracking:[],teams:{us:'El Cartel',them:'Regenerados'},onFocus:jest.fn(),onSeek,onPoint,sourceContacts};
    act(()=>{view=create(React.createElement(VideoTimeline,{...props,bench:true}));});
    const contact=button('Saque · 00:03.000 · Em jogo');
    expect(contact.props.iconContent.props.className).toBe('sv-timeline-symbol');
    expect(contact.props.iconContent.props.children[0].props.className).toBe('sv-timeline-dot');
    const point=button('Ponto · 00:12.500 · El Cartel');
    expect(point.props.icon).toBeUndefined();expect(point.props.iconContent.props.children[0].props.className).toBe('sv-timeline-dot');
    act(()=>point.props.onPress());expect(onSeek).toHaveBeenCalledWith(12.5);expect(onPoint).not.toHaveBeenCalled();
    const source=button('Defesa registrado · 00:06.000 · Ana · Boa');
    expect(source.props.iconContent.props.children[0].props.className).toBe('sv-timeline-dot');act(()=>source.props.onPress());expect(onSeek).toHaveBeenCalledWith(6);
    expect(JSON.stringify({document,sourceContacts})).toBe(before);
    act(()=>view.update(React.createElement(VideoTimeline,props)));
    expect(button('Ponto · 00:12.500 · El Cartel').props.icon).toBe('flag');
    expect(button('Ponto · 00:12.500 · El Cartel').props.iconContent).toBeUndefined();
});

test('draft contact previews its stage and changes without saving; cancel restores the timeline', () => {
    const before = JSON.stringify(doc);
    const props = { doc, focus: 'r1', time: 7, tracking: [], teams: { us: 'El Cartel', them: 'Regenerados' }, onFocus: jest.fn(), onSeek: jest.fn() };
    const draftContact = { ...doc.contacts[1], id: 'draft', time: 7, skill: 'Levantamento' as const };
    act(() => { view = create(React.createElement(VideoTimeline, { ...props, draftContact })); });
    expect(button('Levantamento em 00:07')).toBeDefined();
    expect(button('Levantamento · 00:07.000 · Em edição')).toBeDefined();
    expect(view.root.findAllByProps({ 'data-draft': true })).toHaveLength(1);
    act(() => { view.update(React.createElement(VideoTimeline, { ...props, draftContact: { ...draftContact, time: 9, outcome: 'Fora de condição' } })); });
    expect(button('Levantamento em 00:09')).toBeDefined();
    expect(view.root.findByProps({ 'data-draft': true }).props['data-outcome']).toBe('warning');
    act(() => { view.update(React.createElement(VideoTimeline, { ...props, focus: null, draftContact })); });
    expect(button('Levantamento · 00:07.000 · Em edição')).toBeDefined();
    act(() => { view.update(React.createElement(VideoTimeline, props)); });
    expect(view.root.findAllByProps({ 'data-draft': true })).toHaveLength(0);
    expect(button('Levantamento em 00:07')).toBeUndefined();
    expect(JSON.stringify(doc)).toBe(before);
});

test.each([[null, 450], ['r2', 457.5]] as const)('only the progress track seeks within the visible range (%s)', (focus, expected) => {
    const { onFocus, onSeek } = mount(focus);
    const click = { detail: 1, clientX: 400, target: { closest: () => null }, currentTarget: { getBoundingClientRect: () => ({ left: 100, width: 600 }) }, preventDefault: jest.fn(), stopPropagation: jest.fn() };
    const axis = view.root.findByProps({ className: 'sv-segments' });
    expect(view.root.findByProps({ className: 'sv-seek' }).props.onClickCapture).toBeUndefined();
    act(() => axis.props.onClickCapture(click));
    expect(onSeek).toHaveBeenCalledWith(expected);
    expect(onFocus).not.toHaveBeenCalled();
    expect(click.stopPropagation).toHaveBeenCalled();
    onSeek.mockClear();
    act(() => axis.props.onClickCapture({ ...click, detail: 0 }));
    expect(onSeek).not.toHaveBeenCalled();
});

test('a chapter click seeks without switching the macro view; modes are chosen in the gallery', () => {
    const { onFocus, onSeek } = mount(null);
    act(() => button('Rally 02 em 00:15').props.onPress());
    expect(onSeek).toHaveBeenCalledWith(15);
    expect(onFocus).not.toHaveBeenCalled();
    expect(button('Rally selecionado')).toBeUndefined();
    expect(button('Vídeo completo')).toBeUndefined();
});

test('macro chapter preview lists its contacts, teams and outcomes, excluding other rallies', () => {
    mount(null);
    const chapter = view.root.findAll(n => typeof n.props.className === 'string' && n.props.className.startsWith('sv-chapter'))[0];
    act(() => chapter.props.onPointerEnter(bounds));
    const preview = view.root.findByProps({ role: 'dialog' }).findAllByType('small').map(n => n.children.join('')).join(' ');
    expect(preview).toContain('Regenerados');
    expect(view.root.findAllByProps({ className: 'sv-outcome-label' }).some(n => n.children.includes('Controlada'))).toBe(true);
    expect(button('Ir para Saque em 00:03.000')).toBeDefined();
    expect(button('Ir para Recepção em 00:05.000')).toBeDefined();
    expect(button('Ir para Ataque em 00:18.000')).toBeUndefined();
});

test.each([320, 1063])('contact preview opens above its marker and stays within a %s px viewport', viewportWidth => {
    Object.assign(globalThis, { innerWidth: viewportWidth });
    mount(null);
    const marker = view.root.findByProps({ className: 'sv-marker grouped macro' });
    const rect = { left: viewportWidth - 28, width: 20, top: 560 };
    act(() => marker.props.onPointerEnter({ currentTarget: { getBoundingClientRect: () => rect } }));
    const style = view.root.findByProps({ role: 'dialog' }).props.style;
    expect(704 - style.bottom).toBe(rect.top - 8);
    expect(style.left).toBeGreaterThanOrEqual(8);
    expect(style.left + style.width).toBeLessThanOrEqual(viewportWidth - 8);
    expect(style.maxHeight).toBeLessThanOrEqual(280);
});

test('micro shows only contacts inside the selected rally and supports keyboard preview and exact seeking', () => {
    const { onFocus, onSeek } = mount('r1');
    expect(button('Ataque · 00:18.000 · Ponto de ataque')).toBeUndefined();
    const markers = view.root.findAllByProps({ className: 'sv-marker' });
    expect(markers).toHaveLength(2);
    act(() => markers[1].props.onFocus(bounds));
    const tip = view.root.findByProps({ role: 'dialog' });
    expect(tip.props.style.width).toBe(220);
    expect(tip.findAllByProps({ className: 'sv-tip-heading' })).toHaveLength(0);
    expect(tip.findAllByType('b').map(n => n.children.join(''))).toEqual(['Recepção']);
    act(() => button('Ir para Recepção em 00:05.000').props.onPress());
    expect(onSeek).toHaveBeenCalledWith(5);
    expect(onFocus).not.toHaveBeenCalled();
});

test('contacts share the chapter time axis and remain directly seekable in both scales', () => {
    const { onFocus, onSeek } = mount('r1');
    const axis = view.root.findByProps({ className: 'sv-seek' });
    const contacts = axis.findByProps({ 'aria-label': 'Contatos na timeline' });
    expect(contacts.findAllByProps({ className: 'sv-marker' })).toHaveLength(2);
    expect(view.root.findAllByProps({ className: 'sv-track' })).toHaveLength(0);
    act(() => button('Recepção · 00:05.000 · Controlada').props.onPress());
    expect(onSeek).toHaveBeenLastCalledWith(5);
    expect(onFocus).not.toHaveBeenCalled();
    act(() => { view.update(React.createElement(VideoTimeline, { doc, focus: null, time: 5, tracking: [], teams: { us: 'El Cartel', them: 'Regenerados' }, onFocus, onSeek })); });
    const group = view.root.findByProps({ className: 'sv-seek' }).findByProps({ className: 'sv-marker grouped macro' });
    act(() => group.findByType('button').props.onPress());
    expect(onSeek).toHaveBeenLastCalledWith(3);
    expect(onFocus).not.toHaveBeenCalled();
});

test.each([
    ['Recepção', 'Bola devolvida direto', 'warning'],
    ['Recepção', 'Limitou o ataque', 'warning'],
    ['Levantamento', 'Fora de condição', 'warning'],
    ['Levantamento', 'Bola enviada ao adversário', 'warning'],
    ['Ataque', 'Bloqueado', 'warning'],
    ['Ataque', 'Erro', 'error'],
    ['Saque', 'Erro', 'error'],
    ['Saque', 'Ace', 'point'],
    ['Ataque', 'Ponto de ataque', 'point'],
    ['Bloqueio', 'Ponto de bloqueio', 'point'],
    ['Bola de graça', 'Ponto direto', 'point'],
    ['Recepção', 'Controlada', 'positive'],
    ['Levantamento', 'Atacável', 'positive'],
    ['Defesa', 'Controlada', 'positive'],
    ['Cobertura de ataque', 'Controlada', 'positive'],
    ['Bola de graça', 'Em jogo', 'neutral'],
    ['Ataque', 'Em jogo', 'neutral'],
    ['Saque', '', 'neutral'],
] as const)('%s / %s has the outcome tone %s', (skill, outcome, tone) => {
    expect(contactOutcomeTone({ skill, outcome })).toBe(tone);
});

test('micro evaluates each contact; mixed macro groups stay neutral and expose exact outcome counts', () => {
    const document: VideoDocument = { ...doc, contacts: doc.contacts.map((c, i) => ({ ...c, outcome: ['Erro', 'Bola devolvida direto', 'Ponto de ataque'][i] })) };
    const before = JSON.stringify(document);
    const { onFocus, onSeek } = mount('r1', document);
    expect(view.root.findAllByProps({ className: 'sv-marker' }).map(n => n.props['data-outcome'])).toEqual(['error', 'warning']);
    expect(button('Recepção · 00:05.000 · Bola devolvida direto')).toBeDefined();
    act(() => { view.update(React.createElement(VideoTimeline, { doc: document, focus: null, time: 5, tracking: [], teams: { us: 'El Cartel', them: 'Regenerados' }, onFocus, onSeek })); });
    const group = view.root.findByProps({ className: 'sv-marker grouped macro' });
    expect(group.props['data-outcome']).toBe('neutral');
    expect(contactOutcomeSummary(document.contacts).map(s => s.label)).toEqual(['1 erro', '1 comprometido', '1 ponto direto']);
    act(() => group.props.onPointerEnter(bounds));
    expect(view.root.findByProps({ className: 'sv-tip-summary' }).findAllByProps({ className: 'sv-outcome-label' }).map(n => n.props['data-outcome'])).toEqual(['error', 'warning']);
    expect(button('Ir para Ataque em 00:18.000')).toBeUndefined();
    expect(JSON.stringify(document)).toBe(before);
    expect(document.rallies.every(r => r.winner === null)).toBe(true);
});

test('dense macro markers retain every contact; the micro scale separates them without altering times', () => {
    expect(timelineContactGroups(doc.contacts, 0, 900, 900).map(g => g.contacts.length)).toEqual([3]);
    expect(timelineContactGroups(doc.contacts.slice(0, 2), 0, 15, 900).map(g => g.contacts.length)).toEqual([1, 1]);
    expect(timelineContactGroups([], 0, 15, 400)).toEqual([]);
    expect(doc.contacts.map(c => c.time)).toEqual([3, 5, 18]);
});

test('macro shows contact counts with room between groups, keeping every timestamp', () => {
    mount(null);
    const group = view.root.findByProps({ className: 'sv-marker grouped macro' });
    expect(group.findByType('button').props.children[0]).toBe(2);
    expect(view.root.findAll(n => typeof n.props.className === 'string' && n.props.className.startsWith('sv-marker') && n.props.className.endsWith('macro'))).toHaveLength(2);
    const contacts = doc.contacts.map((c, i) => ({ ...c, time: [3, 35, 75][i] }));
    const grouped = timelineContactGroups(contacts, 0, 1000, 1000, 44);
    expect(grouped.map(g => g.contacts.length)).toEqual([2, 1]);
    expect(grouped.flatMap(g => g.contacts)).toEqual(contacts);
    expect(timelineContactGroups(contacts, 0, 1000, 1000).map(g => g.contacts.length)).toEqual([1, 1, 1]);
});


test('contact clicks open the contact editor without changing macro/micro scale', () => {
    const onContact = jest.fn(), onFocus = jest.fn(), onSeek = jest.fn();
    act(() => { view = create(React.createElement(VideoTimeline, { doc, focus: 'r1', time: 5, tracking: [], teams: { us: 'Equipe', them: 'Adversário' }, onFocus, onSeek, onContact })); });
    act(() => button('Saque · 00:03.000 · Em jogo').props.onPress());
    expect(onContact).toHaveBeenCalledWith(doc.contacts[0]);
    expect(onFocus).not.toHaveBeenCalled();
    expect(onSeek).not.toHaveBeenCalled();
});

test('bench progress previews the drag despite stale player ticks and seeks only on release', () => {
    const before = JSON.stringify(doc);
    const props = { doc, focus: 'r1', time: 5, tracking: [], teams: { us: 'Equipe', them: 'Adversário' }, onFocus: jest.fn(), onSeek: jest.fn(), bench: true };
    act(() => { view = create(React.createElement(VideoTimeline, props)); });
    const slider = () => view.root.findByProps({ 'aria-label': 'Posição no vídeo' });
    const pointer = { pointerId: 7, button: 0, currentTarget: { setPointerCapture: jest.fn() } };
    act(() => slider().props.onPointerDown(pointer));
    expect(pointer.currentTarget.setPointerCapture).toHaveBeenCalledWith(7);
    for (const value of [6, 8, 11]) {
        act(() => slider().props.onChange({ target: { value: String(value) } }));
        act(() => view.update(React.createElement(VideoTimeline, { ...props, time: 5.2 })));
        expect(slider().props.value).toBe(value);
        expect(slider().props['aria-valuetext']).toContain(`00:${String(value).padStart(2, '0')}.000`);
        const rail=view.root.findByProps({className:'sv-bench-time-rail'});
        expect(parseFloat(rail.findByType('i').props.style.width)).toBeCloseTo(value / 15 * 100);
    }
    expect(props.onSeek).not.toHaveBeenCalled();
    act(() => slider().props.onPointerUp(pointer));
    act(() => slider().props.onLostPointerCapture());
    expect(props.onSeek).toHaveBeenCalledTimes(1);
    expect(props.onSeek).toHaveBeenCalledWith(11);
    expect(props.onFocus).not.toHaveBeenCalled();
    expect(JSON.stringify(doc)).toBe(before);
});

test('cancelling or changing the rally during drag does not seek; keyboard changes still seek immediately', () => {
    const props = { doc, focus: 'r1', time: 5, tracking: [], teams: { us: 'Equipe', them: 'Adversário' }, onFocus: jest.fn(), onSeek: jest.fn() };
    act(() => { view = create(React.createElement(VideoTimeline, props)); });
    const slider = () => view.root.findByProps({ 'aria-label': 'Posição no vídeo' });
    const pointer = { pointerId: 8, button: 0, currentTarget: { setPointerCapture: jest.fn() } };
    act(() => slider().props.onPointerDown(pointer));
    act(() => slider().props.onChange({ target: { value: '9' } }));
    act(() => slider().props.onPointerCancel());
    expect(slider().props.value).toBe(5);
    act(() => slider().props.onPointerUp(pointer));
    expect(props.onSeek).not.toHaveBeenCalled();
    act(() => slider().props.onPointerDown(pointer));
    act(() => slider().props.onChange({ target: { value: '9' } }));
    act(() => view.update(React.createElement(VideoTimeline, { ...props, focus: 'r2', time: 18 })));
    act(() => slider().props.onChange({ target: { value: '25' } }));
    act(() => slider().props.onPointerUp(pointer));
    expect(props.onSeek).not.toHaveBeenCalled();
    expect(slider().props.value).toBe(18);
    act(() => slider().props.onChange({ target: { value: '19' } }));
    expect(props.onSeek).toHaveBeenCalledWith(19);
});

 test('point marker opens its rally editor without rewriting the point', () => {
    const document = { ...doc, rallies: doc.rallies.map((r, i) => i === 0 ? { ...r, pointTime: 12.5 } : r) };
    const onPoint = jest.fn(), onSeek = jest.fn();
    act(() => { view = create(React.createElement(VideoTimeline, { doc: document, focus: 'r1', time: 5, tracking: [], teams: { us: 'El Cartel', them: 'Regenerados' }, onFocus: jest.fn(), onSeek, onPoint })); });
    act(() => button('Ponto · 00:12.500 · N/D').props.onPress());
    expect(onPoint).toHaveBeenCalledWith('r1', 12.5);
    expect(onSeek).not.toHaveBeenCalled();
    expect(document.rallies[0].pointTime).toBe(12.5);
});

test('space is captured before chapter buttons can seek, and toggles only once', () => {
    const onPlay = jest.fn(), onSeek = jest.fn();
    act(() => { view = create(React.createElement(VideoTimeline, { doc, focus: 'r1', time: 5, tracking: [], teams: { us: 'A', them: 'B' }, onFocus: jest.fn(), onSeek, onPlay })); });
    const timeline = view.root.findByProps({ className: 'sv-timeline' });
    const event = { code: 'Space', key: ' ', repeat: false, preventDefault: jest.fn(), stopPropagation: jest.fn() };
    act(() => timeline.props.onKeyDownCapture(event));
    act(() => timeline.props.onKeyDownCapture({ ...event, repeat: true }));
    act(() => timeline.props.onKeyUpCapture(event));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onSeek).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledTimes(3);
    expect(event.stopPropagation).toHaveBeenCalledTimes(3);
});

test('interactive marker previews announce a nonmodal dialog and keep Space available to their actions',()=>{
    const onPlay=jest.fn();
    act(()=>{view=create(React.createElement(VideoTimeline,{doc,focus:'r1',time:5,tracking:[],teams:{us:'A',them:'B'},onFocus:jest.fn(),onSeek:jest.fn(),onPlay}));});
    const marker=view.root.findAllByType('div').find(node=>node.props.className==='sv-marker')!;
    expect(marker.findByType('button').props.hasPopup).toBe('dialog');
    act(()=>marker.props.onPointerEnter(bounds));
    const preview=view.root.findByProps({role:'dialog'});expect(preview.props['aria-modal']).toBe(false);expect(preview.props['aria-label']).toBe('Saque');
    const event={code:'Space',key:' ',repeat:false,target:{closest:()=>({})},preventDefault:jest.fn(),stopPropagation:jest.fn()};
    const timeline=view.root.findByProps({className:'sv-timeline'});
    act(()=>{timeline.props.onKeyDownCapture(event);timeline.props.onKeyUpCapture(event);});
    expect(onPlay).not.toHaveBeenCalled();expect(event.preventDefault).not.toHaveBeenCalled();expect(event.stopPropagation).not.toHaveBeenCalled();
});


function denseOfficialFixture(rallyCount: number) {
    const document: VideoDocument = { version: 1, media: { fingerprint: 'official-density', name: 'Fixture local', duration: rallyCount * 60, width: 1280, height: 720 },
        rallies: Array.from({ length: rallyCount }, (_, index) => ({ id: `rally-${index}`, start: index * 60, winner: null, reviewed: false })), contacts: [], corrections: [] };
    const sourceContacts: StudioSourceContact[] = document.rallies.flatMap((rally, index) => Array.from({ length: 12 }, (_, contact) => ({
        id: `official-${index}-${contact}`, rallyId: rally.id, time: index * 60 + 20 + contact * .025,
        skill: contact % 2 ? 'Defesa' : 'Saque', result: 'Coletado', athlete: `Atleta ${contact + 1}`, detail: `Contato ${index}-${contact}`, uncertaintyMs: 40,
    })));
    return { document, sourceContacts };
}

test('reference legends keep clear of the rally context and each other, preserving the active label when possible',()=>{
    expect([...timelineLegendIndexes([.3,.55,.8],1000,180,170)]).toEqual([0,1,2]);
    const positions=[.05,.3,.32,.5,.7,.95], selected=timelineLegendIndexes(positions,1000,160,170,2);
    expect(selected.has(2)).toBe(true);expect(selected.has(1)).toBe(false);
    for(const index of selected){expect(positions[index]*1000-80).toBeGreaterThanOrEqual(182);expect(positions[index]*1000+80).toBeLessThanOrEqual(996);}
    const ordered=[...selected].map(index=>positions[index]*1000).sort((a,b)=>a-b);
    for(let index=1;index<ordered.length;index++)expect(ordered[index]-ordered[index-1]).toBeGreaterThanOrEqual(176);
});

test('bench keeps rally context accessible without duplicating the gallery score below the timeline',()=>{
    const fixture=denseOfficialFixture(1);
    act(()=>{view=create(React.createElement(VideoTimeline,{doc:fixture.document,sourceContacts:fixture.sourceContacts,bench:true,focus:'rally-0',time:20,tracking:[],teams:{us:'A',them:'B'},rallyMetadata:{'rally-0':{scoreUs:17,scoreThem:15}},onFocus:jest.fn(),onSeek:jest.fn()}));});
    expect(view.root.findAllByProps({className:'sv-bench-rally-context'})).toHaveLength(0);
    expect(view.root.findByProps({className:'sv-tracks'}).props['aria-description']).toBe('Rally 01 · 17 × 15');
    expect(view.root.findAllByProps({className:'sv-timeline-cluster'})).toHaveLength(0);
    expect(view.root.findAllByProps({className:'sv-timeline-caption'})).toHaveLength(0);
    expect(view.root.findAllByProps({className:'sv-bench-playhead'})).toHaveLength(1);
});

// This projection checks the existing 14 px bench hotspots, not a screenshot or CSS engine.
function projectedMarkerCenters() {
    return view.root.findByProps({ 'aria-label': 'Contatos na timeline' }).findAll(node =>
        typeof node.props.className === 'string' && node.props.className.split(' ').includes('sv-marker')
    ).map(node => {
        const percent = Number(/(-?[\d.]+)%/.exec(node.props.style.left)?.[1]);
        return Math.max(12, Math.min(900 - 12, percent / 100 * 900));
    }).sort((a, b) => a - b);
}

test.each([null, 'rally-40'])('dense official source markers do not overlap the 14px bench hotspots with focus %s', focus => {
    const { document, sourceContacts } = denseOfficialFixture(80), before = JSON.stringify({ document, sourceContacts });
    act(() => { view = create(React.createElement(VideoTimeline, { doc: document, sourceContacts, bench: true, focus, time: 20,
        tracking: [], teams: { us: 'Equipe', them: 'Adversário' }, onFocus: jest.fn(), onSeek: jest.fn() })); });
    const centers = projectedMarkerCenters();
    expect(centers.length).toBeGreaterThan(0);
    const minimumGap = Math.min(...centers.slice(1).map((center, index) => center - centers[index]));
    expect(minimumGap).toBeGreaterThanOrEqual(14 - .000001);
    expect(JSON.stringify({ document, sourceContacts })).toBe(before);
});

test.each([null, 'rally-6'])('dense official groups keep every original timestamp reachable through their tooltips with focus %s', focus => {
    const { document, sourceContacts } = denseOfficialFixture(12), before = JSON.stringify({ document, sourceContacts });
    const onSeek = jest.fn(), onContact = jest.fn();
    act(() => { view = create(React.createElement(VideoTimeline, { doc: document, sourceContacts, bench: true, focus, time: 20,
        tracking: [], teams: { us: 'Equipe', them: 'Adversário' }, onFocus: jest.fn(), onSeek, onContact })); });
    const show = view.root.findByProps({ 'aria-label': 'Contatos na timeline' }).findAll(node =>
        typeof node.props.className === 'string' && node.props.className.split(' ').includes('sv-marker')
    ).map(node => node.props.onPointerEnter);
    for (const open of show) {
        act(() => open(bounds));
        const navigate = view.root.findByProps({ role: 'dialog' }).findAllByType('button')
            .filter(node => String(node.props.label).startsWith('Ir para ')).map(node => node.props.onPress);
        for (const seek of navigate) act(() => seek());
    }
    const visited = onSeek.mock.calls.map(([time]) => time).sort((a, b) => a - b);
    expect(visited).toEqual(sourceContacts.filter(contact => !focus || contact.rallyId === focus).map(contact => contact.time!).sort((a, b) => a - b));
    expect(onContact).not.toHaveBeenCalled();expect(JSON.stringify({ document, sourceContacts })).toBe(before);
});

test.each([320, 900])('many manual contacts retain their exact identities and separated groups at %ipx', width => {
    const contacts = Array.from({ length: 480 }, (_, index) => ({ ...doc.contacts[index % doc.contacts.length], id: `manual-${index}`, time: index * 1.975 }));
    const before = JSON.stringify(contacts), groups = timelineContactGroups(contacts, 0, 1000, width, 24);
    expect(groups.flatMap(group => group.contacts)).toEqual(contacts);
    expect(groups.length).toBeLessThan(contacts.length);
    for (let index = 1; index < groups.length; index++) expect((groups[index].position - groups[index - 1].position) * width).toBeGreaterThanOrEqual(24 - .000001);
    expect(JSON.stringify(contacts)).toBe(before);
});


test('mixed dense cluster dispatches manual, official and point choices without changing their original data', () => {
    const document: VideoDocument = { ...doc, media: { ...doc.media, duration: 60 },
        rallies: [{ id: 'mixed', start: 0, pointTime: 10.02, winner: 'us', reviewed: false }],
        contacts: [{ ...doc.contacts[0], id: 'manual-near', time: 10 }], corrections: [] };
    const sourceContacts: StudioSourceContact[] = [
        { id: 'official-near', rallyId: 'mixed', time: 10.01, skill: 'Defesa', result: 'Boa', athlete: 'Ana', detail: 'Original', uncertaintyMs: 40 },
        { id: 'official-outside', rallyId: 'mixed', time: 10.03, skill: 'Bloqueio', result: 'Tocou', athlete: 'Bia', detail: 'Aguardando vídeo', uncertaintyMs: 40 },
    ];
    const before = JSON.stringify({ document, sourceContacts }), onContact = jest.fn(), onSeek = jest.fn(), onPoint = jest.fn();
    act(() => { view = create(React.createElement(VideoTimeline, { doc: document, sourceContacts, bench: true, focus: 'mixed', time: 10,
        availableWindow: [0, 10.025], tracking: [], teams: { us: 'Equipe', them: 'Adversário' }, onFocus: jest.fn(), onSeek, onContact, onPoint }), {
        createNodeMock: element => element.type === 'div' && element.props['data-event-count'] === 4 ? { getBoundingClientRect: bounds.currentTarget.getBoundingClientRect } : null,
    }); });
    const open = () => {
        const group = view.root.findAllByType('div').find(node => node.props['data-event-count'] === 4)!;
        expect(group).toBeDefined();act(() => group.props.onPointerEnter(bounds));
        return view.root.findByProps({ role: 'dialog' });
    };
    expect(open().findAllByType('button')).toHaveLength(4);
    expect(onContact).not.toHaveBeenCalled();expect(onSeek).not.toHaveBeenCalled();expect(onPoint).not.toHaveBeenCalled();
    act(() => button('Ir para Saque em 00:10.000').props.onPress());
    expect(onContact).toHaveBeenCalledTimes(1);expect(onContact).toHaveBeenCalledWith(document.contacts[0]);expect(onSeek).not.toHaveBeenCalled();expect(onPoint).not.toHaveBeenCalled();
    open();act(() => button('Ir para Defesa registrado em 00:10.010').props.onPress());
    expect(onSeek).toHaveBeenCalledTimes(1);expect(onSeek).toHaveBeenCalledWith(10.01);expect(onContact).toHaveBeenCalledTimes(1);expect(onPoint).not.toHaveBeenCalled();
    open();act(() => button('Ir para Ponto em 00:10.020').props.onPress());
    expect(onPoint).toHaveBeenCalledTimes(1);expect(onPoint).toHaveBeenCalledWith('mixed', 10.02);expect(onSeek).toHaveBeenCalledTimes(1);expect(onContact).toHaveBeenCalledTimes(1);
    open();expect(button('Ir para Bloqueio registrado em 00:10.030').props.disabled).toBe(true);
    expect(JSON.stringify({ document, sourceContacts })).toBe(before);
});

test('an unavailable singleton official contact remains disabled inside its tooltip list', () => {
    const document: VideoDocument = { ...doc, media: { ...doc.media, duration: 60 }, rallies: [{ id: 'single', start: 0, winner: null, reviewed: false }], contacts: [] };
    const sourceContacts: StudioSourceContact[] = [{ id: 'outside', rallyId: 'single', time: 12, skill: 'Defesa', result: 'Boa', athlete: 'Ana', detail: '', uncertaintyMs: 40 }];
    act(() => { view = create(React.createElement(VideoTimeline, { doc: document, sourceContacts, bench: true, focus: 'single', time: 0,
        availableWindow: [0, 11], tracking: [], teams: { us: 'Equipe', them: 'Adversário' }, onFocus: jest.fn(), onSeek: jest.fn() })); });
    const marker = view.root.findAllByType('div').find(node => node.props['data-event-count'] === 1)!;
    expect(marker.findByType('button').props.disabled).toBe(true);act(() => marker.props.onPointerEnter(bounds));
    expect(button('Ir para Defesa registrado em 00:12.000').props.disabled).toBe(true);
});

test('240 rallies and 2880 official IDs survive grouping and remain represented in the tooltip lists', () => {
    const fixture = denseOfficialFixture(240);
    const document = { ...fixture.document, media: { ...fixture.document.media, duration: 7200 }, rallies: fixture.document.rallies.map(rally => ({ ...rally, start: rally.start / 2 })) };
    const sourceContacts = fixture.sourceContacts.map(contact => ({ ...contact, time: contact.time! / 2, athlete: contact.id }));
    const before = JSON.stringify({ document, sourceContacts }), onSeek = jest.fn();
    act(() => { view = create(React.createElement(VideoTimeline, { doc: document, sourceContacts, bench: true, focus: null, time: 0,
        tracking: [], teams: { us: 'Equipe', them: 'Adversário' }, onFocus: jest.fn(), onSeek })); });
    const markers = view.root.findAllByType('div').filter(node => node.props['data-event-count'] !== undefined);
    expect(markers.reduce((sum, marker) => sum + marker.props['data-event-count'], 0)).toBe(2880);
    const open = markers.map(marker => marker.props.onPointerEnter), ids: string[] = [];
    for (const show of open) {
        act(() => show(bounds));
        for (const row of view.root.findByProps({ role: 'dialog' }).findAllByType('small')) {
            const match = /^(official-\d+-\d+)(?: ·|$)/.exec(row.children.join(''));
            if (match) ids.push(match[1]);
        }
    }
    expect(new Set(ids).size).toBe(2880);
    expect([...ids].sort()).toEqual(sourceContacts.map(contact => contact.id).sort());
    expect(onSeek).not.toHaveBeenCalled();expect(JSON.stringify({ document, sourceContacts })).toBe(before);
});


test('compact bench group click seeks the first available instant; ArrowDown retains all grouped choices', () => {
    const document: VideoDocument = { ...doc, media: { ...doc.media, duration: 60 }, contacts: [],
        rallies: [{ id: 'group', start: 0, pointTime: 10.02, winner: 'us', reviewed: false }] };
    const sourceContacts: StudioSourceContact[] = [
        { id: 'first', rallyId: 'group', time: 10, skill: 'Saque', result: 'Ace', athlete: '', detail: '', uncertaintyMs: 40 },
    ];
    const onSeek = jest.fn(), onPoint = jest.fn(), props = { doc: document, sourceContacts, bench: true, focus: 'group', time: 10,
        tracking: [], teams: { us: 'A', them: 'B' }, onFocus: jest.fn(), onSeek, onPoint };
    act(() => { view = create(React.createElement(VideoTimeline, props), {
        createNodeMock: element => element.type === 'div' && element.props['data-event-count'] === 2
            ? { getBoundingClientRect: bounds.currentTarget.getBoundingClientRect } : null,
    }); });
    const group = () => view.root.findAllByType('div').find(node => node.props['data-event-count'] === 2)!;
    expect(group().findByType('button').props.iconContent.props.children[1].props.children[0].props.children).toBe('S');
    act(() => group().findByType('button').props.onPress());
    expect(onSeek).toHaveBeenLastCalledWith(10); expect(onPoint).not.toHaveBeenCalled();
    expect(view.root.findAllByProps({ role: 'dialog' })).toHaveLength(0);
    const key = { key: 'ArrowDown', preventDefault: jest.fn(), stopPropagation: jest.fn() };
    act(() => group().props.onKeyDown(key));
    expect(key.preventDefault).toHaveBeenCalled();
    expect(button('Ir para Saque registrado em 00:10.000')).toBeDefined();
    expect(button('Ir para Ponto em 00:10.020')).toBeDefined();
    act(() => view.update(React.createElement(VideoTimeline, { ...props, availableWindow: [10.01, 60] as const })));
    act(() => group().findByType('button').props.onPress());
    expect(onSeek).toHaveBeenLastCalledWith(10.02);
});
