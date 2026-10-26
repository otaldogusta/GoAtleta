import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Platform } from "react-native";
import { isTransientRoleError, useRoleRecovery } from "../use-role-recovery";

const transient = () => Object.assign(new Error("temporarily unavailable"), { status: 503 });
let props: { error: Error | null; loading: boolean; sessionKey: string };
let retry: jest.Mock;
function Probe() { useRoleRecovery(props.error, props.loading, retry, props.sessionKey); return null; }
let tree: TestRenderer.ReactTestRenderer;
let doc: EventTarget & { visibilityState: string };
let win: EventTarget;
const priorDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const priorPlatform = Platform.OS;

beforeEach(() => {
  jest.useFakeTimers();
  Platform.OS = "web";
  doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  win = new EventTarget();
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  props = { error: transient(), loading: false, sessionKey: "user-a" };
  retry = jest.fn().mockResolvedValue(undefined);
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  jest.useRealTimers(); Platform.OS = priorPlatform;
  if (priorDocument) Object.defineProperty(globalThis, "document", priorDocument); else Reflect.deleteProperty(globalThis, "document");
  if (priorWindow) Object.defineProperty(globalThis, "window", priorWindow); else Reflect.deleteProperty(globalThis, "window");
});
const render = () => act(() => { tree = TestRenderer.create(React.createElement(Probe)); });
const update = () => act(() => tree.update(React.createElement(Probe)));

test("retries transient failures twice, then waits instead of looping", () => {
  render(); act(() => jest.advanceTimersByTime(1000)); expect(retry).toHaveBeenCalledTimes(1);
  props = { ...props, loading: true, error: null }; update();
  props = { ...props, loading: false, error: transient() }; update();
  act(() => jest.advanceTimersByTime(3000)); expect(retry).toHaveBeenCalledTimes(2);
  props = { ...props, error: transient() }; update();
  act(() => jest.advanceTimersByTime(60000)); expect(retry).toHaveBeenCalledTimes(2);
});
test("waits while hidden and retries once when resumed, deduplicating online/pageshow", () => {
  doc.visibilityState = "hidden"; render();
  act(() => jest.advanceTimersByTime(60000)); expect(retry).not.toHaveBeenCalled();
  act(() => { doc.visibilityState = "visible"; doc.dispatchEvent(new Event("visibilitychange")); win.dispatchEvent(new Event("online")); win.dispatchEvent(new Event("pageshow")); });
  expect(retry).toHaveBeenCalledTimes(1);
  // Duplicate browser signals must not reset the budget of the running attempt.
  props = { ...props, loading: true, error: null }; update();
  props = { ...props, loading: false, error: transient() }; update();
  act(() => jest.advanceTimersByTime(1000)); expect(retry).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(2000)); expect(retry).toHaveBeenCalledTimes(2);
  props = { ...props, error: transient() }; update();
  act(() => jest.advanceTimersByTime(60000)); expect(retry).toHaveBeenCalledTimes(2);
});
test("recovers on online and cancels an old identity's scheduled retry", () => {
  render(); props = { error: null, loading: true, sessionKey: "user-b" }; update();
  act(() => jest.advanceTimersByTime(10000)); expect(retry).not.toHaveBeenCalled();
  props = { ...props, error: transient(), loading: false }; update();
  act(() => win.dispatchEvent(new Event("online"))); expect(retry).toHaveBeenCalledTimes(1);
});
test("retries on the browser resume event and removes listeners on unmount", () => {
  render();
  act(() => doc.dispatchEvent(new Event("resume")));
  expect(retry).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
  act(() => { doc.dispatchEvent(new Event("resume")); jest.advanceTimersByTime(10000); });
  expect(retry).toHaveBeenCalledTimes(1);
});
test.each([401,403,404])("does not retry authorization or contract failure %s", status => {
  props.error = Object.assign(new Error("denied"), { status }); render();
  act(() => { jest.advanceTimersByTime(60000); win.dispatchEvent(new Event("online")); });
  expect(retry).not.toHaveBeenCalled();
});
test("does not retry arbitrary programming errors", () => {
  expect(isTransientRoleError(new TypeError("Cannot read properties of undefined"))).toBe(false);
  expect(isTransientRoleError(new TypeError("Failed to fetch"))).toBe(true);
  expect(isTransientRoleError(Object.assign(new Error("timeout"), {status:408}))).toBe(true);
});
