import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("LayoutAnimation on the New Architecture", () => {
  it("does not call the obsolete Android experimental toggle", () => {
    const helperSource = readFileSync(resolve(__dirname, "../animate-layout.ts"), "utf8");
    const studentsSource = readFileSync(
      resolve(__dirname, "../../../app/class/[id]/students.tsx"),
      "utf8"
    );

    expect(helperSource).not.toContain("setLayoutAnimationEnabledExperimental");
    expect(studentsSource).not.toContain("setLayoutAnimationEnabledExperimental");
  });
});
