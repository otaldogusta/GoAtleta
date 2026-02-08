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
  },
  subtitle: {
    color: "#555",
    lineHeight: 1.35,
    fontSize: 9,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e6e6e6",
    gap: 12,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  headerTitle: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  headerTag: {
    backgroundColor: "#f4f4f4",
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
    fontSize: 8,
    color: "#666",
  },
  headerMeta: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  metaItem: { flexDirection: "row", gap: 4 },
  metaLabel: { color: "#666", fontWeight: "bold" },
  metaValue: { color: "#555" },
  metaSep: { color: "#bbb", fontWeight: "bold", paddingHorizontal: 4 },
  headerRight: { width: 200, alignItems: "flex-end" },
  badge: {
    backgroundColor: "#f2f2f2",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    fontSize: 8,
  },
  coach: { marginTop: 6, fontSize: 9, color: "#444" },
  layout: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  leftColumn: {
    flex: 1,
    minWidth: 0,
  },
  rightColumn: {
    width: 260,
    flexShrink: 0,
  },
  table: {
    borderWidth: 1,
    borderColor: "#d9d9d9",
    width: "100%",
  },
  row: {
    flexDirection: "row",
  },
  rowAlt: {
    backgroundColor: "#fafafa",
  },
  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#d9d9d9",
    paddingVertical: 2,
    paddingHorizontal: 3,
  },
  headerCell: {
    backgroundColor: "#f2f2f2",
    fontWeight: "bold",
    textAlign: "center",
  },
  colIndex: { width: 22, textAlign: "center" },
  colBirth: { width: 56, textAlign: "center" },
  colContact: { width: 104 },
  colTotal: { width: 44, textAlign: "center" },
  colName: { width: 150 },
  colFund: { width: 110 },
  colDay: { flexGrow: 1, flexBasis: 0, minWidth: 12, textAlign: "center" },
  colDayRight: { flexGrow: 1, flexBasis: 0, minWidth: 10, textAlign: "center" },
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
  const isEmpty = !row.studentName;
  if (isWhatsApp) {
    return [
      { key: "index", text: String(row.index), style: styles.colIndex },
      { key: "name", text: row.studentName, style: styles.colName },
      {
        key: "contact",
        text: isEmpty
          ? ""
          : `${row.contactLabel ?? "-"} ${row.contactPhone ?? ""}`.trim(),
        style: styles.colContact,
      },
    ];
  }

  return [
    { key: "index", text: String(row.index), style: styles.colIndex },
    { key: "name", text: row.studentName, style: styles.colName },
    {
      key: "birth",
      text: isEmpty ? "" : row.birthDate ?? "-",
      style: styles.colBirth,
    },
  ];
};

export function ClassRosterDocument({ data }: { data: ClassRosterPdfData }) {
  const isWhatsApp = data.mode === "whatsapp";
  const minRows = 20;
  const paddedRows =
    data.rows.length >= minRows
    ? data.rows
      : [
          ...data.rows,
          ...Array.from({ length: minRows - data.rows.length }, (_, idx) => ({
            index: data.rows.length + idx + 1,
            studentName: "",
            birthDate: "",
            contactLabel: "",
            contactPhone: "",
          })),
        ];
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
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerTitle}>
              <Text style={styles.title}>{data.title}</Text>
              {data.ageBand ? <Text style={styles.headerTag}>{data.ageBand}</Text> : null}
            </View>
            <View style={styles.headerMeta}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Turma:</Text>
                <Text style={styles.metaValue}>{data.className}</Text>
              </View>
              <Text style={styles.metaSep}>|</Text>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Unidade:</Text>
                <Text style={styles.metaValue}>{data.unitLabel ?? "-"}</Text>
              </View>
              <Text style={styles.metaSep}>|</Text>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Dias:</Text>
                <Text style={styles.metaValue}>{data.daysLabel ?? "-"}</Text>
              </View>
              <Text style={styles.metaSep}>|</Text>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Horário:</Text>
                <Text style={styles.metaValue}>{data.timeLabel ?? "-"}</Text>
              </View>
              <Text style={styles.metaSep}>|</Text>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Mês:</Text>
                <Text style={styles.metaValue}>{data.monthLabel}</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerRight}>
            {data.periodizationLabel ? (
              <Text style={styles.badge}>{data.periodizationLabel}</Text>
            ) : null}
            {data.coachName ? (
              <Text style={styles.coach}>Professor: {data.coachName}</Text>
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
                      styles.colDay,
                    ]}
                  >
                    {day}
                  </Text>
                ))}
                <Text style={[styles.cell, styles.headerCell, styles.colTotal]} wrap={false}>
                  Total
                </Text>
              </View>
              {paddedRows.length ? (
                paddedRows.map((row, idx) => {
                  const cells = renderRowCells(row, isWhatsApp);
                  return (
                    <View
                      key={`row-${row.index}`}
                      style={[styles.row, idx % 2 === 1 ? styles.rowAlt : null]}
                    >
                      {cells.map((cell) => (
                        <Text key={`${row.index}-${cell.key}`} style={[styles.cell, cell.style]}>
                          {cell.text}
                        </Text>
                      ))}
                      {data.monthDays.map((day) => (
                        <Text
                          key={`${row.index}-day-${day}`}
                          style={[styles.cell, styles.colDay]}
                        >
                          {row.attendance?.[day] ?? ""}
                        </Text>
                      ))}
                      <Text style={[styles.cell, styles.colTotal]}>
                        {typeof row.total === "number" ? String(row.total) : ""}
                      </Text>
                    </View>
                  );
                })
              ) : null}
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
                        styles.colDayRight,
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
                        style={[styles.cell, styles.colDayRight]}
                      >
                        {" "}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.block, styles.notes]}>
              <Text style={styles.blockTitle}>Observações</Text>
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
