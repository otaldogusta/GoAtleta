import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "../StudentAthleteHome.tsx"), "utf8");

describe("student home navigation", () => {
  it("exposes the main sidebar trigger on mobile web and native", () => {
    expect(source).toContain('accessibilityLabel="Abrir menu principal"');
    expect(source).toContain('new CustomEvent("goatleta:toggle-sidebar")');
    expect(source).toContain("openMobileSidebar()");
    expect(source).toContain("layout.isMobile ? (");
  });
});
