import {
    buildGoogleSheetsCsvUrl,
    extractGoogleSheetsId,
    mapGoogleFormsCsvToImportRows,
} from "../google-forms-sync";

describe("google forms sync", () => {
  test("extracts google sheets id from edit url", () => {
    expect(
      extractGoogleSheetsId(
        "https://docs.google.com/spreadsheets/d/1va9_nQ2SVfR2QUmKuCmm7YlK-FQIBhkHz9Cd4feRgc8/edit"
      )
    ).toBe("1va9_nQ2SVfR2QUmKuCmm7YlK-FQIBhkHz9Cd4feRgc8");
  });

  test("builds csv export url preserving gid", () => {
    expect(
      buildGoogleSheetsCsvUrl(
        "https://docs.google.com/spreadsheets/d/1va9_nQ2SVfR2QUmKuCmm7YlK-FQIBhkHz9Cd4feRgc8/edit#gid=123456"
      )
    ).toBe(
      "https://docs.google.com/spreadsheets/d/1va9_nQ2SVfR2QUmKuCmm7YlK-FQIBhkHz9Cd4feRgc8/export?format=csv&gid=123456"
    );
  });

  test("maps google forms csv into student import rows", () => {
    const rows = mapGoogleFormsCsvToImportRows(
      [
        "Carimbo de data/hora,Nome completo,RA,Data de nascimento,Email,Nome do responsável,Telefone do responsável,Modalidade",
        '"12/03/2026 10:00:00","Ana Silva","2025207385","01/02/2008","ana@example.com","Maria Silva","41999998888","Vôlei"',
      ].join("\n")
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Ana Silva",
      ra: "2025207385",
      birthDate: "2008-02-01",
      loginEmail: "ana@example.com",
      guardianName: "Maria Silva",
      guardianPhone: "41999998888",
    });
  });
});
