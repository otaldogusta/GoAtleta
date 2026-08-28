import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { resolveClassPlanModalSafeAreaPadding } from "../class-plan-modal-safe-area";

const workspaceSource = readFileSync(
  resolve(__dirname, "../../UnifiedPlanningWorkspace.tsx"),
  "utf8",
);

describe("class plan fullscreen modal safe area", () => {
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

  it("wires real safe-area insets around both loading and embedded content", () => {
    expect(workspaceSource).toContain('import { useSafeAreaInsets } from "react-native-safe-area-context"');
    expect(workspaceSource).toContain("const insets = useSafeAreaInsets();");
    expect(workspaceSource).toContain("resolveClassPlanModalSafeAreaPadding(compact, insets)");
    expect(workspaceSource).toContain("<View style={modalContentSafeAreaStyle}>");
    expect(workspaceSource).toContain('height: compact ? "100%" : "90%"');
  });
});
