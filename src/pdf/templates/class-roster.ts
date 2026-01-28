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
  const emptyCols = 3 + data.monthDays.length + 1;
  const leftFixedCols = isWhatsApp ? 320 : 272;
  const fundFixedCols = 110;
  const dayHeaderCells = data.monthDays
    .map((day) => `<th class="col-day">${day}</th>`)
    .join("");
  const fundDayHeaderCells = data.monthDays
    .map((day) => `<th class="col-day">${day}</th>`)
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

  const minRows = 20;
  const paddedRows = data.rows.length >= minRows
    ? data.rows
    : [
        ...data.rows,
        ...Array.from({ length: minRows - data.rows.length }, (_, idx) => ({
          index: data.rows.length + idx + 1,
          studentName: "",
          birthDate: "",
          contactLabel: "",
          contactPhone: "",
        })),
      ];

  const rows = paddedRows
    .map((row, rowIndex) => {
      const isEmpty = !row.studentName;
      const dayCells = data.monthDays.map(() => `<td class="col-day"></td>`).join("");
      if (isWhatsApp) {
        return `
          <tr class="${rowIndex % 2 === 0 ? "row-alt" : ""}">
            <td class="col-index">${row.index}</td>
            <td class="col-name">${esc(row.studentName)}</td>
            <td class="col-contact">${
              isEmpty ? "" : `${esc(row.contactLabel ?? "-")} ${esc(row.contactPhone ?? "")}`.trim()
            }</td>
            ${dayCells}
            <td class="col-total"></td>
          </tr>
        `;
      }

      return `
        <tr class="${rowIndex % 2 === 0 ? "row-alt" : ""}">
          <td class="col-index">${row.index}</td>
          <td class="col-name">${esc(row.studentName)}</td>
          <td class="col-birth">${isEmpty ? "" : esc(row.birthDate ?? "-")}</td>
          ${dayCells}
          <td class="col-total"></td>
        </tr>
      `;
    })
    .join("");

  const fundamentalsRows = data.fundamentals
    .map((item) => {
      const dayCells = data.monthDays.map(() => `<td class="col-day"></td>`).join("");
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
          margin: 0;
        }
        .sub { color: #555; line-height: 1.35; font-size: 10px; }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e6e6e6;
        }
        .header-left { flex: 1; min-width: 0; }
        .header-title {
          display: flex;
          align-items: baseline;
          gap: 10px;
        }
        .header-tag {
          font-size: 9px;
          color: #666;
          background: #f4f4f4;
          border-radius: 999px;
          padding: 2px 8px;
        }
        .header-meta-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 6px;
          font-size: 10px;
        }
        .header-meta-table td {
          padding: 2px 0;
          vertical-align: top;
        }
        .meta-label {
          color: #666;
          font-weight: 600;
          padding-right: 4px;
          white-space: nowrap;
        }
        .meta-value { color: #555; }
        .header-right {
          width: 200px;
          text-align: right;
        }
        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 999px;
          background: #f2f2f2;
          font-size: 9px;
        }
        .coach {
          margin-top: 6px;
          font-size: 10px;
          color: #444;
        }
        .layout {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          width: 100%;
        }
        .left-column {
          flex: 1;
          min-width: 0;
        }
        .right-column {
          width: 260px;
          flex-shrink: 0;
        }

        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td {
          border: 1px solid #d9d9d9;
          padding: 3px 4px;
          font-size: 9px;
          vertical-align: middle;
          word-break: break-word;
        }
        th { background: #f2f2f2; text-align: center; }
        .col-index { width: 22px; text-align: center; }
        .col-birth { width: 56px; text-align: center; }
        .col-contact { width: 104px; }
        .col-total {
          width: 44px;
          text-align: center;
          white-space: nowrap;
          word-break: keep-all;
          hyphens: none;
        }
        .col-name { width: 150px; text-align: left; }
        .col-fund { width: 110px; text-align: left; }
        .roster-table .col-day {
          text-align: center;
          width: calc((100% - var(--fixed-cols)) / var(--day-count));
        }
        .fund-table .col-day {
          text-align: center;
          width: calc((100% - var(--fixed-cols)) / var(--day-count));
        }
        .row-alt { background: #fafafa; }

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
      <div class="header">
        <div class="header-left">
          <div class="header-title">
            <h1>${esc(data.title)}</h1>
            ${data.ageBand ? `<span class="header-tag">${esc(data.ageBand)}</span>` : ""}
          </div>
          <table class="header-meta-table">
            <tr>
              <td class="meta-label">Turma:</td>
              <td class="meta-value">${esc(data.className)}</td>
              <td class="meta-label">Unidade:</td>
              <td class="meta-value">${esc(data.unitLabel ?? "-")}</td>
            </tr>
            <tr>
              <td class="meta-label">Dias:</td>
              <td class="meta-value">${esc(data.daysLabel ?? "-")}</td>
              <td class="meta-label">Horario:</td>
              <td class="meta-value">${esc(data.timeLabel ?? "-")}</td>
            </tr>
            <tr>
              <td class="meta-label">Mes:</td>
              <td class="meta-value">${esc(data.monthLabel)}</td>
              <td></td>
              <td></td>
            </tr>
          </table>
        </div>
        <div class="header-right">
          ${data.periodizationLabel ? `<div class="badge">${esc(data.periodizationLabel)}</div>` : ""}
          ${data.coachName ? `<div class="coach"><strong>Professor:</strong> ${esc(data.coachName)}</div>` : ""}
        </div>
      </div>

      <div class="layout">
        <div class="left-column">
          <table class="roster-table" style="--day-count:${dayCount}; --fixed-cols:${leftFixedCols}px">
            <thead>
              <tr>
                ${headerCells}
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="${emptyCols}" class="sub"> </td></tr>`}
            </tbody>
          </table>
          <div class="footer">
            <div>Exportado em ${esc(data.exportDate)}</div>
            <div>Total de alunos: ${data.totalStudents}</div>
          </div>
        </div>

        <div class="right-column">
          <div class="block">
            <div class="block-title">Fundamentos trabalhados</div>
            <table class="fund-table" style="--day-count:${dayCount}; --fixed-cols:${fundFixedCols}px">
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
            <div class="block-title">Observações</div>
            ${Array.from({ length: 8 }).map(() => `<div class="notes-line"></div>`).join("")}
          </div>
        </div>
      </div>
    </body>
  </html>
  `;
};
