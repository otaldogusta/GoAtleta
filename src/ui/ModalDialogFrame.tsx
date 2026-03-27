import { Ionicons } from "@expo/vector-icons";
import { type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";

import type { ThemeColors } from "./app-theme";
import { ModalSheet } from "./ModalSheet";
import { Pressable } from "./Pressable";

type Props = {
  visible: boolean;
  onClose: () => void;
  cardStyle: object;
  colors: ThemeColors;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  position?: "bottom" | "center";
  contentContainerStyle?: object;
  bodyStyle?: object;
  footerStyle?: object;
};

export function ModalDialogFrame({
  visible,
  onClose,
  cardStyle,
  colors,
  title,
  subtitle,
  children,
  footer,
  position = "center",
  contentContainerStyle,
  bodyStyle,
  footerStyle,
}: Props) {
  return (
    <ModalSheet visible={visible} onClose={onClose} cardStyle={cardStyle} position={position}>
      <View style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>{title}</Text>
            {subtitle ? <Text style={{ color: colors.muted, fontSize: 12 }}>{subtitle}</Text> : null}
          </View>
          <Pressable
            onPress={onClose}
            style={{
              height: 32,
              width: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={[{ flex: 1, minHeight: 0 }, bodyStyle]}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={contentContainerStyle ?? { gap: 12, paddingBottom: 24, paddingTop: 12 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            nestedScrollEnabled
          >
            {children}
          </ScrollView>
        </View>

        {footer ? (
          <View
            style={[
              {
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                gap: 8,
              },
              footerStyle,
            ]}
          >
            {footer}
          </View>
        ) : null}
      </View>
    </ModalSheet>
  );
}
