import React from "react";
// Use the browser bundle to avoid yoga's import.meta in dev web.
import {
    Document,
    Image,
    Page,
    StyleSheet,
    Text,
    View,
} from "@react-pdf/renderer/lib/react-pdf.browser";
import { resolveLearningObjectives } from "../core/pedagogy/objective-language";
import { sanitizeVolleyballLanguage } from "../core/pedagogy/volleyball-language-lexicon";
import { toPdfCoachingText, toPdfText } from "./pdf-coaching-text";
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
    marginBottom: 8,
  },
  header: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e6e6e6",
  },
  headerMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 14,
    rowGap: 6,
  },
  metaItem: {
    flexDirection: "row",
    gap: 4,
    width: "48%",
  },
  metaLabel: {
    color: "#666666",
    fontWeight: "bold",
    fontSize: 10.5,
  },
  metaValue: {
    fontSize: 10.5,
    color: "#333333",
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
    fontSize: 10,
    lineHeight: 1.3,
  },
  textCenter: {
    textAlign: "center",
    fontWeight: "bold",
  },
  periodCell: {
    width: "16%",
  },
  activitiesCell: {
    width: "24%",
  },
  timeCell: {
    width: "12%",
  },
  descriptionCell: {
    width: "48%",
  },
  workoutTable: {
    borderWidth: 1,
    borderColor: "#888888",
    width: "100%",
  },
  workoutHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f7f7f7",
    borderBottomWidth: 1,
    borderBottomColor: "#888888",
  },
  workoutRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#888888",
  },
  workoutRowLast: {
    borderBottomWidth: 0,
  },
  workoutCell: {
    paddingHorizontal: 5,
    paddingVertical: 5,
    borderRightWidth: 1,
    borderRightColor: "#888888",
  },
  workoutNameCell: {
    width: "46%",
  },
  workoutSmallCell: {
    width: "18%",
  },
  workoutCellLast: {
    borderRightWidth: 0,
  },
  workoutHeaderText: {
    fontSize: 9,
    fontWeight: "bold",
  },
  workoutText: {
    fontSize: 9,
    lineHeight: 1.25,
  },
  workoutTextCenter: {
    textAlign: "center",
  },
  activityEntry: {
    gap: 4,
    marginBottom: 8,
  },
  activityEntryLast: {
    marginBottom: 0,
  },
  demoQr: {
    marginTop: 4,
    gap: 3,
    alignItems: "flex-start",
  },
  demoQrLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#222222",
  },
  demoQrImage: {
    width: 44,
    height: 44,
  },
  notesLabel: {
    width: "16%",
  },
  notesContent: {
    width: "84%",
    minHeight: 86,
  },
  footer: {
    marginTop: 10,
    fontSize: 9,
    color: "#555555",
    textAlign: "right",
  },
});

const asText = (value: unknown) => sanitizeVolleyballLanguage(toPdfText(value));

const asCoachingText = (value: unknown) => sanitizeVolleyballLanguage(toPdfCoachingText(value));

const buildNumberedLines = (rows: string[]) =>
  rows.length ? rows.map((line, index) => `${index + 1}. ${line}`).join("\n\n") : "-";

const getBlockLabel = (block: SessionPlanPdfData["blocks"][number]) =>
  asText(block?.label || block?.title) || "-";

const getBlockTime = (block: SessionPlanPdfData["blocks"][number]) => {
  if (typeof block?.durationMinutes === "number" && Number.isFinite(block.durationMinutes)) {
    return `${Math.max(0, Math.round(block.durationMinutes))} min`;
  }
  return asText(block?.time) || "-";
};

const getBlockActivities = (block: SessionPlanPdfData["blocks"][number]) => {
  if (Array.isArray(block?.activities) && block.activities.length) return block.activities;
  if (Array.isArray(block?.items) && block.items.length) return block.items;
  return [];
};

const hasWorkoutPrescription = (item: ReturnType<typeof getBlockActivities>[number]) =>
  Boolean(
    String(item?.sets ?? "").trim() ||
      String(item?.reps ?? "").trim() ||
      String(item?.rest ?? "").trim()
  );

