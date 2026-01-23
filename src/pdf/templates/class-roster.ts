export type ClassRosterRow = {
  index: number;
  studentName: string;
  birthDate?: string;
  contactLabel?: string;
  contactPhone?: string;
};

export type ClassRosterPdfData = {
  title: string;
  className: string;
  ageBand?: string;
  unitLabel?: string;
  daysLabel?: string;
  timeLabel?: string;
  monthLabel: string;
  exportDate: string;
  mode: "full" | "whatsapp";
  totalStudents: number;
  monthDays: number[];
  fundamentals: string[];
  periodizationLabel?: string;
  coachName?: string;
  rows: ClassRosterRow[];
};

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");

export const classRosterHtml = (data: ClassRosterPdfData) => {
  const isWhatsApp = data.mode === "whatsapp";
  const dayCount = Math.max(1, data.monthDays.length);
  const leftDayCellWidth = Math.max(14, Math.min(24, Math.floor(300 / dayCount)));
  const rightDayCellWidth = Math.max(10, Math.min(18, Math.floor(160 / dayCount)));
  const emptyCols = 3 + data.monthDays.length + 1;
  const dayHeaderCells = data.monthDays
    .map((day) => `<th class="col-day" style="width:${leftDayCellWidth}px">${day}</th>`)
    .join("");
  const fundDayHeaderCells = data.monthDays
    .map((day) => `<th class="col-day" style="width:${rightDayCellWidth}px">${day}</th>`)
    .join("");

  const headerCells = isWhatsApp
    ? `
      <th class="col-index">#</th>
      <th class="col-name">Atletas</th>
      <th class="col-contact">Contato</th>
      ${dayHeaderCells}
      <th class="col-total">Total</th>
    `
    : `
      <th class="col-index">#</th>
      <th class="col-name">Atletas</th>
      <th class="col-birth">Nasc</th>
      ${dayHeaderCells}
      <th class="col-total">Total</th>
    `;

  const rows = data.rows
    .map((row) => {
      const dayCells = data.monthDays
        .map(() => `<td class="col-day" style="width:${leftDayCellWidth}px"></td>`)
        .join("");
      if (isWhatsApp) {
        return `
          <tr>
            <td class="col-index">${row.index}</td>
            <td class="col-name">${esc(row.studentName)}</td>
            <td class="col-contact">${esc(row.contactLabel ?? "-")} ${esc(row.contactPhone ?? "")}</td>
            ${dayCells}
            <td class="col-total"></td>
          </tr>
        `;
      }

      return `
        <tr>
          <td class="col-index">${row.index}</td>
          <td class="col-name">${esc(row.studentName)}</td>
          <td class="col-birth">${esc(row.birthDate ?? "-")}</td>
          ${dayCells}
          <td class="col-total"></td>
        </tr>
      `;
    })
    .join("");

  const fundamentalsRows = data.fundamentals
    .map((item) => {
      const dayCells = data.monthDays
        .map(() => `<td class="col-day" style="width:${rightDayCellWidth}px"></td>`)
        .join("");
      return `
        <tr>
          <td class="col-fund">${esc(item)}</td>
          ${dayCells}
        </tr>
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
          margin: 20px;
        }
        body {
          font-family: -apple-system, Arial, sans-serif;
          color: #111;
        }
        h1 {
          font-size: 18px;
          margin: 0 0 6px 0;
        }
        .sub { color: #555; margin-bottom: 8px; line-height: 1.35; font-size: 11px; }
        .top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 6px;
        }
        .badge {
          padding: 4px 8px;
          border-radius: 999px;
          background: #f2f2f2;
          font-size: 10px;
        }
        .layout {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 12px;
          align-items: start;
        }

        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td {
          border: 1px solid #d9d9d9;
          padding: 4px;
          font-size: 10px;
          vertical-align: middle;
          word-break: break-word;
        }
        th { background: #f2f2f2; text-align: center; }
        .col-index { width: 26px; text-align: center; }
        .col-birth { width: 64px; text-align: center; }
        .col-contact { width: 120px; }
        .col-total { width: 32px; text-align: center; }
        .col-name { width: 180px; text-align: left; }
        .col-fund { width: 120px; text-align: left; }
        .col-day { text-align: center; }

        .block {
          border: 1px solid #ddd;
          border-radius: 10px;
          padding: 8px;
          background: #fafafa;
        }
        .block-title {
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .notes {
          margin-top: 10px;
          min-height: 120px;
          background: #fff;
        }
        .notes-line {
          border-bottom: 1px dashed #ddd;
          height: 18px;
        }

        .footer {
          margin-top: 10px;
          font-size: 10px;
          color: #666;
          display: flex;
          justify-content: space-between;
          border-top: 1px dashed #ddd;
          padding-top: 6px;
        }
      </style>
    </head>

    <body>
      <div class="top-row">
        <div>
          <h1>${esc(data.title)}</h1>
          <div class="sub">
            <strong>Turma:</strong> ${esc(data.className)}${
              data.ageBand ? ` (${esc(data.ageBand)})` : ""
            }<br/>
            ${data.unitLabel ? `<strong>Unidade:</strong> ${esc(data.unitLabel)}<br/>` : ""}
            ${data.daysLabel ? `<strong>Dias:</strong> ${esc(data.daysLabel)}<br/>` : ""}
            ${data.timeLabel ? `<strong>Horario:</strong> ${esc(data.timeLabel)}<br/>` : ""}
            <strong>Mes:</strong> ${esc(data.monthLabel)}
          </div>
        </div>
        <div style="text-align:right">
          ${data.periodizationLabel ? `<div class="badge">${esc(data.periodizationLabel)}</div>` : ""}
          ${data.coachName ? `<div class="sub"><strong>Professor:</strong> ${esc(data.coachName)}</div>` : ""}
        </div>
      </div>

      <div class="layout">
        <div>
          <table>
            <thead>
              <tr>
                ${headerCells}
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="${emptyCols}" class="sub">Nenhum aluno encontrado.</td></tr>`}
            </tbody>
          </table>
          <div class="footer">
            <div>Exportado em ${esc(data.exportDate)}</div>
            <div>Total de alunos: ${data.totalStudents}</div>
          </div>
        </div>

        <div>
          <div class="block">
            <div class="block-title">Fundamentos trabalhados</div>
            <table>
              <thead>
                <tr>
                  <th class="col-fund">Fundamento</th>
                  ${fundDayHeaderCells}
                </tr>
              </thead>
              <tbody>
                ${fundamentalsRows || `<tr><td class="col-fund">Sem fundamentos</td>${data.monthDays.map(() => `<td class="col-day"></td>`).join("")}</tr>`}
              </tbody>
            </table>
          </div>
          <div class="block notes">
            <div class="block-title">Observacoes</div>
            ${Array.from({ length: 8 }).map(() => `<div class="notes-line"></div>`).join("")}
          </div>
        </div>
      </div>
    </body>
  </html>
  `;
};
