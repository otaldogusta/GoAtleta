import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import {
  resolveEffectiveProfile,
  useEffectiveProfile,
  type EffectiveProfile,
} from "../effective-profile";

describe("effective profile", () => {
  it("uses the professor fallback while the organization provider is unavailable", () => {
    let profile: EffectiveProfile | null = null;

    function Harness() {
      profile = useEffectiveProfile();
      return null;
    }

    expect(() => {
      act(() => {
        TestRenderer.create(React.createElement(Harness));
      });
    }).not.toThrow();
    expect(profile).toBe("professor");
  });

  it("resolves an administrative trainer from the organization role level", () => {
    expect(resolveEffectiveProfile({ role: "trainer", orgRoleLevel: 50 })).toBe("admin");
  });
});
