import { Text, View } from "react-native";

import type { ThemeColors } from "../../../ui/app-theme";
import { Pressable } from "../../../ui/Pressable";

type StudentDuplicateBadgeProps = {
  colors: ThemeColors;
  onPress: () => void;
};

export function StudentDuplicateBadge({ colors, onPress }: StudentDuplicateBadgeProps) {
  return (
    <Pressable
      accessibilityLabel="Revisar nome repetido"
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        backgroundColor: colors.warningBg,
        paddingHorizontal: 7,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color: colors.warningText, fontSize: 10, fontWeight: "700" }}>
        Nome repetido
      </Text>
    </Pressable>
  );
}

type StudentDuplicateReviewPromptProps = {
  colors: ThemeColors;
  studentName: string;
  onReview: () => void;
  onKeep: () => void;
};

export function StudentDuplicateReviewPrompt({
  colors,
  studentName,
  onReview,
  onKeep,
}: StudentDuplicateReviewPromptProps) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Nome repetido</Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 13 }}>
          {studentName}
        </Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
        Manter os dois cadastros?
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
        <Pressable
          onPress={onReview}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            backgroundColor: colors.card,
            paddingHorizontal: 14,
            paddingVertical: 9,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>Revisar</Text>
        </Pressable>
        <Pressable
          onPress={onKeep}
          style={{
            borderWidth: 1,
            borderColor: colors.primaryBg,
            borderRadius: 10,
            backgroundColor: colors.primaryBg,
            paddingHorizontal: 14,
            paddingVertical: 9,
          }}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "700" }}>Manter</Text>
        </Pressable>
      </View>
    </View>
  );
}
