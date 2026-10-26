import { buildAttendanceMonthlyPages, paginateAttendanceSummary } from "../../screens/classes/application/attendance-export-groups";
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

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

export const attendanceSummaryHtml = (data: AttendanceSummaryPdfData) => `
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<style>
@page { size: A4 landscape; margin: 16mm 12mm; }
body { font-family: Arial, sans-serif; color: #142439; font-size: 10px; margin: 0; }
.page { break-before: page; } .page:first-child { break-before: auto; }
.brand { color: #08794e; font-weight: bold; font-size: 14px; padding-bottom: 10px; border-bottom: 2px solid #08794e; margin-bottom: 14px; }
h1 { font-size: 27px; margin: 0 0 6px; } h2 { font-size: 16px; margin: 0 0 4px; } h3 { font-size: 16px; margin: 0; color: #08794e; }
.muted, .small { color: #627084; } .small { font-size: 9px; margin-top: 4px; }
.metrics { display: flex; gap: 10px; margin: 16px 0; } .metric { flex: 1; padding: 12px; background: #f2f7f5; border-radius: 5px; }
.metric strong { display: block; font-size: 24px; color: #08794e; margin-bottom: 4px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; } thead { display: table-header-group; }
th { background: #142439; color: white; font-size: 9px; text-align: left; } td, th { padding: 6px; border-bottom: 1px solid #dfe5eb; overflow-wrap: anywhere; }
tr { break-inside: avoid; } tbody tr:nth-child(even) { background: #f5f7f9; }
.info { display: flex; gap: 24px; margin: 14px 0; } .info > div { flex: 1; } .label { display: block; color: #627084; font-size: 8px; margin-bottom: 5px; } .value { font-weight: bold; font-size: 12px; margin-bottom: 4px; }
.month { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #eaf5ef; border-radius: 5px; margin: 12px 0; color: #08794e; }
.center { text-align: center; } .present { color: #08794e; font-weight: bold; } .absent { color: #af3333; font-weight: bold; } .empty { color: #a3acb8; }
.legend { color: #627084; margin-top: 12px; font-size: 9px; line-height: 1.4; } footer { border-top: 1px solid #dfe5eb; color: #627084; font-size: 8px; margin-top: 14px; padding-top: 8px; }
</style></head><body>
${paginateAttendanceSummary(data.rows).map((summaryRows) => `<section class="page">
<div class="brand">Go Atleta <span style="float:right;font-size:10px">RELATÓRIO DE FREQUÊNCIA</span></div>
<h1>Chamadas por turma</h1><div class="muted">${escapeHtml(data.organizationName)} · ${escapeHtml(data.periodLabel)}</div><div class="small">${escapeHtml(data.scopeLabel)}</div>
<div class="metrics">${[["Presenças", data.totalPresent], ["Faltas", data.totalAbsent], ["Frequência", `${data.attendanceRate}%`], ["Registros exportados", data.totalRecords]].map(([label, value]) => `<div class="metric"><strong>${value}</strong>${label}</div>`).join("")}</div>
<h2>Resumo por turma</h2>
<table><thead><tr><th style="width:25%">Turma / unidade</th><th style="width:19%">Horário / dias</th><th style="width:17%">Idade / nível</th><th style="width:18%">Professor</th><th>P</th><th>F</th><th>%</th></tr></thead><tbody>
${summaryRows.map((row) => `<tr><td><strong>${escapeHtml(row.className)}</strong><div class="small">${escapeHtml(row.unit)}</div></td><td>${escapeHtml(row.classInfo?.scheduleLabel ?? "Horário não definido")}<div class="small">${escapeHtml(row.classInfo?.daysLabel ?? "Dias não definidos")}</div></td><td>${escapeHtml(row.classInfo?.ageBandLabel ?? "Faixa não definida")}<div class="small">${escapeHtml(row.classInfo?.levelLabel ?? "Nível não definido")}</div></td><td>${escapeHtml(row.professorNames)}</td><td>${row.present}</td><td>${row.absent}</td><td>${row.attendanceRate}%</td></tr>`).join("")}
</tbody></table><div class="legend">P = Presenças · F = Faltas. Indicadores do período incluem presenças e faltas; as grades seguintes respeitam todos os filtros da exportação.</div>
<footer>${data.totalRecords} registros · Exportado em ${escapeHtml(data.exportedAt)} · Fuso: ${escapeHtml(data.timeZone)}</footer>
</section>`).join("")}
${buildAttendanceMonthlyPages(data.details).map((page) => `<section class="page">
<div class="brand">Go Atleta <span style="float:right;font-size:10px">TURMA ${page.groupNumber} / ${page.groupCount}</span></div>
<h1>${escapeHtml(page.className)}</h1><div class="muted">${escapeHtml([page.unit, page.classInfo?.trainingSpace, page.classInfo?.genderLabel].filter(Boolean).join(" · "))}</div>
<div class="info"><div><span class="label">HORÁRIO E DIAS</span><div class="value">${escapeHtml(page.classInfo?.scheduleLabel ?? "Horário não definido")}</div>${escapeHtml(page.classInfo?.daysLabel ?? "Dias não definidos")}</div><div><span class="label">IDADE / NÍVEL</span><div class="value">${escapeHtml(page.classInfo?.ageBandLabel ?? "Faixa não definida")}</div>${escapeHtml(page.classInfo?.levelLabel ?? "Nível não definido")}</div><div><span class="label">PROFESSOR</span><div class="value">${escapeHtml(page.professorNames)}</div></div></div>
<div class="month"><h3>${escapeHtml(page.monthLabel)}</h3><span>${page.athleteCount} atletas · ${page.sessionCount} datas · ${page.present} presenças · ${page.absent} faltas${page.parts > 1 ? ` · Parte ${page.part}/${page.parts}` : ""}</span></div>
<table><thead><tr><th style="width:28%">Atleta</th><th style="width:9%">Vínculo atual</th>${page.dates.map((date) => `<th class="center">${date.slice(8)}/${date.slice(5, 7)}</th>`).join("")}<th style="width:3%">P</th><th style="width:3%">F</th></tr></thead><tbody>
${page.athletes.map((athlete, index) => `<tr><td>${String(page.athleteOffset + index + 1).padStart(2, "0")}  ${escapeHtml(athlete.name)}</td><td>${escapeHtml(athlete.membership)}</td>${page.dates.map((date) => { const marks = athlete.statuses.get(date); return `<td class="center ${marks?.every((mark) => mark === "P") ? "present" : marks ? "absent" : "empty"}">${marks?.join("/") ?? "-"}</td>`; }).join("")}<td class="center present">${athlete.present}</td><td class="center absent">${athlete.absent}</td></tr>`).join("")}
</tbody></table>
<div class="legend">P = Presente · F = Faltou · - = Sem registro no recorte. Totais P/F por atleta referem-se ao mês inteiro exibido, mesmo quando dividido em partes.</div>
<div class="small">${escapeHtml(data.organizationName)} · ${escapeHtml(data.periodLabel)} · ${escapeHtml(data.scopeLabel)}</div>
<footer>Go Atleta · ${escapeHtml(data.exportedAt)} · Fuso: ${escapeHtml(data.timeZone)}</footer>
</section>`).join("")}
</body></html>`;
