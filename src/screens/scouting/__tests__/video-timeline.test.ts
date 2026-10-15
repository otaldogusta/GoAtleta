import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { VideoTimeline } from '../video/VideoTimeline.web';
import { timelineContactGroups } from '../video/timeline-contacts';
import type { VideoDocument } from '../../../core/scouting-video';
import { contactOutcomeSummary, contactOutcomeTone } from '../video/video-contact-outcomes';

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
    const preview = view.root.findByProps({ role: 'tooltip' }).findAllByType('small').map(n => n.children.join('')).join(' ');
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
    const style = view.root.findByProps({ role: 'tooltip' }).props.style;
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
    const tip = view.root.findByProps({ role: 'tooltip' });
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

test('drag previews every position locally despite stale player ticks and seeks only on release', () => {
    const before = JSON.stringify(doc);
    const props = { doc, focus: 'r1', time: 5, tracking: [], teams: { us: 'Equipe', them: 'Adversário' }, onFocus: jest.fn(), onSeek: jest.fn() };
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
