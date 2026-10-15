import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { VideoShareAudienceMenu, VideoShareRoleMenu } from '../video/VideoShareRoleMenu.web';

jest.mock('react-native', () => {
  const React = jest.requireActual('react');
  return { Text: 'text', View: React.forwardRef(function MockView(props: object, ref: unknown) {
    React.useImperativeHandle(ref, () => ({ measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => callback(300, 100, 80, 38) }));
    return React.createElement('view', props);
  }) };
});

test('audience menu changes access only when choosing a different option', () => {
  const onChange = jest.fn();
  let view!: ReactTestRenderer;
  act(() => { view = create(createElement(VideoShareAudienceMenu, { value: 'team', onChange })); });
  const trigger = () => view.root.findByProps({ accessibilityLabel: 'Quem pode acessar' });
  act(() => trigger().props.onPress());
  const team = view.root.findByProps({ accessibilityLabel: 'Equipe desta turma' });
  expect(team.props['aria-checked']).toBe(true);
  act(() => team.props.onPress());
  expect(onChange).not.toHaveBeenCalled();
  expect(trigger().props.accessibilityState.expanded).toBe(false);
  act(() => trigger().props.onPress());
  act(() => view.root.findByProps({ accessibilityLabel: 'Qualquer pessoa com o link' }).props.onPress());
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith('link');
  expect(trigger().props.accessibilityState.expanded).toBe(false);
  act(() => view.update(createElement(VideoShareAudienceMenu, { value: 'link', onChange })));
  act(() => trigger().props.onPress());
  expect(view.root.findByProps({ accessibilityLabel: 'Qualquer pessoa com o link' }).props['aria-checked']).toBe(true);
  act(() => view.unmount());
});
jest.mock('../../../ui/app-theme', () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock('../../../ui/icon-registry', () => ({ GoAtletaIcon: () => null }));
jest.mock('../../../ui/Pressable', () => ({ Pressable: (props: object) => jest.requireActual('react').createElement('button', props) }));
jest.mock('../../../ui/AnchoredDropdown', () => ({ AnchoredDropdown: (props: { visible: boolean }) => props.visible ? jest.requireActual('react').createElement('dropdown', props) : null }));

test('role menu opens with viewer selected and cannot grant unavailable roles', () => {
  let view!: ReactTestRenderer;
  act(() => {
    view = create(createElement(VideoShareRoleMenu));
  });
  const trigger = () => view.root.findByProps({ accessibilityLabel: 'Permissão: Leitor' });
  expect(trigger().props.accessibilityState.expanded).toBe(false);
  act(() => trigger().props.onPress());
  expect(trigger().props.accessibilityState.expanded).toBe(true);
  const reader = view.root.findByProps({ accessibilityLabel: 'Leitor' });
  expect(reader.props['aria-checked']).toBe(true);
  for (const label of ['Comentador', 'Editor']) {
    const option = view.root.findByProps({ accessibilityLabel: `${label} — indisponível` });
    expect(option.props.disabled).toBe(true);
    expect(option.props.onPress).toBeUndefined();
  }
  act(() => reader.props.onPress());
  expect(trigger().props.accessibilityState.expanded).toBe(false);
  act(() => view.unmount());
});
