import fs from "node:fs";
import path from "node:path";

const dashboardSource = fs.readFileSync(
  path.join(__dirname, "..", "PlatformDashboard.tsx"),
  "utf8",
);
const accessesSource = fs.readFileSync(
  path.join(__dirname, "..", "PlatformAccessDashboard.tsx"),
  "utf8",
);

describe("platform lifecycle UI contract", () => {
  test("never renders sample institutions while real records are loading", () => {
    expect(dashboardSource).not.toContain("const institutions:");
    expect(dashboardSource).toContain(
      "useState<Institution[]>([])",
    );
    expect(dashboardSource).toContain("Carregando instituições…");
  });

  test("keeps demo access requests exclusive to the explicit design preview", () => {
    expect(accessesSource.match(/setRequests\(demoRequests\)/g)).toHaveLength(1);
    expect(accessesSource).toContain("if (designPreview)");
    expect(accessesSource).toContain("Não foi possível carregar os acessos.");
  });

  test("treats a temporary access block as suspension, not removal", () => {
    expect(dashboardSource).toContain('paused: "Suspensa"');
    expect(dashboardSource).toContain('lifecycleStatus: "paused"');
    expect(dashboardSource).toContain("Suspender instituição");
  });
});
