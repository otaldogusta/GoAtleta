import { useState } from "react";
import { ScrollView, View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";

import { useRole } from "../../auth/role";
import { compactUiMetrics as metrics, radius } from "../../theme/tokens";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";

export function FamilyStudentSwitcher() {
  const { colors } = useAppTheme();
  const layout = useResponsiveLayout("dashboard");
  const padding = layout.density.cardPadding;
  const {
    familyContexts,
    selectedFamilyStudent,
    setActiveFamilyStudent,
  } = useRole();
  const [open, setOpen] = useState(false);

  if (!selectedFamilyStudent) {
    return (
      <View
        style={{
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize }}>
          Nenhum atleta vinculado a esta conta.
        </Text>
      </View>
    );
  }

  const content = (
    <>
      <View
        style={{
          width: metrics.controlHeight,
          height: metrics.controlHeight,
          borderRadius: radius.full,
          backgroundColor: colors.successBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <GoAtletaIcon name="student" size={metrics.iconSize} color={colors.successText} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: metrics.gap }}>
          <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, color: colors.text, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight, fontWeight: "700" }}>
            {selectedFamilyStudent.studentName}
          </Text>
          <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight }}>{selectedFamilyStudent.relationshipLabel}</Text>
        </View>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight }}>
          {selectedFamilyStudent.organizationName}
          {selectedFamilyStudent.className ? ` · ${selectedFamilyStudent.className}` : ""}
        </Text>
      </View>
      {familyContexts.length > 1 ? (
        <GoAtletaIcon name="chevronDown" size={metrics.secondaryIconSize} color={colors.muted} />
      ) : null}
    </>
  );

  return (
    <>
      {familyContexts.length > 1 ? (
        <Pressable
          accessibilityLabel="Trocar atleta acompanhado"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(true)}
          suppressWebHoverFeedback disableWebPressScale
          style={state => ({
            minHeight: metrics.touchTarget,
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: state.pressed || Boolean((state as { hovered?: boolean }).hovered) ? colors.borderStrong : colors.border,
            backgroundColor: colors.card,
            paddingHorizontal: padding,
            paddingVertical: metrics.smallGap,
            flexDirection: "row",
            alignItems: "center",
            gap: metrics.gap,
          })}
        >
          {content}
        </Pressable>
      ) : (
        <View
          style={{
            minHeight: metrics.touchTarget,
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            paddingHorizontal: padding,
            paddingVertical: metrics.smallGap,
            flexDirection: "row",
            alignItems: "center",
            gap: metrics.gap,
          }}
        >
          {content}
        </View>
      )}

      <ModalSheet
        visible={open}
        onClose={() => setOpen(false)}
        position="center"
        cardStyle={{
          width: "100%",
          maxWidth: 440,
          maxHeight: "78%",
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding,
          gap: metrics.gap,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: metrics.gap }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.text, fontSize: metrics.titleFontSize, fontWeight: "800" }}>
              Trocar atleta
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Fechar"
            onPress={() => setOpen(false)}
            disableWebPressScale
            style={{
              width: 38,
              height: 38,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GoAtletaIcon name="close" size={metrics.iconSize} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: metrics.smallGap }}>
          {familyContexts.map((context) => {
            const selected = context.studentId === selectedFamilyStudent.studentId;
            return (
              <Pressable
                key={context.relationshipId}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  void setActiveFamilyStudent(context.studentId).then((changed) => {
                    if (changed) setOpen(false);
                  });
                }}
                suppressWebHoverFeedback disableWebPressScale
                style={state => ({
                  minHeight: metrics.touchTarget,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: selected ? colors.successBorder : state.pressed || Boolean((state as { hovered?: boolean }).hovered) ? colors.borderStrong : "transparent",
                  backgroundColor: selected ? colors.successBg : state.pressed || Boolean((state as { hovered?: boolean }).hovered) ? colors.secondaryBg : "transparent",
                  paddingHorizontal: metrics.gap,
                  paddingVertical: metrics.smallGap,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: metrics.gap,
                })}
              >
                <GoAtletaIcon name="student" size={metrics.iconSize} color={selected ? colors.successText : colors.text} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: metrics.bodyFontSize, fontWeight: "800" }}>
                    {context.studentName}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: metrics.metadataFontSize, marginTop: 2 }}>
                    {context.organizationName}
                  </Text>
                </View>
                {selected ? (
                  <GoAtletaIcon name="checkmarkCircle" size={metrics.iconSize} color={colors.successText} />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </ModalSheet>
    </>
  );
}
