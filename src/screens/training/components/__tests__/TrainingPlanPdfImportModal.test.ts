import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const modalSource = readFileSync(resolve(__dirname, "../TrainingPlanPdfImportModal.tsx"), "utf8");

describe("training plan PDF import progress", () => {
  it("renders an animated staged analysis state instead of a static loading label", () => {
    expect(modalSource).toContain("function PdfAnalysisProgress");
    expect(modalSource).toContain("Animated.loop");
    expect(modalSource).toContain('accessibilityRole="progressbar"');
    expect(modalSource).toContain('setAnalysisStage("reading")');
    expect(modalSource).toContain('setAnalysisStage("organizing")');
    expect(modalSource).toContain('setAnalysisStage("waiting")');
  });

  it("uses uninterrupted CSS keyframes for continuous web motion", () => {
    expect(modalSource).toContain("ensurePdfAnalysisWebMotion");
    expect(modalSource).toContain("@keyframes goatleta-pdf-spin");
    expect(modalSource).toContain("@keyframes goatleta-pdf-sweep");
    expect(modalSource).toContain('animationIterationCount: "infinite"');
    expect(modalSource).toContain('if (isWeb) {');
  });

  it("keeps the animated PDF glyph free of an extra inner border", () => {
    expect(modalSource).not.toContain("borderColor: colors.primaryBg");
    expect(modalSource).toContain('analysisOrb: { width: 52, height: 52, alignItems: "center", justifyContent: "center" }');
  });

  it("keeps the processing steps concise and operational", () => {
    expect(modalSource).toContain('label: "Preparar"');
    expect(modalSource).toContain('label: "Ler páginas"');
    expect(modalSource).toContain('label: "Organizar"');
  });

  it("does not repeat the selected class or PDF-reading explanation in the idle drop zone", () => {
    expect(modalSource).not.toContain("Plano de aula da turma {classGroup.name}");
    expect(modalSource).not.toContain("A leitura considera o texto e a imagem de cada página");
  });

  it("shows the PDF itself and opens it in the editor without a class destination", () => {
    expect(modalSource).toContain("<PdfPreviewFrame");
    expect(modalSource).toContain('"Abrir no editor"');
    expect(modalSource).toContain("A turma será escolhida somente ao adicionar o plano.");
    expect(modalSource).not.toContain("Planos encontrados");
    expect(modalSource).not.toContain("Math.round(item.confidence * 100)");
    expect(modalSource).not.toContain("classGroup.id");
  });
});
