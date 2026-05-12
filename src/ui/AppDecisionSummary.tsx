import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { AppBadge } from "./AppBadge";
import { AppCard } from "./AppCard";
import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";

export type AppDecisionEvidenceItem = {
  label: string;
  confidence?: string;
  typeLabel?: string;
  confidenceTone?: "muted" | "warning" | "success";
};

export function AppDecisionSummary({
  attentionItems,
  detailTitle = "Motivo",
  evidenceItems,
  focusItems,
  manualOverridePreserved,
  shortReason,
  title = "Foco de hoje",
}: {
  attentionItems?: string[];
  detailTitle?: string;
  evidenceItems?: AppDecisionEvidenceItem[];
  focusItems?: string[];
  manualOverridePreserved?: boolean;
  shortReason?: string;
  title?: string;
}) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const focus = useMemo(() => [...new Set((focusItems ?? []).filter(Boolean))].slice(0, 3), [focusItems]);
  const attention = useMemo(
    () => [...new Set((attentionItems ?? []).filter(Boolean))].slice(0, 2),
    [attentionItems],
  );
  const evidence = useMemo(() => (evidenceItems ?? []).filter((item) => item.label).slice(0, 2), [evidenceItems]);
  const hasDetails = Boolean(shortReason) || evidence.length > 0 || manualOverridePreserved;

  if (!focus.length && !attention.length && !hasDetails) return null;

  return (
    <AppCard compact>
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <View style={{ flex: 1, minWidth: 190, gap: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" }}>
            {title}
          </Text>
          {focus.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {focus.map((item) => (
                <AppBadge key={`decision-focus-${item}`} label={item} tone="neutral" />
              ))}
            </View>
          ) : (
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
              {shortReason || "Manter plano da sessão"}
            </Text>
          )}
        </View>

        {attention.length ? (
          <View style={{ flex: 1, minWidth: 170, gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" }}>
              Atenção
            </Text>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800", lineHeight: 18 }}>
              {attention.join(", ")}
            </Text>
          </View>
        ) : null}
      </View>

      {hasDetails ? (
        <Pressable onPress={() => setExpanded((current) => !current)} style={{ alignSelf: "flex-start" }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
            {expanded ? "Ocultar motivo" : "Ver motivo"}
          </Text>
        </Pressable>
      ) : null}

      {expanded ? (
        <View style={{ gap: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
          {manualOverridePreserved ? (
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
              Plano manual preservado. Sinais aparecem como apoio.
            </Text>
          ) : shortReason ? (
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>{shortReason}</Text>
          ) : null}

          {evidence.length ? (
            <View style={{ gap: 5 }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" }}>
                Base
              </Text>
              {evidence.map((item) => (
                <Text key={`decision-evidence-${item.label}`} style={{ color: colors.muted, fontSize: 11, lineHeight: 15 }}>
                  {`${item.label}${item.confidence ? ` · confiança ${item.confidence}` : ""}`}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </AppCard>
  );
}
