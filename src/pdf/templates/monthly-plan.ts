import { normalizeDisplayText } from "../../utils/text-normalization";

export type MonthlyLessonPlanBlockRow = {
  period: "Aquecimento" | "Parte principal" | "Volta à calma";
  activities: string;
  time: string;
  description: string;
};

export type MonthlyLessonPlanItem = {
  id: string;
  weekLabel: string;
  dateLabel: string;
  timeLabel?: string;
  generalObjective: string;
  specificObjective: string;
  situationProblem?: string;
  blocks: MonthlyLessonPlanBlockRow[];
  observations?: string;
};

export type MonthlyPlanPdfData = {
  className: string;
  unitLabel?: string;
  ageGroup?: string;
  genderLabel?: string;
  professorName: string;
  monthLabel: string;
  generatedAt: string;
  totalWeeks: number;
  totalSessions: number;
  lessons: MonthlyLessonPlanItem[];
};

const asText = (value: unknown) => {
  if (typeof value === "string") return normalizeDisplayText(value);
  if (value === null || value === undefined) return "";
  return normalizeDisplayText(String(value));
};

const esc = (value: unknown) =>
  asText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");

const specificObjectiveHtml = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => {
      const label = ["Conceitual:", "Atitudinal:", "Procedimental:"].find((candidate) =>
        line.startsWith(candidate)
      );
      return label
        ? `<strong>${esc(label)}</strong>${esc(line.slice(label.length))}`
        : esc(line);
    })
    .join("<br/>");

const multilineBlockHtml = (value: string) =>
  (value || "-")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => `<div class="block-paragraph">${esc(line)}</div>`)
    .join("");

