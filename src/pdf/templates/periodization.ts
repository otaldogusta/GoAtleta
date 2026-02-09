export type PeriodizationWeekRow = {
  week: number;
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
  cycleStart: string;
  cycleLength: number;
  generatedAt: string;
  rows: PeriodizationWeekRow[];
};

const esc = (value: string) =>
  value
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
        ${
          data.cycleStart
            ? `<strong>Início do ciclo:</strong> ${esc(data.cycleStart)}<br/>`
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
          ${rowsHtml || `<tr><td colspan="8">Sem semanas geradas.</td></tr>`}
        </tbody>
      </table>

      <div class="footer">
        Gerado em ${esc(data.generatedAt)} pelo app.
      </div>
    </body>
  </html>
  `;
};
