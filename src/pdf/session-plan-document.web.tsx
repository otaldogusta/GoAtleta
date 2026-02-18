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
import type { SessionPlanPdfData } from "./templates/session-plan";

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 11,
    color: "#111",
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
  },
  subtitle: {
    color: "#555",
    marginBottom: 12,
    lineHeight: 1.4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fafafa",
    width: "48%",
  },
  label: {
    fontSize: 9,
    color: "#777",
    marginBottom: 4,
  },
  value: {
    fontSize: 11,
  },
  block: {
    marginTop: 14,
  },
  blockHeader: {
    marginBottom: 6,
  },
  blockTitle: {
    fontSize: 12,
    fontWeight: "bold",
  },
  muted: {
    color: "#666",
    fontSize: 9,
    marginTop: 3,
  },
  itemRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  itemName: {
    fontSize: 11,
    fontWeight: "bold",
  },
  footer: {
    marginTop: 16,
    fontSize: 9,
    color: "#777",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signature: {
    fontSize: 10,
  },
});

const asText = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
};

export function SessionPlanDocument({ data }: { data: SessionPlanPdfData }) {
  const objective = asText(data?.objective);
  const plannedLoad = asText(data?.plannedLoad);
  const title = asText(data?.title);
  const notes = asText(data?.notes);
  const materials = (Array.isArray(data?.materials) ? data.materials : []).map((item) =>
    asText(item)
  );
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];

  const hasObjective = Boolean(objective.trim());
  const hasLoad = Boolean(plannedLoad.trim());
  const hasTitle = Boolean(title.trim());
  const hasMaterials = materials.length > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Plano de Aula (Dia)</Text>
        <Text style={styles.subtitle}>
          Turma: {asText(data?.className)}
          {asText(data?.ageGroup) ? ` (${asText(data?.ageGroup)})` : ""}{"\n"}
          Data: {asText(data?.dateLabel)}
          {asText(data?.unitLabel) ? `\nUnidade: ${asText(data?.unitLabel)}` : ""}
        </Text>

        <View style={styles.grid}>
          {hasTitle ? (
            <View style={styles.card}>
              <Text style={styles.label}>Titulo / Tema</Text>
              <Text style={styles.value}>{title}</Text>
            </View>
          ) : null}
          <View style={styles.card}>
            <Text style={styles.label}>Tempo total</Text>
            <Text style={styles.value}>{asText(data?.totalTime) || "-"}</Text>
          </View>
          {hasObjective ? (
            <View style={styles.card}>
              <Text style={styles.label}>Objetivo</Text>
              <Text style={styles.value}>{objective}</Text>
            </View>
          ) : null}
          {hasLoad ? (
            <View style={styles.card}>
              <Text style={styles.label}>Carga planejada</Text>
              <Text style={styles.value}>{plannedLoad}</Text>
            </View>
          ) : null}
        </View>

        {hasMaterials ? (
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>Materiais</Text>
            </View>
            <Text style={styles.value}>{materials.join(", ")}</Text>
          </View>
        ) : null}

        {blocks.map((block, blockIndex) => (
          <View key={`${asText(block?.title)}-${blockIndex}`} style={styles.block}>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>{asText(block?.title)}</Text>
              {asText(block?.time) ? (
                <Text style={styles.muted}>{asText(block?.time)}</Text>
              ) : null}
            </View>
            {Array.isArray(block?.items) && block.items.length ? (
              block.items.map((item, index) => (
                <View key={`${asText(block?.title)}-${index}`} style={styles.itemRow}>
                  <Text style={styles.itemName}>{asText(item?.name)}</Text>
                  {asText(item?.notes) ? (
                    <Text style={styles.muted}>{asText(item?.notes)}</Text>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={styles.muted}>Sem atividades.</Text>
            )}
          </View>
        ))}

        {notes ? (
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>Observacoes</Text>
            </View>
            <Text style={styles.value}>{notes}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text>Gerado pelo app</Text>
          <Text style={styles.signature}>
            {asText(data?.coachName)
              ? `Professor(a): ${asText(data?.coachName)}`
              : "Assinatura: ____________________"}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
