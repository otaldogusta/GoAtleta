import * as XLSX from "@e965/xlsx";

describe("attendance export binary artifacts", () => {
  test("serializes the detailed attendance workbook as an XLSX zip", () => {
    const workbook = XLSX.utils.book_new();
    const contextRows = [
      ["Organização", "GoAtleta Teste"],
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
