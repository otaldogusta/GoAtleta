import { act, renderHook } from "@testing-library/react-native";
import { useConversationScroll } from "../useConversationScroll";
const position = (offset: number, height = 1200, viewport = 400) => ({ nativeEvent: { contentOffset: { y: offset }, contentSize: { height }, layoutMeasurement: { height: viewport } } }) as any;
test("shows the arrow only away from the bottom and hides for short conversations", () => {
  const { result } = renderHook(() => useConversationScroll());
  act(() => result.current.onScroll(position(300)));
  expect(result.current.showLatest).toBe(true);
  act(() => result.current.onScroll(position(790)));
  expect(result.current.showLatest).toBe(false);
  act(() => result.current.onScroll(position(0, 200)));
  expect(result.current.showLatest).toBe(false);
});
test("incoming content respects reading position; jumping resumes following", () => {
  const { result } = renderHook(() => useConversationScroll());
  const scrollToEnd = jest.fn();
  (result.current.scrollRef as any).current = { scrollToEnd };
  act(() => result.current.onScroll(position(300)));
  act(() => result.current.onContentSizeChange(300, 1500));
  expect(scrollToEnd).not.toHaveBeenCalled();
  act(() => result.current.scrollToLatest(false));
  expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
  act(() => result.current.onScroll(position(1100, 1500)));
  expect(result.current.showLatest).toBe(false);
  act(() => result.current.onContentSizeChange(300, 1600));
  expect(scrollToEnd).toHaveBeenCalledTimes(2);
});
test("resizing follows the bottom only while pinned", () => {
  const { result } = renderHook(() => useConversationScroll());
  const scrollToEnd = jest.fn();
  (result.current.scrollRef as any).current = { scrollToEnd };
  act(() => result.current.onScroll(position(800)));
  act(() => result.current.onLayout({ nativeEvent: { layout: { height: 250 } } } as any));
  expect(scrollToEnd).toHaveBeenCalledTimes(1);
  act(() => result.current.onScroll(position(300)));
  act(() => result.current.onLayout({ nativeEvent: { layout: { height: 200 } } } as any));
  expect(scrollToEnd).toHaveBeenCalledTimes(1);
});
