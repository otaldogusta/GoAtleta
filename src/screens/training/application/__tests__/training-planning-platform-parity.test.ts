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
const classPlanModalFrame = readFileSync(
  resolve(__dirname, "../../../classes/components/ClassPlanModalFrame.tsx"),
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
const nativePdfPreview = readFileSync(
  resolve(__dirname, "../../../../pdf/PdfPreviewFrame.tsx"),
  "utf8"
);

describe("training planning platform parity", () => {
  it("keeps the unified planning workspace enabled independently of Platform.OS", () => {
    expect(trainingRoute.match(/<ClassPlanPreviewModal/g)).toHaveLength(1);
    expect(trainingRoute).toContain('presentation="workspace"');
    expect(trainingRoute).not.toContain("usesUnifiedPlanningWorkspace");
    expect(trainingRoute).not.toContain('{Platform.OS === "web" ? (\n          <>\n            <ScreenPageHeader');
    expect(trainingRoute).toContain('message: "Não foi possível salvar o rascunho."');
  });

  it("branches leave and replacement confirmation copy from the explicit draft flush result", () => {
    expect(trainingRoute).toContain("buildTrainingPlanWorkspaceExitConfirmation");
    expect(trainingRoute.match(/const flushResult = await flushWorkspaceDraft\(\);/g)).toHaveLength(2);
    expect(trainingRoute.match(/draftPersisted: flushResult\.persisted/g)).toHaveLength(2);
    expect(trainingRoute).not.toContain(
      'message: "Seu rascunho está salvo neste dispositivo e será restaurado quando você voltar."'
    );
    expect(trainingRoute).not.toContain(
      'message: "O rascunho atual está salvo neste dispositivo. Ao trocar, ele será descartado."'
    );
  });

  it("renders the editable document surface on native", () => {
    expect(classPlanWorkspace).toContain('if (Platform.OS !== "web")');
    expect(classPlanWorkspace).toContain("<View style={styles.workspacePreview}>{preview}</View>");
    expect(classPlanWorkspace).toContain("onMessage={handlePdfBridgeMessage}");
    expect(nativePdfPreview).toContain('from "react-native-webview"');
    expect(nativePdfPreview).toContain("window.ReactNativeWebView.postMessage");
    expect(nativePdfPreview).toContain("if (!html)");
    expect(nativePdfPreview).toContain("scalesPageToFit={false}");
    expect(nativePdfPreview).toContain("onLayout={handleLayout}");
    expect(nativePdfPreview).toContain("PDF selecionado. Abra no editor para continuar.");
  });

  it("keeps the web class plan on the same inline PDF editor used by planning", () => {
    expect(classPlanWorkspace).toContain("const inlinePdfEditor = true;");
    expect(classPlanWorkspace).toContain("{inlinePdfEditor ? (\n            preview");
    expect(classPlanWorkspace).toContain("const currentWorkingPlan = workingPlanRef.current;");
    expect(classPlanWorkspace).toContain("normalizeClassTrainingPlan(currentWorkingPlan)");
  });

  it("keeps compact web plan actions in the header and above page FABs", () => {
    expect(classPlanWorkspace).toContain("{inlinePdfEditor ? inlineSaveButton : null}");
    expect(classPlanWorkspace).toContain("{menuButton}\n          </>");
    expect(classPlanModalFrame).toContain("overlayZIndex = 6000");
    expect(classPlanWorkspace).toContain(
      'minimumPageWidth={phoneLayout ? 620 : undefined}'
    );
    expect(classPlanWorkspace).toContain("const MOBILE_DOCUMENT_ZOOM = 125;");
    expect(classPlanWorkspace).toContain(
      "zoom={workspaceMode ? previewZoom : phoneLayout ? MOBILE_DOCUMENT_ZOOM : 100}"
    );
    expect(classPlanWorkspace).toContain("<ClassPlanModalFrame");
    expect(classPlanWorkspace).toContain("<ClassPlanModalHeader");
    expect(classPlanModalFrame).toContain("containerPadding={8}");
    expect(classPlanModalFrame).toContain('width: "94%"');
    expect(classPlanModalFrame).toContain('height: "90%"');
    expect(classPlanModalFrame).toContain("borderRadius: 18");
    expect(classPlanWorkspace).not.toContain(
      "inlinePdfEditor && !splitLayout ? renderEditFooter(true)"
    );
    expect(classPlanWorkspace).toContain(">Baixar PDF</Text>");
    expect(classPlanWorkspace).toContain(">Salvar ou compartilhar</Text>");
  });

  it("keeps the library trigger in the PDF toolbar and opens the library as an overlay", () => {
    expect(classPlanWorkspace).toContain("onToggleWorkspaceLibrary");
    expect(classPlanWorkspace).toContain('accessibilityLabel={workspaceLibraryExpanded ? "Recolher biblioteca" : "Expandir biblioteca"}');
    expect(trainingRoute).toContain("{responsiveLayout.isMobile ? (");
    expect(trainingRoute).toContain('position="right"');
    expect(trainingRoute).toContain('renderWorkspaceLibrary("sheet", false)');
    expect(trainingRoute).toContain('renderWorkspaceLibrary("rail", true)');
    expect(trainingRoute).toContain(") : !workspaceLibraryCollapsed || !selectedPlan ? (");
    expect(trainingRoute).toContain('boxShadow: "10px 0 28px rgba(10, 19, 34, 0.26)"');
    expect(trainingRoute).toContain("workspaceLibraryExpanded={!workspaceLibraryCollapsed}");
    expect(trainingRoute).not.toContain("paddingLeft: responsiveLayout.isMobile && workspaceLibraryCollapsed ? 64 : 0");
  });

  it("opens the lesson modal with a guarded loading overlay and a recoverable native preview", () => {
    expect(unifiedPlanningWorkspace).toContain("<ClassPlanModalHost");
    expect(unifiedPlanningWorkspace).toContain("<ClassPlanModalFrame");
    expect(unifiedPlanningWorkspace).toContain("<ClassPlanModalHeader");
    expect(unifiedPlanningWorkspace).toContain('presentation="embedded"');
    expect(unifiedPlanningWorkspace).not.toContain("<ClassPlanLoadingModal");
    expect(unifiedPlanningWorkspace).toContain("Carregando plano…");
    expect(unifiedPlanningWorkspace).not.toContain("<Suspense fallback={null}>");
    expect(classPlanWorkspace).toContain('presentation?: "modal" | "workspace" | "embedded"');
    expect(classPlanWorkspace).toContain("if (embeddedMode)");
    expect(classPlanWorkspace).toContain('message.type === "GOATLETA_PDF_READY"');
    expect(classPlanWorkspace).toContain("handlePdfBridgeMessage(event.data)");
    expect(classPlanWorkspace).toContain('pointerEvents={previewStatus === "ready" ? "auto" : "none"}');
    expect(classPlanWorkspace).toContain("style={StyleSheet.absoluteFill}");
    expect(classPlanWorkspace).toContain("PREVIEW_LOAD_TIMEOUT_MS");
    expect(classPlanWorkspace).toContain('onError={() => setPreviewStatus("error")}');
    expect(classPlanWorkspace).toContain("setPreviewRevision((current) => current + 1)");
  });

  it("keeps the selected month first in the rail and the lesson detail compact", () => {
    expect(unifiedPlanningWorkspace).toContain("const lastScrolledMonthIndexRef = useRef<number | null>(null)");
    expect(unifiedPlanningWorkspace).toContain("lastScrolledMonthIndexRef.current !== selectedMonthIndex");
    expect(unifiedPlanningWorkspace).toContain("animated: animate");
    expect(unifiedPlanningWorkspace).toContain("lastScrolledMonthIndexRef.current = selectedMonthIndex");
    expect(unifiedPlanningWorkspace).not.toContain("<MonthOverview");
    expect(unifiedPlanningWorkspace).not.toContain("Aplicação da regra mensal em jogo formal");
    expect(unifiedPlanningWorkspace).toContain("compact emphasized showLegend={false}");
    expect(planTimeDistribution).toContain('alignItems: "center", justifyContent: "center"');
    expect(planTimeDistribution).not.toContain("paddingTop: emphasized ? 26 : 0");
  });
});
