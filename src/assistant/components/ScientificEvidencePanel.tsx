import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";

export type ScientificEvidenceStatus = "not_needed" | "cache" | "searched" | "fallback" | "quota_exceeded";

export type ScientificReference = {
  id: string;
  title: string;
  author: string;
  url: string;
  doi: string;
  pmid: string;
  year: string;
  method: string;
  population: string;
  supportingExcerpt: string;
  limitations: string[];
};

type Props = {
  references: ScientificReference[];
  status?: ScientificEvidenceStatus;
  onOpenReference: (url: string) => void | Promise<void>;
};

const statusCopy = (status?: ScientificEvidenceStatus) => {
  if (status === "fallback") return "A fonte principal não respondeu; usamos a alternativa científica disponível.";
  if (status === "quota_exceeded") return "A cota externa foi atingida; usamos cache ou fonte alternativa.";
  return "";
};

export function ScientificEvidencePanel({ references, status, onOpenReference }: Props) {
  const { colors } = useAppTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (!references.length) return null;
  const notice = statusCopy(status);

  return (
    <View style={[styles.panel, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={[styles.heading, { color: colors.text }]}>
        Base científica · {references.length} referência{references.length === 1 ? "" : "s"}
      </Text>
      {notice ? <Text style={[styles.notice, { color: colors.muted }]}>{notice}</Text> : null}
      <View style={styles.list}>
        {references.map((reference) => {
          const expanded = expandedId === reference.id;
          return (
            <View key={reference.id} style={[styles.reference, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${expanded ? "Recolher" : "Expandir"} referência ${reference.title}`}
                onPress={() => setExpandedId((current) => current === reference.id ? null : reference.id)}
                style={styles.summaryButton}
              >
                <View style={styles.summaryText}>
                  <Text style={[styles.title, { color: colors.text }]}>{reference.title}</Text>
                  <Text style={[styles.meta, { color: colors.muted }]}>
                    {[reference.author, reference.year].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <GoAtletaIcon name={expanded ? "chevronUp" : "chevronDown"} size={18} color={colors.muted} />
              </Pressable>
              {expanded ? (
                <View style={[styles.details, { borderTopColor: colors.border }]}>
                  {reference.method ? <Detail label="Método" value={reference.method} /> : null}
                  {reference.population ? <Detail label="População" value={reference.population} /> : null}
                  {reference.supportingExcerpt ? <Detail label="Trecho sustentador" value={reference.supportingExcerpt} /> : null}
                  {reference.limitations.length ? <Detail label="Limitações" value={reference.limitations.join("; ")} /> : null}
                  {reference.doi ? <Detail label="DOI" value={reference.doi} /> : null}
                  {reference.pmid ? <Detail label="PMID" value={reference.pmid} /> : null}
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => void onOpenReference(reference.url)}
                    style={styles.linkButton}
                  >
                    <Text style={[styles.link, { color: colors.primaryBg }]}>Abrir referência</Text>
                    <GoAtletaIcon name="link" size={15} color={colors.primaryBg} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.muted }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 14, borderRadius: 18, borderWidth: 1, gap: 8 },
  heading: { fontWeight: "700", fontSize: 15 },
  notice: { fontSize: 12, lineHeight: 17 },
  list: { gap: 8 },
  reference: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  summaryButton: { minHeight: 52, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  summaryText: { flex: 1, gap: 3 },
  title: { fontWeight: "700", lineHeight: 20 },
  meta: { fontSize: 12, lineHeight: 17 },
  details: { borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  detailRow: { gap: 2 },
  detailLabel: { fontSize: 12, fontWeight: "700" },
  detailValue: { fontSize: 13, lineHeight: 19 },
  linkButton: { minHeight: 40, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  link: { fontWeight: "700", textDecorationLine: "underline" },
});
