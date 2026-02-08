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

export function SessionPlanDocument({ data }: { data: SessionPlanPdfData }) {
  const hasObjective = Boolean(data.objective.trim());
  const hasLoad = Boolean(data.plannedLoad.trim());
  const hasTitle = Boolean(data.title.trim());
  const hasMaterials = (data.materials ?? []).length > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Plano de Aula (Dia)</Text>
        <Text style={styles.subtitle}>
          Turma: {data.className}
          {data.ageGroup ? ` (${data.ageGroup})` : ""}{"\n"}
          Data: {data.dateLabel}
          {data.unitLabel ? `\nUnidade: ${data.unitLabel}` : ""}
        </Text>

        <View style={styles.grid}>
          {hasTitle ? (
            <View style={styles.card}>
              <Text style={styles.label}>Título / Tema</Text>
              <Text style={styles.value}>{data.title}</Text>
            </View>
          ) : null}
          <View style={styles.card}>
            <Text style={styles.label}>Tempo total</Text>
            <Text style={styles.value}>{data.totalTime ?? "-"}</Text>
          </View>
          {hasObjective ? (
            <View style={styles.card}>
              <Text style={styles.label}>Objetivo</Text>
              <Text style={styles.value}>{data.objective}</Text>
            </View>
          ) : null}
          {hasLoad ? (
            <View style={styles.card}>
              <Text style={styles.label}>Carga planejada</Text>
              <Text style={styles.value}>{data.plannedLoad}</Text>
            </View>
          ) : null}
        </View>

        {hasMaterials ? (
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>Materiais</Text>
            </View>
            <Text style={styles.value}>{data.materials.join(", ")}</Text>
          </View>
        ) : null}

        {data.blocks.map((block) => (
          <View key={block.title} style={styles.block}>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>{block.title}</Text>
              {block.time ? (
                <Text style={styles.muted}>{block.time}</Text>
              ) : null}
            </View>
            {block.items.length ? (
              block.items.map((item, index) => (
                <View key={`${block.title}-${index}`} style={styles.itemRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.notes ? (
                    <Text style={styles.muted}>{item.notes}</Text>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={styles.muted}>Sem atividades.</Text>
            )}
          </View>
        ))}

        {data.notes ? (
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>Observações</Text>
            </View>
            <Text style={styles.value}>{data.notes}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text>Gerado pelo app</Text>
          <Text style={styles.signature}>
            {data.coachName
            ? `Professor(a): ${data.coachName}`
              : "Assinatura: ____________________"}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
