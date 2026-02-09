import React from "react";
// Use the browser bundle to avoid yoga's import.meta in dev web.
// @ts-expect-error no types for browser bundle entry
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
  colWeek: { width: "8%" },
  colPhase: { width: "14%" },
  colTheme: { width: "18%" },
  colTech: { width: "22%" },
  colPhys: { width: "18%" },
  colPse: { width: "10%" },
  colJump: { width: "10%" },
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
          {data.cycleStart ? `Início do ciclo: ${data.cycleStart}\n` : ""}
          {typeof data.cycleLength === "number"
            ? `Semanas: ${data.cycleLength}`
            : ""}
        </Text>

        <View style={styles.headerRow}>
          <Text style={[styles.cell, styles.colWeek]}>Sem</Text>
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
