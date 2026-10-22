import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AppState, Text } from "react-native";
import { supabasePost } from "../../db/client";
import { useMemberPresence, useMemberPresenceHeartbeat } from "../use-member-presence";

jest.mock("../../db/client", () => ({ supabasePost: jest.fn() }));
jest.mock("../../auth/session", () => ({ getSessionIdentity: () => ({ userId: "user", generation: 1 }) }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const post = jest.mocked(supabasePost);
function Reader({ org = "org", user = "user" }) { return React.createElement(Text, null, useMemberPresence(org,user)); }
function Sender() { useMemberPresenceHeartbeat("org","user"); return null; }
beforeEach(() => {
  jest.useFakeTimers();
  post.mockReset();
  Object.defineProperty(AppState,"currentState",{ configurable:true,value:"active" });
});
afterEach(() => jest.useRealTimers());

it("does not infer online from an unavailable API and clears status on identity change", async () => {
  post.mockResolvedValue([{status:"online"}]);
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r=TestRenderer.create(React.createElement(Reader)); });
  expect(r.root.findByType(Text).props.children).toBe("online");
  post.mockRejectedValue(new Error("offline"));
  await act(async () => { jest.advanceTimersByTime(20_000); });
  expect(r.root.findByType(Text).props.children).toBe("unknown");
  post.mockResolvedValue([{status:"offline"}]);
  await act(async () => { r.update(React.createElement(Reader,{org:"other",user:"other"})); });
  expect(r.root.findByType(Text).props.children).toBe("offline");
  act(() => r.unmount());
});

it("expires a previously online result if a later request never completes", async () => {
  post.mockResolvedValueOnce([{status:"online"}]).mockImplementation(() => new Promise(() => {}));
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r=TestRenderer.create(React.createElement(Reader)); });
  await act(async () => { jest.advanceTimersByTime(60_000); });
  expect(r.root.findByType(Text).props.children).toBe("unknown");
  act(() => r.unmount());
});

it("sends authenticated heartbeats without a target identity and stops in background", async () => {
  post.mockResolvedValue(null);
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r=TestRenderer.create(React.createElement(Sender)); });
  expect(post).toHaveBeenCalledWith("/rpc/touch_my_org_presence",{p_org_id:"org"},undefined,{userId:"user",generation:1});
  post.mockClear();
  Object.defineProperty(AppState,"currentState",{configurable:true,value:"background"});
  await act(async () => { jest.advanceTimersByTime(60_000); });
  expect(post).not.toHaveBeenCalled();
  act(() => r.unmount());
});
