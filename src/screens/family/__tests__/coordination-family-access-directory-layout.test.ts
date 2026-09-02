import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const screenSource = readFileSync(
  resolve(__dirname, "../CoordinationFamilyAccessScreen.tsx"),
  "utf8"
);

describe("coordination family access athlete directory", () => {
  it("contains long athlete lists in an internally scrollable region", () => {
    expect(screenSource).toContain('accessibilityLabel="Lista de atletas"');
    expect(screenSource).toContain("style={{ maxHeight: 420, minHeight: 0 }}");
    expect(screenSource).toContain("nestedScrollEnabled");
    expect(screenSource).toContain("showsVerticalScrollIndicator");
  });
});
