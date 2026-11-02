import { createElement } from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import type { ScoutingCount, ScoutingOverview } from '../../../db/scouting-collection';
import { ScoutingPerformanceOverview, scoutingPerformanceContexts } from '../ScoutingPerformanceOverview';

jest.mock('react-native-svg', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const component = (name: string) => (props: object) => React.createElement(name, props);
    return { __esModule: true, default: component('chart'), Circle: component('circle'), Line: component('line'), Polyline: component('polyline'), Text: component('chart-text') };
});
jest.mock('../../../ui/app-theme', () => ({ useAppTheme: () => ({ colors: { card: '#172234', border: '#283548', text: '#fff', muted: '#8fa1ba', primaryBg: '#30d786' } }) }));
jest.mock('../../../ui/use-responsive-layout', () => ({ useResponsiveLayout: () => ({ supportsSplitView: true, density: { cardPadding: 12, pageGap: 16 } }) }));
jest.mock('../../../components/ui/ResponsiveGrid', () => ({ ResponsiveGrid: ({ children }: { children: unknown }) => children }));
jest.mock('../../../ui/Pressable', () => ({ Pressable: (props: object) => jest.requireActual('react').createElement('button', props) }));
jest.mock('../ScoutingNavigation', () => ({ ScoutingSelect: (props: object) => jest.requireActual('react').createElement('context-select', props) }));
jest.mock('../ScoutingMetrics', () => ({ ScoutingMetrics: (props: object) => jest.requireActual('react').createElement('metrics', props) }));
jest.mock('../ScoutingUI', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return {
        Copy: (props: object) => React.createElement('copy', props),
        Link: (props: object) => React.createElement('button', props),
        amount: (value: number, single: string, plural: string) => `${value} ${value === 1 ? single : plural}`,
        shortDate: (date: string) => date,
    };
});

const count = (fundamental: ScoutingCount['fundamental'], result_key: string, result_level: number, value: number): ScoutingCount => ({ fundamental, result_key, result_level, count: value });
const row = (id: string, overrides: Partial<ScoutingOverview> = {}, session: Partial<ScoutingOverview['session']> = {}): ScoutingOverview => ({
    counts: [], rallyStats: { total: 5, receiving: 3, receivingWon: 2, serving: 2, servingWon: 1 }, ...overrides,
    session: { id, organizationId: 'org', classId: 'class', title: `Set ${id}`, type: 'jogo', date: '2026-11-01', status: 'concluido', format: '6x6', createdAt: '2026-11-01T12:00:00Z', updatedAt: '2026-11-01T12:00:00Z', ...session },
});
const six = () => row('1', { counts: [count('recepcao', 'a_alto', 3, 3), count('recepcao', 'erro', 0, 1), count('ataque', 'ponto', 3, 8), count('ataque', 'erro', 0, 2)] });
const other = () => row('2', { counts: [count('recepcao', 'b_medio', 2, 1), count('recepcao', 'erro', 0, 3), count('ataque', 'ponto', 3, 2), count('ataque', 'erro', 0, 6)] }, { format: 'outro' });
const freeze = <T,>(value: T): T => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
};
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : text(child)).join('');
let view: ReactTestRenderer | undefined;
const one = (type: string) => view!.root.findByType(type as never);
const mount = (rows: ScoutingOverview[], onReview = jest.fn()) => {
    act(() => { view = create(createElement(ScoutingPerformanceOverview, { rows, ready: true, onReview })); });
    return onReview;
};
const labels = () => view!.root.findAll(node => typeof node.props.accessibilityLabel === 'string').map(node => node.props.accessibilityLabel as string);
const choose = (context: string) => act(() => one('context-select').props.onChange(context));
afterEach(() => { act(() => { view?.unmount(); view = undefined; }); });

test('excludes in-progress sets from completed analyses, recorded points and observed actions', () => {
    const completed = six();
    const unfinished = row('unfinished', { counts: [count('ataque', 'ponto', 3, 99)], rallyStats: { total: 99, receiving: 99, receivingWon: 99, serving: 0, servingWon: 0 } }, { status: 'em_andamento', format: 'outro' });
    const contexts = scoutingPerformanceContexts([unfinished, completed]);
    expect(contexts.map(group => ({ key: group.key, ids: group.rows.map(value => value.session.id) }))).toEqual([{ key: '6x6', ids: ['1'] }]);
    mount([unfinished, completed]);
    const summary = view!.root.findByProps({ accessibilityLabel: 'Resumo do scouting concluído' });
    expect(text(summary)).toBe('1análises concluídas14ações observadas5pontos registrados');
    expect(view!.root.findAllByType('context-select' as never)).toHaveLength(0);
    expect(text(view!.root)).not.toContain('jogos concluídos');
});

test('keeps 6x6 and other contexts separate rather than combining their efficiencies', () => {
    mount([other(), six()]);
    expect(one('context-select').props.options).toEqual([{ value: '6x6', label: '6 × 6' }, { value: 'outro', label: 'Outro' }]);
    expect(labels()).toContain('Recepção positiva: 75%');
    expect(labels()).toContain('Eficiência de ataque: 60%');
    choose('outro');
    expect(labels()).toContain('Recepção positiva: 25%');
    expect(labels()).toContain('Eficiência de ataque: -50%');
    expect(labels()).not.toContain('Recepção positiva: 50%');
    expect(text(view!.root)).toContain('1 análise · Outro');
});

test('score-only or attack-only collections do not invent zero reception or a reception trend', () => {
    mount([row('score-only'), row('attack-only', { counts: [count('ataque', 'ponto', 3, 3)] })]);
    expect(labels()).toContain('Recepção positiva: sem registros');
    expect(labels()).not.toContain('Recepção positiva: 0%');
    expect(view!.root.findAllByType('chart' as never)).toHaveLength(0);
    expect(text(view!.root)).toContain('São necessárias duas análises com recepções registradas no mesmo contexto para mostrar a evolução.');
    expect(text(view!.root)).toContain('Coleta parcial · ausência de contato não significa erro.');
});

test('switching context recalculates detailed counts and leaves all input records unchanged', () => {
    const rows = freeze([other(), six()]), original = JSON.stringify(rows);
    mount(rows);
    expect(one('metrics').props.counts).toEqual(rows[1].counts);
    choose('outro');
    expect(one('metrics').props.counts).toEqual(rows[0].counts);
    choose('6x6');
    expect(one('metrics').props.counts).toEqual(rows[1].counts);
    expect(JSON.stringify(rows)).toBe(original);
});

test('draws a trend only with two reception samples in the selected context and opens the chosen analysis', () => {
    const later = row('3', { counts: [count('recepcao', 'b_medio', 2, 2)] }, { date: '2026-11-02' });
    const onReview = mount([later, other(), six()]);
    expect(view!.root.findAllByType('chart' as never)).toHaveLength(1);
    const review = view!.root.findAllByType('button').find(node => node.props.accessibilityLabel === 'Revisar Set 3, recepção 100%');
    expect(review).toBeDefined();
    act(() => review!.props.onPress());
    expect(onReview).toHaveBeenCalledWith('3');
    choose('outro');
    expect(view!.root.findAllByType('chart' as never)).toHaveLength(0);
    expect(view!.root.findAllByType('button').filter(node => node.props.accessibilityLabel?.startsWith('Revisar '))).toHaveLength(0);
});
