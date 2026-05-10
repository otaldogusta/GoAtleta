import { Text, View } from "react-native";
import type { ThemeColors } from "../../../ui/app-theme";
import { getSectionCardStyle } from "../../../ui/section-styles";

type TeamPlanningContextSummaryProps = {
  colors: ThemeColors;
  planningModeLabel: string;
  loadBiasLabel: string;
  focusHints: string[];
  avoidHints: string[];
  reason: string;
};

export function TeamPlanningContextSummary({
  colors,
  planningModeLabel,
  loadBiasLabel,
  focusHints,
  avoidHints,
  reason,
}: TeamPlanningContextSummaryProps) {
  return (
    <View style={[getSectionCardStyle(colors, "primary", { radius: 18 }), { gap: 12 }]}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>
          Resumo do contexto
        </Text>
        <Text style={{ fontSize: 13, color: colors.muted }}>
          O que a turma pede agora, antes de mexer no motor de geração.
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: colors.secondaryBg,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
            Modo: {planningModeLabel}
          </Text>
        </View>
        <View
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: colors.secondaryBg,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
            Carga sugerida: {loadBiasLabel}
          </Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
            Focos sugeridos
          </Text>
          {focusHints.length ? (
            focusHints.map((item) => (
              <Text key={item} style={{ fontSize: 13, color: colors.text }}>
                • {item}
              </Text>
            ))
          ) : (
            <Text style={{ fontSize: 13, color: colors.muted }}>
              Nenhum foco adicional além do ciclo normal.
            </Text>
          )}
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
            Evitar
          </Text>
          {avoidHints.length ? (
            avoidHints.map((item) => (
              <Text key={item} style={{ fontSize: 13, color: colors.text }}>
                • {item}
              </Text>
            ))
          ) : (
            <Text style={{ fontSize: 13, color: colors.muted }}>
              Nenhum alerta específico no momento.
            </Text>
          )}
        </View>
      </View>

      <View
        style={{
          padding: 12,
          borderRadius: 14,
          backgroundColor: colors.secondaryBg,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>Motivo</Text>
        <Text style={{ fontSize: 13, color: colors.text, marginTop: 4 }}>{reason}</Text>
      </View>
    </View>
  );
}
