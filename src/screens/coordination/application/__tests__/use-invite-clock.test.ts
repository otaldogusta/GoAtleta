import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { TrainerInviteItem } from "../../../../api/trainer-invite";
import { inviteNeedsAction, resolveInviteLifecycleStatus } from "../invite-lifecycle";
import { useInviteClock } from "../use-invite-clock";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("invitation clock", () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date("2026-09-04T12:00:00Z")); });
  afterEach(() => jest.useRealTimers());

  it("updates status and pending count while the screen remains open and cleans its timer", () => {
    const start = Date.now();
    const invites: TrainerInviteItem[] = [{
      id: "invite", organization_id: "org", target_role_level: 10,
      created_at: new Date(start).toISOString(), expires_at: new Date(start + 1000).toISOString(),
      uses: 0, max_uses: 1, revoked: false, invited_via: "email", invited_to: "test@example.com",
    }];
    let status = "";
    let pending = 0;
    function Probe() {
      const now = useInviteClock(invites);
      status = resolveInviteLifecycleStatus(invites[0], now);
      pending = invites.filter((invite) => inviteNeedsAction(invite, now)).length;
      return null;
    }
    let root: TestRenderer.ReactTestRenderer;
    act(() => { root = TestRenderer.create(React.createElement(Probe)); });
    expect(status).toBe("sent");
    expect(pending).toBe(1);
    act(() => jest.advanceTimersByTime(1000));
    expect(status).toBe("expired");
    expect(pending).toBe(0);
    act(() => root!.unmount());
    expect(jest.getTimerCount()).toBe(0);
  });
});
