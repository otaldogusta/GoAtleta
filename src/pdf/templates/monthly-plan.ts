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
  generalObjective: string;
  specificObjective: string;
  blocks: MonthlyLessonPlanBlockRow[];
  observations?: string;
};

export type MonthlyPlanPdfData = {
  className: string;
  unitLabel?: string;
  ageGroup?: string;
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

const chunk = <T,>(items: T[], size: number) => {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }
  return pages;
};

const lessonCardHtmlWithProfessor = (lesson: MonthlyLessonPlanItem, professorName: string) => {
  const rows = lesson.blocks
    .map(
      (block) => `
        <tr class="block-row block-${block.period === "Parte principal" ? "main" : "short"}">
          <td class="period">${esc(block.period)}</td>
          <td class="activities">${esc(block.activities)}</td>
          <td class="time">${esc(block.time)}</td>
          <td class="description">${esc(block.description)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <section class="lesson-card">
      <table>
        <tbody>
          <tr class="title-row">
            <th class="title" colspan="4">PLANO DE AULA ESCOLINHA VÔLEI</th>
          </tr>
          <tr class="compact-row">
            <td colspan="4"><strong>Professor:</strong> ${esc(professorName)}</td>
          </tr>
          <tr class="compact-row">
            <td colspan="2"><strong>${esc(lesson.weekLabel)}</strong></td>
            <td colspan="2"><strong>Data:</strong> ${esc(lesson.dateLabel)}</td>
          </tr>
          <tr class="compact-row">
            <td colspan="4"><strong>Objetivo geral:</strong> ${esc(lesson.generalObjective)}</td>
          </tr>
          <tr class="objective-row">
            <td colspan="4"><strong>Objetivo específico:</strong> ${esc(lesson.specificObjective)}</td>
          </tr>
          <tr class="table-header-row">
            <th>Período</th>
            <th>Atividades</th>
            <th>Tempo</th>
            <th>Descrição</th>
          </tr>
          ${rows}
          <tr class="observations-row">
            <td><strong>Observações:</strong></td>
            <td colspan="3">${esc(lesson.observations || "")}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
};

export const monthlyPlanHtml = (data: MonthlyPlanPdfData) => {
  const pages = chunk(data.lessons, 2);
  const pagesHtml = pages
    .map((lessons) => {
      const cards = lessons
        .map((lesson) => lessonCardHtmlWithProfessor(lesson, data.professorName))
        .join("");
      return `
        <div class="page">
          <div class="lessons-grid">${cards}</div>
        </div>
      `;
    })
    .join("");

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page {
          size: A4 landscape;
          margin: 8mm;
        }
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          color: #111;
          background: #fff;
          font-family: Calibri, Arial, Helvetica, sans-serif;
        }
        .page {
          position: relative;
          width: 100%;
          min-height: 190mm;
          page-break-after: always;
          padding: 18mm 11mm 4mm;
        }
        .page:last-child {
          page-break-after: auto;
        }
        .lessons-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18mm;
          align-items: start;
        }
        .lesson-card table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          border: 1.4px solid #111;
          font-size: 9px;
        }
        th,
        td {
          border: 1.2px solid #111;
          padding: 0.5px 4px;
          vertical-align: top;
          line-height: 1;
          white-space: pre-wrap;
        }
        th {
          text-align: center;
          font-weight: 700;
        }
        .table-header-row th {
          height: 8mm;
          vertical-align: middle;
        }
        .title {
          font-size: 9px;
          padding: 0.5px 4px;
        }
        .title-row {
          height: 4.5mm;
        }
        .compact-row td {
          height: 4.8mm;
        }
        .period {
          width: 21%;
        }
        .activities {
          width: 21%;
        }
        .time {
          width: 13%;
          text-align: center;
          white-space: nowrap;
        }
        .description {
          width: 45%;
        }
        .objective-row td {
          min-height: 8.5mm;
        }
        .block-short td {
          min-height: 10mm;
        }
        .block-main td {
          min-height: 37mm;
        }
        .observations-row td {
          height: 13mm;
        }
      </style>
    </head>
    <body>
      ${pagesHtml || `<div class="page"><div class="lessons-grid"></div></div>`}
    </body>
  </html>
  `;
};
