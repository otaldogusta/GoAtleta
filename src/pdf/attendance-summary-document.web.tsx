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
  unit: { width: "24%" },
  className: { width: "28%" },
  number: { width: "12%", textAlign: "right" },
  footer: { marginTop: 14, color: "#64748b", fontSize: 8 },
});

export function AttendanceSummaryDocument({ data }: { data: AttendanceSummaryPdfData }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Resumo de chamadas</Text>
        <Text style={styles.muted}>{data.organizationName} · {data.periodLabel}</Text>
        <Text style={styles.muted}>{data.scopeLabel}</Text>
        <View style={styles.metrics}>
          <View style={styles.metric}><Text>Presenças</Text><Text style={styles.metricValue}>{data.totalPresent}</Text></View>
          <View style={styles.metric}><Text>Faltas</Text><Text style={styles.metricValue}>{data.totalAbsent}</Text></View>
          <View style={styles.metric}><Text>Frequência</Text><Text style={styles.metricValue}>{data.attendanceRate}%</Text></View>
        </View>
        <View style={[styles.row, styles.header]}>
          <Text style={[styles.cell, styles.unit]}>Unidade</Text><Text style={[styles.cell, styles.className]}>Turma</Text><Text style={[styles.cell, styles.number]}>Aulas</Text><Text style={[styles.cell, styles.number]}>Presenças</Text><Text style={[styles.cell, styles.number]}>Faltas</Text><Text style={[styles.cell, styles.number]}>Frequência</Text>
        </View>
        {data.rows.map((row) => (
          <View key={`${row.unit}-${row.className}`} style={styles.row}>
            <Text style={[styles.cell, styles.unit]}>{row.unit}</Text><Text style={[styles.cell, styles.className]}>{row.className}</Text><Text style={[styles.cell, styles.number]}>{row.sessions}</Text><Text style={[styles.cell, styles.number]}>{row.present}</Text><Text style={[styles.cell, styles.number]}>{row.absent}</Text><Text style={[styles.cell, styles.number]}>{row.attendanceRate}%</Text>
          </View>
        ))}
        <Text style={styles.footer}>{data.totalRecords} registros · Exportado em {data.exportedAt}</Text>
      </Page>
    </Document>
  );
}
