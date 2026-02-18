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
import type { SessionReportPdfData } from "./templates/session-report";

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 11,
    color: "#111",
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: 0.6,
  },
  meta: {
    fontSize: 10,
    marginBottom: 10,
    lineHeight: 1.4,
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    borderWidth: 1,
    borderColor: "#000",
    padding: 8,
    flex: 1,
    minHeight: 34,
  },
  cellWide: {
    borderWidth: 1,
    borderColor: "#000",
    padding: 8,
    flex: 1,
  },
  label: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  photos: {
    minHeight: 200,
  },
});

const asText = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
};

export function SessionReportDocument({ data }: { data: SessionReportPdfData }) {
  const participants =
    typeof data?.participantsCount === "number" && data.participantsCount > 0
      ? String(data.participantsCount)
      : "-";
  const deadline = asText(data?.deadlineLabel).trim() || "ultimo dia da escolinha do mes";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>RELATORIO ESCOLINHA DE VOLEI</Text>
        <Text style={styles.meta}>
          Turma: {asText(data?.className) || "-"}{"\n"}
          Unidade: {asText(data?.unitLabel) || "-"}
        </Text>

        <View style={styles.row}>
          <View style={styles.cell}>
            <Text>MES: {asText(data?.monthLabel)}</Text>
          </View>
          <View style={styles.cell}>
            <Text>Prazo de entrega: {deadline}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.cellWide}>
            <Text style={styles.label}>Data:</Text>
            <Text>{asText(data?.dateLabel)}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.cellWide}>
            <Text style={styles.label}>Atividade:</Text>
            <Text>{asText(data?.activity) || "-"}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.cellWide}>
            <Text style={styles.label}>Conclusao:</Text>
            <Text>{asText(data?.conclusion) || "-"}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.cellWide}>
            <Text style={styles.label}>Numero de participantes:</Text>
            <Text>{participants}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.cellWide, styles.photos]}>
            <Text style={styles.label}>Fotos:</Text>
            <Text>{asText(data?.photos) || "-"}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
