import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StudioPanel } from '../video/StudioPanel.web';

test('tabs restore independent scroll offsets before paint', () => {
    const node = { scrollTop: 0 };
    let view!: ReactTestRenderer;
    const render = (tab: string) => createElement(StudioPanel, { tab }, tab);
    act(() => { view = create(render('rallies'), { createNodeMock: () => node }); });
    const scroll = (top: number) => { node.scrollTop = top; act(() => view.root.findByType('section').props.onScroll({ currentTarget: node })); };
    scroll(640);
    act(() => view.update(render('contacts')));
    expect(node.scrollTop).toBe(0);
    scroll(85);
    act(() => view.update(render('rallies')));
    expect(node.scrollTop).toBe(640);
    act(() => view.update(render('contacts')));
    expect(node.scrollTop).toBe(85);
    act(() => view.unmount());
});
