import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer/lib/react-pdf.browser";
import { buildAttendanceMonthlyPages, paginateAttendanceSummary } from "../screens/classes/application/attendance-export-groups";
import type { AttendanceSummaryPdfData } from "./templates/attendance-summary";

const ink = "#142439";
const muted = "#627084";
const green = "#08794e";
const styles = StyleSheet.create({
  page: { padding: 30, paddingBottom: 42, fontSize: 9, color: ink, fontFamily: "Helvetica" },
  top: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: green, marginBottom: 10 },
  brand: { fontSize: 12, fontWeight: "bold", color: green },
  eyebrow: { fontSize: 8, color: muted, letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 5 },
  muted: { color: muted, marginBottom: 4, lineHeight: 1.3 },
  metrics: { flexDirection: "row", gap: 10, marginTop: 14, marginBottom: 16 },
  metric: { flex: 1, backgroundColor: "#f2f7f5", borderRadius: 5, padding: 10 },
  metricValue: { fontSize: 21, fontWeight: "bold", color: green, marginBottom: 3 },
  section: { fontSize: 12, fontWeight: "bold", marginBottom: 7 },
  row: { flexDirection: "row", alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: "#dfe5eb", minHeight: 22 },
  header: { backgroundColor: ink, color: "#ffffff", fontSize: 8, fontWeight: "bold", minHeight: 25 },
  cell: { paddingVertical: 5, paddingHorizontal: 6 },
  identity: { width: "28%" }, schedule: { width: "18%" }, profile: { width: "17%" },
  teacher: { width: "19%" }, count: { width: "6%", textAlign: "right" },
  small: { fontSize: 7.5, color: muted, marginTop: 3 },
  info: { flexDirection: "row", gap: 18, marginTop: 5, marginBottom: 8 },
  infoItem: { flex: 1 }, infoLabel: { fontSize: 7, color: muted, marginBottom: 4, letterSpacing: 0.5 },
  infoValue: { fontSize: 10, fontWeight: "bold", marginBottom: 3 },
  month: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#eaf5ef", padding: 8, borderRadius: 5, marginBottom: 7 },
  monthTitle: { fontSize: 14, fontWeight: "bold", color: green },
  monthCounts: { fontSize: 8, color: green },
  athlete: { width: 214, paddingHorizontal: 6 },
  membership: { width: 67, paddingHorizontal: 4, fontSize: 7.5 },
  date: { flex: 1, textAlign: "center", fontSize: 8, paddingVertical: 3 },
  total: { width: 28, textAlign: "center", fontSize: 8 },
  present: { color: green, fontWeight: "bold" },
  absent: { color: "#af3333", fontWeight: "bold" },
  empty: { color: "#a3acb8" },
  legend: { fontSize: 7.5, color: muted, marginTop: 7, lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 18, left: 30, right: 30, borderTopWidth: 0.5, borderTopColor: "#dfe5eb", paddingTop: 7, flexDirection: "row", justifyContent: "space-between", color: muted, fontSize: 7 },
});

function Footer({ data }: { data: AttendanceSummaryPdfData }) {
  return <View style={styles.footer} fixed>
    <Text>Go Atleta · {data.exportedAt} · {data.timeZone}</Text>
    <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
  </View>;
}

