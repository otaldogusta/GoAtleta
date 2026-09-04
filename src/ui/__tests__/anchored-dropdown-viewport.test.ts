import { readFileSync } from "fs";
import { resolve } from "path";

const source = readFileSync(resolve(__dirname, "../AnchoredDropdown.tsx"), "utf8");

describe("anchored dropdown viewport contract", () => {
  test("clamps fixed web portals to the CSS layout viewport, including browser zoom", () => {
    expect(source).toContain("document.documentElement");
    expect(source).toContain('layoutViewport?.clientWidth || Dimensions.get("window").width');
    expect(source).toContain('layoutViewport?.clientHeight || Dimensions.get("window").height');
    expect(source).toContain("windowWidth - 16 - resolvedWidth");
    expect(source).toContain("ReactDOM.createPortal(dropdown, document.body)");
  });

  test("dismisses stale anchors on resizing and removes its listeners", () => {
    expect(source).toContain('window.addEventListener("resize", handleVisibilityOrBlur)');
    expect(source).toContain('window.removeEventListener("resize", handleVisibilityOrBlur)');
    expect(source).toContain('window.visualViewport?.addEventListener("resize", handleVisibilityOrBlur)');
    expect(source).toContain('window.visualViewport?.removeEventListener("resize", handleVisibilityOrBlur)');
  });
});
