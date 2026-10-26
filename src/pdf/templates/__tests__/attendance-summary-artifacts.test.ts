import { buildAttendanceExportDetailSheets } from "../../../screens/classes/application/attendance-export-groups";
import * as XLSX from "@e965/xlsx";

describe("attendance export binary artifacts", () => {
  test("serializes the detailed attendance workbook as an XLSX zip", () => {
    const workbook = XLSX.utils.book_new();
    const contextRows = [
      ["Organização", "Go Atleta Teste"],
      ["Fuso IANA", "America/Sao_Paulo"],
    ];
    const summaryRows = [
      ["Unidade", "Turma", "Professor", "Datas com chamada", "Presenças", "Faltas", "Frequência"],
      ["Centro", "Águias", "Professora Joana", 1, 0, 1, "0%"],
    ];
    const detailRows = [
      ["Data", "Unidade", "Turma", "Professor", "Atleta", "Vínculo", "Presença"],
      ["04/08/2026", "Centro", "Águias", "Professora Joana", "Ana Silva", "Inativo", "Faltou"],
    ];
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(contextRows),
      "Contexto"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(summaryRows),
      "Resumo"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(detailRows),
      "Registros"
    );

    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const signature = new TextDecoder().decode(new Uint8Array(bytes).slice(0, 2));
    const reopened = XLSX.read(bytes, { type: "array" });
    const reopenedDetails = XLSX.utils.sheet_to_json<unknown[]>(
      reopened.Sheets.Registros,
      { header: 1 }
    );

    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(signature).toBe("PK");
    expect(reopened.SheetNames).toEqual(["Contexto", "Resumo", "Registros"]);
    expect(reopened.Sheets.Contexto.B2.v).toBe("America/Sao_Paulo");
    expect(reopenedDetails[1]).toEqual(detailRows[1]);
  });
});


test("serializes separate same-name class tabs with months inside each class", () => {
  const row = { unit: "Centro", className: "Turma / [] : ? * muito longa repetida", professorNames: "Joana", studentName: "Ana", membershipStatus: "Inativo" as const, attendanceStatus: "Faltou" as const };
  const sheets = buildAttendanceExportDetailSheets([
    { ...row, classId: "b", date: "2026-08-01" },
    { ...row, classId: "a", date: "2026-09-01" },
    { ...row, classId: "a", date: "2026-08-02" },
  ]);
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  const reopened = XLSX.read(XLSX.write(workbook, { bookType: "xlsx", type: "array" }), { type: "array" });
  expect(reopened.SheetNames).toHaveLength(2);
  expect(new Set(reopened.SheetNames).size).toBe(2);
  const first = XLSX.utils.sheet_to_json(reopened.Sheets[reopened.SheetNames[0]], { header: 1 });
  expect(first).toEqual([sheets[0].rows[0], ["Agosto de 2026", "02/08/2026", ...sheets[0].rows[1].slice(2)], ["Setembro de 2026", "01/09/2026", ...sheets[0].rows[2].slice(2)]]);
  expect(sheets[1].rows).toHaveLength(2);
});
