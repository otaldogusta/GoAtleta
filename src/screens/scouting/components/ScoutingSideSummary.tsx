import { Text, View } from "react-native";

import type { ScoutingAction } from "../../../core/scouting-action";
import {
  getAthletesInFocus,
  getAthletesNeedingAttention,
  getDominantStrengths,
  getDominantWeaknesses,
  summarizeScoutingActionsByAthleteDetailed,
} from "../../../core/scouting-action";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { getSectionCardStyle } from "../../../ui/section-styles";

export function ScoutingSideSummary({
  actions,
  onOpenLegacy,
}: {
  actions: ScoutingAction[];
  onOpenLegacy?: () => void;
}) {
  const { colors } = useAppTheme();
  const byAthlete = summarizeScoutingActionsByAthleteDetailed(actions);
  const athletesInFocus = getAthletesInFocus(actions);
  const athletesNeedingAttention = getAthletesNeedingAttention(actions);
  const strengths = getDominantStrengths(actions);
  const weaknesses = getDominantWeaknesses(actions);
  const hasActions = actions.length > 0;
  const athletesPreview = [...athletesNeedingAttention, ...athletesInFocus]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.athleteName === item.athleteName) === index)
    .slice(0, 3);

  return (
    <>
      <View style={[getSectionCardStyle(colors, "neutral", { radius: 18, padding: 14, shadow: false }), { gap: 8 }]}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Resumo</Text>
        {!hasActions ? (
          <Text style={{ color: colors.muted, fontSize: 13 }}>0 ações · 0 atletas</Text>
        ) : (
          <>
            <SummaryRow label="Ações" value={String(actions.length)} />
            <SummaryRow label="Atletas" value={String(byAthlete.length)} />
            <SummaryRow label="Ponto forte" value={strengths[0] || "—"} />
            <SummaryRow label="Atenção" value={weaknesses[0] || "—"} />
          </>
        )}
      </View>

      <View style={[getSectionCardStyle(colors, "neutral", { radius: 18, padding: 14, shadow: false }), { gap: 8 }]}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Sinais para o treino</Text>
        {!weaknesses.length ? (
          <Text style={{ color: colors.muted, fontSize: 13 }}>Aguardando dados</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {weaknesses.slice(0, 3).map((item) => (
              <View
                key={item}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: colors.successBg,
                }}
              >
                <Text style={{ color: colors.successText, fontWeight: "700", fontSize: 12 }}>{item}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={[getSectionCardStyle(colors, "neutral", { radius: 18, padding: 14, shadow: false }), { gap: 8 }]}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Atletas em destaque</Text>
        {!athletesPreview.length ? (
          <Text style={{ color: colors.muted, fontSize: 13 }}>Aguardando ações individuais</Text>
        ) : (
          athletesPreview.map((item) => (
            <View key={item.athleteName} style={{ gap: 3 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{item.athleteName}</Text>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>
                  média {item.averageScore.toFixed(1)}
                </Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {item.weakestSkill
                  ? `Atenção: ${item.weakestSkill}`
                  : item.strongestSkill
                    ? `Ponto forte: ${item.strongestSkill}`
                    : item.attentionPoints[0] || item.strengths[0] || "Aguardando mais ações"}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={[getSectionCardStyle(colors, "neutral", { radius: 18, padding: 14, shadow: false }), { gap: 8 }]}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Vídeo</Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Preparado para marcação temporal futura.</Text>
      </View>

      {onOpenLegacy ? (
        <View style={{ alignItems: "flex-start" }}>
          <Pressable onPress={onOpenLegacy}>
            <Text style={{ color: colors.muted, fontWeight: "700" }}>Mais opções · Abrir legado</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ color: colors.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13, flexShrink: 1, textAlign: "right" }}>{value}</Text>
    </View>
  );
}
