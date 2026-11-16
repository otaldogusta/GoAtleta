import { memo } from "react";
import { professorShortcuts } from "./professor-shortcuts";
import { coordinationShortcuts } from "./coordination-shortcuts";

import { Platform, View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";

import { useRouter } from "expo-router";

import { navigateToPrimaryRoute } from "../../navigation/primary-route-navigation";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { compactUiMetrics as metrics } from "../../theme/tokens";

type HomeProfessorBelowFoldProps = {
  variant?: "professor" | "coordination";
  mobile?: boolean;
  canOpenClassesShortcut: boolean;
  canOpenStudentsShortcut: boolean;
  canOpenTrainingShortcut: boolean;
  canOpenCalendarShortcut: boolean;
  canOpenAbsenceNoticesShortcut: boolean;
  canOpenPeriodizationShortcut: boolean;
  canOpenRegulationHistoryShortcut: boolean;
  canOpenAssistantShortcut: boolean;
};

type ShortcutCardProps = {
  label: string;
  description: string;
  icon: GoAtletaIconName;
  onPress: () => void;
  mobile: boolean;
};

function ShortcutCard({ label, description, icon, onPress, mobile }: ShortcutCardProps) {
  const { colors, mode } = useAppTheme();
  const isAndroidLight = Platform.OS === "android" && mode === "light";

  const shortcutCardSurfaceStyle = isAndroidLight
    ? ({
        backgroundColor: "#f8fafc",
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(15,23,42,0.06)",
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      } as const)
    : ({
        backgroundColor: colors.secondaryBg,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOpacity: mode === "dark" ? 0.08 : 0.03,
        shadowRadius: mode === "dark" ? 6 : 3,
        shadowOffset: { width: 0, height: 2 },
        elevation: mode === "dark" ? 2 : 1,
      } as const);

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexBasis: mobile ? 150 : 200,
        flexGrow: 1,
        minWidth: 0,
        minHeight: 52,
        padding: mobile ? 8 : 10,
        borderRadius: 12,
        ...shortcutCardSurfaceStyle,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: mobile ? 8 : 10 }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            backgroundColor: colors.secondaryBg,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <GoAtletaIcon name={icon} size={metrics.iconSize} color={colors.text} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: metrics.bodyFontSize,
              lineHeight: metrics.bodyLineHeight,
              fontWeight: "700",
              color: colors.text,
            }}
            numberOfLines={mobile ? 2 : 1}
          >
            {label}
          </Text>
          <Text
            style={{
              color: colors.muted,
              marginTop: 2,
              fontSize: metrics.metadataFontSize,
              lineHeight: metrics.metadataLineHeight,
            }}
            numberOfLines={mobile ? 2 : 1}
          >
            {description}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function HomeProfessorBelowFoldBase({
  variant = "professor",
  mobile = false,
  canOpenClassesShortcut,
  canOpenStudentsShortcut,
  canOpenTrainingShortcut,
  canOpenCalendarShortcut,
  canOpenAbsenceNoticesShortcut,
  canOpenPeriodizationShortcut,
  canOpenRegulationHistoryShortcut,
  canOpenAssistantShortcut,
}: HomeProfessorBelowFoldProps) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const navigateToShortcut = (href: string) =>
    navigateToPrimaryRoute({ router, href });

  const professorShortcutAccess = {
    canOpenClassesShortcut,
    canOpenStudentsShortcut,
    canOpenTrainingShortcut,
    canOpenCalendarShortcut,
    canOpenAbsenceNoticesShortcut,
    canOpenPeriodizationShortcut,
    canOpenAssistantShortcut,
    canOpenRegulationHistoryShortcut,
  };

  if (variant === "coordination") {
    return (
      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Atalhos</Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {coordinationShortcuts.map((shortcut) => (
            <ShortcutCard
              key={shortcut.route}
              label={shortcut.label}
              description={shortcut.description}
              icon={shortcut.icon}
              mobile={mobile}
              onPress={() => navigateToShortcut(shortcut.route)}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Atalhos</Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {professorShortcuts.filter(({ gate }) => professorShortcutAccess[gate]).map((shortcut) => (
          <ShortcutCard
            key={shortcut.route}
            label={shortcut.label}
            description={shortcut.description}
            icon={shortcut.icon}
            mobile={mobile}
            onPress={() => navigateToShortcut(shortcut.route)}
          />
        ))}
      </View>
    </View>
  );
}

export const HomeProfessorBelowFold = memo(HomeProfessorBelowFoldBase);
HomeProfessorBelowFold.displayName = "HomeProfessorBelowFold";
