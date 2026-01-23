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
    padding: 20,
    fontSize: 9,
    color: "#111",
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    color: "#555",
    marginBottom: 8,
    lineHeight: 1.35,
    fontSize: 9,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
    gap: 10,
  },
  badge: {
    backgroundColor: "#f2f2f2",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    fontSize: 8,
    marginBottom: 4,
  },
  layout: {
    flexDirection: "row",
    gap: 10,
  },
  leftColumn: {
    flexGrow: 1,
    flexBasis: "60%",
  },
  rightColumn: {
    flexBasis: "40%",
  },
  table: {
    borderWidth: 1,
    borderColor: "#d9d9d9",
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#d9d9d9",
    padding: 3,
  },
  headerCell: {
    backgroundColor: "#f2f2f2",
    fontWeight: "bold",
    textAlign: "center",
  },
  colIndex: { width: 24, textAlign: "center" },
  colBirth: { width: 58, textAlign: "center" },
  colContact: { width: 110 },
  colTotal: { width: 28, textAlign: "center" },
  colName: { width: 170 },
  colFund: { width: 110 },
  block: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 6,
    backgroundColor: "#fafafa",
  },
  blockTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 4,
  },
  notes: {
    marginTop: 8,
    backgroundColor: "#fff",
  },
  notesLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    height: 14,
  },
  footer: {
    marginTop: 8,
    fontSize: 8,
    color: "#666",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    paddingTop: 6,
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
      {
        key: "contact",
        text: `${row.contactLabel ?? "-"} ${row.contactPhone ?? ""}`.trim(),
        style: styles.colContact,
      },
    ];
  }

  return [
    { key: "index", text: String(row.index), style: styles.colIndex },
    { key: "name", text: row.studentName, style: styles.colName },
    { key: "birth", text: row.birthDate ?? "-", style: styles.colBirth },
  ];
};

export function ClassRosterDocument({ data }: { data: ClassRosterPdfData }) {
  const isWhatsApp = data.mode === "whatsapp";
  const dayCount = Math.max(1, data.monthDays.length);
  const leftDayCellWidth = Math.max(12, Math.min(20, Math.floor(260 / dayCount)));
  const rightDayCellWidth = Math.max(10, Math.min(16, Math.floor(160 / dayCount)));
  const headerCells = renderRowCells(
    {
      index: 0,
      studentName: "Atletas",
      birthDate: "Nasc",
      contactLabel: "Contato",
      contactPhone: "",
    },
    isWhatsApp
  );

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{data.title}</Text>
            <Text style={styles.subtitle}>
              Turma: {data.className}
              {data.ageBand ? ` (${data.ageBand})` : ""}
              {data.unitLabel ? `\nUnidade: ${data.unitLabel}` : ""}
              {data.daysLabel ? `\nDias: ${data.daysLabel}` : ""}
              {data.timeLabel ? `\nHorario: ${data.timeLabel}` : ""}
              {`\nMes: ${data.monthLabel}`}
            </Text>
          </View>
          <View style={{ minWidth: 140 }}>
            {data.periodizationLabel ? (
              <Text style={styles.badge}>{data.periodizationLabel}</Text>
            ) : null}
            {data.coachName ? (
              <Text style={styles.subtitle}>Professor: {data.coachName}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.layout}>
          <View style={styles.leftColumn}>
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
                {data.monthDays.map((day) => (
                  <Text
                    key={`day-${day}`}
                    style={[
                      styles.cell,
                      styles.headerCell,
                      { width: leftDayCellWidth, textAlign: "center" },
                    ]}
                  >
                    {day}
                  </Text>
                ))}
                <Text style={[styles.cell, styles.headerCell, styles.colTotal]}>
                  Total
                </Text>
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
                      {data.monthDays.map((day) => (
                        <Text
                          key={`${row.index}-day-${day}`}
                          style={[styles.cell, { width: leftDayCellWidth }]}
                        >
                          {" "}
                        </Text>
                      ))}
                      <Text style={[styles.cell, styles.colTotal]}> </Text>
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
              <Text>Exportado em {data.exportDate}</Text>
              <Text>Total de alunos: {data.totalStudents}</Text>
            </View>
          </View>

          <View style={styles.rightColumn}>
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Fundamentos trabalhados</Text>
              <View style={styles.table}>
                <View style={styles.row}>
                  <Text style={[styles.cell, styles.headerCell, styles.colFund]}>
                    Fundamento
                  </Text>
                  {data.monthDays.map((day) => (
                    <Text
                      key={`fund-day-${day}`}
                      style={[
                        styles.cell,
                        styles.headerCell,
                        { width: rightDayCellWidth, textAlign: "center" },
                      ]}
                    >
                      {day}
                    </Text>
                  ))}
                </View>
                {data.fundamentals.map((item, idx) => (
                  <View key={`fund-${idx}`} style={styles.row}>
                    <Text style={[styles.cell, styles.colFund]}>{item}</Text>
                    {data.monthDays.map((day) => (
                      <Text
                        key={`fund-${idx}-day-${day}`}
                        style={[styles.cell, { width: rightDayCellWidth }]}
                      >
                        {" "}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.block, styles.notes]}>
              <Text style={styles.blockTitle}>Observacoes</Text>
              {Array.from({ length: 8 }).map((_, idx) => (
                <View key={`note-${idx}`} style={styles.notesLine} />
              ))}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
