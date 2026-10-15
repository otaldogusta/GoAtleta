import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { VideoCorrectionLens } from '../video/VideoCorrectionLens.web';

test('magnifies the source frame at the pointer and hides on exit or seek', () => {
    const drawImage = jest.fn();
    const context = { drawImage, fillRect: jest.fn(), beginPath: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(), stroke: jest.fn() };
    const media = { readyState: 2, seeking: false, videoWidth: 1200, videoHeight: 600 };
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(VideoCorrectionLens, { video: { current: media as HTMLVideoElement }, width: 600, height: 300 }), { createNodeMock: () => ({ getContext: () => context }) }); });
    const target = view.root.findByType('div');
    const event = { clientX: 310, clientY: 170, currentTarget: { getBoundingClientRect: () => ({ left: 10, top: 20, width: 600, height: 300 }) } };
    act(() => target.props.onPointerMove(event));
    expect(drawImage).toHaveBeenCalledWith(media, 552, 252, 96, 96, 0, 0, 160, 160);
    expect(view.root.findByType('canvas').props.style.display).toBe('block');
    act(() => target.props.onPointerLeave());
    expect(view.root.findByType('canvas').props.style.display).toBe('none');
    media.seeking = true;
    drawImage.mockClear();
    act(() => target.props.onPointerMove(event));
    expect(drawImage).not.toHaveBeenCalled();
    act(() => view.unmount());
});
