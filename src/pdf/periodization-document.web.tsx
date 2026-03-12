import React from "react";
// Use the browser bundle to avoid yoga's import.meta in dev web.
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer/lib/react-pdf.browser";
import type { PeriodizationPdfData } from "./templates/periodization";

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 10,
    color: "#111",
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
  },
  subtitle: {
    color: "#555",
    marginBottom: 12,
    lineHeight: 1.4,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingBottom: 6,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 4,
  },
  cell: {
    paddingRight: 6,
  },
  colWeek: { width: "6%" },
  colDates: { width: "18%" },
  colPhase: { width: "12%" },
  colTheme: { width: "16%" },
  colTech: { width: "18%" },
  colPhys: { width: "16%" },
  colPse: { width: "7%" },
  colJump: { width: "7%" },
  footer: {
    marginTop: 12,
    fontSize: 9,
    color: "#777",
  },
});

export function PeriodizationDocument({ data }: { data: PeriodizationPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Periodizacao do ciclo</Text>
        <Text style={styles.subtitle}>
          Turma: {data.className}
          {data.ageGroup ? ` (${data.ageGroup})` : ""}
          {"\n"}
          {data.unitLabel ? `Unidade: ${data.unitLabel}\n` : ""}
          {data.cycleStart ? `Inicio do ciclo: ${data.cycleStart}\n` : ""}
          {data.planningMode ? `Modo: ${data.planningMode}\n` : ""}
          {data.targetCompetition ? `Competicao-alvo: ${data.targetCompetition}\n` : ""}
          {data.targetDate ? `Data-alvo: ${data.targetDate}\n` : ""}
          {data.tacticalSystem ? `Sistema tatico: ${data.tacticalSystem}\n` : ""}
          {data.currentPhase ? `Fase atual: ${data.currentPhase}\n` : ""}
          {typeof data.cycleLength === "number" ? `Semanas: ${data.cycleLength}` : ""}
        </Text>

        <View style={styles.headerRow}>
          <Text style={[styles.cell, styles.colWeek]}>Sem</Text>
          <Text style={[styles.cell, styles.colDates]}>Datas</Text>
          <Text style={[styles.cell, styles.colPhase]}>Fase</Text>
          <Text style={[styles.cell, styles.colTheme]}>Tema</Text>
          <Text style={[styles.cell, styles.colTech]}>Foco tecnico</Text>
          <Text style={[styles.cell, styles.colPhys]}>Foco fisico</Text>
          <Text style={[styles.cell, styles.colPse]}>PSE</Text>
          <Text style={[styles.cell, styles.colJump]}>Saltos</Text>
        </View>

        {data.rows.length ? (
          data.rows.map((row) => (
            <View key={row.week} style={styles.row}>
              <Text style={[styles.cell, styles.colWeek]}>{row.week}</Text>
              <Text style={[styles.cell, styles.colDates]}>{row.dateRange || row.sessionDates || "-"}</Text>
              <Text style={[styles.cell, styles.colPhase]}>{row.phase}</Text>
              <Text style={[styles.cell, styles.colTheme]}>{row.theme}</Text>
              <Text style={[styles.cell, styles.colTech]}>{row.technicalFocus}</Text>
              <Text style={[styles.cell, styles.colPhys]}>{row.physicalFocus}</Text>
              <Text style={[styles.cell, styles.colPse]}>{row.rpeTarget}</Text>
              <Text style={[styles.cell, styles.colJump]}>{row.jumpTarget}</Text>
            </View>
          ))
        ) : (
          <Text>Nenhuma semana gerada.</Text>
        )}

        <Text style={styles.footer}>Gerado em {data.generatedAt}</Text>
      </Page>
    </Document>
  );
}
