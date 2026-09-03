import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import process from "node:process";

import React from "react";
import ts from "typescript";
import * as XLSX from "@e965/xlsx";

const root = process.cwd();
const documentSourcePath = `${root}/src/pdf/attendance-summary-document.web.tsx`;
const documentSource = await readFile(documentSourcePath, "utf8");
const rendererUrl = new URL(
  "./react-pdf.browser.js",
  import.meta.resolve("@react-pdf/renderer")
).href;
const reactUrl = import.meta.resolve("react");
const compiledDocument = ts
  .transpileModule(documentSource, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: documentSourcePath,
  })
  .outputText.replace('from "react"', `from "${reactUrl}"`)
  .replace(
    'from "@react-pdf/renderer/lib/react-pdf.browser"',
    `from "${rendererUrl}"`
  );
const documentModuleUrl = `data:text/javascript;base64,${Buffer.from(
  compiledDocument
).toString("base64")}`;
const { AttendanceSummaryDocument } = await import(documentModuleUrl);
const { pdf } = await import(rendererUrl);

const data = {
  organizationName: "Go Atleta Teste",
  periodLabel: "01/08/2026 a 31/08/2026",
  scopeLabel: "Centro · Águias · Somente faltas",
  timeZone: "America/Sao_Paulo",
  exportedAt: "25/08/2026 09:30:00",
  totalRecords: 1,
  totalPresent: 0,
  totalAbsent: 1,
  attendanceRate: 0,
  rows: [
    {
      unit: "Centro",
      className: "Águias",
      professorNames: "Professora Joana",
      sessions: 1,
      present: 0,
      absent: 1,
      attendanceRate: 0,
    },
  ],
  details: [
    {
      date: "2026-08-04",
      unit: "Centro",
      className: "Águias",
      professorNames: "Professora Joana",
      studentName: "Ana Silva",
      membershipStatus: "Inativo",
      attendanceStatus: "Faltou",
    },
  ],
};

const pdfBlob = await pdf(
  React.createElement(AttendanceSummaryDocument, { data })
).toBlob();
const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
const pdfSignature = new TextDecoder().decode(pdfBytes.slice(0, 4));
if (pdfBlob.type !== "application/pdf" || pdfBytes.length < 500 || pdfSignature !== "%PDF") {
  throw new Error("Attendance PDF artifact is invalid");
}

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
const xlsxBuffer = XLSX.write(workbook, {
  bookType: "xlsx",
  type: "array",
});
const xlsxBytes = new Uint8Array(xlsxBuffer);
const xlsxSignature = new TextDecoder().decode(xlsxBytes.slice(0, 2));
const reopenedWorkbook = XLSX.read(xlsxBuffer, { type: "array" });
const reopenedDetails = XLSX.utils.sheet_to_json(
  reopenedWorkbook.Sheets.Registros,
  { header: 1 }
);
if (
  xlsxBytes.length < 500 ||
  xlsxSignature !== "PK" ||
  reopenedWorkbook.SheetNames.join(",") !== "Contexto,Resumo,Registros" ||
  reopenedWorkbook.Sheets.Contexto.B2?.v !== "America/Sao_Paulo" ||
  reopenedDetails[1]?.join("|") !== detailRows[1].join("|")
) {
  throw new Error("Attendance XLSX artifact is invalid");
}

console.log(
  JSON.stringify({
    pdf: { bytes: pdfBytes.length, signature: pdfSignature },
    xlsx: { bytes: xlsxBytes.length, signature: xlsxSignature },
  })
);
