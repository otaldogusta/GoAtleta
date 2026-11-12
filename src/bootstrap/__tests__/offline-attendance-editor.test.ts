import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { getCachedAttendanceEditor } from "../../db/students";
import { useEmbeddedClassAttendance } from "../../screens/attendance/use-embedded-class-attendance";
import { ClassAttendanceWorkspacePanel } from "../../screens/classes/components/ClassAttendanceWorkspacePanel";
import OfflineAttendanceEditor from "../OfflineAttendanceEditor";

jest.mock("../../db/students", () => ({ getCachedAttendanceEditor: jest.fn() }));
jest.mock("../../screens/attendance/use-embedded-class-attendance", () => ({
  useEmbeddedClassAttendance: jest.fn(),
}));
jest.mock("../../screens/classes/components/ClassAttendanceWorkspacePanel", () => ({
  ClassAttendanceWorkspacePanel: () => null,
}));
jest.mock("../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("../../ui/use-responsive-layout", () => ({
  useResponsiveLayout: () => ({ isMobile: true, density: { pageTitleFontSize: 16 } }),
}));

const startTime = Date.UTC(2026, 10, 12, 12);
const expiresAt = startTime / 1000 + 60;
const date = "2026-11-12";
const setStudentStatus = jest.fn();
const targets = { document: new EventTarget(), window: new EventTarget() };
const globals = ["document", "window"] as const;
const originalDescriptors = globals.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
let tree: TestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(startTime);
  setStudentStatus.mockClear();
  for (const name of globals) {
    Object.defineProperty(globalThis, name, { configurable: true, value: targets[name] });
  }
  jest.mocked(getCachedAttendanceEditor).mockResolvedValue({
    date, students: [], records: [], origin: { userId: "user-a", organizationId: "org-a" },
    assertCurrent: jest.fn(),
  });
  jest.mocked(useEmbeddedClassAttendance).mockReturnValue({
    setStudentStatus,
  } as ReturnType<typeof useEmbeddedClassAttendance>);
});

afterEach(() => {
  if (tree) act(() => tree?.unmount());
  tree = undefined;
  jest.useRealTimers();
  globals.forEach((name, index) => {
    const descriptor = originalDescriptors[index];
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  });
});

async function renderEditor() {
  await act(async () => {
    tree = TestRenderer.create(React.createElement(OfflineAttendanceEditor, {
      classId: "class-a", date, expiresAt, fallback: React.createElement("span", null, "Conecte-se"),
    }));
  });
  return tree!.root;
}

test("blocks attendance marks after expiry even while the tab's timer is suspended", async () => {
  const root = await renderEditor();
  const mark = root.findByType(ClassAttendanceWorkspacePanel).props.onSetStatus;
  act(() => mark("student-a", "presente"));
  expect(setStudentStatus).toHaveBeenCalledWith("student-a", "presente");
  setStudentStatus.mockClear();

  jest.setSystemTime(expiresAt * 1000 + 1);
  expect(root.findAllByType(ClassAttendanceWorkspacePanel)).toHaveLength(1);
  act(() => mark("student-a", "faltou"));
  expect(setStudentStatus).not.toHaveBeenCalled();
});

test.each([
  ["document", "visibilitychange"],
  ["window", "pageshow"],
] as const)("replaces an expired editor with the fallback on %s %s", async (target, event) => {
  const root = await renderEditor();
  jest.setSystemTime(expiresAt * 1000 + 1);
  expect(root.findAllByType(ClassAttendanceWorkspacePanel)).toHaveLength(1);

  act(() => { targets[target].dispatchEvent(new Event(event)); });

  expect(root.findAllByType(ClassAttendanceWorkspacePanel)).toHaveLength(0);
  expect(root.findByType("span").children).toEqual(["Conecte-se"]);
});
