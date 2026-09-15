import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../../..");

describe("attendance floating save", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "app/class/[id]/attendance.tsx"),
    "utf8",
  );

  it("uses one floating web action only while the attendance has changes", () => {
    expect(source).toContain('import { FloatingSaveBar } from "../../../src/ui/FloatingSaveBar";');
    expect(source).toContain('visible={Platform.OS === "web" && hasChanges}');
    expect(source).toContain('label={isSavingAttendance ? "Salvando chamada..." : "Salvar chamada"}');
    expect(source).toContain('isMobile && Platform.OS !== "web"');
    expect(source).toContain('Platform.OS !== "web" ? (');
  });

  it("reserves list space so the floating action does not cover students", () => {
    expect(source).toContain('Platform.OS === "web" && hasChanges ? 104');
  });
});
