import { Linking, Text, View } from "react-native";

import type { InsightsView } from "../CopilotProvider";
import type { RegulationUpdate } from "../../api/regulation-updates";
import { Pressable } from "../../ui/Pressable";

const regulationDateLabel = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Date(parsed).toLocaleDateString("pt-BR");
};

type Colors = {
  border: string;
  background: string;
  secondaryBg: string;
  text: string;
  muted: string;
  primaryBg: string;
  primaryText: string;
  card: string;
  inputBg: string;
  dangerText: string;
  warningText: string;
};

type CopilotRegulationDetailViewProps = {
  colors: Colors;
  insightsView: InsightsView;
  detailRegulationUpdate: RegulationUpdate | null;
  onNavigateToImpactAction: (route: string) => void;
};

export function CopilotRegulationDetailView({
  colors,
  insightsView,
  detailRegulationUpdate,
  onNavigateToImpactAction,
}: CopilotRegulationDetailViewProps) {
  if (
    insightsView.mode !== "detail" ||
    insightsView.category !== "regulation" ||
    !detailRegulationUpdate
  ) {
    return null;
  }

  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: 12,
          gap: 6,
        }}
      >
        <Text style={{ color: colors.primaryBg, fontWeight: "800", fontSize: 11 }}>
          {detailRegulationUpdate.sourceAuthority}
        </Text>
        <Text style={{ color: colors.text, fontWeight: "800" }}>
          {detailRegulationUpdate.title}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {detailRegulationUpdate.diffSummary}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>
          Publicado em {regulationDateLabel(detailRegulationUpdate.publishedAt ?? detailRegulationUpdate.createdAt)}
        </Text>
        {detailRegulationUpdate.changedTopics.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {detailRegulationUpdate.changedTopics.map((topic) => (
              <View
                key={`${detailRegulationUpdate.id}_${topic}`}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>
                  {topic}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {detailRegulationUpdate.impactAreas.length ? (
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            Impacto: {detailRegulationUpdate.impactAreas.join(", ")}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={() => {
          if (!detailRegulationUpdate.sourceUrl) return;
          void Linking.openURL(detailRegulationUpdate.sourceUrl);
        }}
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.primaryBg,
          backgroundColor: colors.secondaryBg,
          paddingVertical: 11,
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "800" }}>Ver fonte</Text>
      </Pressable>

      {detailRegulationUpdate.impactActions.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {detailRegulationUpdate.impactActions.map((action) => (
            <Pressable
              key={`${detailRegulationUpdate.id}_${action.route}`}
              onPress={() => {
                onNavigateToImpactAction(action.route);
              }}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
