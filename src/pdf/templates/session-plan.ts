import type { LessonActivity, LessonBlock } from "../../core/models";
import { resolveLearningObjectives } from "../../core/pedagogy/objective-language";
import { sanitizeVolleyballLanguage } from "../../core/pedagogy/volleyball-language-lexicon";
import { toPdfCoachingText, toPdfText } from "../pdf-coaching-text";

export type SessionPlanActivity = LessonActivity & {
  description?: string;
  // Legacy fallback for migration.
  notes?: string;
};

export type SessionBlock = Partial<LessonBlock> & {
  title?: string;
  time?: string;
  // Legacy fallback for migration.
  summary?: string;
  activities?: SessionPlanActivity[];
  items?: SessionPlanActivity[];
};

export type SessionPlanPdfData = {
  className: string;
  ageGroup?: string;
  unitLabel?: string;
  genderLabel?: string;
  dateLabel: string;
  weekLabel?: string;
  title?: string;
  objective?: string;
  generalObjective?: string;
  specificObjective?: string;
  weeklyFocus?: string;
  pedagogicalRule?: string;
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

const asText = (value: unknown) => sanitizeVolleyballLanguage(toPdfText(value));

const asCoachingText = (value: unknown) => sanitizeVolleyballLanguage(toPdfCoachingText(value));

const nl2br = (value: unknown) => esc(asText(value)).replace(/\n/g, "<br/>");

const buildOrderedLines = (rows: string[]) =>
  rows.length ? rows.map((line, index) => `${index + 1}. ${line}`).join("\n") : "-";

const getBlockLabel = (block: SessionBlock) => asText(block?.label || block?.title) || "-";

const getBlockTime = (block: SessionBlock) => {
  if (typeof block?.durationMinutes === "number" && Number.isFinite(block.durationMinutes)) {
    return `${Math.max(0, Math.round(block.durationMinutes))} min`;
  }
  return asText(block?.time) || "-";
};

const getBlockActivities = (block: SessionBlock) => {
  if (Array.isArray(block?.activities) && block.activities.length) return block.activities;
  if (Array.isArray(block?.items) && block.items.length) return block.items;
  return [];
};

const resolveBlockDescriptionLines = (block: SessionBlock) => {
  const blockItems = getBlockActivities(block);
  const descriptionRows = blockItems
    .map((item) => asCoachingText(item?.description || item?.notes).trim())
    .filter(Boolean);

  if (descriptionRows.length) return descriptionRows;

  const blockSummary = asCoachingText(block?.summary).trim();
  return blockSummary ? [blockSummary] : [];
};

export const sessionPlanHtml = (data: SessionPlanPdfData) => {
  const objective = asCoachingText(data?.objective);
  const generalObjective = asCoachingText(data?.generalObjective);
  const specificObjective = asCoachingText(data?.specificObjective);
  const weeklyFocus = asCoachingText(data?.weeklyFocus);
  const title = asCoachingText(data?.title);
  const notes = asCoachingText(data?.notes);
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  const resolvedObjectives = resolveLearningObjectives({
    generalObjective,
    specificObjective: specificObjective || objective,
    title,
    weeklyFocus,
    theme: weeklyFocus,
    technicalFocus: weeklyFocus,
  });
  const resolvedGeneralObjective = sanitizeVolleyballLanguage(resolvedObjectives.generalObjective);
  const resolvedSpecificObjective = sanitizeVolleyballLanguage(resolvedObjectives.specificObjective);

  const blockRowsHtml = blocks
    .map((block) => {
      const period = getBlockLabel(block);
      const time = getBlockTime(block);
      const blockItems = getBlockActivities(block);
      const activities = buildOrderedLines(
        blockItems.map((item) => asCoachingText(item?.name).trim()).filter(Boolean)
      );
      const descriptions = buildOrderedLines(resolveBlockDescriptionLines(block));

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
          font-size: 16px;
          margin: 0;
          letter-spacing: 0.4px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 14px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e6e6e6;
        }
        .header-left {
          flex: 1;
          min-width: 0;
        }
        .header-meta {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px 14px;
          font-size: 11px;
          line-height: 1.35;
        }
        .meta-item {
          display: flex;
          gap: 4px;
          min-width: 220px;
        }
        .meta-label {
          color: #666;
          font-weight: 700;
          white-space: nowrap;
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
      <div class="header">
        <div class="header-left">
          <h1>PLANEJAMENTO DE AULA DO DIA</h1>
          <div class="header-meta">
            <div class="meta-item">
              <span class="meta-label">Turma:</span>
              <span>${esc(asText(data?.className))}${
                asText(data?.ageGroup) ? ` (${esc(asText(data?.ageGroup))})` : ""
              }</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Data:</span>
              <span>${esc(asText(data?.dateLabel))}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Semana:</span>
              <span>${esc(asText(data?.weekLabel) || "-")}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Unidade:</span>
              <span>${esc(asText(data?.unitLabel) || "-")}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Gênero:</span>
              <span>${esc(asText(data?.genderLabel) || "-")}</span>
            </div>
          </div>
        </div>
      </div>

      <table>
        <tr>
          <td colspan="4"><strong>Tema/Atividade:</strong> ${esc(title || "")}</td>
        </tr>
        ${
          resolvedGeneralObjective
            ? `<tr><td colspan="4"><strong>Objetivo geral:</strong> ${esc(resolvedGeneralObjective)}</td></tr>`
            : ""
        }
        ${
          resolvedSpecificObjective
            ? `<tr><td colspan="4"><strong>Objetivo específico:</strong> ${esc(resolvedSpecificObjective)}</td></tr>`
            : ""
        }
        <tr>
          <td colspan="4"><strong>Tempo total:</strong> ${esc(asText(data?.totalTime) || "")}</td>
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

