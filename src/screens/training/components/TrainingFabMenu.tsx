import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Animated, Easing, Text, View } from "react-native";

import { useAppTheme } from "../../../ui/app-theme";
import { Pressable } from "../../../ui/Pressable";

type TrainingFabMenuProps = {
  visible: boolean;
  importBusy?: boolean;
  anchorRight: number;
  anchorBottom: number;
  onClose: () => void;
  onImportPress: () => void;
};

export function TrainingFabMenu({
  visible,
  importBusy = false,
  anchorRight,
  anchorBottom,
  onClose,
  onImportPress,
}: TrainingFabMenuProps) {
  const { colors } = useAppTheme();
  const anim = useRef(new Animated.Value(0)).current;
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
            backgroundColor: "#000",
            opacity: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.08],
            }),
          }}
        />
      </Pressable>

      <Animated.View
        style={{
          position: "absolute",
          right: anchorRight,
          bottom: anchorBottom + 64,
          width: 200,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: 6,
          shadowColor: "#000",
          shadowOpacity: 0.16,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
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
          disabled={importBusy}
          onPress={onImportPress}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            borderRadius: 10,
            paddingHorizontal: 9,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            opacity: importBusy ? 0.65 : 1,
          }}
        >
          <Ionicons name="cloud-upload-outline" size={16} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
            {importBusy ? "Importando..." : "Importar planilha"}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
