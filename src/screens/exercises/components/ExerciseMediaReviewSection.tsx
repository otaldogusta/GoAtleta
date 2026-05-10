import { Pressable, Text, View } from "react-native";

import type { ExerciseMediaAsset } from "../../../exercise-media/exercise-media.types";
import type { ThemeColors } from "../../../ui/app-theme";
import { ExerciseMediaPreviewCard } from "./ExerciseMediaPreviewCard";

type Props = {
  colors: ThemeColors;
  title: string;
  subtitle?: string;
  emptyMessage: string;
  items: ExerciseMediaAsset[];
  onView: (asset: ExerciseMediaAsset) => void;
  onApprove?: (asset: ExerciseMediaAsset) => void;
  onArchive: (asset: ExerciseMediaAsset) => void;
  pills?: Array<{ label: string; active?: boolean }>;
  compactCards?: boolean;
};

export function ExerciseMediaReviewSection({
  colors,
  title,
  subtitle,
  emptyMessage,
  items,
  onView,
  onApprove,
  onArchive,
  pills,
  compactCards,
}: Props) {
  return (
    <View
      style={{
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        gap: 14,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
          {title}
        </Text>
        {subtitle ? <Text style={{ color: colors.muted }}>{subtitle}</Text> : null}
      </View>

      {pills?.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {pills.map((pill) => (
            <View
              key={pill.label}
              style={{
                paddingVertical: 7,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: pill.active ? colors.primaryBg : colors.secondaryBg,
              }}
            >
              <Text
                style={{
                  color: pill.active ? colors.primaryText : colors.muted,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {pill.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {items.length ? (
        items.map((asset) => (
          <ExerciseMediaPreviewCard
            key={asset.id}
            asset={asset}
            colors={colors}
            statusLabel={asset.status === "approved" ? "Aprovado" : "Pendente"}
            compact={compactCards}
            actions={
              <>
                {onApprove ? (
                  <Pressable
                    onPress={() => onApprove(asset)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      backgroundColor: colors.primaryBg,
                    }}
                  >
                    <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 12 }}>
                      Aprovar
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={() => onArchive(asset)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: colors.dangerBg,
                    borderWidth: 1,
                    borderColor: colors.dangerBorder,
                  }}
                  >
                  <Text style={{ color: colors.dangerText, fontWeight: "700", fontSize: 12 }}>
                    Arquivar
                  </Text>
                </Pressable>
              </>
            }
          />
        ))
      ) : (
        <Text style={{ color: colors.muted }}>{emptyMessage}</Text>
      )}
    </View>
  );
}