const isWorkoutBlock = (block: SessionPlanPdfData["blocks"][number]) => {
  const label = getBlockLabel(block);
  const items = getBlockActivities(block);
  return /treino\s+resistido|academia/i.test(label) || items.some(hasWorkoutPrescription);
};

const resolveBlockDescriptionLines = (block: SessionPlanPdfData["blocks"][number]) => {
  const items = getBlockActivities(block);
  const descriptionRows = items
    .map((item) => asCoachingText(item?.description || item?.notes).trim())
    .filter(Boolean);

  if (descriptionRows.length) return descriptionRows;

  const blockSummary = asCoachingText(block?.summary).trim();
  return blockSummary ? [blockSummary] : [];
};

const TITLE_TEXT = "PLANEJAMENTO DE AULA DO DIA";
const LABEL_PERIODO = "Per\u00edodo";
const LABEL_DESCRICAO = "Descri\u00e7\u00e3o";
const LABEL_OBSERVACOES = "Observa\u00e7\u00f5es:";

const DemoQr = ({
  label,
  dataUri,
}: {
  label?: string;
  dataUri?: string;
}) => {
  const qr = String(dataUri ?? "").trim();
  if (!qr) return null;
  return (
    <View style={styles.demoQr}>
      <Text style={styles.demoQrLabel}>{asText(label) || "Demonstração"}</Text>
      <Image src={qr} style={styles.demoQrImage} />
    </View>
  );
};

const WorkoutTable = ({ items }: { items: ReturnType<typeof getBlockActivities> }) => (
  <View style={styles.workoutTable}>
    <View style={styles.workoutHeaderRow}>
      <View style={[styles.workoutCell, styles.workoutNameCell]}>
        <Text style={styles.workoutHeaderText}>Atividade</Text>
      </View>
      <View style={[styles.workoutCell, styles.workoutSmallCell]}>
        <Text style={[styles.workoutHeaderText, styles.workoutTextCenter]}>Séries</Text>
      </View>
      <View style={[styles.workoutCell, styles.workoutSmallCell]}>
        <Text style={[styles.workoutHeaderText, styles.workoutTextCenter]}>Repet.</Text>
      </View>
      <View style={[styles.workoutCell, styles.workoutSmallCell, styles.workoutCellLast]}>
        <Text style={[styles.workoutHeaderText, styles.workoutTextCenter]}>Interv.</Text>
      </View>
    </View>
    {items.map((item, index) => (
      <View
        key={`${item.name ?? "exercise"}-${index}`}
        style={[styles.workoutRow, index === items.length - 1 ? styles.workoutRowLast : {}]}
      >
        <View style={[styles.workoutCell, styles.workoutNameCell]}>
          <Text style={styles.workoutText}>{asCoachingText(item?.name) || `Exercício ${index + 1}`}</Text>
          <DemoQr label={item.demoLabel} dataUri={item.demoQrDataUri} />
        </View>
        <View style={[styles.workoutCell, styles.workoutSmallCell]}>
          <Text style={[styles.workoutText, styles.workoutTextCenter]}>{asText(item?.sets) || "-"}</Text>
        </View>
        <View style={[styles.workoutCell, styles.workoutSmallCell]}>
          <Text style={[styles.workoutText, styles.workoutTextCenter]}>{asText(item?.reps) || "-"}</Text>
        </View>
        <View style={[styles.workoutCell, styles.workoutSmallCell, styles.workoutCellLast]}>
          <Text style={[styles.workoutText, styles.workoutTextCenter]}>{asText(item?.rest) || "-"}</Text>
        </View>
      </View>
    ))}
  </View>
);

