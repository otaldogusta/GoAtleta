export type SessionBlock = {
  title: string;
  time: string;
  items: {
    name: string;
    duration: string;
    reps: string;
    intensity: string;
    notes: string;
  }[];
};

export type SessionPlanPdfData = {
  className: string;
  ageGroup: string;
  unitLabel: string;
  dateLabel: string;
  title: string;
  objective: string;
  totalTime: string;
  plannedLoad: string;
  materials: string[];
  notes: string;
  blocks: SessionBlock[];
  coachName: string;
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

export const sessionPlanHtml = (data: SessionPlanPdfData) => {
  const objective = asText(data?.objective);
  const plannedLoad = asText(data?.plannedLoad);
  const title = asText(data?.title);
  const notes = asText(data?.notes);
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  const materials = (Array.isArray(data?.materials) ? data.materials : [])
    .map((item) => `<span class="chip">${esc(asText(item))}</span>`)
    .join("");
  const hasMaterials = materials.length > 0;
  const hasObjective = Boolean(objective.trim());
  const hasLoad = Boolean(plannedLoad.trim());
  const hasTitle = Boolean(title.trim());

  const blocksHtml = blocks
    .map((block) => {
      const blockTitle = asText(block?.title);
      const blockTime = asText(block?.time);
      const blockItems = Array.isArray(block?.items) ? block.items : [];
      const rows = blockItems
        .map(
          (item) => `
      <tr>
        <td class="col-name">
          <strong>${esc(asText(item?.name))}</strong>
          ${asText(item?.notes) ? `<div class="muted">${esc(asText(item?.notes))}</div>` : ""}
        </td>
      </tr>
    `
        )
        .join("");

      return `
      <div class="block">
        <div class="block-header">
          <div>
            <div class="block-title">${esc(blockTitle)}</div>
            ${blockTime ? `<div class="muted">${esc(blockTime)}</div>` : ""}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Atividade / Exerc\u00edcio</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td class="muted">Sem atividades.</td></tr>`}
          </tbody>
        </table>
      </div>
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
        }
        h1 {
          font-size: 20px;
          margin: 0 0 6px 0;
        }
        .sub { color: #555; margin-bottom: 14px; line-height: 1.45; }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 12px;
        }
        .card {
          border: 1px solid #ddd;
          border-radius: 10px;
          padding: 12px;
          background: #fafafa;
        }
        .label { font-size: 11px; color: #777; margin-bottom: 4px; }
        .value { font-size: 13px; }
        .chip {
          display: inline-block;
          padding: 4px 8px;
          margin: 4px 6px 0 0;
          border-radius: 999px;
          background: #eee;
          font-size: 11px;
        }

        .block { margin-top: 16px; }
        .block-header { margin-bottom: 8px; display: flex; justify-content: space-between; align-items: baseline; }
        .block-title { font-size: 14px; font-weight: 700; }
        .muted { color: #666; font-size: 11px; margin-top: 4px; }

        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; vertical-align: top; word-break: break-word; }
        th { background: #f2f2f2; text-align: left; }
        .col-small { width: 70px; text-align: center; }
        .col-name { width: auto; }
        .prewrap { white-space: pre-wrap; }

        .footer {
          margin-top: 18px;
          font-size: 11px;
          color: #777;
          display: flex;
          justify-content: space-between;
          border-top: 1px dashed #ddd;
          padding-top: 12px;
        }
        .signature {
          margin-top: 10px;
          font-size: 12px;
        }
      </style>
    </head>

    <body>
      <h1>Plano de Aula (Dia)</h1>
      <div class="sub">
        <strong>Turma:</strong> ${esc(asText(data?.className))}${
          asText(data?.ageGroup) ? ` (${esc(asText(data?.ageGroup))})` : ""
        }<br/>
        <strong>Data:</strong> ${esc(asText(data?.dateLabel))}
        ${asText(data?.unitLabel) ? `<br/><strong>Unidade:</strong> ${esc(asText(data?.unitLabel))}` : ""}
      </div>

      <div class="grid">
        ${
          hasTitle
            ? `
        <div class="card">
          <div class="label">T\u00edtulo / Tema</div>
          <div class="value">${esc(title || "")}</div>
        </div>
        `
            : ""
        }
        <div class="card">
          <div class="label">Tempo total</div>
          <div class="value">${esc(asText(data?.totalTime) || "-")}</div>
        </div>
        ${
          hasObjective
            ? `
        <div class="card">
          <div class="label">Objetivo</div>
          <div class="value">${esc(objective || "")}</div>
        </div>
        `
            : ""
        }
        ${
          hasLoad
            ? `
        <div class="card">
          <div class="label">Carga planejada</div>
          <div class="value">${esc(plannedLoad || "")}</div>
        </div>
        `
            : ""
        }
      </div>

      ${
        hasMaterials
          ? `
        <div class="block">
          <div class="block-header">
            <div class="block-title">Materiais</div>
          </div>
          <div>${materials}</div>
        </div>
      `
          : ""
      }

      ${blocksHtml}

      ${
        notes
          ? `
        <div class="block">
          <div class="block-header">
            <div class="block-title">Observa\u00e7\u00f5es</div>
          </div>
          <div class="card prewrap">${esc(notes)}</div>
        </div>
      `
          : ""
      }

      <div class="footer">
        <div>Gerado pelo app - ${new Date().toLocaleDateString("pt-BR")}</div>
        <div class="signature">
          ${
            asText(data?.coachName)
              ? `Professor(a): ${esc(asText(data?.coachName))}`
              : "Assinatura: ____________________"
          }
        </div>
      </div>
    </body>
  </html>
  `;
};


