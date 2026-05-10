import { Text, View } from "react-native";

import type { ScoutingAction } from "../../../core/scouting-action";
import { getDominantStrengths, getDominantWeaknesses, summarizeScoutingActionsByAthlete } from "../../../core/scouting-action";
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
  const byAthlete = summarizeScoutingActionsByAthlete(actions);
  const strengths = getDominantStrengths(actions);
  const weaknesses = getDominantWeaknesses(actions);

  return (
    <>
      <View style={[getSectionCardStyle(colors, "neutral", { radius: 18, padding: 14, shadow: false }), { gap: 8 }]}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Resumo</Text>
        <SummaryRow label="Ações" value={String(actions.length)} />
        <SummaryRow label="Atletas" value={String(byAthlete.length)} />
        <SummaryRow label="Ponto forte" value={strengths[0] || "—"} />
        <SummaryRow label="Atenção" value={weaknesses[0] || "—"} />
      </View>

      <View style={[getSectionCardStyle(colors, "neutral", { radius: 18, padding: 14, shadow: false }), { gap: 8 }]}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Sinais para o treino</Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Aparecem quando houver dados suficientes.</Text>
        {!weaknesses.length ? (
          <Text style={{ color: colors.muted }}>Sem sinais suficientes ainda.</Text>
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
        {!byAthlete.length ? (
          <Text style={{ color: colors.muted }}>Sem leitura individual ainda.</Text>
        ) : (
          byAthlete.slice(0, 3).map((item) => (
            <View key={item.athleteName} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{item.athleteName}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, flexShrink: 1, textAlign: "right" }}>
                {item.weaknesses[0] || item.strengths[0] || "Sem recorte"}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={[getSectionCardStyle(colors, "neutral", { radius: 18, padding: 14, shadow: false }), { gap: 8 }]}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Vídeo</Text>
        <Text style={{ color: colors.muted }}>
          A marcação temporal entra no próximo pacote. O fluxo de quadra segue sem depender disso agora.
        </Text>
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
