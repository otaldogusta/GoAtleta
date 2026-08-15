import type { AttendanceExportSummaryRow } from "../../screens/classes/application/attendance-export";

export type AttendanceSummaryPdfData = {
  organizationName: string;
  periodLabel: string;
  scopeLabel: string;
  exportedAt: string;
  totalRecords: number;
  totalPresent: number;
  totalAbsent: number;
  attendanceRate: number;
  rows: AttendanceExportSummaryRow[];
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export const attendanceSummaryHtml = (data: AttendanceSummaryPdfData) => `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; color: #111827; padding: 24px; font-size: 12px; }
      h1 { margin: 0 0 6px; font-size: 22px; }
      .muted { color: #64748b; }
      .metrics { display: flex; gap: 10px; margin: 20px 0; }
      .metric { flex: 1; border: 1px solid #dbe2ea; border-radius: 10px; padding: 12px; }
      .metric strong { display: block; font-size: 20px; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border-bottom: 1px solid #e2e8f0; padding: 9px 7px; text-align: left; }
      th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; }
      td.number, th.number { text-align: right; }
      footer { margin-top: 20px; color: #64748b; font-size: 10px; }
    </style>
  </head>
  <body>
    <h1>Resumo de chamadas</h1>
    <div class="muted">${escapeHtml(data.organizationName)} · ${escapeHtml(data.periodLabel)}</div>
    <div class="muted">${escapeHtml(data.scopeLabel)}</div>
    <div class="metrics">
      <div class="metric">Presenças<strong>${data.totalPresent}</strong></div>
      <div class="metric">Faltas<strong>${data.totalAbsent}</strong></div>
      <div class="metric">Frequência<strong>${data.attendanceRate}%</strong></div>
    </div>
    <table>
      <thead><tr><th>Unidade</th><th>Turma</th><th class="number">Aulas</th><th class="number">Presenças</th><th class="number">Faltas</th><th class="number">Frequência</th></tr></thead>
      <tbody>
        ${data.rows.map((row) => `<tr><td>${escapeHtml(row.unit)}</td><td>${escapeHtml(row.className)}</td><td class="number">${row.sessions}</td><td class="number">${row.present}</td><td class="number">${row.absent}</td><td class="number">${row.attendanceRate}%</td></tr>`).join("")}
      </tbody>
    </table>
    <footer>${data.totalRecords} registros · Exportado em ${escapeHtml(data.exportedAt)}</footer>
  </body>
</html>`;
