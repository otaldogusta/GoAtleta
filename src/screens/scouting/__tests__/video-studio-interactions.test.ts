import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useStudioInteractions } from '../video/use-studio-interactions';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
let handlers: Record<string, (event: any) => void>;
let view: ReactTestRenderer;
const onDeselect = jest.fn(), onStep = jest.fn(), onPlay = jest.fn();
const props = { modalOpen: false, canDeselect: true, onDeselect, onStep, onPlay };
function Harness(input: typeof props) { useStudioInteractions(input); return null; }
beforeEach(() => {
  jest.clearAllMocks(); handlers = {};
  const events = { addEventListener: (name: string, callback: (event: any) => void) => { handlers[name] = callback; }, removeEventListener: (name: string) => { delete handlers[name]; } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: events });
  act(() => { view = create(createElement(Harness, props)); });
});
afterEach(() => {
  act(() => view.unmount());
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window');
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document');
});
const event = (key = '', inside = false) => ({ key, code: key === ' ' ? 'Space' : key, preventDefault: jest.fn(), target: { closest: (selector: string) => inside && !selector.startsWith('.sv-seek') ? {} : null } });

test('arrows seek and space toggles playback outside form and menu controls', () => {
  const right = event('ArrowRight');
  act(() => handlers.keydown(right));
  expect(onStep).toHaveBeenLastCalledWith(1);
  expect(right.preventDefault).toHaveBeenCalled();
  act(() => handlers.keydown(event('ArrowLeft')));
  expect(onStep).toHaveBeenLastCalledWith(-1);
  act(() => handlers.keydown(event(' ')));
  expect(onPlay).toHaveBeenCalledTimes(1);
  act(() => handlers.keydown(event('ArrowRight', true)));
  expect(onStep).toHaveBeenCalledTimes(2);
  act(() => view.update(createElement(Harness, { ...props, modalOpen: true })));
  act(() => handlers.keydown(event('ArrowRight')));
  expect(onStep).toHaveBeenCalledTimes(2);
});

test('outside click and Escape deselect a clean contact without discarding changed data', () => {
  act(() => handlers.pointerdown(event('', true)));
  expect(onDeselect).not.toHaveBeenCalled();
  act(() => handlers.pointerdown(event()));
  act(() => handlers.keydown(event('Escape')));
  expect(onDeselect).toHaveBeenCalledTimes(2);
  act(() => view.update(createElement(Harness, { ...props, canDeselect: false })));
  act(() => handlers.pointerdown(event()));
  act(() => handlers.keydown(event('Escape')));
  expect(onDeselect).toHaveBeenCalledTimes(2);
});

test('space toggles playback on the timeline slider, without repeats and arrows use the playback step', () => {
  const slider = (key: string, repeat = false) => ({ ...event(key), repeat, target: { closest: (selector: string) => selector.includes('input') ? {} : null } });
  const space = slider(' ');
  act(() => handlers.keydown(space));
  expect(onPlay).toHaveBeenCalledTimes(1);
  expect(space.preventDefault).toHaveBeenCalled();
  act(() => handlers.keydown(slider(' ', true)));
  expect(onPlay).toHaveBeenCalledTimes(1);
  act(() => handlers.keydown(slider('ArrowRight')));
  expect(onStep).toHaveBeenCalledWith(1);
  act(() => view.update(createElement(Harness, { ...props, modalOpen: true })));
  act(() => handlers.keydown(slider(' ')));
  expect(onPlay).toHaveBeenCalledTimes(1);
});
