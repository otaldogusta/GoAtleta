import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Platform } from "react-native";
import { FamilyStudentSwitcher } from "../FamilyStudentSwitcher";
import { ModalSheet } from "../../../ui/ModalSheet";

jest.mock("../../../auth/role", () => ({ useRole: () => ({
  selectedFamilyStudent: { studentId: "ana", studentName: "Ana", relationshipLabel: "Responsável", organizationName: "QA" },
  familyContexts: [
    { relationshipId: "ana-link", studentId: "ana", studentName: "Ana", organizationName: "QA" },
    { relationshipId: "bruno-link", studentId: "bruno", studentName: "Bruno", organizationName: "QA" },
  ],
  setActiveFamilyStudent: jest.fn(async () => true),
}) }));
jest.mock("../../../ui/ModalSheet", () => ({ ModalSheet: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { text: "#fff", card: "#123", border: "#456" } }) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/use-responsive-layout", () => ({ useResponsiveLayout: () => ({ density: { cardPadding: 12 } }) }));

const originals = [
  [globalThis, "document"], [globalThis, "requestAnimationFrame"],
  [globalThis, "cancelAnimationFrame"], [Platform, "OS"],
].map(([target, key]) => ({ target: target as object, key: key as string, descriptor: Object.getOwnPropertyDescriptor(target, key as string) }));
let view: ReactTestRenderer | undefined;
let frames: Map<number, FrameRequestCallback>;
let documentMock: { body: object; activeElement: object; getElementById: jest.Mock };
let target: { isConnected: boolean; getClientRects: jest.Mock; closest: jest.Mock; focus: jest.Mock };
const trigger = () => view!.root.findAll(n => n.props.nativeID && typeof n.props.onPress === "function")[0];
const flushFrame = () => { const pending = [...frames.values()]; frames.clear(); act(() => pending.forEach(callback => callback(0))); };
const close = () => {
  act(() => view!.root.findByType(ModalSheet).props.onClose());
  act(() => view!.root.findByType(ModalSheet).props.onExited());
};

beforeEach(() => {
  frames = new Map();
  let sequence = 0;
  const set = (target: object, key: string, value: unknown) => Object.defineProperty(target, key, { configurable: true, writable: true, value });
  target = { isConnected: true, getClientRects: jest.fn(() => [{}]), closest: jest.fn(() => null), focus: jest.fn() };
  documentMock = { body: {}, activeElement: {}, getElementById: jest.fn(id => id === trigger().props.nativeID ? target : null) };
  set(globalThis, "document", documentMock);
  set(Platform, "OS", "web");
  set(globalThis, "requestAnimationFrame", (callback: FrameRequestCallback) => { const id = ++sequence; frames.set(id, callback); return id; });
  set(globalThis, "cancelAnimationFrame", (id: number) => frames.delete(id));
  act(() => { view = create(React.createElement(FamilyStudentSwitcher)); });
  act(() => trigger().props.onPress());
});
afterEach(() => {
  if (view) act(() => view!.unmount());
  view = undefined;
  for (const { target, key, descriptor } of originals) {
    if (descriptor) Object.defineProperty(target, key, descriptor); else Reflect.deleteProperty(target, key);
  }
});

test("returns to its own launcher after the closing modal has unmounted", () => {
  close();
  expect(target.focus).not.toHaveBeenCalled();
  documentMock.activeElement = documentMock.body;
  flushFrame();
  expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });
});

test("preserves focus deliberately moved to another control while closing", () => {
  close();
  documentMock.activeElement = { id: "other-control" };
  flushFrame();
  expect(target.focus).not.toHaveBeenCalled();
});

test.each(["disconnected", "hidden", "inert"])("does not focus a %s launcher", state => {
  close();
  documentMock.activeElement = documentMock.body;
  if (state === "disconnected") target.isConnected = false;
  if (state === "hidden") target.getClientRects.mockReturnValue([]);
  if (state === "inert") target.closest.mockReturnValue({});
  flushFrame();
  expect(target.focus).not.toHaveBeenCalled();
});

test("cancels pending focus when the selector reopens", () => {
  close();
  documentMock.activeElement = documentMock.body;
  act(() => trigger().props.onPress());
  expect(frames.size).toBe(0);
  flushFrame();
  expect(target.focus).not.toHaveBeenCalled();
});

test("cancels pending focus when the screen unmounts", () => {
  close();
  documentMock.activeElement = documentMock.body;
  act(() => view!.unmount());
  view = undefined;
  expect(frames.size).toBe(0);
  flushFrame();
  expect(target.focus).not.toHaveBeenCalled();
});
