import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const dashboardSource = readSource(
  "src/screens/finance/CoordinationFinanceDashboard.tsx",
);
const peopleSource = readSource(
  "src/screens/coordination/CoordinationPeopleWorkspace.tsx",
);
const familyAccessSource = readSource(
  "src/screens/family/CoordinationFamilyAccessScreen.tsx",
);
const tuitionSetupSource = readSource(
  "src/screens/finance/CoordinationTuitionSetup.tsx",
);
const newChargeSource = readSource(
  "src/screens/finance/components/NewChargeModal.tsx",
);

describe("coordination finance modal navigation", () => {
  it("keeps charge and settings actions modal while plans stay in the module", () => {
    expect(dashboardSource).toContain("setNewChargeVisible(true)");
    expect(dashboardSource).toContain('setActiveSection("plans")');
    expect(dashboardSource).toContain('setWorkspaceModal("settings")');
    expect(dashboardSource).toContain("<NewChargeModal");
    expect(dashboardSource).toContain("<CoordinationTuitionSetup");
    expect(dashboardSource).toContain("<CoordinationFinanceSettings");
    expect(dashboardSource).toContain('type FinanceSection = "overview" | "charges" | "plans" | "payers"');
    expect(dashboardSource).not.toContain('router.push("/coord/finance/manage"');
    expect(dashboardSource).not.toContain('router.push("/coord/finance/settings"');
  });

  it("keeps the finance header fixed and provides safe back navigation", () => {
    expect(dashboardSource).toContain("<ScreenPageHeader");
    expect(dashboardSource).toContain('title="Financeiro"');
    expect(dashboardSource).toContain("navigateBackOrReplace({ router, fallback: \"/coord/dashboard\" })");
    expect(dashboardSource.indexOf("<ScreenPageHeader")).toBeLessThan(
      dashboardSource.indexOf("<ScrollView"),
    );
    expect(dashboardSource).not.toContain("openMobileSidebar");
  });

  it("keeps family access in people management instead of finance", () => {
    expect(peopleSource).toContain('accessibilityLabel="Gerenciar acessos familiares"');
    expect(peopleSource).toContain("<CoordinationFamilyAccessScreen embedded");
    expect(dashboardSource).toContain('router.push("/coord/management" as never)');
    expect(dashboardSource).not.toContain("<CoordinationFamilyAccessScreen");
  });

  it("closes the embedded flow and returns standalone access to management", () => {
    expect(familyAccessSource).toContain("onBack={onClose ??");
    expect(familyAccessSource).toContain('router.replace("/coord/management" as never)');
  });

  it("uses operational collection language instead of internal relationship terms", () => {
    expect(dashboardSource).toContain("Precisam de atenção");
    expect(dashboardSource).toContain("getOperationalStatusLabel");
    expect(tuitionSetupSource).toContain("Planos e mensalidades");
    expect(tuitionSetupSource).toContain("Gerenciar responsáveis");
    expect(newChargeSource).toContain("Abrir planos e mensalidades");
    expect(newChargeSource).not.toContain("Abrir planos e vínculos");
  });
});
