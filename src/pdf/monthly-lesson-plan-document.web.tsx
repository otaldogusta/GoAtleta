import React from "react";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { MonthlyLessonPlanItem, MonthlyPlanPdfData } from "./templates/monthly-plan";

const calibriFont = require("../../assets/fonts/calibri.ttf");
const calibriBoldFont = require("../../assets/fonts/calibrib.ttf");
const calibriItalicFont = require("../../assets/fonts/calibrii.ttf");

Font.register({
  family: "Calibri",
  fonts: [
    { src: calibriFont, fontWeight: 400 },
    { src: calibriBoldFont, fontWeight: 700 },
    { src: calibriItalicFont, fontWeight: 400, fontStyle: "italic" },
  ],
});

const styles = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingRight: 24,
    paddingBottom: 28,
    paddingLeft: 24,
    fontFamily: "Calibri",
    fontSize: 9.5,
    color: "#000000",
    backgroundColor: "#ffffff",
  },
  table: {
    borderWidth: 1,
    borderColor: "#000000",
    width: "100%",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  cell: {
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRightWidth: 1,
    borderRightColor: "#000000",
    justifyContent: "flex-start",
  },
  lastCell: {
    borderRightWidth: 0,
  },
  labelCell: {
    backgroundColor: "#f2f2f2",
    justifyContent: "center",
  },
  situationLabel: {
    backgroundColor: "#eaf5ea",
  },
  titleCell: {
    width: "100%",
    paddingVertical: 6,
    borderRightWidth: 0,
    backgroundColor: "#457b3c",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#ffffff",
    textAlign: "center",
    fontWeight: 700,
    fontSize: 9.5,
  },
  labelText: {
    fontWeight: 700,
    fontSize: 9.5,
  },
  fieldRow: {
    minHeight: 20,
  },
  fieldCell: {
    paddingVertical: 2,
  },
  text: {
    fontSize: 9.5,
    lineHeight: 1.1,
  },
  fieldLabel: {
    width: "17%",
  },
  fieldValue: {
    width: "83%",
  },
  fullValue: {
    width: "83%",
  },
  contentRow: {
    minHeight: 24,
  },
  situationRow: {
    minHeight: 24,
  },
  pairValue: {
    width: "26%",
  },
  rightPairValue: {
    width: "47%",
  },
  secondaryLabel: {
    width: "10%",
  },
  tableHeaderCell: {
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    minHeight: 20,
  },
  tableHeaderText: {
    fontSize: 9.5,
    fontWeight: 700,
    lineHeight: 1.1,
    textAlign: "center",
  },
  periodCell: {
    width: "17%",
  },
  activitiesCell: {
    width: "26%",
  },
  timeCell: {
    width: "10%",
    alignItems: "center",
  },
  descriptionCell: {
    width: "47%",
  },
  shortBlockRow: {
    minHeight: 34,
  },
  cooldownBlockRow: {
    minHeight: 20,
  },
  mainBlockRow: {
    minHeight: 52,
  },
  observationsRow: {
    minHeight: 34,
  },
  specificRow: {
    minHeight: 34,
  },
  pageLabel: {
    height: 18,
    paddingTop: 1,
    color: "#777777",
    fontSize: 9.5,
    fontWeight: 700,
  },
  bold: {
    fontWeight: 700,
  },
  italic: {
    fontStyle: "italic",
  },
  centeredCell: {
    justifyContent: "center",
  },
  blockParagraph: {
    marginBottom: 3,
  },
});

const SPECIFIC_OBJECTIVE_LABELS = ["Conceitual:", "Atitudinal:", "Procedimental:"];

function StructuredSpecificObjective({ value }: { value: string }) {
  const lines = value.split(/\r?\n/).filter(Boolean);

  return (
    <Text style={styles.text}>
      {lines.map((line, index) => {
        const label = SPECIFIC_OBJECTIVE_LABELS.find((candidate) => line.startsWith(candidate));
        return (
          <React.Fragment key={`${line}-${index}`}>
            {index ? "\n" : ""}
            {label ? <Text style={styles.bold}>{label}</Text> : null}
            {label ? line.slice(label.length) : line}
          </React.Fragment>
        );
      })}
    </Text>
  );
}

