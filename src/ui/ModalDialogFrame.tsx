import { type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { OperationalText as Text } from "./OperationalText";

import type { ThemeColors } from "./app-theme";
import { GoAtletaIcon } from "./icon-registry";
import { ModalSheet } from "./ModalSheet";
import { Pressable } from "./Pressable";
import { compactUiMetrics } from "../theme/compact-ui-metrics";

type Props = {
  visible: boolean;
  onClose: () => void;
  cardStyle: object;
  colors: ThemeColors;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  position?: "bottom" | "center" | "right";
  contentContainerStyle?: object;
  bodyStyle?: object;
  footerStyle?: object;
  closeAccessibilityLabel?: string;
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
  closeAccessibilityLabel = "Fechar modal",
}: Props) {
  return (
    <ModalSheet visible={visible} onClose={onClose} cardStyle={cardStyle} position={position}>
      <View style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: compactUiMetrics.gap,
            paddingBottom: compactUiMetrics.gap,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={{ fontSize: compactUiMetrics.titleFontSize, lineHeight: compactUiMetrics.titleLineHeight, fontWeight: "900", color: colors.text }}>{title}</Text>
            {subtitle ? <Text style={{ color: colors.muted, fontSize: compactUiMetrics.metadataFontSize, lineHeight: compactUiMetrics.metadataLineHeight }}>{subtitle}</Text> : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeAccessibilityLabel}
            onPress={onClose}
            style={{
              height: 38,
              width: 38,
              borderRadius: 19,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <GoAtletaIcon name="close" size={compactUiMetrics.iconSize} color={colors.text} />
          </Pressable>
        </View>

        <View style={[{ flex: 1, minHeight: 0 }, bodyStyle]}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={contentContainerStyle ?? { gap: compactUiMetrics.gap, paddingBottom: 12, paddingTop: 8 }}
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
                paddingTop: 8,
                paddingBottom: 8,
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
