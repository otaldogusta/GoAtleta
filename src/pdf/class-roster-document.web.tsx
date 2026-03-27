import React from "react";
// Use the browser bundle to avoid yoga's import.meta in dev web.
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer/lib/react-pdf.browser";
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e6e6e6",
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
    width: "100%",
  },
  leftColumn: {
    flex: 1,
    minWidth: 0,
  },
  rightColumn: {
    width: 250,
    flexShrink: 0,
    marginLeft: 24,
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
  colCourse: { width: 96, textAlign: "left" },
  colContact: { width: 104 },
  colTotal: { width: 44, textAlign: "center" },
  colName: { width: 150 },
  colDay: { flexGrow: 1, flexBasis: 0, minWidth: 12, textAlign: "center" },
  block: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fafafa",
  },
  blockTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 4,
  },
  fundTable: {
    borderWidth: 1,
    borderColor: "#d9d9d9",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  fundTableRow: {
    flexDirection: "row",
  },
  fundTableHeader: {
    backgroundColor: "#f2f2f2",
    borderBottomWidth: 1,
    borderBottomColor: "#d9d9d9",
  },
  fundLabelHead: {
    width: 108,
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "left",
    borderRightWidth: 1,
    borderRightColor: "#d9d9d9",
  },
  fundDayHead: {
    width: 28,
    paddingVertical: 4,
    textAlign: "center",
    fontSize: 9,
    fontWeight: "bold",
    borderRightWidth: 1,
    borderRightColor: "#d9d9d9",
  },
  fundLabelCell: {
    width: 108,
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 9,
    fontWeight: "bold",
    borderRightWidth: 1,
    borderRightColor: "#d9d9d9",
    borderBottomWidth: 1,
    borderBottomColor: "#d9d9d9",
  },
  fundDayCell: {
    width: 28,
    paddingVertical: 4,
    textAlign: "center",
    fontSize: 9,
    fontWeight: "bold",
    borderRightWidth: 1,
    borderRightColor: "#d9d9d9",
    borderBottomWidth: 1,
    borderBottomColor: "#d9d9d9",
  },
  fundList: {
    gap: 6,
  },
  fundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  fundBox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: "#777",
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
    fontSize: 8,
    lineHeight: 1,
    color: "#111",
  },
  fundBoxActive: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  fundBoxTextActive: {
    color: "#fff",
    fontWeight: "bold",
  },
  fundLabel: {
    flex: 1,
    minWidth: 0,
  },
  notes: {
    marginTop: 18,
    backgroundColor: "#fff",
  },
  notesLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    height: 14,
  },
  footer: {
    marginTop: 12,
    fontSize: 8,
    color: "#666",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export function ClassRosterDocument({ data }: { data: ClassRosterPdfData }) {
  const showAttendance = data.includeAttendance !== false;
  const showBirthDate = data.includeBirthDate !== false;
  const showCourse = data.includeCourse === true;
  const showContact = data.includeContact === true;
  const showFundamentals = data.includeFundamentals !== false;
  const paddedRows: ClassRosterRow[] =
    data.rows.length >= 20
      ? data.rows
      : [
          ...data.rows,
          ...Array.from({ length: 20 - data.rows.length }, (_, idx) => ({
            index: data.rows.length + idx + 1,
            studentName: "",
            birthDate: "",
            collegeCourse: "",
            contactLabel: "",
            contactPhone: "",
            attendance: undefined,
            total: undefined,
          })),
        ];

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
                <Text style={[styles.cell, styles.headerCell, styles.colIndex]}>#</Text>
                <Text style={[styles.cell, styles.headerCell, styles.colName]}>Atletas</Text>
                {showBirthDate ? (
                  <Text style={[styles.cell, styles.headerCell, styles.colBirth]}>Nasc</Text>
                ) : null}
                {showCourse ? (
                  <Text style={[styles.cell, styles.headerCell, styles.colCourse]}>Curso</Text>
                ) : null}
                {showContact ? (
                  <Text style={[styles.cell, styles.headerCell, styles.colContact]}>Contato</Text>
                ) : null}
                {showAttendance
                  ? data.monthDays.map((day) => (
                      <Text key={`day-${day}`} style={[styles.cell, styles.headerCell, styles.colDay]}>
                        {day}
                      </Text>
                    ))
                  : null}
                {showAttendance ? (
                  <Text style={[styles.cell, styles.headerCell, styles.colTotal]} wrap={false}>
                    Total
                  </Text>
                ) : null}
              </View>
              {paddedRows.length
                ? paddedRows.map((row, idx) => (
                    <View
                      key={`row-${row.index}`}
                      style={idx % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row}
                    >
                      <Text style={[styles.cell, styles.colIndex]}>{row.index}</Text>
                      <Text style={[styles.cell, styles.colName]}>{row.studentName}</Text>
                      {showBirthDate ? (
                        <Text style={[styles.cell, styles.colBirth]}>{row.studentName ? row.birthDate ?? "-" : ""}</Text>
                      ) : null}
                      {showCourse ? (
                        <Text style={[styles.cell, styles.colCourse]}>
                          {row.studentName ? row.collegeCourse ?? "-" : ""}
                        </Text>
                      ) : null}
                      {showContact ? (
                        <Text style={[styles.cell, styles.colContact]}>
                          {row.studentName ? `${row.contactLabel ?? "-"} ${row.contactPhone ?? ""}`.trim() : ""}
                        </Text>
                      ) : null}
                      {showAttendance
                        ? data.monthDays.map((day) => (
                            <Text key={`${row.index}-day-${day}`} style={[styles.cell, styles.colDay]}>
                              {row.attendance?.[day] ?? ""}
                            </Text>
                          ))
                        : null}
                      {showAttendance ? (
                        <Text style={[styles.cell, styles.colTotal]}>
                          {typeof row.total === "number" ? String(row.total) : ""}
                        </Text>
                      ) : null}
                    </View>
                  ))
                : null}
            </View>

            <View style={styles.footer}>
              <Text>Exportado em {data.exportDate}</Text>
              <Text>Total de alunos: {data.totalStudents}</Text>
            </View>
          </View>

          <View style={styles.rightColumn}>
            {showFundamentals ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Fundamentos trabalhados</Text>
                <View style={styles.fundTable}>
                  <View style={[styles.fundTableRow, styles.fundTableHeader]}>
                    <Text style={styles.fundLabelHead}>Fundamento</Text>
                    {data.monthDays.map((day) => (
                      <Text key={`fund-head-${day}`} style={styles.fundDayHead}>
                        {day}
                      </Text>
                    ))}
                  </View>
                  {data.fundamentals.length ? (
                    data.fundamentals.map((item, index) => {
                      const key = data.fundamentalKeys?.[index] ?? item;
                      return (
                      <View key={key} style={styles.fundTableRow}>
                        <Text
                          style={[
                            styles.fundLabelCell,
                            index === data.fundamentals.length - 1
                              ? { borderBottomWidth: 0 }
                              : {},
                          ]}
                        >
                          {item}
                        </Text>
                        {data.monthDays.map((day, dayIndex) => {
                          const active = ((data.fundamentalsByDay ?? {})[day] ?? []).includes(key);
                          return (
                            <Text
                              key={`fund-${key}-${day}`}
                              style={[
                                styles.fundDayCell,
                                index === data.fundamentals.length - 1
                                  ? { borderBottomWidth: 0 }
                                  : {},
                              ]}
                            >
                              {active ? "X" : ""}
                            </Text>
                          );
                        })}
                      </View>
                      );
                    })
                  ) : (
                    <View style={styles.fundTableRow}>
                      <Text style={styles.fundLabelCell}>Sem fundamentos</Text>
                      {data.monthDays.map((day, dayIndex) => (
                        <Text
                          key={`fund-empty-${day}`}
                          style={[
                            styles.fundDayCell,
                          ]}
                        >
                          {" "}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ) : null}

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
