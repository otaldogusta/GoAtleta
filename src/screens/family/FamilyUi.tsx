import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { radius, spacing } from "../../theme/tokens";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";

export function FamilySurface({
  title,
  eyebrow,
  children,
}: {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        width: "100%",
        borderRadius: radius.container,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      {eyebrow ? (
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
          {eyebrow.toUpperCase()}
        </Text>
      ) : null}
      {title ? (
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function FamilyEmptyState({
  icon = "family",
  title,
  description,
  action,
}: {
  icon?: GoAtletaIconName;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        width: "100%",
        minHeight: 220,
        borderRadius: radius.container,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: spacing.xl,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: radius.full,
          backgroundColor: colors.successBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <GoAtletaIcon name={icon} size={22} color={colors.successText} />
      </View>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800", textAlign: "center" }}>
        {title}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", maxWidth: 460 }}>
        {description}
      </Text>
      {action}
    </View>
  );
}
