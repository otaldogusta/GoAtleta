import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";

import { resolveClassPlanModalSafeAreaPadding } from "../class-plan-modal-safe-area";
import { ClassPlanModalHeader, isClassPlanPhoneLayout } from "../../../classes/components/ClassPlanModalFrame";
import { compactUiMetrics } from "../../../../theme/tokens";

const workspaceSource = readFileSync(
  resolve(__dirname, "../../UnifiedPlanningWorkspace.tsx"),
  "utf8",
);
const previewSource = readFileSync(
  resolve(__dirname, "../../../classes/components/ClassPlanPreviewModal.tsx"),
  "utf8",
);
const frameSource = readFileSync(
  resolve(__dirname, "../../../classes/components/ClassPlanModalFrame.tsx"),
  "utf8",
);

describe("class plan fullscreen modal safe area", () => {
  it("uses the same phone header breakpoint for loading and ready content", () => {
    expect(isClassPlanPhoneLayout(599)).toBe(true);
    expect(isClassPlanPhoneLayout(600)).toBe(false);
  });

  it("protects status bar, cutout, and navigation edges in compact mode", () => {
    expect(
      resolveClassPlanModalSafeAreaPadding(true, {
        top: 48,
        right: 12,
        bottom: 34,
        left: 8,
      }),
    ).toEqual({
      paddingTop: 48,
      paddingRight: 12,
      paddingBottom: 34,
      paddingLeft: 8,
    });
  });

  it("keeps the centered non-compact modal dimensions unchanged", () => {
    expect(
      resolveClassPlanModalSafeAreaPadding(false, {
        top: 48,
        right: 12,
        bottom: 34,
        left: 8,
      }),
    ).toEqual({
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
    });
  });

  it("uses one centered frame and header geometry while ModalSheet owns safe areas", () => {
    expect(workspaceSource).toContain("<ClassPlanModalFrame");
    expect(workspaceSource).toContain("<ClassPlanModalHeader");
    expect(workspaceSource).toContain("<View style={modalContentSafeAreaStyle}>");
    expect(previewSource).toContain("<ClassPlanModalFrame");
    expect(previewSource).toContain("<ClassPlanModalHeader");
    expect(frameSource).toContain("containerPadding={8}");
    expect(frameSource).toContain('width: "94%"');
    expect(frameSource).toContain('height: "90%"');
    expect(frameSource).toContain("borderRadius: 18");
  });

  it("keeps both rendered headers compact while preserving the minimum touch target", () => {
    for (const phoneLayout of [false, true]) {
      const props = { phoneLayout, borderColor: "#334455", textColor: "#ffffff", mutedColor: "#aabbcc", title: "Plano", subtitle: "Turma", children: null };
      const header = render(React.createElement(ClassPlanModalHeader, props));
      const tree = header.toJSON();
      if (!tree || Array.isArray(tree)) throw new Error("Expected a single header frame");
      const height = StyleSheet.flatten(tree.props.style).minHeight;
      expect(height).toBeGreaterThanOrEqual(compactUiMetrics.touchTarget);
      expect(height).toBeLessThanOrEqual(56);
      header.unmount();
    }
  });
});
