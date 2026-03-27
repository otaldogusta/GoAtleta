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
import type { SessionReportPdfData } from "./templates/session-report";

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 11,
    color: "#111",
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: 0.6,
  },
  meta: {
    fontSize: 10,
    marginBottom: 10,
    lineHeight: 1.4,
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    borderWidth: 1,
    borderColor: "#000",
    padding: 8,
    flex: 1,
    minHeight: 34,
  },
  cellWide: {
    borderWidth: 1,
    borderColor: "#000",
    padding: 8,
    flex: 1,
  },
  label: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  photos: {
    minHeight: 200,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  photoItem: {
    width: "31%",
    borderWidth: 1,
    borderColor: "#999",
  },
});

const asText = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
};

const parsePhotoUris = (raw: string) => {
  const value = asText(raw).trim();
  if (!value || value === "[]") return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => asText(item).trim()).filter(Boolean);
    }
  } catch {
    // fallback to line-based parsing
  }
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const isRenderableImageUri = (value: string) =>
  /^(https?:|file:|content:|blob:|data:image\/)/i.test(value);

export function SessionReportDocument({ data }: { data: SessionReportPdfData }) {
  const participants =
    typeof data?.participantsCount === "number" && data.participantsCount > 0
      ? String(data.participantsCount)
      : "-";
  const deadline = asText(data?.deadlineLabel).trim() || "último dia da escolinha do mês";
  const photoUris = parsePhotoUris(asText(data?.photos))
    .filter(isRenderableImageUri)
    .slice(0, 6);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>RELATÓRIO ESCOLINHA DE VÔLEI</Text>
        <Text style={styles.meta}>
          Turma: {asText(data?.className) || "-"}{"\n"}
          Unidade: {asText(data?.unitLabel) || "-"}
        </Text>

        <View style={styles.row}>
          <View style={styles.cell}>
            <Text>MÊS: {asText(data?.monthLabel)}</Text>
          </View>
          <View style={styles.cell}>
            <Text>Prazo de entrega: {deadline}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.cellWide}>
            <Text style={styles.label}>Data:</Text>
            <Text>{asText(data?.dateLabel)}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.cellWide}>
            <Text style={styles.label}>Atividade:</Text>
            <Text>{asText(data?.activity) || "-"}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.cellWide}>
            <Text style={styles.label}>Conclusão:</Text>
            <Text>{asText(data?.conclusion) || "-"}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.cellWide}>
            <Text style={styles.label}>Número de participantes:</Text>
            <Text>{participants}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.cellWide, styles.photos]}>
            <Text style={styles.label}>Fotos:</Text>
            {photoUris.length ? (
              <View style={styles.photoGrid}>
                {photoUris.map((uri, index) => (
                  <Image key={`${uri}_${index}`} src={uri} style={styles.photoItem} />
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}

