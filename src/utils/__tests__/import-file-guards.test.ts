import {
  IMPORT_FILE_LIMITS,
  assertImportAssetWithinLimits,
  normalizeSpreadsheetMatrixForImport,
} from "../import-file-guards";

describe("import-file-guards", () => {
  it("rejects import files over the configured byte limit", () => {
    expect(() =>
      assertImportAssetWithinLimits({
        name: "students.xlsx",
        size: IMPORT_FILE_LIMITS.maxBytes + 1,
      })
    ).toThrow(/Arquivo muito grande/);
  });

  it("rejects spreadsheets with too many rows", () => {
    const rows = Array.from({ length: IMPORT_FILE_LIMITS.maxRows + 2 }, () => ["Nome"]);

    expect(() => normalizeSpreadsheetMatrixForImport(rows)).toThrow(/Planilha muito extensa/);
  });

  it("rejects spreadsheets with abusive cell content", () => {
    const cell = "x".repeat(IMPORT_FILE_LIMITS.maxCellChars + 1);

    expect(() => normalizeSpreadsheetMatrixForImport([["Nome"], [cell]])).toThrow(
      /Celula muito longa/
    );
  });
});
