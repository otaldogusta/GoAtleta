import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { MonthlyLessonPlanItem, MonthlyPlanPdfData } from "./templates/monthly-plan";

const chunk = <T,>(items: T[], size: number) => {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }
  return pages;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 66,
    paddingRight: 42,
    paddingBottom: 12,
    paddingLeft: 42,
    fontFamily: "Helvetica",
    fontSize: 8.1,
    color: "#111111",
    backgroundColor: "#ffffff",
  },
  lessonGrid: {
    flexDirection: "row",
    gap: 50,
    alignItems: "flex-start",
  },
  lessonCard: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 1.2,
    borderColor: "#111111",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  cell: {
    paddingHorizontal: 4,
    paddingVertical: 0.5,
    borderRightWidth: 1,
    borderRightColor: "#111111",
    lineHeight: 1.05,
  },
  cellBox: {
    paddingHorizontal: 4,
    paddingVertical: 0.5,
    borderRightWidth: 1,
    borderRightColor: "#111111",
    justifyContent: "center",
  },
  cellText: {
    fontSize: 8.1,
    lineHeight: 1.05,
  },
  lastCell: {
    borderRightWidth: 0,
  },
  titleText: {
    textAlign: "center",
    fontWeight: 700,
    fontSize: 8.4,
    lineHeight: 1,
  },
  titleRow: {
    height: 12,
  },
  compactRow: {
    height: 14,
  },
  headerCell: {
    paddingVertical: 1.5,
    textAlign: "center",
    fontWeight: 700,
  },
  tableHeaderRow: {
    height: 24,
  },
  tableHeaderBox: {
    paddingHorizontal: 4,
    paddingVertical: 0.5,
    borderRightWidth: 1,
    borderRightColor: "#111111",
    justifyContent: "center",
    alignItems: "center",
  },
  tableHeaderText: {
    fontSize: 8.1,
    fontWeight: 700,
    lineHeight: 1,
    textAlign: "center",
  },
  periodCell: {
    width: "21%",
  },
  activitiesCell: {
    width: "21%",
  },
  timeCell: {
    width: "13%",
    textAlign: "center",
    fontSize: 7.7,
  },
  descriptionCell: {
    width: "45%",
  },
  objectiveRow: {
    minHeight: 24,
  },
  shortBlockRow: {
    minHeight: 30,
  },
  mainBlockRow: {
    minHeight: 112,
  },
  observationsRow: {
    minHeight: 38,
  },
  bold: {
    fontWeight: 700,
  },
  emptySlot: {
    flexGrow: 1,
    flexBasis: 0,
  },
});

function LessonCard({ lesson, professorName }: { lesson: MonthlyLessonPlanItem; professorName: string }) {
  return (
    <View style={styles.lessonCard}>
      <View style={[styles.row, styles.titleRow]}>
        <View style={[styles.cellBox, styles.lastCell, { width: "100%" }]}>
          <Text style={styles.titleText}>PLANO DE AULA ESCOLINHA VÔLEI</Text>
        </View>
      </View>

      <View style={[styles.row, styles.compactRow]}>
        <View style={[styles.cellBox, styles.lastCell, { width: "100%" }]}>
          <Text style={styles.cellText}>
            <Text style={styles.bold}>Professor: </Text>
            {professorName}
          </Text>
        </View>
      </View>

      <View style={[styles.row, styles.compactRow]}>
        <View style={[styles.cellBox, { width: "44%" }]}>
          <Text style={[styles.cellText, styles.bold]}>{lesson.weekLabel}</Text>
        </View>
        <View style={[styles.cellBox, styles.lastCell, { width: "56%" }]}>
          <Text style={styles.cellText}>
            <Text style={styles.bold}>Data: </Text>
            {lesson.dateLabel}
          </Text>
        </View>
      </View>

      <View style={[styles.row, styles.compactRow]}>
        <View style={[styles.cellBox, styles.lastCell, { width: "100%" }]}>
          <Text style={styles.cellText}>
            <Text style={styles.bold}>Objetivo geral: </Text>
            {lesson.generalObjective}
          </Text>
        </View>
      </View>

      <View style={[styles.row, styles.objectiveRow]}>
        <View style={[styles.cellBox, styles.lastCell, { width: "100%" }]}>
          <Text style={styles.cellText}>
            <Text style={styles.bold}>Objetivo específico: </Text>
            {lesson.specificObjective}
          </Text>
        </View>
      </View>

      <View style={[styles.row, styles.tableHeaderRow]}>
        <View style={[styles.tableHeaderBox, styles.periodCell]}>
          <Text style={styles.tableHeaderText}>Período</Text>
        </View>
        <View style={[styles.tableHeaderBox, styles.activitiesCell]}>
          <Text style={styles.tableHeaderText}>Atividades</Text>
        </View>
        <View style={[styles.tableHeaderBox, styles.timeCell]}>
          <Text style={styles.tableHeaderText}>Tempo</Text>
        </View>
        <View style={[styles.tableHeaderBox, styles.descriptionCell, styles.lastCell]}>
          <Text style={styles.tableHeaderText}>Descrição</Text>
        </View>
      </View>

      {lesson.blocks.map((block) => (
        <View
          key={block.period}
          style={[
            styles.row,
            block.period === "Parte principal" ? styles.mainBlockRow : styles.shortBlockRow,
          ]}
        >
          <Text style={[styles.cell, styles.periodCell]}>{block.period}</Text>
          <Text style={[styles.cell, styles.activitiesCell]}>{block.activities}</Text>
          <Text style={[styles.cell, styles.timeCell]}>{block.time}</Text>
          <Text style={[styles.cell, styles.descriptionCell, styles.lastCell]}>{block.description}</Text>
        </View>
      ))}

      <View style={[styles.row, styles.observationsRow, styles.lastRow]}>
        <Text style={[styles.cell, styles.periodCell, styles.bold]}>Observações:</Text>
        <Text style={[styles.cell, styles.lastCell, { width: "79%" }]}>{lesson.observations || ""}</Text>
      </View>
    </View>
  );
}

export function MonthlyLessonPlanDocument({ data }: { data: MonthlyPlanPdfData }) {
  const pages = chunk(data.lessons, 2);

  return (
    <Document title={`Plano mensal - ${data.monthLabel}`}>
      {(pages.length ? pages : [[]]).map((lessons, pageIndex) => (
        <Page key={`page-${pageIndex}`} size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.lessonGrid}>
            {lessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} professorName={data.professorName} />
            ))}
            {lessons.length === 1 ? <View style={styles.emptySlot} /> : null}
          </View>
        </Page>
      ))}
    </Document>
  );
}
