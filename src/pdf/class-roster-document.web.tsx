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
import type { ClassRosterPdfData, ClassRosterRow } from "./templates/class-roster";

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 9,
    color: "#111",
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 6,
  },
  subtitle: {
    color: "#555",
    marginBottom: 10,
    lineHeight: 1.4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#fafafa",
    minWidth: "30%",
  },
  label: {
    fontSize: 8,
    color: "#777",
    marginBottom: 3,
  },
  value: {
    fontSize: 10,
  },
  table: {
    borderWidth: 1,
    borderColor: "#ddd",
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#ddd",
    padding: 4,
  },
  headerCell: {
    backgroundColor: "#f2f2f2",
    fontWeight: "bold",
  },
  colIndex: { width: 28, textAlign: "center" },
  colAge: { width: 40, textAlign: "center" },
  colPhone: { width: 90 },
  colLink: { width: 180 },
  colSign: { width: 120 },
  colName: { flexGrow: 1, minWidth: 160 },
  colGuardian: { width: 120 },
  footer: {
    marginTop: 12,
    fontSize: 9,
    color: "#666",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

const renderRowCells = (
  row: ClassRosterRow,
  isWhatsApp: boolean
) => {
  if (isWhatsApp) {
    return [
      { key: "index", text: String(row.index), style: styles.colIndex },
      { key: "name", text: row.studentName, style: styles.colName },
      { key: "contact", text: row.contactSource ?? "-", style: styles.colGuardian },
      { key: "phone", text: row.contactPhone ?? "-", style: styles.colPhone },
      { key: "link", text: row.whatsappLink ?? "-", style: styles.colLink },
    ];
  }

  return [
    { key: "index", text: String(row.index), style: styles.colIndex },
    { key: "name", text: row.studentName, style: styles.colName },
    { key: "age", text: row.age ?? "-", style: styles.colAge },
    { key: "phone", text: row.studentPhone ?? "-", style: styles.colPhone },
    { key: "guardian", text: row.guardianName ?? "-", style: styles.colGuardian },
    { key: "guardianPhone", text: row.guardianPhone ?? "-", style: styles.colPhone },
    { key: "sign", text: " ", style: styles.colSign },
  ];
};

export function ClassRosterDocument({ data }: { data: ClassRosterPdfData }) {
  const isWhatsApp = data.mode === "whatsapp";
  const headerCells = renderRowCells(
    {
      index: 0,
      studentName: "Aluno",
      age: "Idade",
      studentPhone: "Telefone",
      guardianName: "Responsavel",
      guardianPhone: "Telefone resp.",
      contactSource: "Contato",
      contactPhone: "Telefone",
      whatsappLink: "WhatsApp",
    },
    isWhatsApp
  );

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.subtitle}>
          Turma: {data.className}
          {data.ageBand ? ` (${data.ageBand})` : ""}
          {data.unitLabel ? `\nUnidade: ${data.unitLabel}` : ""}
          {data.daysLabel ? `\nDias: ${data.daysLabel}` : ""}
          {data.timeLabel ? `\nHorario: ${data.timeLabel}` : ""}
          {`\nExportado em: ${data.exportDate}`}
        </Text>

        <View style={styles.grid}>
          <View style={styles.card}>
            <Text style={styles.label}>Total de alunos</Text>
            <Text style={styles.value}>{data.totalStudents}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Tipo</Text>
            <Text style={styles.value}>
              {isWhatsApp ? "Lista WhatsApp" : "Lista completa"}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Unidade</Text>
            <Text style={styles.value}>{data.unitLabel ?? "Sem unidade"}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.row}>
            {headerCells.map((cell) => (
              <Text
                key={`header-${cell.key}`}
                style={[styles.cell, styles.headerCell, cell.style]}
              >
                {cell.text}
              </Text>
            ))}
          </View>
          {data.rows.length ? (
            data.rows.map((row) => {
              const cells = renderRowCells(row, isWhatsApp);
              return (
                <View key={`row-${row.index}`} style={styles.row}>
                  {cells.map((cell) => (
                    <Text key={`${row.index}-${cell.key}`} style={[styles.cell, cell.style]}>
                      {cell.text}
                    </Text>
                  ))}
                </View>
              );
            })
          ) : (
            <View style={styles.row}>
              <Text style={[styles.cell, styles.colName]}>
                Nenhum aluno encontrado.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text>Gerado pelo app</Text>
          <Text>Assinatura: ____________________</Text>
        </View>
      </Page>
    </Document>
  );
}
