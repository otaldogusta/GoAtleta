import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer/lib/react-pdf.browser";
import type { AttendanceSummaryPdfData } from "./templates/attendance-summary";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, color: "#111827", fontFamily: "Helvetica" },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  muted: { color: "#64748b", marginBottom: 2 },
  metrics: { flexDirection: "row", gap: 8, marginVertical: 16 },
  metric: { flex: 1, borderWidth: 1, borderColor: "#dbe2ea", borderRadius: 6, padding: 9 },
  metricValue: { fontSize: 16, fontWeight: "bold", marginTop: 4 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  header: { backgroundColor: "#f1f5f9", fontWeight: "bold" },
  cell: { paddingVertical: 6, paddingHorizontal: 4 },
  unit: { width: "17%" },
  className: { width: "21%" },
  professor: { width: "26%" },
  number: { width: "9%", textAlign: "right" },
  sectionTitle: { fontSize: 11, fontWeight: "bold", marginTop: 14, marginBottom: 5 },
  detailDate: { width: "10%" },
  detailUnit: { width: "13%" },
  detailClassName: { width: "17%" },
  detailProfessor: { width: "20%" },
  detailStudent: { width: "22%" },
  detailMembership: { width: "9%" },
  detailStatus: { width: "9%" },
  footer: { marginTop: 14, color: "#64748b", fontSize: 8 },
});

const formatDate = (isoDate: string) => isoDate.split("-").reverse().join("/");

export function AttendanceSummaryDocument({ data }: { data: AttendanceSummaryPdfData }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Resumo de chamadas</Text>
        <Text style={styles.muted}>{data.organizationName} · {data.periodLabel}</Text>
        <Text style={styles.muted}>{data.scopeLabel}</Text>
        <Text style={styles.muted}>Fuso: {data.timeZone}</Text>
        <View style={styles.metrics}>
          <View style={styles.metric}><Text>Presenças</Text><Text style={styles.metricValue}>{data.totalPresent}</Text></View>
          <View style={styles.metric}><Text>Faltas</Text><Text style={styles.metricValue}>{data.totalAbsent}</Text></View>
          <View style={styles.metric}><Text>Frequência</Text><Text style={styles.metricValue}>{data.attendanceRate}%</Text></View>
        </View>
        <Text style={styles.sectionTitle}>Resumo por turma</Text>
        <View style={[styles.row, styles.header]}>
          <Text style={[styles.cell, styles.unit]}>Unidade</Text><Text style={[styles.cell, styles.className]}>Turma</Text><Text style={[styles.cell, styles.professor]}>Professor</Text><Text style={[styles.cell, styles.number]}>Datas</Text><Text style={[styles.cell, styles.number]}>Presenças</Text><Text style={[styles.cell, styles.number]}>Faltas</Text><Text style={[styles.cell, styles.number]}>Frequência</Text>
        </View>
        {data.rows.map((row) => (
          <View key={`${row.unit}-${row.className}`} style={styles.row}>
            <Text style={[styles.cell, styles.unit]}>{row.unit}</Text><Text style={[styles.cell, styles.className]}>{row.className}</Text><Text style={[styles.cell, styles.professor]}>{row.professorNames}</Text><Text style={[styles.cell, styles.number]}>{row.sessions}</Text><Text style={[styles.cell, styles.number]}>{row.present}</Text><Text style={[styles.cell, styles.number]}>{row.absent}</Text><Text style={[styles.cell, styles.number]}>{row.attendanceRate}%</Text>
          </View>
        ))}
        <Text style={styles.sectionTitle}>Registros do período</Text>
        <View style={[styles.row, styles.header]}>
          <Text style={[styles.cell, styles.detailDate]}>Data</Text><Text style={[styles.cell, styles.detailUnit]}>Unidade</Text><Text style={[styles.cell, styles.detailClassName]}>Turma</Text><Text style={[styles.cell, styles.detailProfessor]}>Professor</Text><Text style={[styles.cell, styles.detailStudent]}>Atleta</Text><Text style={[styles.cell, styles.detailMembership]}>Vínculo</Text><Text style={[styles.cell, styles.detailStatus]}>Presença</Text>
        </View>
        {data.details.map((row, index) => (
          <View key={`${row.date}-${row.className}-${row.studentName}-${index}`} style={styles.row} wrap={false}>
            <Text style={[styles.cell, styles.detailDate]}>{formatDate(row.date)}</Text><Text style={[styles.cell, styles.detailUnit]}>{row.unit}</Text><Text style={[styles.cell, styles.detailClassName]}>{row.className}</Text><Text style={[styles.cell, styles.detailProfessor]}>{row.professorNames}</Text><Text style={[styles.cell, styles.detailStudent]}>{row.studentName}</Text><Text style={[styles.cell, styles.detailMembership]}>{row.membershipStatus}</Text><Text style={[styles.cell, styles.detailStatus]}>{row.attendanceStatus}</Text>
          </View>
        ))}
        <Text style={styles.footer}>{data.totalRecords} registros · Exportado em {data.exportedAt} ({data.timeZone})</Text>
      </Page>
    </Document>
  );
}
