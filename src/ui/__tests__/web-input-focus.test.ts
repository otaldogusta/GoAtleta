import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const layout = readFileSync(resolve(__dirname, "../../../app/_layout.tsx"), "utf8");
const focusRule = layout.match(/input:focus-visible,[\s\S]*?\n\}/)?.[0] ?? "";

describe("global web input focus", () => {
  it("does not draw a focus outline or replacement ring on text fields", () => {
    expect(focusRule).toContain("outline: none");
    expect(focusRule).toContain("box-shadow: none");
    expect(focusRule).not.toContain("solid");
    expect(focusRule).not.toContain("colors.");
  });

  it("keeps select focus separate and does not replace validation borders or autofill", () => {
    expect(focusRule).toContain("textarea:focus-visible");
    expect(focusRule).not.toContain("select:focus-visible");
    expect(layout).toContain("select:focus-visible {");
    expect(focusRule).not.toMatch(/border(?:-color)?:/);
    expect(layout).toContain("border-radius: 0px !important");
  });
});
