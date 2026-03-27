import React from "react";
// Use the browser bundle to avoid yoga's import.meta in dev web.
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer/lib/react-pdf.browser";
import type { SessionPlanPdfData } from "./templates/session-plan";

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 10.5,
    color: "#111111",
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 14,
  },
  meta: {
    color: "#333333",
    marginBottom: 12,
    lineHeight: 1.4,
  },
  table: {
    borderWidth: 1,
    borderColor: "#111111",
    width: "100%",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  cell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: "#111111",
    justifyContent: "flex-start",
  },
  cellLast: {
    borderRightWidth: 0,
  },
  cellSingle: {
    width: "100%",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerCell: {
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  labelStrong: {
    fontSize: 12,
    fontWeight: "bold",
  },
  strong: {
    fontWeight: "bold",
  },
  text: {
    fontSize: 10.5,
    lineHeight: 1.35,
  },
  textCenter: {
    textAlign: "center",
    fontWeight: "bold",
  },
  periodCell: {
    width: "20%",
  },
  activitiesCell: {
    width: "24%",
  },
  timeCell: {
    width: "12%",
  },
  descriptionCell: {
    width: "44%",
  },
  notesLabel: {
    width: "20%",
  },
  notesContent: {
    width: "80%",
    minHeight: 86,
  },
  footer: {
    marginTop: 10,
    fontSize: 9,
    color: "#555555",
    textAlign: "right",
  },
});

const asText = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
};

const buildOrderedLines = (rows: string[]) =>
  rows.length ? rows.map((line, index) => `${index + 1}. ${line}`).join("\n") : "-";

const TITLE_TEXT = "PLANEJAMENTO DE AULA DO DIA";
const LABEL_PERIODO = "Per\u00edodo";
const LABEL_DESCRICAO = "Descri\u00e7\u00e3o";
const LABEL_OBSERVACOES = "Observa\u00e7\u00f5es:";

export function SessionPlanDocument({ data }: { data: SessionPlanPdfData }) {
  const objective = asText(data?.objective);
  const title = asText(data?.title);
  const notes = asText(data?.notes);
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  const generatedAt = new Date().toLocaleDateString("pt-BR");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{TITLE_TEXT}</Text>
        <Text style={styles.meta}>
          Turma: {asText(data?.className)}
          {asText(data?.ageGroup) ? ` (${asText(data?.ageGroup)})` : ""}{"\n"}
          Data: {asText(data?.dateLabel)}
          {asText(data?.unitLabel) ? `\nUnidade: ${asText(data?.unitLabel)}` : ""}
        </Text>

        <View style={styles.table}>
          <View style={styles.row}>
            <View style={styles.cellSingle}>
              <Text style={styles.text}>
                <Text style={styles.strong}>Tema/Atividade: </Text>
                {title || "-"}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.cell, styles.periodCell]}>
              <Text style={styles.text}>
                <Text style={styles.strong}>Objetivo: </Text>
                {objective || "-"}
              </Text>
            </View>
            <View style={[styles.cell, styles.cellLast, styles.descriptionCell]}>
              <Text style={styles.text}>
                <Text style={styles.strong}>Tempo total: </Text>
                {asText(data?.totalTime) || "-"}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.cell, styles.periodCell, styles.headerCell]}>
              <Text style={styles.labelStrong}>{LABEL_PERIODO}</Text>
            </View>
            <View style={[styles.cell, styles.activitiesCell, styles.headerCell]}>
              <Text style={styles.labelStrong}>Atividades</Text>
            </View>
            <View style={[styles.cell, styles.timeCell, styles.headerCell]}>
              <Text style={styles.labelStrong}>Tempo</Text>
            </View>
            <View style={[styles.cell, styles.descriptionCell, styles.cellLast, styles.headerCell]}>
              <Text style={styles.labelStrong}>{LABEL_DESCRICAO}</Text>
            </View>
          </View>

          {blocks.map((block, blockIndex) => {
            const period = asText(block?.title) || "-";
            const time = asText(block?.time) || "-";
            const items = Array.isArray(block?.items) ? block.items : [];
            const activities = buildOrderedLines(
              items.map((item) => asText(item?.name).trim()).filter(Boolean)
            );
            const descriptions = buildOrderedLines(
              items
                .map((item) => asText(item?.notes).trim() || asText(item?.name).trim())
                .filter(Boolean)
            );
            return (
              <View key={`${period}-${blockIndex}`} style={styles.row}>
                <View style={[styles.cell, styles.periodCell]}>
                  <Text style={styles.text}>
                    <Text style={styles.strong}>{period}</Text>
                  </Text>
                </View>
                <View style={[styles.cell, styles.activitiesCell]}>
                  <Text style={styles.text}>{activities}</Text>
                </View>
                <View style={[styles.cell, styles.timeCell]}>
                  <Text style={[styles.text, styles.textCenter]}>{time}</Text>
                </View>
                <View style={[styles.cell, styles.descriptionCell, styles.cellLast]}>
                  <Text style={styles.text}>{descriptions}</Text>
                </View>
              </View>
            );
          })}

          <View style={[styles.row, styles.rowLast]}>
            <View style={[styles.cell, styles.notesLabel]}>
              <Text style={styles.text}>
                <Text style={styles.strong}>{LABEL_OBSERVACOES}</Text>
              </Text>
            </View>
            <View style={[styles.cell, styles.notesContent, styles.cellLast]}>
              <Text style={styles.text}>{notes || "-"}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          Gerado em {generatedAt}
          {asText(data?.coachName) ? ` - Professor(a): ${asText(data?.coachName)}` : ""}
        </Text>
      </Page>
    </Document>
  );
}