export function SessionPlanDocument({ data }: { data: SessionPlanPdfData }) {
  const objective = asCoachingText(data?.objective);
  const generalObjective = asCoachingText(data?.generalObjective);
  const specificObjective = asCoachingText(data?.specificObjective);
  const weeklyFocus = asCoachingText(data?.weeklyFocus);
  const title = asCoachingText(data?.title);
  const notes = asCoachingText(data?.notes);
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  const generatedAt = new Date().toLocaleDateString("pt-BR");
  const resolvedObjectives = resolveLearningObjectives({
    generalObjective,
    specificObjective: specificObjective || objective,
    title,
    weeklyFocus,
    theme: weeklyFocus,
    technicalFocus: weeklyFocus,
  });
  const resolvedGeneralObjective = sanitizeVolleyballLanguage(resolvedObjectives.generalObjective);
  const resolvedSpecificObjective = sanitizeVolleyballLanguage(resolvedObjectives.specificObjective);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{TITLE_TEXT}</Text>
          <View style={styles.headerMeta}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Turma:</Text>
              <Text style={styles.metaValue}>
                {asText(data?.className)}
                {asText(data?.ageGroup) ? ` (${asText(data?.ageGroup)})` : ""}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Data:</Text>
              <Text style={styles.metaValue}>{asText(data?.dateLabel)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Semana:</Text>
              <Text style={styles.metaValue}>{asText(data?.weekLabel) || "-"}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Unidade:</Text>
              <Text style={styles.metaValue}>{asText(data?.unitLabel) || "-"}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Gênero:</Text>
              <Text style={styles.metaValue}>{asText(data?.genderLabel) || "-"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.row}>
            <View style={styles.cellSingle}>
              <Text style={styles.text}>
                <Text style={styles.strong}>Tema/Atividade: </Text>
                {title || ""}
              </Text>
            </View>
          </View>

          {resolvedGeneralObjective ? (
            <View style={styles.row}>
              <View style={styles.cellSingle}>
                <Text style={styles.text}>
                  <Text style={styles.strong}>Objetivo geral: </Text>
                  {resolvedGeneralObjective}
                </Text>
              </View>
            </View>
          ) : null}

          {resolvedSpecificObjective ? (
            <View style={styles.row}>
              <View style={styles.cellSingle}>
                <Text style={styles.text}>
                  <Text style={styles.strong}>Objetivo específico: </Text>
                  {resolvedSpecificObjective}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.row}>
            <View style={styles.cellSingle}>
              <Text style={styles.text}>
                <Text style={styles.strong}>Tempo total: </Text>
                  {asText(data?.totalTime) || ""}
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
            const period = getBlockLabel(block);
            const time = getBlockTime(block);
            const items = getBlockActivities(block);
            const workoutBlock = isWorkoutBlock(block);
            const descriptionRows = items.length
              ? items.map((item) => asCoachingText(item?.description || item?.notes).trim() || "-")
              : resolveBlockDescriptionLines(block);

            return (
              <View key={`${period}-${blockIndex}`} style={styles.row}>
                <View style={[styles.cell, styles.periodCell]}>
                  <Text style={styles.text}>
                    <Text style={styles.strong}>{period}</Text>
                  </Text>
                </View>
                <View style={[styles.cell, styles.activitiesCell]}>
                  {workoutBlock ? (
                    <Text style={styles.text}>-</Text>
                  ) : (
                    items.map((item, index) => (
                      <View
                        key={`${item.name ?? "activity"}-${index}`}
                        style={[styles.activityEntry, index === items.length - 1 ? styles.activityEntryLast : {}]}
                      >
                        <Text style={styles.text}>
                          {`${index + 1}. ${asCoachingText(item?.name).trim() || `Atividade ${index + 1}`}`}
                        </Text>
                        <DemoQr label={item.demoLabel} dataUri={item.demoQrDataUri} />
                      </View>
                    ))
                  )}
                </View>
                <View style={[styles.cell, styles.timeCell]}>
                  <Text style={[styles.text, styles.textCenter]}>{time}</Text>
                </View>
                <View style={[styles.cell, styles.descriptionCell, styles.cellLast]}>
                  {workoutBlock && items.length ? (
                    <WorkoutTable items={items} />
                  ) : (
                    <Text style={styles.text}>{buildNumberedLines(descriptionRows)}</Text>
                  )}
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
