import { normalizeDisplayText } from "../../utils/text-normalization";

export type MonthlyLessonPlanBlockRow = {
  period: "Aquecimento" | "Parte principal" | "Volta à calma";
  activities: string;
  time: string;
  description: string;
  items?: {
    activity: string;
    description: string;
  }[];
};

export type MonthlyLessonPlanItem = {
  id: string;
  weekLabel: string;
  dateLabel: string;
  timeLabel?: string;
  generalObjective: string;
  specificObjective: string;
  situationProblem?: string;
  periodizationSource?: {
    weekLabel: string;
    phaseLabel: string;
    focusLabel: string;
    loadLabel: string;
    roleLabel: string;
    classLevelLabel?: string;
    objectiveLabel?: string;
    loadModelLabel?: string;
    beforeLabel?: string;
    nowLabel?: string;
    afterLabel?: string;
  };
  blocks: MonthlyLessonPlanBlockRow[];
  observations?: string;
  preserveEmptyFields?: boolean;
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

const multilineBlockHtml = (value: string, emptyValue = "-") =>
  (value || emptyValue)
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
  pageLabel = "",
  options?: { editable?: boolean }
) => {
  const editable = Boolean(options?.editable);
  const emptyValue = lesson.preserveEmptyFields ? "" : "-";
  const editAttr = (field: string, extra = "") =>
    editable ? ` contenteditable="true" data-field="${field}" class="pdf-editable-cell"${extra ? ` ${extra}` : ""}` : "";

  const getBlockKey = (period: string) =>
    period === "Aquecimento" ? "warmup" : period === "Parte principal" ? "main" : "cooldown";

  const rows = lesson.blocks
    .map((block) => {
      const blockKey = getBlockKey(block.period);
      const bKeyAttr = editable ? `data-block-key="${blockKey}"` : "";
      return block.period === "Volta à calma"
        ? `
        <tr class="block-row block-cooldown">
          <th class="label-cell period">Volta à calma:</th>
          <td colspan="3"${editAttr(`block-activities-${block.period}`, bKeyAttr)}>${multilineBlockHtml(block.activities || block.description, emptyValue)}</td>
        </tr>
      `
        : `
        <tr class="block-row block-${block.period === "Parte principal" ? "main" : "warmup"}">
          <td class="period"${bKeyAttr ? ` ${bKeyAttr}` : ""}>${esc(block.period)}</td>
          <td class="activities"${editAttr(`block-activities-${block.period}`, bKeyAttr)}>${multilineBlockHtml(block.activities, emptyValue)}</td>
          <td class="time"${editAttr(`block-time-${block.period}`, bKeyAttr)}>${esc(block.time || emptyValue)}</td>
          <td class="description"${editAttr(`block-description-${block.period}`, bKeyAttr)}>${multilineBlockHtml(block.description, emptyValue)}</td>
        </tr>
      `;
    })
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
            <td class="value-cell"${lesson.preserveEmptyFields ? editAttr("title") : ""} colspan="3">${esc(lesson.weekLabel)}</td>
          </tr>
          <tr class="field-row">
            <th class="label-cell">Data:</th>
            <td class="value-cell">${esc(lesson.dateLabel)}</td>
            <th class="label-cell label-secondary">Horário:</th>
            <td class="value-cell">${esc(lesson.timeLabel || "-")}</td>
          </tr>
          ${lesson.periodizationSource ? `
          <tr class="field-row periodization-row">
            <th class="label-cell">Periodização:</th>
            <td class="value-cell" colspan="3">
              <strong>${esc(lesson.periodizationSource.weekLabel)}</strong>
              <span class="periodization-separator"> · </span>${esc(lesson.periodizationSource.phaseLabel)}
              <span class="periodization-separator"> · </span><strong>Foco:</strong> ${esc(lesson.periodizationSource.focusLabel)}
              <span class="periodization-separator"> · </span><strong>Carga:</strong> ${esc(lesson.periodizationSource.loadLabel)}
              <span class="periodization-separator"> · </span><strong>Papel:</strong> ${esc(lesson.periodizationSource.roleLabel)}
            </td>
          </tr>
          ` : ""}
          ${lesson.periodizationSource && (lesson.periodizationSource.classLevelLabel || lesson.periodizationSource.objectiveLabel || lesson.periodizationSource.loadModelLabel) ? `
          <tr class="field-row periodization-row">
            <th class="label-cell">Contexto:</th>
            <td class="value-cell" colspan="3">
              ${lesson.periodizationSource.classLevelLabel ? `<strong>Nível:</strong> ${esc(lesson.periodizationSource.classLevelLabel)}` : ""}
              ${lesson.periodizationSource.objectiveLabel ? `<span class="periodization-separator"> · </span><strong>Objetivo:</strong> ${esc(lesson.periodizationSource.objectiveLabel)}` : ""}
              ${lesson.periodizationSource.loadModelLabel ? `<span class="periodization-separator"> · </span><strong>Modelo:</strong> ${esc(lesson.periodizationSource.loadModelLabel)}` : ""}
            </td>
          </tr>
          ` : ""}
          <tr class="content-row">
            <th class="label-cell">Objetivo geral:</th>
            <td class="value-cell"${editAttr("generalObjective", 'data-section="pedagogy"')} colspan="3">${esc(lesson.generalObjective)}</td>
          </tr>
          <tr class="content-row specific-row">
            <th class="label-cell">Objetivo específico:</th>
            <td class="value-cell"${editAttr("specificObjective", 'data-section="pedagogy"')} colspan="3">${specificObjectiveHtml(lesson.specificObjective)}</td>
          </tr>
          <tr class="content-row situation-row">
            <th class="label-cell">Situação-problema:</th>
            <td class="value-cell situation-value"${editAttr("situationProblem", 'data-section="pedagogy"')} colspan="3">${esc(lesson.situationProblem || emptyValue)}</td>
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
            <td${editAttr("observations", 'data-section="pedagogy"')} colspan="3">${esc(lesson.observations || "")}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
};

export const monthlyPlanHtml = (data: MonthlyPlanPdfData, options?: { editable?: boolean }) => {
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
            data.lessons.length > 1 ? `Aula ${index + 1} de ${data.lessons.length}` : "",
            options
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
          overflow-wrap: anywhere;
          word-break: normal;
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
        .periodization-row th,
        .periodization-row td { height: auto; min-height: 5.5mm; }
        .periodization-row .label-cell { background: #eaf5ea; }
        .periodization-row .value-cell { white-space: normal; }
        .periodization-separator { color: #6b7280; }
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
          height: 8mm;
        }
        .specific-row td,
        .specific-row th { height: 12mm; }
        .situation-row td,
        .situation-row th { height: 8mm; }
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
        .structured-list { line-height: 1.25; }
        .structured-item { display: inline; }
        .structured-separator { color: #6b7280; white-space: normal; }
        .block-paragraph:not(:last-child) { margin-bottom: 3pt; }
        .block-warmup td {
          height: 12mm;
        }
        .block-cooldown th,
        .block-cooldown td { height: 7mm; vertical-align: middle; }
        .block-main td {
          height: 18mm;
        }
        .observations-row td {
          height: 12mm;
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