export function AttendanceSummaryDocument({ data }: { data: AttendanceSummaryPdfData }) {
  const pages = buildAttendanceMonthlyPages(data.details);
  return <Document title={`Chamadas - ${data.organizationName}`} author="Go Atleta">
    {paginateAttendanceSummary(data.rows).map((summaryRows, summaryIndex) => <Page key={`summary-${summaryIndex}`} size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.top} fixed><Text style={styles.brand}>Go Atleta</Text><Text style={styles.eyebrow}>RELATÓRIO DE FREQUÊNCIA</Text></View>
      <Text style={styles.title}>Chamadas por turma</Text>
      <Text style={styles.muted}>{data.organizationName} · {data.periodLabel}</Text>
      <Text style={styles.muted}>{data.scopeLabel}</Text>
      <View style={styles.metrics}>
        {[ ["Presenças", data.totalPresent], ["Faltas", data.totalAbsent], ["Frequência", `${data.attendanceRate}%`], ["Registros exportados", data.totalRecords] ].map(([label, value]) =>
          <View style={styles.metric} key={label}><Text style={styles.metricValue}>{value}</Text><Text>{label}</Text></View>)}
      </View>
      <Text style={styles.section}>Resumo por turma</Text>
      <View style={[styles.row, styles.header]} wrap={false}>
        <Text style={[styles.cell, styles.identity]}>Turma / unidade</Text><Text style={[styles.cell, styles.schedule]}>Horário / dias</Text><Text style={[styles.cell, styles.profile]}>Idade / nível</Text><Text style={[styles.cell, styles.teacher]}>Professor</Text><Text style={[styles.cell, styles.count]}>P</Text><Text style={[styles.cell, styles.count]}>F</Text><Text style={[styles.cell, styles.count]}>%</Text>
      </View>
      {summaryRows.map((row, index) => <View key={row.classId ?? index} style={styles.row} wrap={false}>
        <View style={[styles.cell, styles.identity]}><Text>{row.className}</Text><Text style={styles.small}>{row.unit}</Text></View>
        <View style={[styles.cell, styles.schedule]}><Text>{row.classInfo?.scheduleLabel ?? "Horário não definido"}</Text><Text style={styles.small}>{row.classInfo?.daysLabel ?? "Dias não definidos"}</Text></View>
        <View style={[styles.cell, styles.profile]}><Text>{row.classInfo?.ageBandLabel ?? "Faixa não definida"}</Text><Text style={styles.small}>{row.classInfo?.levelLabel ?? "Nível não definido"}</Text></View>
        <Text hyphenationCallback={(word) => [word]} style={[styles.cell, styles.teacher]}>{row.professorNames}</Text><Text style={[styles.cell, styles.count]}>{row.present}</Text><Text style={[styles.cell, styles.count]}>{row.absent}</Text><Text style={[styles.cell, styles.count]}>{row.attendanceRate}%</Text>
      </View>)}
      <Text style={styles.legend}>P = Presenças · F = Faltas. Indicadores do período incluem presenças e faltas; as grades seguintes respeitam todos os filtros da exportação.</Text>
      <Footer data={data} />
    </Page>)}
    {pages.map((page) => <Page key={page.key} size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.top}><Text style={styles.brand}>Go Atleta</Text><Text style={styles.eyebrow}>TURMA {String(page.groupNumber).padStart(2, "0")} / {String(page.groupCount).padStart(2, "0")}</Text></View>
      <Text style={styles.title}>{page.className}</Text>
      <Text style={styles.muted}>{page.unit}{page.classInfo?.trainingSpace ? ` · ${page.classInfo.trainingSpace}` : ""}{page.classInfo?.genderLabel ? ` · ${page.classInfo.genderLabel}` : ""}</Text>
      <View style={styles.info}>
        <View style={styles.infoItem}><Text style={styles.infoLabel}>HORÁRIO E DIAS</Text><Text style={styles.infoValue}>{page.classInfo?.scheduleLabel ?? "Horário não definido"}</Text><Text>{page.classInfo?.daysLabel ?? "Dias não definidos"}</Text></View>
        <View style={styles.infoItem}><Text style={styles.infoLabel}>IDADE / NÍVEL</Text><Text style={styles.infoValue}>{page.classInfo?.ageBandLabel ?? "Faixa não definida"}</Text><Text>{page.classInfo?.levelLabel ?? "Nível não definido"}</Text></View>
        <View style={styles.infoItem}><Text style={styles.infoLabel}>PROFESSOR</Text><Text style={styles.infoValue}>{page.professorNames}</Text></View>
      </View>
      <View style={styles.month}><Text style={styles.monthTitle}>{page.monthLabel}</Text><Text style={styles.monthCounts}>{page.athleteCount} atletas · {page.sessionCount} datas · {page.present} presenças · {page.absent} faltas{page.parts > 1 ? ` · Parte ${page.part}/${page.parts}` : ""}</Text></View>
      <View style={[styles.row, styles.header]} wrap={false}>
        <Text style={styles.athlete}>Atleta</Text><Text style={styles.membership}>Vínculo atual</Text>
        {page.dates.map((date) => <Text key={date} style={styles.date}>{date.slice(8)}/{date.slice(5, 7)}</Text>)}
        <Text style={styles.total}>P</Text><Text style={styles.total}>F</Text>
      </View>
      {page.athletes.map((athlete, index) => <View key={athlete.key} style={[styles.row, { minHeight: 16, backgroundColor: index % 2 ? "#f5f7f9" : "#ffffff" }]} wrap={false}>
        <Text style={[styles.athlete, { fontSize: 8, paddingVertical: 3 }]}>{String(page.athleteOffset + index + 1).padStart(2, "0")}  {athlete.name}</Text>
        <Text style={styles.membership}>{athlete.membership}</Text>
        {page.dates.map((date) => {
          const marks = athlete.statuses.get(date);
          return <Text key={date} style={[styles.date, marks?.every((mark) => mark === "P") ? styles.present : marks ? styles.absent : styles.empty]}>{marks?.join("/") ?? "-"}</Text>;
        })}
        <Text style={[styles.total, styles.present]}>{athlete.present}</Text><Text style={[styles.total, styles.absent]}>{athlete.absent}</Text>
      </View>)}
      <Text style={styles.legend}>P = Presente · F = Faltou · - = Sem registro no recorte. Totais P/F por atleta referem-se ao mês inteiro exibido, mesmo quando dividido em partes.</Text>
      <Text style={styles.small}>{data.organizationName} · {data.periodLabel} · {data.scopeLabel}</Text>
      <Footer data={data} />
    </Page>)}
  </Document>;
}
