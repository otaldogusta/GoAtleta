export type SessionBlock = {
  title: string;
  time: string;
  items: {
    name: string;
    duration?: string;
    reps?: string;
    intensity?: string;
    notes?: string;
  }[];
};

export type SessionPlanPdfData = {
  className: string;
  ageGroup?: string;
  unitLabel?: string;
  dateLabel: string;
  title?: string;
  objective?: string;
  totalTime?: string;
  plannedLoad?: string;
  materials?: string[];
  notes?: string;
  blocks: SessionBlock[];
  coachName?: string;
};

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");

const asText = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
};

const nl2br = (value: unknown) => esc(asText(value)).replace(/\n/g, "<br/>");

const buildOrderedLines = (rows: string[]) =>
  rows.length ? rows.map((line, index) => `${index + 1}. ${line}`).join("\n") : "-";

export const sessionPlanHtml = (data: SessionPlanPdfData) => {
  const objective = asText(data?.objective);
  const title = asText(data?.title);
  const notes = asText(data?.notes);
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];

  const blockRowsHtml = blocks
    .map((block) => {
      const period = asText(block?.title) || "-";
      const time = asText(block?.time) || "-";
      const blockItems = Array.isArray(block?.items) ? block.items : [];
      const activities = buildOrderedLines(
        blockItems.map((item) => asText(item?.name).trim()).filter(Boolean)
      );
      const descriptions = buildOrderedLines(
        blockItems
          .map((item) => asText(item?.notes).trim() || asText(item?.name).trim())
          .filter(Boolean)
      );

      return `
      <tr>
        <td class="period"><strong>${esc(period)}</strong></td>
        <td class="activities prewrap">${nl2br(activities)}</td>
        <td class="time">${esc(time)}</td>
        <td class="description prewrap">${nl2br(descriptions)}</td>
      </tr>
    `;
    })
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
          background: #fff;
        }
        h1 {
          text-align: center;
          font-size: 16px;
          margin: 0 0 16px 0;
          letter-spacing: 0.4px;
        }
        .meta {
          margin-top: 10px;
          font-size: 12px;
          margin-bottom: 12px;
          line-height: 1.45;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        td, th {
          border: 1px solid #111;
          padding: 10px;
          vertical-align: top;
          hyphens: none;
        }
        th {
          background: #f2f2f2;
          text-align: center;
          font-size: 12px;
          white-space: nowrap;
          word-break: keep-all;
        }
        .prewrap {
          white-space: pre-wrap;
          line-height: 1.4;
        }
        .period {
          width: 20%;
          font-size: 11px;
        }
        .activities {
          width: 24%;
        }
        .time {
          width: 12%;
          text-align: center;
          font-weight: 700;
          white-space: nowrap;
          word-break: keep-all;
        }
        .description {
          width: 44%;
        }
        .notes-label {
          width: 20%;
          font-weight: 700;
        }
        .notes-value {
          min-height: 96px;
        }
        .footer {
          margin-top: 12px;
          font-size: 10px;
          color: #555;
          text-align: right;
        }
      </style>
    </head>

    <body>
      <h1>PLANEJAMENTO DE AULA DO DIA</h1>
      <div class="meta">
        <strong>Turma:</strong> ${esc(asText(data?.className))}${
          asText(data?.ageGroup) ? ` (${esc(asText(data?.ageGroup))})` : ""
        }<br/>
        <strong>Data:</strong> ${esc(asText(data?.dateLabel))}
        ${asText(data?.unitLabel) ? `<br/><strong>Unidade:</strong> ${esc(asText(data?.unitLabel))}` : ""}
      </div>

      <table>
        <tr>
          <td colspan="4"><strong>Tema/Atividade:</strong> ${esc(title || "-")}</td>
        </tr>
        <tr>
          <td colspan="3"><strong>Objetivo:</strong> ${esc(objective || "-")}</td>
          <td><strong>Tempo total:</strong> ${esc(asText(data?.totalTime) || "-")}</td>
        </tr>
        <tr>
          <th>Per\u00edodo</th>
          <th>Atividades</th>
          <th>Tempo</th>
          <th>Descri\u00e7\u00e3o</th>
        </tr>
        ${blockRowsHtml}
        <tr>
          <td class="notes-label">Observa\u00e7\u00f5es:</td>
          <td colspan="3" class="notes-value prewrap">${nl2br(notes || "-")}</td>
        </tr>
      </table>

      <div class="footer">
        Gerado em ${new Date().toLocaleDateString("pt-BR")}${
          asText(data?.coachName) ? ` - Professor(a): ${esc(asText(data?.coachName))}` : ""
        }
      </div>
    </body>
  </html>
  `;
};