const lessonCardHtmlWithProfessor = (
  lesson: MonthlyLessonPlanItem,
  professorName: string,
  className: string,
  ageGroup?: string,
  genderLabel?: string,
  pageLabel = ""
) => {
  const rows = lesson.blocks
    .map((block) =>
      block.period === "Volta à calma"
        ? `
        <tr class="block-row block-cooldown">
          <th class="label-cell period">Volta à calma:</th>
          <td colspan="3">${esc(block.activities || block.description || "-")}</td>
        </tr>
      `
        : `
        <tr class="block-row block-${block.period === "Parte principal" ? "main" : "warmup"}">
          <td class="period">${esc(block.period)}</td>
          <td class="activities">${multilineBlockHtml(block.activities)}</td>
          <td class="time">${esc(block.time)}</td>
          <td class="description">${multilineBlockHtml(block.description)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <section class="lesson-card">
      ${pageLabel ? `<div class="page-label">${esc(pageLabel)}</div>` : ""}
      <table>
        <colgroup>
          <col class="col-period" />
          <col class="col-activities" />
          <col class="col-time" />
          <col class="col-description" />
        </colgroup>
        <tbody>
          <tr class="title-row">
            <th class="title" colspan="4">PLANO DE AULA — ESCOLINHA VÔLEI</th>
          </tr>
          <tr class="field-row">
            <th class="label-cell">Professor:</th>
            <td class="value-cell">${esc(professorName)}</td>
            <th class="label-cell label-secondary">Turma:</th>
            <td class="value-cell value-class">${esc(className)}${ageGroup ? ` (${esc(ageGroup)} anos${genderLabel ? `, ${esc(genderLabel)}` : ""})` : ""}</td>
          </tr>
          <tr class="field-row">
            <th class="label-cell">Semana:</th>
            <td class="value-cell" colspan="3">${esc(lesson.weekLabel)}</td>
          </tr>
          <tr class="field-row">
            <th class="label-cell">Data:</th>
            <td class="value-cell">${esc(lesson.dateLabel)}</td>
            <th class="label-cell label-secondary">Horário:</th>
            <td class="value-cell">${esc(lesson.timeLabel || "-")}</td>
          </tr>
          <tr class="content-row">
            <th class="label-cell">Objetivo geral:</th>
            <td class="value-cell" colspan="3">${esc(lesson.generalObjective)}</td>
          </tr>
          <tr class="content-row specific-row">
            <th class="label-cell">Objetivo específico:</th>
            <td class="value-cell" colspan="3">${specificObjectiveHtml(lesson.specificObjective)}</td>
          </tr>
          <tr class="content-row situation-row">
            <th class="label-cell">Situação-problema:</th>
            <td class="value-cell situation-value" colspan="3">${esc(lesson.situationProblem || "-")}</td>
          </tr>
          <tr class="table-header-row">
            <th>Período</th>
            <th>Atividades</th>
            <th>Tempo</th>
            <th>Descrição / condução da situação-problema</th>
          </tr>
          ${rows}
          <tr class="observations-row">
            <th class="label-cell">Observações:</th>
            <td colspan="3">${esc(lesson.observations || "")}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
};

export const monthlyPlanHtml = (data: MonthlyPlanPdfData) => {
  const pagesHtml = data.lessons
    .map(
      (lesson, index) => `
        <div class="page">
          ${lessonCardHtmlWithProfessor(
            lesson,
            data.professorName,
            data.className,
            data.ageGroup,
            data.genderLabel,
            data.lessons.length > 1 ? `Aula ${index + 1} de ${data.lessons.length}` : ""
          )}
        </div>
      `
    )
    .join("");

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page {
          size: A4 portrait;
          margin: 15mm 8mm 8mm;
        }
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          color: #000;
          background: #fff;
          font-family: Calibri, Arial, Helvetica, sans-serif;
        }
        .page {
          width: 100%;
          min-height: 267mm;
          page-break-after: always;
        }
        .page:last-child {
          page-break-after: auto;
        }
        .lesson-card {
          width: 100%;
        }
        .lesson-card table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          border: 1.4px solid #000;
          font-size: 9.5pt;
        }
        .col-period { width: 17%; }
        .col-activities { width: 26%; }
        .col-time { width: 10%; }
        .col-description { width: 47%; }
        .page-label {
          height: 8mm;
          padding-top: 1mm;
          color: #777;
          font-size: 9.5pt;
          font-weight: 700;
        }
        th,
        td {
          border: 1.2px solid #000;
          padding: 3px 5px;
          vertical-align: top;
          line-height: 1.1;
          white-space: pre-wrap;
          background: #fff;
        }
        th {
          text-align: center;
          font-weight: 700;
        }
        .title {
          background: #457b3c;
          color: #fff;
          font-size: 9.5pt;
          padding: 6px 5px;
          height: 7mm;
        }
        .field-row th,
        .field-row td { height: 5.5mm; }
        .label-cell {
          width: 17%;
          background: #f2f2f2;
          text-align: left;
          white-space: normal;
        }
        .field-row .label-cell { white-space: nowrap; }
        .value-cell {
          width: 83%;
          text-align: left;
        }
        .value-class { width: 47%; }
        .label-secondary { width: 10%; }
        .field-row td:nth-child(2) { width: 26%; }
        .field-row td:nth-child(4) { width: 47%; }
        .situation-row .label-cell {
          background: #eaf5ea;
        }
        .situation-value { font-style: italic; }
        .content-row td,
        .content-row th {
          height: 10mm;
        }
        .specific-row td,
        .specific-row th { height: 24mm; }
        .situation-row td,
        .situation-row th { height: 9mm; }
        .table-header-row th {
          height: 5.5mm;
          vertical-align: middle;
        }
        .period {
          width: 17%;
        }
        .activities {
          width: 26%;
        }
        .time {
          width: 10%;
          text-align: center;
          white-space: nowrap;
        }
        .description {
          width: 47%;
        }
        .block-paragraph:not(:last-child) { margin-bottom: 3pt; }
        .block-warmup td {
          height: 16mm;
        }
        .block-cooldown th,
        .block-cooldown td { height: 5.5mm; vertical-align: middle; }
        .block-main td {
          height: 36mm;
        }
        .observations-row td {
          height: 20mm;
        }
        .observations-row .label-cell {
          text-align: left;
          background: #f2f2f2;
        }
      </style>
    </head>
    <body>
      ${pagesHtml || `<div class="page"></div>`}
    </body>
  </html>
  `;
};