function MultilineText({ value }: { value: string }) {
  const lines = value.split(/\r?\n/).filter(Boolean);

  return (
    <>
      {(lines.length ? lines : ["-"]).map((line, index) => (
        <Text
          key={`${line}-${index}`}
          style={[styles.text, ...(index < lines.length - 1 ? [styles.blockParagraph] : [])] as any}
        >
          {line}
        </Text>
      ))}
    </>
  );
}

function FieldRow({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  preserveEmpty = false,
}: {
  leftLabel: string;
  leftValue: string;
  rightLabel?: string;
  rightValue?: string;
  preserveEmpty?: boolean;
}) {
  const emptyValue = preserveEmpty ? "" : "-";
  return (
    <View style={[styles.row, styles.fieldRow]}>
      <View style={[styles.cell, styles.fieldCell, styles.labelCell, styles.fieldLabel]}>
        <Text style={styles.labelText}>{leftLabel}:</Text>
      </View>
      <View style={[styles.cell, styles.fieldCell, rightLabel ? styles.pairValue : styles.fieldValue, ...(rightLabel ? [] : [styles.lastCell])] as any}>
        <Text style={styles.text}>{leftValue || emptyValue}</Text>
      </View>
      {rightLabel ? (
        <>
          <View style={[styles.cell, styles.fieldCell, styles.labelCell, styles.secondaryLabel]}>
            <Text style={styles.labelText}>{rightLabel}:</Text>
          </View>
          <View style={[styles.cell, styles.fieldCell, styles.rightPairValue, styles.lastCell]}>
            <Text style={styles.text}>{rightValue || emptyValue}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

function ContentRow({ label, value, situation = false, specific = false, preserveEmpty = false }: { label: string; value: string; situation?: boolean; specific?: boolean; preserveEmpty?: boolean }) {
  const emptyValue = preserveEmpty ? "" : "-";
  return (
    <View style={[styles.row, styles.contentRow, ...(specific ? [styles.specificRow] : []), ...(situation ? [styles.situationRow] : [])] as any}>
      <View style={[styles.cell, styles.labelCell, styles.fieldLabel, ...(situation ? [styles.situationLabel] : [])] as any}>
        <Text style={styles.labelText}>{label}:</Text>
      </View>
      <View style={[styles.cell, styles.fullValue, styles.lastCell]}>
        {specific ? (
          <StructuredSpecificObjective value={value || emptyValue} />
        ) : (
          <Text style={[styles.text, ...(situation ? [styles.italic] : [])] as any}>{value || emptyValue}</Text>
        )}
      </View>
    </View>
  );
}

function LessonTable({ lesson, data, pageLabel }: { lesson: MonthlyLessonPlanItem; data: MonthlyPlanPdfData; pageLabel: string }) {
  const preserveEmpty = lesson.preserveEmptyFields === true;
  const emptyValue = preserveEmpty ? "" : "-";
  return (
    <>
      {pageLabel ? <Text style={styles.pageLabel}>{pageLabel}</Text> : null}
      <View style={styles.table}>
      <View style={styles.row}>
        <View style={styles.titleCell}>
          <Text style={styles.title}>PLANO DE AULA — ESCOLINHA VÔLEI</Text>
        </View>
      </View>

      <FieldRow
        leftLabel="Professor"
        leftValue={data.professorName}
        rightLabel="Turma"
        rightValue={`${data.className}${data.ageGroup ? ` (${data.ageGroup} anos${data.genderLabel ? `, ${data.genderLabel}` : ""})` : ""}`}
        preserveEmpty={preserveEmpty}
      />
      <FieldRow leftLabel="Semana" leftValue={lesson.weekLabel} preserveEmpty={preserveEmpty} />
      <FieldRow leftLabel="Data" leftValue={lesson.dateLabel} rightLabel="Horário" rightValue={lesson.timeLabel || emptyValue} preserveEmpty={preserveEmpty} />
      <ContentRow label="Objetivo geral" value={lesson.generalObjective} preserveEmpty={preserveEmpty} />
      <ContentRow label="Objetivo específico" value={lesson.specificObjective} specific preserveEmpty={preserveEmpty} />
      <ContentRow label="Situação-problema" value={lesson.situationProblem || emptyValue} situation preserveEmpty={preserveEmpty} />

      <View style={styles.row}>
        <View style={[styles.cell, styles.tableHeaderCell, styles.periodCell]}>
          <Text style={styles.tableHeaderText}>Período</Text>
        </View>
        <View style={[styles.cell, styles.tableHeaderCell, styles.activitiesCell]}>
          <Text style={styles.tableHeaderText}>Atividades</Text>
        </View>
        <View style={[styles.cell, styles.tableHeaderCell, styles.timeCell]}>
          <Text style={styles.tableHeaderText}>Tempo</Text>
        </View>
        <View style={[styles.cell, styles.tableHeaderCell, styles.descriptionCell, styles.lastCell]}>
          <Text style={styles.tableHeaderText}>Descrição / condução da situação-problema</Text>
        </View>
      </View>

      {lesson.blocks.map((block) => {
        if (block.period === "Volta à calma") {
          return <View key={`${lesson.id}-${block.period}`} style={[styles.row, styles.cooldownBlockRow]} wrap={false}>
            <View style={[styles.cell, styles.labelCell, styles.periodCell, styles.centeredCell]}>
              <Text style={[styles.text, styles.bold]}>Volta à calma:</Text>
            </View>
            <View style={[styles.cell, styles.fullValue, styles.lastCell, styles.centeredCell]}>
              <Text style={styles.text}>{block.activities || block.description || emptyValue}</Text>
            </View>
          </View>;
        }

        const structuredItems = block.items?.filter(
          (item) => item.activity.trim() || item.description.trim()
        );
        if (structuredItems?.length) {
          return structuredItems.map((item, itemIndex) => (
            <View
              key={`${lesson.id}-${block.period}-${itemIndex}`}
              style={[styles.row, block.period === "Parte principal" ? styles.mainBlockRow : styles.shortBlockRow]}
              wrap={false}
            >
              <View style={[styles.cell, styles.periodCell, styles.centeredCell]}>
                <Text style={[styles.text, styles.bold]}>{itemIndex === 0 ? block.period : ""}</Text>
              </View>
              <View style={[styles.cell, styles.activitiesCell, styles.centeredCell]}>
                <Text style={styles.text}>{item.activity || emptyValue}</Text>
              </View>
              <View style={[styles.cell, styles.timeCell, styles.centeredCell]}>
                <Text style={[styles.text, styles.bold]}>{itemIndex === 0 ? block.time || emptyValue : ""}</Text>
              </View>
              <View style={[styles.cell, styles.descriptionCell, styles.lastCell, styles.centeredCell]}>
                <Text style={styles.text}>{item.description || emptyValue}</Text>
              </View>
            </View>
          ));
        }

        return <View
            key={`${lesson.id}-${block.period}`}
            style={[styles.row, block.period === "Parte principal" ? styles.mainBlockRow : styles.shortBlockRow]}
            wrap={false}
          >
            <View style={[styles.cell, styles.periodCell, styles.centeredCell]}>
              <Text style={[styles.text, styles.bold]}>{block.period}</Text>
            </View>
            <View style={[styles.cell, styles.activitiesCell, styles.centeredCell]}>
              <MultilineText value={block.activities || emptyValue} />
            </View>
            <View style={[styles.cell, styles.timeCell, styles.centeredCell]}>
              <Text style={[styles.text, styles.bold]}>{block.time || emptyValue}</Text>
            </View>
            <View style={[styles.cell, styles.descriptionCell, styles.lastCell, styles.centeredCell]}>
              <MultilineText value={block.description || emptyValue} />
            </View>
          </View>;
      })}

      <View style={[styles.row, styles.observationsRow, styles.lastRow]}>
        <View style={[styles.cell, styles.labelCell, styles.fieldLabel]}>
          <Text style={styles.labelText}>Observações:</Text>
        </View>
        <View style={[styles.cell, styles.fullValue, styles.lastCell]}>
          <Text style={styles.text}>{lesson.observations || ""}</Text>
        </View>
      </View>
      </View>
    </>
  );
}

export function MonthlyLessonPlanDocument({ data }: { data: MonthlyPlanPdfData }) {
  const lessons = data.lessons.length ? data.lessons : [null];

  return (
    <Document title={`Plano mensal - ${data.monthLabel}`}>
      {lessons.map((lesson, index) => (
        <Page key={`page-${lesson?.id || index}`} size="A4" style={styles.page}>
          {lesson ? (
            <LessonTable
              lesson={lesson}
              data={data}
              pageLabel={data.lessons.length > 1 ? `Aula ${index + 1} de ${data.lessons.length}` : ""}
            />
          ) : null}
        </Page>
      ))}
    </Document>
  );
}
