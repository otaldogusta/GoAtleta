import { Text, View } from "react-native";

import { Button } from "./Button";
import { useAppTheme } from "./app-theme";

export function AppEmptyState({
  actionLabel,
  description,
  onAction,
  title,
}: {
  actionLabel?: string;
  description?: string;
  onAction?: () => void;
  title: string;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={{ gap: 8, paddingVertical: 4 }}>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{title}</Text>
      {description ? (
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ alignSelf: "flex-start", minWidth: 160 }}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
