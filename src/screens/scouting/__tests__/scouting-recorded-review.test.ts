import { createElement } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { ScoutingAction, ScoutingRally } from '../../../core/models';
import type { ScoutingDetail } from '../../../db/scouting-collection';
import { applyScoutingCommand } from '../../../db/scouting-collection';
import { ScoutingRecordedReview } from '../ScoutingRecordedReview';

jest.mock('../../../ui/app-theme', () => ({ useAppTheme: () => ({ mode: 'dark', colors: {} }) }));
jest.mock('../../../ui/icon-registry', () => ({ GoAtletaIcon: () => null }));
jest.mock('../../../db/scouting-collection', () => ({ applyScoutingCommand: jest.fn() }));
jest.mock('../use-scouting-collection', () => ({ useScoutingCollection: () => { throw new Error('Review cannot mount the capture flow.'); } }));

const freeze = <T,>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const rally = (id: string, overrides: Partial<ScoutingRally> = {}): ScoutingRally => ({
  id, sessionId: 'game', setNumber: 1, number: 1, won: false, serve: 'them', rotation: 3,
  scoreUs: 0, scoreThem: 1, contacts: [], createdAt: '2026-11-01T12:00:00Z', ...overrides,
});
const fixture = (overrides: Partial<ScoutingDetail> = {}): ScoutingDetail => ({
  session: { id: 'game', organizationId: 'org', classId: 'class', title: 'Taça Paraná', type: 'jogo', date: '2026-11-01', status: 'concluido', format: '6x6', createdAt: '2026-11-01T12:00:00Z', updatedAt: '2026-11-01T12:00:00Z' },
  captureReady: true, captureVersion: 3, actions: [], rallies: [
    rally('p1', { contacts: [
      { studentId: 'ana', athleteName: 'Ana Martins', fundamental: 'recepcao', resultKey: 'b_medio', phase: 'side_out', zone: 6 },
      { studentId: null, athleteName: null, fundamental: 'ataque', resultKey: 'freeball_devolvida', phase: 'side_out', zone: 2 },
    ] }),
    rally('p2', { number: 2, won: true, serve: 'us', scoreUs: 1, contacts: [{ studentId: 'joao', athleteName: 'João Victor', fundamental: 'saque', resultKey: 'ace', phase: 'saque', zone: 1 }], outcome: { kind: 'ace', team: 'us' } }),
    rally('p3', { setNumber: 2, number: 1, scoreUs: 12, scoreThem: 15 }),
  ], ...overrides,
});
beforeEach(() => jest.clearAllMocks());
afterEach(() => expect(applyScoutingCommand).not.toHaveBeenCalled());

