import type { ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { Button } from "./Button";
import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";

export function AppPageHeader({
  actionLabel,
  badge,
  onBack,
  meta,
  onAction,
  subtitle,
  title,
}: {
  actionLabel?: string;
  badge?: ReactNode;
  onBack?: () => void;
  meta?: ReactNode;
  onAction?: () => void;
  subtitle?: string;
  title: string;
}) {
  const { colors } = useAppTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      <View style={{ flex: 1, minWidth: 260, gap: 5 }}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginLeft: -8,
              paddingRight: 8,
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </View>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>{title}</Text>
            {badge}
          </Pressable>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>{title}</Text>
            {badge}
          </View>
        )}
        {subtitle ? <Text style={{ color: colors.muted, fontSize: 13 }}>{subtitle}</Text> : null}
      </View>
      {meta || (actionLabel && onAction) ? (
        <View
          style={{
            alignItems: "flex-end",
            gap: 8,
            flexShrink: 1,
            minWidth: actionLabel && onAction ? 180 : 0,
            maxWidth: "100%",
          }}
        >
          {meta}
          {actionLabel && onAction ? (
            <View style={{ minWidth: 180 }}>
              <Button label={actionLabel} onPress={onAction} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
