import { compactUiMetrics } from "../../../theme/tokens";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { OperationalText as Text } from "../../../ui/OperationalText";

import { ModalSheet } from "../../../ui/ModalSheet";

export const CLASS_PLAN_PHONE_LAYOUT_MAX_WIDTH = 600;

export const isClassPlanPhoneLayout = (width: number) =>
  width < CLASS_PLAN_PHONE_LAYOUT_MAX_WIDTH;

type ClassPlanModalFrameProps = {
  visible: boolean;
  onClose: () => void;
  borderColor: string;
  children: ReactNode;
  overlayZIndex?: number;
};

export function ClassPlanModalFrame({
  visible,
  onClose,
  borderColor,
  children,
  overlayZIndex = 6000,
}: ClassPlanModalFrameProps) {
  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      position="center"
      overlayZIndex={overlayZIndex}
      containerPadding={8}
      cardStyle={[styles.card, { borderColor }]}
    >
      {children}
    </ModalSheet>
  );
}

type ClassPlanModalHeaderProps = {
  phoneLayout: boolean;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function ClassPlanModalHeader({
  phoneLayout,
  borderColor,
  textColor,
  mutedColor,
  title,
  subtitle,
  children,
}: ClassPlanModalHeaderProps) {
  return (
    <View
      style={[
        styles.header,
        phoneLayout ? styles.headerPhone : null,
        { borderBottomColor: borderColor },
      ]}
    >
      <View style={styles.headerCopy}>
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            phoneLayout ? styles.titlePhone : null,
            { color: textColor },
          ]}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.subtitle,
            phoneLayout ? styles.subtitlePhone : null,
            { color: mutedColor },
          ]}
        >
          {subtitle}
        </Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "94%",
    maxWidth: 1200,
    height: "90%",
    maxHeight: 840,
    borderRadius: 18,
    borderWidth: 1,
    padding: 0,
    paddingBottom: 0,
    marginBottom: 0,
    gap: 0,
    overflow: "hidden",
  },
  header: {
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerPhone: {
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: compactUiMetrics.titleFontSize, fontWeight: "800" },
  titlePhone: { fontSize: compactUiMetrics.titleFontSize },
  subtitle: { marginTop: 3, fontSize: 12 },
  subtitlePhone: { marginTop: 1, fontSize: 11 },
});