test('browses recorded points in order, keeps score-only observations and respects navigation boundaries', () => {
  const detail = freeze(fixture()), original = JSON.stringify(detail), screen = render(createElement(ScoutingRecordedReview, { detail }));
  expect(screen.getByLabelText('Revisar scouting sem vídeo')).toBeTruthy();
  expect(screen.getByLabelText('Placar registrado: nós 0, adversário 1')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Revisar ponto 1, set 1, 0 a 1' })).toBeSelected();
  expect(screen.getByRole('button', { name: 'Ponto anterior' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Ponto anterior' }));
  fireEvent.press(screen.getByRole('button', { name: 'Próximo ponto' }));
  expect(screen.getByLabelText('Placar registrado: nós 1, adversário 1')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Ver contato 1: João Victor' })).toBeSelected();
  expect(screen.getAllByText('Ace nosso')).toHaveLength(2);
  fireEvent.press(screen.getByRole('button', { name: 'Próximo ponto' }));
  expect(screen.getByText('Set 2 · Ponto 3')).toBeTruthy();
  expect(screen.getByLabelText('Placar registrado: nós 12, adversário 15')).toBeTruthy();
  expect(screen.getByText('Somente placar registrado.')).toBeTruthy();
  expect(screen.queryByText('Local do contato')).toBeNull();
  expect(screen.getByRole('button', { name: 'Próximo ponto' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Próximo ponto' }));
  fireEvent.press(screen.getByRole('button', { name: 'Ponto anterior' }));
  expect(screen.getByLabelText('Placar registrado: nós 1, adversário 1')).toBeTruthy();
  expect(JSON.stringify(detail)).toBe(original);
});

test('selects contacts for their recorded zone, resets selection on a different point and offers no capture commands', () => {
  const detail = freeze(fixture()), original = JSON.stringify(detail), screen = render(createElement(ScoutingRecordedReview, { detail, containerWidth: 380 }));
  expect(screen.getByText('Zona 6')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Ver contato 2: Equipe' }));
  expect(screen.getByRole('button', { name: 'Ver contato 2: Equipe' })).toBeSelected();
  expect(screen.getByText('Zona 2')).toBeTruthy();
  expect(screen.getAllByText(/Bola de graça/).length).toBeGreaterThan(0);
  fireEvent.press(screen.getByRole('button', { name: 'Revisar ponto 2, set 1, 1 a 1' }));
  expect(screen.getByText('Zona 1')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Revisar ponto 1, set 1, 0 a 1' }));
  expect(screen.getByRole('button', { name: 'Ver contato 1: Ana Martins' })).toBeSelected();
  expect(screen.getByText('Zona 6')).toBeTruthy();
  for (const name of ['＋ Nosso ponto', '＋ Ponto adversário', 'Desfazer ponto', 'Refazer ponto', 'Editar placar', 'Encerrar análise', 'Desfazer contato']) expect(screen.queryByRole('button', { name })).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(JSON.stringify(detail)).toBe(original);
});

test('renders a recorded team fault and a partial rally without assigning an athlete or inventing a contact', () => {
  const detail = freeze(fixture({ rallies: [rally('fault', { scoreUs: 19, scoreThem: 20, outcome: { kind: 'falta', team: 'us', reason: 'rede' } })] })), original = JSON.stringify(detail);
  const screen = render(createElement(ScoutingRecordedReview, { detail }));
  expect(screen.getAllByText('Falta nossa · Rede')).toHaveLength(2);
  expect(screen.getByText('Contatos · 0')).toBeTruthy();
  expect(screen.getByText('Somente placar registrado.')).toBeTruthy();
  expect(screen.queryAllByRole('button').filter(button => String(button.props.accessibilityLabel).startsWith('Ver contato '))).toHaveLength(0);
  expect(screen.queryByText('Ana Martins')).toBeNull();
  expect(JSON.stringify(detail)).toBe(original);
});

test('keeps the selected record across responsive reflow and falls back safely if refreshed data omits that point', () => {
  const detail = freeze(fixture()), screen = render(createElement(ScoutingRecordedReview, { detail, containerWidth: 1040 }));
  fireEvent.press(screen.getByRole('button', { name: 'Revisar ponto 2, set 1, 1 a 1' }));
  screen.rerender(createElement(ScoutingRecordedReview, { detail, containerWidth: 600 }));
  expect(screen.getByRole('button', { name: 'Revisar ponto 2, set 1, 1 a 1' })).toBeSelected();
  expect(screen.getByText('Zona 1')).toBeTruthy();
  const refreshed = freeze({ ...detail, rallies: [detail.rallies[0]] });
  screen.rerender(createElement(ScoutingRecordedReview, { detail: refreshed, containerWidth: 600 }));
  expect(screen.getByRole('button', { name: 'Revisar ponto 1, set 1, 0 a 1' })).toBeSelected();
  expect(screen.getByText('Zona 6')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Ponto anterior' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Próximo ponto' })).toBeDisabled();
});

test('historical actions without points remain readable with original labels, including unattributed actions', () => {
  const action: ScoutingAction = { id: 'a1', sessionId: 'game', organizationId: 'org', classId: 'class', athleteName: 'Ana Martins', fundamental: 'recepcao', phase: 'side_out', resultKey: 'b_medio', resultLabel: 'Boa', resultLevel: 2, createdAt: '2026-11-01T12:00:00Z' };
  const detail = freeze(fixture({ rallies: [], actions: [action, { ...action, id: 'a2', athleteName: null, fundamental: 'ataque', resultKey: 'legacy-observation', resultLabel: 'Resultado histórico', resultLevel: 1 }] })), original = JSON.stringify(detail);
  const screen = render(createElement(ScoutingRecordedReview, { detail }));
  expect(screen.getByText('Ações · 2')).toBeTruthy();
  expect(screen.getByText('Ana Martins')).toBeTruthy();
  expect(screen.getByText('Recepção · Boa')).toBeTruthy();
  expect(screen.getByText('Equipe')).toBeTruthy();
  expect(screen.getByText('Ataque · Resultado histórico')).toBeTruthy();
  expect(screen.queryByText('Contatos · 0')).toBeNull();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(JSON.stringify(detail)).toBe(original);
});

test('preserves unfamiliar historical contact results without converting them or adding an athlete or zone', () => {
  const detail = freeze(fixture({ rallies: [rally('legacy', { contacts: [{ fundamental: 'ataque', resultKey: 'resultado-antigo', phase: 'transicao' }] })] })), original = JSON.stringify(detail);
  const screen = render(createElement(ScoutingRecordedReview, { detail }));
  expect(screen.getByRole('button', { name: 'Ver contato 1: Equipe' })).toBeSelected();
  expect(screen.getByText('Equipe · resultado-antigo')).toBeTruthy();
  expect(screen.getByText('Ataque · resultado-antigo')).toBeTruthy();
  expect(screen.queryByText('Local do contato')).toBeNull();
  expect(JSON.stringify(detail)).toBe(original);
});

test('empty historical sessions show a readable empty state without fabricated points or write actions', () => {
  const detail = freeze(fixture({ rallies: [], session: { ...fixture().session, status: 'em_andamento' } }));
  const screen = render(createElement(ScoutingRecordedReview, { detail }));
  expect(screen.getByText('Ações · 0')).toBeTruthy();
  expect(screen.getByText('Registrado')).toBeTruthy();
  expect(screen.getByText('Nenhum registro nesta análise.')).toBeTruthy();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(screen.queryByLabelText(/Placar registrado/)).toBeNull();
});
