import { Text, useWindowDimensions, View } from "react-native";

import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";

type AppColors = ReturnType<typeof useAppTheme>["colors"];

export type ClassRadarItem = {
  classId: string;
  className: string;
  unit: string;
  radarScore: number;
  trendLabel: "subindo" | "estavel" | "queda";
  alerts: string[];
  nextTrainingPrompt: string;
  logsCount: number;
};

type ClassRadarPanelProps = {
  colors: AppColors;
  loading: boolean;
  items: ClassRadarItem[];
  onCopyPrompt: (item: ClassRadarItem) => void;
};

export function ClassRadarPanel({ colors, loading, items, onCopyPrompt }: ClassRadarPanelProps) {
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 430;

  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: isCompactLayout ? 12 : 16,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", flex: 1 }}>
          Radar IA por turma
        </Text>
        <View
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
            {loading ? "..." : items.length}
          </Text>
        </View>
      </View>

      {loading ? (
        <Text style={{ color: colors.muted }}>Carregando radar...</Text>
      ) : items.length === 0 ? (
        <Text style={{ color: colors.muted }}>
          Sem turmas com leitura recente. Registre sessões para liberar o radar determinístico.
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          {items.map((item) => (
            <View
              key={item.classId}
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
                padding: isCompactLayout ? 10 : 12,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>{item.className}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                  {(item.radarScore * 100).toFixed(0)}% • {item.trendLabel}
                </Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {item.unit || "Sem unidade"} • Sessões analisadas: {item.logsCount}
              </Text>
              {item.alerts.length > 0 ? (
                <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>
                  Alerta: {item.alerts[0]}
                </Text>
              ) : null}
              <Pressable
                onPress={() => onCopyPrompt(item)}
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                  Copiar prompt próximo treino
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
