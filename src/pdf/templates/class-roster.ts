export type ClassRosterRow = {
  index: number;
  studentName: string;
  age?: string;
  studentPhone?: string;
  guardianName?: string;
  guardianPhone?: string;
  contactSource?: string;
  contactPhone?: string;
  whatsappLink?: string;
};

export type ClassRosterPdfData = {
  title: string;
  className: string;
  ageBand?: string;
  unitLabel?: string;
  daysLabel?: string;
  timeLabel?: string;
  exportDate: string;
  mode: "full" | "whatsapp";
  totalStudents: number;
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
  const emptyCols = isWhatsApp ? 5 : 7;
  const headerCells = isWhatsApp
    ? `
      <th class="col-index">#</th>
      <th class="col-name">Aluno</th>
      <th>Contato</th>
      <th class="col-phone">Telefone</th>
      <th class="col-link">WhatsApp</th>
    `
    : `
      <th class="col-index">#</th>
      <th class="col-name">Aluno</th>
      <th class="col-age">Idade</th>
      <th class="col-phone">Telefone</th>
      <th>Responsavel</th>
      <th class="col-phone">Telefone resp.</th>
      <th class="col-sign">Assinatura</th>
    `;

  const rows = data.rows
    .map((row) => {
      if (isWhatsApp) {
        return `
          <tr>
            <td class="col-index">${row.index}</td>
            <td class="col-name">${esc(row.studentName)}</td>
            <td>${esc(row.contactSource ?? "-")}</td>
            <td class="col-phone">${esc(row.contactPhone ?? "-")}</td>
            <td class="col-link">${esc(row.whatsappLink ?? "-")}</td>
          </tr>
        `;
      }

      return `
        <tr>
          <td class="col-index">${row.index}</td>
          <td class="col-name">${esc(row.studentName)}</td>
          <td class="col-age">${esc(row.age ?? "-")}</td>
          <td class="col-phone">${esc(row.studentPhone ?? "-")}</td>
          <td>${esc(row.guardianName ?? "-")}</td>
          <td class="col-phone">${esc(row.guardianPhone ?? "-")}</td>
          <td class="col-sign"></td>
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
          margin: 24px;
        }
        body {
          font-family: -apple-system, Arial, sans-serif;
          color: #111;
        }
        h1 {
          font-size: 20px;
          margin: 0 0 6px 0;
        }
        .sub { color: #555; margin-bottom: 12px; line-height: 1.4; }
        .grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 12px;
        }
        .card {
          border: 1px solid #ddd;
          border-radius: 10px;
          padding: 10px;
          background: #fafafa;
        }
        .label { font-size: 11px; color: #777; margin-bottom: 4px; }
        .value { font-size: 12px; }

        table { width: 100%; border-collapse: collapse; }
        th, td {
          border: 1px solid #ddd;
          padding: 6px;
          font-size: 11px;
          vertical-align: top;
          word-break: break-word;
        }
        th { background: #f2f2f2; text-align: left; }
        .col-index { width: 30px; text-align: center; }
        .col-age { width: 48px; text-align: center; }
        .col-phone { width: 110px; }
        .col-link { width: 220px; }
        .col-sign { width: 140px; }
        .col-name { width: 220px; }

        .footer {
          margin-top: 14px;
          font-size: 11px;
          color: #666;
          display: flex;
          justify-content: space-between;
          border-top: 1px dashed #ddd;
          padding-top: 8px;
        }
      </style>
    </head>

    <body>
      <h1>${esc(data.title)}</h1>
      <div class="sub">
        <strong>Turma:</strong> ${esc(data.className)}${
          data.ageBand ? ` (${esc(data.ageBand)})` : ""
        }<br/>
        ${data.unitLabel ? `<strong>Unidade:</strong> ${esc(data.unitLabel)}<br/>` : ""}
        ${data.daysLabel ? `<strong>Dias:</strong> ${esc(data.daysLabel)}<br/>` : ""}
        ${data.timeLabel ? `<strong>Horario:</strong> ${esc(data.timeLabel)}<br/>` : ""}
        <strong>Exportado em:</strong> ${esc(data.exportDate)}
      </div>

      <div class="grid">
        <div class="card">
          <div class="label">Total de alunos</div>
          <div class="value">${data.totalStudents}</div>
        </div>
        <div class="card">
          <div class="label">Tipo</div>
          <div class="value">${isWhatsApp ? "Lista WhatsApp" : "Lista completa"}</div>
        </div>
        <div class="card">
          <div class="label">Unidade</div>
          <div class="value">${esc(data.unitLabel ?? "Sem unidade")}</div>
        </div>
      </div>

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
        <div>Gerado pelo app</div>
        <div>Assinatura: ____________________</div>
      </div>
    </body>
  </html>
  `;
};
