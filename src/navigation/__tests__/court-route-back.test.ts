import React from "react";
import { render } from "@testing-library/react-native";
import { Platform } from "react-native";

import ClassVisualTechRoute from "../../../app/class/[id]/visual-tech";
import { registerPendingEditsNavigation } from "../pending-edits-navigation";

type Route = { name: string; key: string; params?: Record<string, unknown> };
const parent: Route = { name: "class/[id]", key: "parent-class", params: {
  id: "class-a", date: "2026-10-24", calendarSource: "prof", calendarDate: "2026-10-24", calendarUnit: "Unidade 01", section: "lesson",
} };
const court: Route = { name: "class/[id]/visual-tech", key: "court", params: { id: "class-a" } };
let mockState = { index: 1, routes: [parent, court] };
const mockReplace = jest.fn();
const mockGetState = jest.fn((): typeof mockState | undefined => mockState);
const mockBack = jest.fn(() => { mockState = { ...mockState, index: mockState.index - 1, routes: mockState.routes.slice(0, -1) }; });
let mockWorkspace: { onBack: () => void; lessonDate?: string; documentId?: string; planId?: string };
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => ({ id: "class-a", date: "2026-10-24", visual: "visual-a", plan: "plan-a" }),
  useNavigation: () => ({ getState: mockGetState }),
}));
jest.mock("../../../src/components/visual-court/CourtEditorWorkspace", () => ({
  CourtEditorWorkspace: (props: typeof mockWorkspace) => { mockWorkspace = props; return null; },
}));
jest.mock("../../../src/observability/perf", () => ({ markRender: jest.fn() }));
const originalPlatform = Object.getOwnPropertyDescriptor(Platform, "OS")!;
beforeEach(() => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  mockState = { index: 1, routes: [parent, court] }; mockBack.mockClear(); mockReplace.mockClear(); mockGetState.mockClear();
});
afterEach(() => { Object.defineProperty(Platform, "OS", originalPlatform); });

test("web returns to the exact existing class without replacing its calendar context or adding a duplicate", () => {
  render(React.createElement(ClassVisualTechRoute));
  expect(mockWorkspace).toMatchObject({ lessonDate: "2026-10-24", documentId: "visual-a", planId: "plan-a" });
  mockWorkspace.onBack();
  expect(mockBack).toHaveBeenCalledTimes(1); expect(mockReplace).not.toHaveBeenCalled();
  expect(mockState.routes).toEqual([parent]); expect(mockState.routes[0]).toBe(parent);
  expect(mockState.routes[0].params).toEqual(parent.params);
});

test.each([
  [{ ...parent, params: { id: "class-b" } }, court],
  [{ ...parent, name: "prof" }, court],
  [court],
])("a different parent or direct URL retains the exact class/date fallback", routes => {
  mockState = { index: routes.length - 1, routes };
  render(React.createElement(ClassVisualTechRoute)); mockWorkspace.onBack();
  expect(mockBack).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith({ pathname: "/class/[id]", params: { id: "class-a", date: "2026-10-24" } });
});

test.each(["android", "ios"])("%s keeps its previous explicit replacement even with a matching parent", platform => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: platform });
  render(React.createElement(ClassVisualTechRoute)); mockWorkspace.onBack();
  expect(mockBack).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith({ pathname: "/class/[id]", params: { id: "class-a", date: "2026-10-24" } });
  expect(mockGetState).not.toHaveBeenCalled();
});

test("reads the committed closest stack at return time, preserving a parent URL without the court's date query", () => {
  mockState = { index: 0, routes: [parent] };
  render(React.createElement(ClassVisualTechRoute));
  const parentWithoutQuery: Route = { name: "class/[id]", key: "parent-with-plan", params: { id: "class-a" } };
  mockState = { index: 1, routes: [parentWithoutQuery, court] };
  expect(mockGetState).not.toHaveBeenCalled(); mockWorkspace.onBack();
  expect(mockGetState).toHaveBeenCalledTimes(1); expect(mockBack).toHaveBeenCalledTimes(1); expect(mockReplace).not.toHaveBeenCalled();
  expect(mockState.routes).toEqual([parentWithoutQuery]); expect(mockState.routes[0].params).toEqual({ id: "class-a" });
});

test("a temporarily unavailable public navigation state uses the original explicit fallback", () => {
  mockGetState.mockReturnValueOnce(undefined);
  render(React.createElement(ClassVisualTechRoute)); expect(() => mockWorkspace.onBack()).not.toThrow();
  expect(mockBack).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith({ pathname: "/class/[id]", params: { id: "class-a", date: "2026-10-24" } });
});

test("web pending-edit cancellation blocks the return until the existing guard releases it", () => {
  let release: (() => void) | undefined;
  const cleanup = registerPendingEditsNavigation(navigate => { release = navigate; });
  try {
    render(React.createElement(ClassVisualTechRoute)); mockWorkspace.onBack();
    expect(mockBack).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
    expect(mockState.routes).toEqual([parent, court]); release!();
    expect(mockBack).toHaveBeenCalledTimes(1); expect(mockState.routes).toEqual([parent]);
  } finally { cleanup(); }
});
