export type SessionReportPdfData = {
  monthLabel: string;
  dateLabel: string;
  className?: string;
  unitLabel?: string;
  activity?: string;
  conclusion?: string;
  participantsCount?: number;
  photos?: string;
  deadlineLabel?: string;
};

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");

const nl2br = (value: string) => esc(value).replace(/\n/g, "<br/>");

export const sessionReportHtml = (data: SessionReportPdfData) => {
  const activity = data.activity?.trim() ?? "";
  const conclusion = data.conclusion?.trim() ?? "";
  const photos = data.photos?.trim() ?? "";
  const participants =
    typeof data.participantsCount === "number" && data.participantsCount > 0
      ? String(data.participantsCount)
      : "-";
  const deadline = data.deadlineLabel?.trim() || "último dia da escolinha do mês";

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
          text-align: center;
          font-size: 16px;
          margin: 0 0 16px 0;
          letter-spacing: 0.4px;
        }
        .meta {
          font-size: 12px;
          margin-bottom: 12px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        td {
          border: 1px solid #000;
          padding: 10px;
          vertical-align: top;
        }
        .label {
          font-weight: 700;
          margin-bottom: 4px;
          display: block;
        }
        .photos {
          min-height: 260px;
        }
      </style>
    </head>
    <body>
      <h1>RELATORIO ESCOLINHA DE VOLEI</h1>
      <div class="meta">
        <strong>Turma:</strong> ${esc(data.className ?? "-")}<br/>
        <strong>Unidade:</strong> ${esc(data.unitLabel ?? "-")}
      </div>
      <table>
        <tr>
          <td><strong>MES:</strong> ${esc(data.monthLabel)}</td>
          <td><strong>Prazo de entrega:</strong> ${esc(deadline)}</td>
        </tr>
        <tr>
          <td colspan="2"><span class="label">Data:</span>${esc(data.dateLabel)}</td>
        </tr>
        <tr>
          <td colspan="2"><span class="label">Atividade:</span>${nl2br(activity || "-")}</td>
        </tr>
        <tr>
          <td colspan="2"><span class="label">Conclusao:</span>${nl2br(conclusion || "-")}</td>
        </tr>
        <tr>
          <td colspan="2"><span class="label">Número de participantes:</span>${esc(participants)}</td>
        </tr>
        <tr>
          <td colspan="2" class="photos"><span class="label">Fotos:</span>${nl2br(photos || "-")}</td>
        </tr>
      </table>
    </body>
  </html>
  `;
};
