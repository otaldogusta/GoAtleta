import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const trainingRoute = readFileSync(
  resolve(__dirname, "../../../../../app/training/index.tsx"),
  "utf8"
);
const classPlanWorkspace = readFileSync(
  resolve(__dirname, "../../../classes/components/ClassPlanPreviewModal.tsx"),
  "utf8"
);
const unifiedPlanningWorkspace = readFileSync(
  resolve(__dirname, "../../../periodization/UnifiedPlanningWorkspace.tsx"),
  "utf8"
);
const planTimeDistribution = readFileSync(
  resolve(__dirname, "../../../classes/components/PlanTimeDistribution.tsx"),
  "utf8"
);

describe("training planning platform parity", () => {
  it("keeps the unified planning workspace enabled independently of Platform.OS", () => {
    expect(trainingRoute).toContain("const usesUnifiedPlanningWorkspace = true;");
    expect(trainingRoute).toContain("{usesUnifiedPlanningWorkspace ? (");
    expect(trainingRoute).not.toContain('{Platform.OS === "web" ? (\n          <>\n            <ScreenPageHeader');
  });

  it("renders an editable compact workspace on native instead of the PDF-only surface", () => {
    expect(classPlanWorkspace).toContain('if (Platform.OS !== "web")');
    expect(classPlanWorkspace).toContain("styles.workspaceNativeOutline");
    expect(classPlanWorkspace).toContain("{renderOutline(editor)}");
    expect(classPlanWorkspace).toContain("renderEditFooter(true)");
  });

  it("keeps the web class plan on the same inline PDF editor used by planning", () => {
    expect(classPlanWorkspace).toContain('const inlinePdfEditor = Platform.OS === "web";');
    expect(classPlanWorkspace).toContain("{inlinePdfEditor ? (\n            preview");
    expect(classPlanWorkspace).toContain("const currentWorkingPlan = workingPlanRef.current;");
    expect(classPlanWorkspace).toContain("normalizeClassTrainingPlan(currentWorkingPlan)");
  });

  it("keeps the library trigger in the PDF toolbar and opens the library as an overlay", () => {
    expect(classPlanWorkspace).toContain("onToggleWorkspaceLibrary");
    expect(classPlanWorkspace).toContain('accessibilityLabel={workspaceLibraryExpanded ? "Recolher biblioteca" : "Expandir biblioteca"}');
    expect(trainingRoute).toContain("{!workspaceLibraryCollapsed || !selectedPlan ? (");
    expect(trainingRoute).toContain("collapsed={!selectedPlan ? workspaceLibraryCollapsed : false}");
    expect(trainingRoute).toContain('position: "absolute"');
    expect(trainingRoute).toContain('boxShadow: "10px 0 28px rgba(10, 19, 34, 0.26)"');
    expect(trainingRoute).toContain("workspaceLibraryExpanded={!workspaceLibraryCollapsed}");
    expect(trainingRoute).not.toContain("paddingLeft: responsiveLayout.isMobile && workspaceLibraryCollapsed ? 64 : 0");
  });

  it("opens the lesson modal before loading and reveals the preview only when its frame is ready", () => {
    expect(unifiedPlanningWorkspace).toContain("<ClassPlanModalHost");
    expect(unifiedPlanningWorkspace).toContain('presentation="embedded"');
    expect(unifiedPlanningWorkspace).not.toContain("<ClassPlanLoadingModal");
    expect(unifiedPlanningWorkspace).toContain("Carregando plano…");
    expect(unifiedPlanningWorkspace).not.toContain("<Suspense fallback={null}>");
    expect(classPlanWorkspace).toContain('presentation?: "modal" | "workspace" | "embedded"');
    expect(classPlanWorkspace).toContain("if (embeddedMode)");
    expect(classPlanWorkspace).toContain('event.data?.type === "GOATLETA_PDF_READY"');
    expect(classPlanWorkspace).toContain('previewStatus === "ready" ? 1 : 0');
  });

  it("keeps the selected month first in the rail and the lesson detail compact", () => {
    expect(unifiedPlanningWorkspace).toContain("horizontalRailRef.current?.scrollTo({ x: selectedMonthIndex * 146, animated: false })");
    expect(unifiedPlanningWorkspace).not.toContain("<MonthOverview");
    expect(unifiedPlanningWorkspace).not.toContain("Aplicação da regra mensal em jogo formal");
    expect(unifiedPlanningWorkspace).toContain("compact emphasized showLegend={false}");
    expect(planTimeDistribution).toContain("paddingTop: emphasized ? 26 : 0");
    expect(planTimeDistribution).toContain("columnGap: emphasized ? 0 : undefined");
  });
});
