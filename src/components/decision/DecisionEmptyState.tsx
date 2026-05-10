import { Text, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";
import { Button } from "../../ui/Button";
import { getSectionCardStyle } from "../../ui/section-styles";

export function DecisionEmptyState({
  actionLabel,
  description,
  onAction,
  title,
}: {
  actionLabel?: string;
  description: string;
  onAction?: () => void;
  title: string;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={[getSectionCardStyle(colors, "neutral", { radius: 16, shadow: false }), { gap: 8 }]}>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>{title}</Text>
      <Text style={{ color: colors.muted }}>{description}</Text>
      {actionLabel && onAction ? (
        <View style={{ alignSelf: "flex-start" }}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}
