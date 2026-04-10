import { toPdfCoachingText, toPdfText } from "../pdf-coaching-text";

export type SessionReportPdfData = {
  monthLabel: string;
  dateLabel: string;
  className: string;
  unitLabel: string;
  activity: string;
  conclusion: string;
  participantsCount: number;
  photos: string;
  deadlineLabel: string;
};

const asText = (value: unknown) => toPdfText(value);

const asCoachingText = (value: unknown) => toPdfCoachingText(value);

const esc = (value: unknown) =>
  asText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");

const nl2br = (value: unknown) => esc(value).replace(/\n/g, "<br/>");

const parsePhotoUris = (raw: string) => {
  const value = asText(raw).trim();
  if (!value || value === "[]") return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => asText(item).trim()).filter(Boolean);
    }
  } catch {
    // fallback to line-based parsing
  }
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const isRenderableImageUri = (value: string) =>
  /^(https?:|file:|content:|blob:|data:image\/)/i.test(value);

export const sessionReportHtml = (data: SessionReportPdfData) => {
  const activity = asCoachingText(data?.activity).trim();
  const conclusion = asCoachingText(data?.conclusion).trim();
  const photos = asText(data?.photos).trim();
  const photoUris = parsePhotoUris(photos).filter(isRenderableImageUri).slice(0, 6);
  const participants =
    typeof data?.participantsCount === "number" && data.participantsCount > 0
      ? String(data.participantsCount)
      : "-";
  const deadline = asText(data?.deadlineLabel).trim() || "último dia da escolinha do mês";

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
        .photo-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
        }
        .photo-item {
          width: 31.5%;
          aspect-ratio: 3 / 4;
          border: 1px solid #999;
          border-radius: 6px;
          object-fit: cover;
        }
      </style>
    </head>
    <body>
      <h1>RELATÓRIO ESCOLINHA DE VÔLEI</h1>
      <div class="meta">
        <strong>Turma:</strong> ${esc(data?.className || "-")}<br/>
        <strong>Unidade:</strong> ${esc(data?.unitLabel || "-")}
      </div>
      <table>
        <tr>
          <td><strong>MÊS:</strong> ${esc(data?.monthLabel)}</td>
          <td><strong>Prazo de entrega:</strong> ${esc(deadline)}</td>
        </tr>
        <tr>
          <td colspan="2"><span class="label">Data:</span>${esc(data?.dateLabel)}</td>
        </tr>
        <tr>
          <td colspan="2"><span class="label">Atividade:</span>${nl2br(activity || "-")}</td>
        </tr>
        <tr>
          <td colspan="2"><span class="label">Conclusão:</span>${nl2br(conclusion || "-")}</td>
        </tr>
        <tr>
          <td colspan="2"><span class="label">Número de participantes:</span>${esc(participants)}</td>
        </tr>
        <tr>
          <td colspan="2" class="photos">
            <span class="label">Fotos:</span>
            ${
              photoUris.length
                ? `<div class="photo-grid">${photoUris
                    .map(
                      (uri) =>
                        `<img class="photo-item" src="${esc(uri)}" alt="Foto do relatório"/>`
                    )
                    .join("")}</div>`
                : ""
            }
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
};

