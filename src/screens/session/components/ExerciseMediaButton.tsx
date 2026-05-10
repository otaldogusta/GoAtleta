import { Alert, Image, Linking, Text, View } from "react-native";

import type { ExerciseMediaAsset } from "../../../exercise-media/exercise-media.types";
import type { ThemeColors } from "../../../ui/app-theme";
import { Pressable } from "../../../ui/Pressable";

type Props = {
  asset: ExerciseMediaAsset | null;
  colors: ThemeColors;
  compact?: boolean;
};

async function openExerciseMedia(uri: string) {
  try {
    await Linking.openURL(uri);
  } catch {
    Alert.alert("Demonstração", "Não foi possível abrir a demonstração.");
  }
}

export function ExerciseMediaButton({ asset, colors, compact = false }: Props) {
  if (!asset) {
    return null;
  }

  const thumbnailSize = compact ? 28 : 36;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        void openExerciseMedia(asset.uri);
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 8,
        paddingHorizontal: compact ? 10 : 12,
        paddingVertical: compact ? 6 : 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.secondaryBg,
      }}
    >
      {asset.thumbnailUri ? (
        <Image
          source={{ uri: asset.thumbnailUri }}
          style={{
            width: thumbnailSize,
            height: thumbnailSize,
            borderRadius: 8,
            backgroundColor: colors.thumbFallback,
          }}
        />
      ) : (
        <View
          style={{
            width: thumbnailSize,
            height: thumbnailSize,
            borderRadius: 8,
            backgroundColor: colors.thumbFallback,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>
            Demo
          </Text>
        </View>
      )}
      <Text
        style={{
          color: colors.text,
          fontSize: compact ? 12 : 13,
          fontWeight: "700",
        }}
      >
        Ver demonstração
      </Text>
    </Pressable>
  );
}
