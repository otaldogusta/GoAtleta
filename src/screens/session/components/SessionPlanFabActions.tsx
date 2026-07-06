import { Animated, Platform, Text, View } from "react-native";

import { Pressable } from "../../../ui/Pressable";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";

type Props = {
  colors: ThemeColors;
  showMenu: boolean;
  planExists: boolean;
  canImportPlan: boolean;
  planFabBottom: number;
  planFabMenuBottom: number;
  animation: Animated.Value;
  startTrainingLabel: string;
  exportLabel: string;
  importPlanLabel: string;
  onCloseMenu: () => void;
  onToggleMenu: () => void;
  onStartTraining: () => void;
  onExportPdf: () => void;
  onImportPlan: () => void;
};

const fixedPosition = (right: number, bottom: number) =>
  Platform.OS === "web"
    ? ({ position: "fixed", right, bottom } as any)
    : ({ position: "absolute", right, bottom } as const);

export function SessionPlanFabActions({
  colors,
  showMenu,
  planExists,
  canImportPlan,
  planFabBottom,
  planFabMenuBottom,
  animation,
  startTrainingLabel,
  exportLabel,
  importPlanLabel,
  onCloseMenu,
  onToggleMenu,
  onStartTraining,
  onExportPdf,
  onImportPlan,
}: Props) {
  return (
    <>
      {showMenu ? (
        <Pressable
          onPress={onCloseMenu}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 3180,
          }}
        />
      ) : null}

      {showMenu ? (
        <View
          style={{
            ...fixedPosition(16, planFabMenuBottom),
            width: 210,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 8,
            gap: 8,
            zIndex: 3190,
          }}
        >
          {planExists ? (
            <Pressable
              onPress={onStartTraining}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.background,
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 9,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <GoAtletaIcon name="playCircle" size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                {startTrainingLabel}
              </Text>
            </Pressable>
          ) : null}

          {planExists ? (
            <Pressable
              onPress={onExportPdf}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.background,
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 9,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <GoAtletaIcon name="download" size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                {exportLabel}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={onImportPlan}
            disabled={!canImportPlan}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 9,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              opacity: canImportPlan ? 1 : 0.65,
            }}
          >
            <GoAtletaIcon name="upload" size={16} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
              {importPlanLabel}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        onPress={onToggleMenu}
        style={{
          ...fixedPosition(16, planFabBottom),
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primaryBg,
          borderWidth: 1,
          borderColor: colors.primaryBg,
          zIndex: 3200,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <Animated.View
          style={{
            transform: [
              {
                rotate: animation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "45deg"],
                }),
              },
              {
                scale: animation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.05],
                }),
              },
            ],
          }}
        >
          <GoAtletaIcon name="add" size={24} color={colors.primaryText} />
        </Animated.View>
      </Pressable>
    </>
  );
}
