import React from "react";
// Use the browser bundle to avoid yoga's import.meta in dev web.
import {
    Document,
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
    fontSize: 8.5,
    lineHeight: 1.25,
  },
  textCenter: {
    textAlign: "center",
    fontWeight: "bold",
  },
  periodCell: {
    width: "12%",
  },
  activitiesCell: {
    width: "17%",
  },
  timeCell: {
    width: "8%",
  },
  organizationCell: {
    width: "16%",
  },
  developmentCell: {
    width: "22%",
  },
  criteriaCell: {
    width: "12%",
  },
  progressionCell: {
    width: "13%",
  },
  notesLabel: {
    width: "12%",
  },
  notesContent: {
    width: "88%",
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

const resolveBlockDescriptionLines = (block: SessionPlanPdfData["blocks"][number]) => {
  const items = getBlockActivities(block);
  const descriptionRows = items
    .map((item) => asCoachingText(item?.description || item?.notes).trim())
    .filter(Boolean);

  if (descriptionRows.length) return descriptionRows;

  const blockSummary = asCoachingText(block?.summary).trim();
  return blockSummary ? [blockSummary] : [];
};

const extractSectionValue = (text: string, label: string, nextLabels: string[]) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedNext = nextLabels.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(`${escapedLabel}:\\s*([\\s\\S]*?)(?=\\n(?:${escapedNext}):|$)`, "i");
  return text.match(pattern)?.[1]?.trim() ?? "";
};

const parseActivitySections = (description: string) => {
  const labels = [
    "Organização",
    "Desenvolvimento",
    "Comandos do professor",
    "Critério de sucesso",
    "Progressão",
    "Adaptação",
    "Perguntas",
  ];
  return {
    organization: extractSectionValue(description, "Organização", labels),
    development: extractSectionValue(description, "Desenvolvimento", labels),
    criteria: extractSectionValue(description, "Critério de sucesso", labels),
    progression: [
      extractSectionValue(description, "Progressão", labels),
      extractSectionValue(description, "Adaptação", labels),
    ]
      .filter(Boolean)
      .join("\n"),
  };
};

const TITLE_TEXT = "PLANEJAMENTO DE AULA DO DIA";
const LABEL_PERIODO = "Per\u00edodo";
const LABEL_OBSERVACOES = "Observa\u00e7\u00f5es:";

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
            <View style={[styles.cell, styles.organizationCell, styles.headerCell]}>
              <Text style={styles.labelStrong}>Organização</Text>
            </View>
            <View style={[styles.cell, styles.developmentCell, styles.headerCell]}>
              <Text style={styles.labelStrong}>Desenvolvimento</Text>
            </View>
            <View style={[styles.cell, styles.criteriaCell, styles.headerCell]}>
              <Text style={styles.labelStrong}>Critério</Text>
            </View>
            <View style={[styles.cell, styles.progressionCell, styles.cellLast, styles.headerCell]}>
              <Text style={styles.labelStrong}>Progressão/Adaptação</Text>
            </View>
          </View>

          {blocks.flatMap((block, blockIndex) => {
            const period = getBlockLabel(block);
            const time = getBlockTime(block);
            const items = getBlockActivities(block);
            const activityRows = items.length
              ? items.map((item, itemIndex) => {
                  const sections = parseActivitySections(asCoachingText(item?.description || item?.notes).trim());
                  return {
                    key: `${period}-${blockIndex}-${itemIndex}`,
                    activity: asCoachingText(item?.name).trim() || "-",
                    organization: sections.organization || "-",
                    development: sections.development || asCoachingText(item?.description || item?.notes).trim() || "-",
                    criteria: sections.criteria || "-",
                    progression: sections.progression || "-",
                    showPeriod: itemIndex === 0,
                  };
                })
              : resolveBlockDescriptionLines(block).map((description, itemIndex) => ({
                  key: `${period}-${blockIndex}-${itemIndex}`,
                  activity: "-",
                  organization: "-",
                  development: description,
                  criteria: "-",
                  progression: "-",
                  showPeriod: itemIndex === 0,
                }));
            return activityRows.map((row) => (
              <View key={row.key} style={styles.row} wrap={false}>
                <View style={[styles.cell, styles.periodCell]}>
                  <Text style={styles.text}>
                    <Text style={styles.strong}>{row.showPeriod ? period : ""}</Text>
                  </Text>
                </View>
                <View style={[styles.cell, styles.activitiesCell]}>
                  <Text style={styles.text}>{row.activity}</Text>
                </View>
                <View style={[styles.cell, styles.timeCell]}>
                  <Text style={[styles.text, styles.textCenter]}>{row.showPeriod ? time : ""}</Text>
                </View>
                <View style={[styles.cell, styles.organizationCell]}>
                  <Text style={styles.text}>{row.organization}</Text>
                </View>
                <View style={[styles.cell, styles.developmentCell]}>
                  <Text style={styles.text}>{row.development}</Text>
                </View>
                <View style={[styles.cell, styles.criteriaCell]}>
                  <Text style={styles.text}>{row.criteria}</Text>
                </View>
                <View style={[styles.cell, styles.progressionCell, styles.cellLast]}>
                  <Text style={styles.text}>{row.progression}</Text>
                </View>
              </View>
            ));
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
