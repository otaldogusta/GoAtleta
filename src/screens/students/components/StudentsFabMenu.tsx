import { useEffect, useState } from "react";
import { Animated, Easing, Platform, Text, View } from "react-native";

import { useAppTheme } from "../../../ui/app-theme";
import { Pressable } from "../../../ui/Pressable";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { brandPalette, radius, shadow } from "../../../theme/tokens";

type StudentsFabMenuProps = {
  visible: boolean;
  exportBusy?: boolean;
  anchorRight: number;
  anchorBottom: number;
  onClose: () => void;
  onSyncFormsPress: () => void;
  onImportPress: () => void;
  onExportPress: () => void;
};

export function StudentsFabMenu({
  visible,
  exportBusy = false,
  anchorRight,
  anchorBottom,
  onClose,
  onSyncFormsPress,
  onImportPress,
  onExportPress,
}: StudentsFabMenuProps) {
  const { colors } = useAppTheme();
  const [anim] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    if (!mounted) return;
    Animated.timing(anim, {
      toValue: 0,
      duration: 140,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [anim, mounted, visible]);

  if (!mounted) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 3190,
      }}
    >
      <Pressable
        onPress={onClose}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: "transparent",
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: brandPalette.navyDeep,
            opacity: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.08],
            }),
          }}
        />
      </Pressable>

      <Animated.View
        style={{
          ...(Platform.OS === "web"
            ? ({ position: "fixed", right: anchorRight, bottom: anchorBottom + 64 } as any)
            : { position: "absolute" as const, right: anchorRight, bottom: anchorBottom + 64 }),
          width: 188,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: 6,
          gap: 6,
          ...shadow.card,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1],
              }),
            },
          ],
        }}
      >
        <Pressable
          onPress={onSyncFormsPress}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            borderRadius: radius.internal,
            paddingHorizontal: 9,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <GoAtletaIcon name="sync" size={16} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
            Sincronizar Forms
          </Text>
        </Pressable>

        <Pressable
          onPress={onImportPress}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            borderRadius: radius.internal,
            paddingHorizontal: 9,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <GoAtletaIcon name="upload" size={16} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
            Importar planilha
          </Text>
        </Pressable>

        <Pressable
          disabled={exportBusy}
          onPress={onExportPress}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            borderRadius: radius.internal,
            paddingHorizontal: 9,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            opacity: exportBusy ? 0.65 : 1,
          }}
        >
          <GoAtletaIcon name="download" size={16} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
            {exportBusy ? "Exportando..." : "Exportar XLSX"}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
