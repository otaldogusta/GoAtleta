import { mkdir, readFile, writeFile } from "node:fs/promises";
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
const groupSource = await readFile(`${root}/src/screens/classes/application/attendance-export-groups.ts`, "utf8");
const groupModuleUrl = `data:text/javascript;base64,${Buffer.from(ts.transpileModule(groupSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString("base64")}`;
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
  .outputText.replace('from "../screens/classes/application/attendance-export-groups"', `from "${groupModuleUrl}"`).replace('from "react"', `from "${reactUrl}"`)
  .replace(
    'from "@react-pdf/renderer/lib/react-pdf.browser"',
    `from "${rendererUrl}"`
  );
const documentModuleUrl = `data:text/javascript;base64,${Buffer.from(
  compiledDocument
).toString("base64")}`;
const { AttendanceSummaryDocument } = await import(documentModuleUrl);
const { pdf } = await import(rendererUrl);

const classInfo = {
  scheduleLabel: "18:00 - 19:00", daysLabel: "Qua, Sex", ageBandLabel: "09-11",
  levelLabel: "Iniciação", genderLabel: "Misto", trainingSpace: "Quadra 1",
};
const rawDetails = process.argv.includes("--review")
  ? ["a", "b"].flatMap((classId, groupIndex) => ["2026-09", "2026-10"].flatMap((month) =>
    Array.from({ length: groupIndex ? 6 : 18 }, (_, day) => Array.from({ length: groupIndex ? 9 : 33 }, (_, student) => ({
      classId, studentId: `${classId}-${student}`, classInfo,
      date: `${month}-${String(day + 1).padStart(2, "0")}`,
      unit: "Unidade Demonstração", className: groupIndex ? "Águias do Amanhã" : "Hipopótamos",
      professorNames: "Professora Joana · Professor Lucas",
      studentName: student === 0 ? "Ana Clara de Albuquerque Nascimento - nome longo" : `Atleta de demonstração ${String(student + 1).padStart(2, "0")}`,
      membershipStatus: student % 9 === 0 ? "Inativo" : "Ativo",
      attendanceStatus: (student + day) % 4 ? "Presente" : "Faltou",
    })))))
  : [{ classId: "a", studentId: "s", classInfo, date: "2026-08-04", unit: "Centro", className: "Águias", professorNames: "Professora Joana", studentName: "Ana Silva", membershipStatus: "Inativo", attendanceStatus: "Faltou" }];
const details = rawDetails.flat(3);
const totalPresent = details.filter((row) => row.attendanceStatus === "Presente").length;
const rows = [...new Set(details.map((row) => row.classId))].map((classId) => {
  const records = details.filter((row) => row.classId === classId);
  const present = records.filter((row) => row.attendanceStatus === "Presente").length;
  return { ...records[0], sessions: new Set(records.map((row) => row.date)).size, present, absent: records.length - present, attendanceRate: Math.round(present / records.length * 100) };
}).sort((a, b) => a.unit.localeCompare(b.unit, "pt-BR") || a.className.localeCompare(b.className, "pt-BR"));
const data = {
  organizationName: "Go Atleta - dados fictícios para revisão",
  periodLabel: process.argv.includes("--review") ? "01/09/2026 a 31/10/2026" : "01/08/2026 a 31/08/2026",
  scopeLabel: "Todas as unidades e turmas · Amostra fictícia",
  timeZone: "America/Sao_Paulo", exportedAt: "26/10/2026 10:00:00",
  totalRecords: details.length, totalPresent, totalAbsent: details.length - totalPresent,
  attendanceRate: Math.round(totalPresent / details.length * 100), rows, details,
};

const pdfBlob = await pdf(
  React.createElement(AttendanceSummaryDocument, { data })
).toBlob();
const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
const pdfSignature = new TextDecoder().decode(pdfBytes.slice(0, 4));
if (pdfBlob.type !== "application/pdf" || pdfBytes.length < 500 || pdfSignature !== "%PDF") {
  throw new Error("Attendance PDF artifact is invalid");
}

if (process.argv.includes("--review")) {
  await mkdir(`${root}/.tmp/attendance-review`, { recursive: true });
  await writeFile(`${root}/.tmp/attendance-review/chamadas-demonstracao.pdf`, pdfBytes);
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
