import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { CourtReadOnlyPlayer } from '../CourtReadOnlyPlayer';
import { newCourtBoard, duplicateStep } from '../../../core/visual-court-editor';

jest.mock('../CourtPerspectiveCanvas', () => ({ CourtPerspectiveCanvas: 'Perspective' }));
jest.mock('../CourtEditorCanvas', () => ({ CourtEditorCanvas: 'Canvas' }));
jest.mock('../CourtEditorControls', () => ({ CourtActionButton: 'Action' }));
jest.mock('../CourtSimulationControls', () => ({ CourtSimulationTransport: 'Transport' }));

it('offers playback, camera, views and steps without enabling editor mutations', () => {
  const payload = duplicateStep(newCourtBoard(), 0).payload;
  const original = JSON.stringify(payload);
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(React.createElement(CourtReadOnlyPlayer, { payload, onClose: () => {} })); });
  const surface = () => tree.root.findByType('Perspective' as never);
  expect(surface().props.disabled).toBe(true);
  expect(surface().props.onSimulationHandle).toBeUndefined();
  act(() => { surface().props.onMove(['player'], { x: 1, y: 1 }); surface().props.onDraw({}); surface().props.onShortcut('save'); });
  expect(JSON.stringify(payload)).toBe(original);
  act(() => tree.root.findByProps({ label: 'Próxima etapa' }).props.onPress());
  expect(surface().props.stepIndex).toBe(1);
  act(() => tree.root.findByProps({ label: 'Quadra 2D' }).props.onPress());
  expect(tree.root.findByType('Canvas' as never).props.disabled).toBe(true);
  expect(tree.root.findAllByProps({ label: 'Salvar' })).toHaveLength(0);
  act(() => tree.unmount());
});
