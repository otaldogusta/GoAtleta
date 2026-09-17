import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../..");

describe("student standalone workspace shell", () => {
  it.each([
    "app/student-plan.tsx",
    "app/absence-report.tsx",
    "app/student-scouting.tsx",
  ])("keeps %s inside the student AppShell", (file) => {
    const source = fs.readFileSync(path.join(repoRoot, file), "utf8");
    expect(source).toContain('<AppShell role="student">');
    expect(source).toContain('useResponsiveLayout("dashboard")');
  });

  it("wraps the root communications route without nesting the coordination shell", () => {
    const source = fs.readFileSync(path.join(repoRoot, "app/communications.tsx"), "utf8");
    expect(source).toContain('pathname.startsWith("/coord/") ? screen');
    expect(source).toContain('<AppShell role="student">{screen}</AppShell>');
  });
});
