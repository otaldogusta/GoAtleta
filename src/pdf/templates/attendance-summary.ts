import type {
  AttendanceExportDetailRow,
  AttendanceExportSummaryRow,
} from "../../screens/classes/application/attendance-export";

export type AttendanceSummaryPdfData = {
  organizationName: string;
  periodLabel: string;
  scopeLabel: string;
  timeZone: string;
  exportedAt: string;
  totalRecords: number;
  totalPresent: number;
  totalAbsent: number;
  attendanceRate: number;
  rows: AttendanceExportSummaryRow[];
  details: AttendanceExportDetailRow[];
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatDate = (isoDate: string) => isoDate.split("-").reverse().join("/");

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
      h2 { margin: 22px 0 8px; font-size: 15px; }
      .details { font-size: 10px; }
      .details th, .details td { padding: 7px 6px; }
    </style>
  </head>
  <body>
    <h1>Resumo de chamadas</h1>
    <div class="muted">${escapeHtml(data.organizationName)} · ${escapeHtml(data.periodLabel)}</div>
    <div class="muted">${escapeHtml(data.scopeLabel)}</div>
    <div class="muted">Fuso: ${escapeHtml(data.timeZone)}</div>
    <div class="metrics">
      <div class="metric">Presenças<strong>${data.totalPresent}</strong></div>
      <div class="metric">Faltas<strong>${data.totalAbsent}</strong></div>
      <div class="metric">Frequência<strong>${data.attendanceRate}%</strong></div>
    </div>
    <h2>Resumo por turma</h2>
    <table>
      <thead><tr><th>Unidade</th><th>Turma</th><th>Professor</th><th class="number">Datas</th><th class="number">Presenças</th><th class="number">Faltas</th><th class="number">Frequência</th></tr></thead>
      <tbody>
        ${data.rows.map((row) => `<tr><td>${escapeHtml(row.unit)}</td><td>${escapeHtml(row.className)}</td><td>${escapeHtml(row.professorNames)}</td><td class="number">${row.sessions}</td><td class="number">${row.present}</td><td class="number">${row.absent}</td><td class="number">${row.attendanceRate}%</td></tr>`).join("")}
      </tbody>
    </table>
    <h2>Registros do período</h2>
    <table class="details">
      <thead><tr><th>Data</th><th>Unidade</th><th>Turma</th><th>Professor</th><th>Atleta</th><th>Vínculo</th><th>Presença</th></tr></thead>
      <tbody>
        ${data.details.map((row) => `<tr><td>${formatDate(row.date)}</td><td>${escapeHtml(row.unit)}</td><td>${escapeHtml(row.className)}</td><td>${escapeHtml(row.professorNames)}</td><td>${escapeHtml(row.studentName)}</td><td>${escapeHtml(row.membershipStatus)}</td><td>${escapeHtml(row.attendanceStatus)}</td></tr>`).join("")}
      </tbody>
    </table>
    <footer>${data.totalRecords} registros · Exportado em ${escapeHtml(data.exportedAt)} (${escapeHtml(data.timeZone)})</footer>
  </body>
</html>`;
