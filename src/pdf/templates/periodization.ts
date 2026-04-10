import { normalizeDisplayText } from "../../utils/text-normalization";

export type PeriodizationWeekRow = {
  week: number;
  dateRange?: string;
  sessionDates?: string;
  phase: string;
  theme: string;
  technicalFocus: string;
  physicalFocus: string;
  constraints: string;
  mvFormat: string;
  jumpTarget: string;
  rpeTarget: string;
  source: string;
};

export type PeriodizationPdfData = {
  className: string;
  unitLabel: string;
  ageGroup: string;
  cycleStart?: string;
  cycleLength: number;
  generatedAt: string;
  planningMode?: string;
  targetCompetition?: string;
  targetDate?: string;
  tacticalSystem?: string;
  currentPhase?: string;
  contextModel?: string;
  contextObjective?: string;
  contextFocus?: string;
  contextCyclePhase?: string;
  contextPedagogicalIntent?: string;
  contextLoad?: string;
  contextConstraints?: string;
  rows: PeriodizationWeekRow[];
};

const asText = (value: unknown) => {
  if (typeof value === "string") return normalizeDisplayText(value);
  if (value === null || value === undefined) return "";
  return normalizeDisplayText(String(value));
};

const esc = (value: string) =>
  asText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");

export const periodizationHtml = (data: PeriodizationPdfData) => {
  const rowsHtml = data.rows
    .map(
      (row) => `
      <tr>
        <td>${row.week}</td>
        <td>${esc(row.dateRange || row.sessionDates || "-")}</td>
        <td>${esc(row.phase)}</td>
        <td>${esc(row.theme)}</td>
        <td>${esc(row.technicalFocus)}</td>
        <td>${esc(row.physicalFocus)}</td>
        <td>${esc(row.rpeTarget)}</td>
        <td>${esc(row.jumpTarget)}</td>
        <td>${esc(row.source)}</td>
      </tr>
    `
    )
    .join("");

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {
          font-family: -apple-system, Arial, sans-serif;
          padding: 24px;
          color: #111;
        }
        h1 {
          font-size: 20px;
          margin: 0 0 6px 0;
        }
        .sub { color: #555; margin-bottom: 14px; line-height: 1.45; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; font-size: 11px; vertical-align: top; }
        th { background: #f2f2f2; text-align: left; }
        .footer {
          margin-top: 18px;
          font-size: 10px;
          color: #777;
          border-top: 1px dashed #ddd;
          padding-top: 12px;
        }
      </style>
    </head>

    <body>
      <h1>Periodizacao do ciclo</h1>
      <div class="sub">
        <strong>Turma:</strong> ${esc(data.className)}${
          data.ageGroup ? ` (${esc(data.ageGroup)})` : ""
        }<br/>
        ${data.unitLabel ? `<strong>Unidade:</strong> ${esc(data.unitLabel)}<br/>` : ""}
        ${data.cycleStart ? `<strong>Inicio do ciclo:</strong> ${esc(data.cycleStart)}<br/>` : ""}
        ${data.planningMode ? `<strong>Modo:</strong> ${esc(data.planningMode)}<br/>` : ""}
        ${
          data.targetCompetition
            ? `<strong>Competicao-alvo:</strong> ${esc(data.targetCompetition)}<br/>`
            : ""
        }
        ${data.targetDate ? `<strong>Data-alvo:</strong> ${esc(data.targetDate)}<br/>` : ""}
        ${
          data.tacticalSystem ? `<strong>Sistema tatico:</strong> ${esc(data.tacticalSystem)}<br/>` : ""
        }
        ${data.currentPhase ? `<strong>Fase atual:</strong> ${esc(data.currentPhase)}<br/>` : ""}
        ${
          data.contextModel ||
          data.contextObjective ||
          data.contextFocus ||
          data.contextCyclePhase ||
          data.contextPedagogicalIntent ||
          data.contextLoad ||
          data.contextConstraints
            ? `<strong>Contexto pedagogico:</strong><br/>
               ${data.contextModel ? `Modelo: ${esc(data.contextModel)}<br/>` : ""}
               ${data.contextObjective ? `Objetivo: ${esc(data.contextObjective)}<br/>` : ""}
               ${data.contextFocus ? `Foco: ${esc(data.contextFocus)}<br/>` : ""}
               ${data.contextCyclePhase ? `Fase do ciclo: ${esc(data.contextCyclePhase)}<br/>` : ""}
               ${data.contextPedagogicalIntent ? `Intencao: ${esc(data.contextPedagogicalIntent)}<br/>` : ""}
               ${data.contextLoad ? `Carga: ${esc(data.contextLoad)}<br/>` : ""}
               ${data.contextConstraints ? `Restricoes: ${esc(data.contextConstraints)}<br/>` : ""}
              `
            : ""
        }
        ${
          typeof data.cycleLength === "number"
            ? `<strong>Semanas:</strong> ${data.cycleLength}<br/>`
            : ""
        }
      </div>

      <table>
        <thead>
          <tr>
            <th>Semana</th>
            <th>Datas</th>
            <th>Fase</th>
            <th>Tema</th>
            <th>Foco tecnico</th>
            <th>Foco fisico</th>
            <th>PSE alvo</th>
            <th>Saltos alvo</th>
            <th>Fonte</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="9">Sem semanas geradas.</td></tr>`}
        </tbody>
      </table>

      <div class="footer">
        Gerado em ${esc(data.generatedAt)} pelo app.
      </div>
    </body>
  </html>
  `;
};
