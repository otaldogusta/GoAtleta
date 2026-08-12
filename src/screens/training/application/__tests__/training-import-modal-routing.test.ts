import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const trainingRoute = readFileSync(resolve(__dirname, "../../../../../app/training/index.tsx"), "utf8");
const legacyImportRoute = readFileSync(resolve(__dirname, "../../../../../app/training/import.tsx"), "utf8");

describe("training import modal routing", () => {
  it("opens PDF and spreadsheet importers inside the training workspace", () => {
    expect(trainingRoute).toContain("<TrainingPlanPdfImportModal");
    expect(trainingRoute).toContain("<TrainingSpreadsheetImportModal");
    expect(trainingRoute).not.toContain('router.push({ pathname: "/training/import" })');
  });

  it("keeps the legacy URL only as a redirect that opens the modal", () => {
    expect(legacyImportRoute).toContain('<Redirect href="/training?import=spreadsheet" />');
    expect(legacyImportRoute).toContain('presentation="modal"');
  });
});
