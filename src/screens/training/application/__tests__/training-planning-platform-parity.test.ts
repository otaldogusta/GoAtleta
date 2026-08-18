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
});
