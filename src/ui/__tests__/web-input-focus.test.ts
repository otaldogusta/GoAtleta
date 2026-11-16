import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const layout = readFileSync(resolve(__dirname, "../../../app/_layout.tsx"), "utf8");
const focusRule = layout.match(/:is\(input:not\([^\n]+:focus \{[\s\S]*?\n\}/)?.[0] ?? "";
const keyboardRule = layout.match(/html\[data-app-keyboard-focus\] :is\(input, textarea, select,[\s\S]*?\n\}/)?.[0] ?? "";

describe("global web input focus", () => {
  it("removes the browser outline without adding a replacement on pointer focus", () => {
    expect(focusRule).toContain("outline: none");
    expect(focusRule).toContain("box-shadow: none");
    expect(focusRule).not.toContain("solid");
    expect(focusRule).not.toContain("colors.");
  });

  it("adds a themed indicator for keyboard navigation while preserving field borders", () => {
    expect(keyboardRule).toContain(":focus");
    expect(keyboardRule).toContain("outline: 2px solid ${colors.inputText}");
    expect(keyboardRule).toContain("#login-email-field");
    expect(keyboardRule).toContain("${keyboardFocusContainer}");
    expect(layout).toContain("${keyboardFocusContainer}:has(> :is(textarea, input):focus)");
    expect(focusRule + keyboardRule).not.toMatch(/border(?:-color)?:/);
    expect(layout).not.toMatch(/border-radius:\s*0(?:px)?\s*!important/);
  });
});
