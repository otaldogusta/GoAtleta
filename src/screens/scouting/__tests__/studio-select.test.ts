import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StudioSelect } from '../video/StudioSelect.web';
jest.mock('react-native', () => {
  const React = jest.requireActual('react');
  return { Text: 'text', View: React.forwardRef(function MockView(props: object, ref: unknown) {
    React.useImperativeHandle(ref, () => ({ measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => callback(300, 600, 64, 36) }));
    return React.createElement('view', props);
  }) };
});
jest.mock('../../../ui/app-theme', () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock('../../../ui/icon-registry', () => ({ GoAtletaIcon: () => null }));
jest.mock('../../../ui/Pressable', () => ({ Pressable: (props: object) => jest.requireActual('react').createElement('button', props) }));
jest.mock('../../../ui/AnchoredDropdown', () => ({ AnchoredDropdown: (props: { visible: boolean }) => props.visible ? jest.requireActual('react').createElement('dropdown', props) : null }));

test('menu highlights the current option and only changes it on explicit selection', () => {
  const onChange = jest.fn();
  let view!: ReactTestRenderer;
  act(() => { view = create(createElement(StudioSelect, { label: 'Velocidade', value: '1', options: [{ value: '1', label: '1×' }, { value: '2', label: '2×' }], onChange, compact: true })); });
  const trigger = () => view.root.findByProps({ accessibilityLabel: 'Velocidade' });
  act(() => trigger().props.onPress());
  expect(view.root.findByProps({ accessibilityLabel: '1×' }).props['aria-checked']).toBe(true);
  act(() => view.root.findByProps({ accessibilityLabel: '1×' }).props.onPress());
  expect(onChange).not.toHaveBeenCalled();
  expect(trigger().props.accessibilityState.expanded).toBe(false);
  act(() => trigger().props.onPress());
  act(() => view.root.findByProps({ accessibilityLabel: '2×' }).props.onPress());
  expect(onChange).toHaveBeenCalledWith('2');
  expect(trigger().props.accessibilityState.expanded).toBe(false);
  act(() => view.unmount());
});
