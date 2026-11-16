import { View } from "react-native";
import { OperationalText as Text } from "./OperationalText";
import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";

/** The unboxed, centered empty list pattern used by Turmas. */
export function ListEmptyState({ title, description, actionLabel, onAction }: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 24, paddingVertical: 40, gap: 6 }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 12, lineHeight: 18, fontWeight: "600", textAlign: "center" }}>{title}</Text>
      {description ? <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center", maxWidth: 300 }}>{description}</Text> : null}
      {onAction && actionLabel ? <Pressable accessibilityRole="button" onPress={onAction} suppressWebHoverFeedback
        style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center", borderRadius: 8 }}>
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{actionLabel}</Text>
      </Pressable> : null}
    </View>
  );
}
