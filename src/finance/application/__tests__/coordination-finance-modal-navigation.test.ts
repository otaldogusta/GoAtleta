import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

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
const financeSettingsSource = readSource(
  "src/screens/finance/CoordinationFinanceSettings.tsx",
);

describe("coordination finance modal navigation", () => {
  it("keeps charge and settings actions modal while plans stay in the module", () => {
    expect(dashboardSource).toContain("setNewChargeVisible(true)");
    expect(dashboardSource).toContain('setActiveSection("plans")');
    expect(dashboardSource).toContain('setWorkspaceModal("settings")');
    expect(dashboardSource).toContain("<NewChargeModal");
    expect(dashboardSource).toContain("<CoordinationTuitionSetup");
    expect(dashboardSource).toContain("<CoordinationFinanceSettings");
    expect(dashboardSource).toContain(
      'type FinanceSection = "overview" | "charges" | "plans" | "payers"',
    );
    expect(dashboardSource).not.toContain(
      'router.push("/coord/finance/manage"',
    );
    expect(dashboardSource).not.toContain(
      'router.push("/coord/finance/settings"',
    );
  });

  it("keeps the finance header fixed and provides safe back navigation", () => {
    expect(dashboardSource).toContain("<ScreenPageHeader");
    expect(dashboardSource).toContain('title="Financeiro"');
    expect(dashboardSource).toContain("right={financeHeaderControls}");
    expect(dashboardSource).toContain(
      "formatFinanceCompactMonthLabel(selectedMonth)",
    );
    expect(dashboardSource).toContain(
      'navigateBackOrReplace({ router, fallback: "/coord/dashboard" })',
    );
    expect(dashboardSource.indexOf("<ScreenPageHeader")).toBeLessThan(
      dashboardSource.indexOf("<ScrollView"),
    );
    expect(dashboardSource).not.toContain("openMobileSidebar");
  });

  it("keeps the three balance metrics together and moves the rate below on compact layouts", () => {
    expect(dashboardSource).toContain('width: "33.333333%"');
    expect(dashboardSource).toContain('width: compact ? "100%" : "25%"');
    expect(dashboardSource).toContain("borderTopWidth: compact ? 1 : 0");
    expect(dashboardSource).toContain("const columns = compact ? 3 : 4");
  });

  it("lets compact overview cards size to their content", () => {
    expect(dashboardSource).toContain("flex: compact ? undefined : 1.35");
    expect(dashboardSource).toContain("flex: compact ? undefined : 0.8");
    expect(dashboardSource).toContain("resolveFinanceScrollBottomPadding({");
  });

  it("keeps family access in people management instead of finance", () => {
    expect(peopleSource).toContain(
      'accessibilityLabel="Gerenciar acessos familiares"',
    );
    expect(peopleSource).toContain("<CoordinationFamilyAccessScreen embedded");
    expect(dashboardSource).toContain(
      'router.push("/coord/management" as never)',
    );
    expect(dashboardSource).not.toContain("<CoordinationFamilyAccessScreen");
  });

  it("closes the embedded flow and returns standalone access to management", () => {
    expect(familyAccessSource).toContain("onBack={onClose ??");
    expect(familyAccessSource).toContain(
      'router.replace("/coord/management" as never)',
    );
  });

  it("uses operational collection language instead of internal relationship terms", () => {
    expect(dashboardSource).toContain("Precisam de atenção");
    expect(dashboardSource).toContain("getOperationalStatusLabel");
    expect(tuitionSetupSource).toContain("Planos e mensalidades");
    expect(tuitionSetupSource).toContain("Gerenciar responsáveis");
    expect(newChargeSource).toContain("Abrir planos e mensalidades");
    expect(newChargeSource).not.toContain("Abrir planos e vínculos");
  });

  it("refreshes dashboard data after issuing an invoice from the embedded plans tab", () => {
    expect(tuitionSetupSource).toContain(
      "onInvoiceIssued?: (agreement: TuitionAgreement) => void | Promise<void>",
    );
    expect(tuitionSetupSource).toContain("await onInvoiceIssued?.(agreement)");
    expect(dashboardSource).toContain("onInvoiceIssued={() => load(true)}");
  });

  it("keeps provider settings compact and reveals technical details on demand", () => {
    expect(financeSettingsSource).toContain("maxWidth: 760");
    expect(financeSettingsSource).toContain(
      'import { SectionLoadingState } from "../../components/ui/SectionLoadingState";',
    );
    expect(financeSettingsSource).toContain("<SectionLoadingState />");
    expect(financeSettingsSource).toContain("{!loading ? (");
    expect(financeSettingsSource).toContain("Conectar conta");
    expect(financeSettingsSource).toContain("Sincronizar agora");
    expect(financeSettingsSource).toContain("Atualizações automáticas");
    expect(financeSettingsSource).toContain("Trocar chave do Asaas");
    expect(financeSettingsSource).toContain("Salvar nova chave");
    expect(financeSettingsSource).toContain("Remover conexão");
    expect(financeSettingsSource).toContain(
      'import { useConfirmDialog } from "../../ui/confirm-dialog";',
    );
    expect(financeSettingsSource).toContain("Remover conexão do Asaas?");
    expect(financeSettingsSource).toContain('tone: "danger"');
    expect(financeSettingsSource).not.toContain("Remover mesmo?");
    expect(financeSettingsSource).not.toContain("confirmDisconnect");
    expect(financeSettingsSource).toContain("styles.providerKeyInlineEditor");
    expect(financeSettingsSource).toContain("styles.providerKeyInlineInput");
    expect(financeSettingsSource).not.toContain("styles.inlineKeyEditor");
    expect(financeSettingsSource).not.toContain("keyManagementSection");
    expect(financeSettingsSource).not.toContain(
      "Confirme para remover a credencial.",
    );
    expect(financeSettingsSource).toContain("rotateFinanceProviderKey");
    expect(financeSettingsSource).toContain("styles.operationalRow");
    expect(financeSettingsSource).toContain("Como funciona");
    expect(financeSettingsSource).toContain(
      "accessibilityState={{ expanded: detailsOpen }}",
    );
    expect(financeSettingsSource).not.toContain(
      'label="Sincronizar histórico"',
    );
    expect(financeSettingsSource).not.toContain('label="Ativar atualizações"');
    expect(financeSettingsSource).not.toContain("Sincronização existente");
    expect(financeSettingsSource).not.toContain("Formas de pagamento");
    expect(financeSettingsSource).not.toContain("Regras de cobrança");
  });

  it("routes finance successes through the canonical timed global notice", () => {
    expect(financeSettingsSource).toContain(
      'import { useSaveToast } from "../../ui/save-toast";',
    );
    expect(financeSettingsSource).toContain(
      "const { showSaveToast } = useSaveToast();",
    );
    expect(financeSettingsSource).toContain(
      '"Atualizações automáticas configuradas."',
    );
    expect(financeSettingsSource).not.toContain('tone: "success"');
  });

  it("uses the canonical close header inside the finance modal", () => {
    expect(financeSettingsSource).toContain(
      'accessibilityLabel="Fechar configurações financeiras"',
    );
    expect(financeSettingsSource).toContain('<GoAtletaIcon name="close"');
    expect(financeSettingsSource).toContain("{!embedded ? (");
    expect(financeSettingsSource).toContain("<ScreenPageHeader");
    expect(financeSettingsSource).toContain(
      "paddingTop: embedded ? spacing.md : 0",
    );
    expect(financeSettingsSource).toContain(
      "const contentSizedEmbedded = embedded && !responsiveLayout.isMobile",
    );
    expect(dashboardSource).toContain(
      'height: responsiveLayout.isMobile ? "94%" : undefined',
    );
  });

  it("detects the Asaas environment without asking the user", () => {
    expect(financeSettingsSource).not.toContain("Usar em");
    expect(financeSettingsSource).not.toContain("setEnvironment");
    expect(financeSettingsSource).not.toContain("FinanceProviderEnvironment");
    expect(financeSettingsSource).toContain("Conta real");
    expect(financeSettingsSource).not.toContain(
      "A chave é criptografada e não volta a aparecer nesta tela.",
    );
    expect(financeSettingsSource).not.toContain("Pronto para conectar");
  });

  it("exposes the fictional connector only in development", () => {
    expect(financeSettingsSource).toContain("{__DEV__ ? (");
    expect(financeSettingsSource).toContain("Testar com dados fictícios");
    expect(financeSettingsSource).toContain("Demonstração local");
    expect(financeSettingsSource).toContain("startFinanceProviderDemo");
    expect(dashboardSource).toContain("allowLocalDemo={designPreview}");
  });

  it("keeps fictional invoices in the selected current month", () => {
    expect(dashboardSource).toContain(
      "const DESIGN_PREVIEW_MONTH = currentMonthKey();",
    );
    expect(dashboardSource).toContain(
      "competenceMonth: `${DESIGN_PREVIEW_MONTH}-01`",
    );
    expect(dashboardSource).toContain(
      "const DESIGN_PREVIEW_SUMMARY = summarizeFinanceInvoices(",
    );
  });
});
