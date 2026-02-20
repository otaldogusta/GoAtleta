import { Text, useWindowDimensions, View } from "react-native";

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
};

const trendCopy: Record<ClassRadarItem["trendLabel"], string> = {
  subindo: "Em alta",
  estavel: "Estavel",
  queda: "Em queda",
};

export function ClassRadarPanel({ colors, loading, items }: ClassRadarPanelProps) {
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
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>Radar por turma</Text>

      {loading ? (
        <Text style={{ color: colors.muted }}>Carregando radar...</Text>
      ) : items.length === 0 ? (
        <Text style={{ color: colors.muted }}>Sem dados suficientes para radar neste momento.</Text>
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
                  {(item.radarScore * 100).toFixed(0)}% - {trendCopy[item.trendLabel]}
                </Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{item.unit || "Sem unidade"}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
                {item.alerts[0] || "Sem alertas relevantes no momento."}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
