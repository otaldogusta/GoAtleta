import { Text, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";
import { Button } from "../../ui/Button";

export type DecisionPageHeaderProps = {
  actionLabel?: string;
  badge?: string;
  classMeta?: React.ReactNode;
  onAction?: () => void;
  subtitle: string;
  title: string;
};

export function DecisionPageHeader({
  actionLabel,
  classMeta,
  onAction,
  subtitle,
  title,
}: DecisionPageHeaderProps) {
  const { colors } = useAppTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <View style={{ flex: 1, minWidth: 280, gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 14 }}>{subtitle}</Text>
      </View>
      <View style={{ minWidth: 220, alignItems: "flex-end", gap: 10 }}>
        {classMeta}
        {actionLabel && onAction ? (
          <View style={{ width: 200 }}>
            <Button label={actionLabel} onPress={onAction} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
