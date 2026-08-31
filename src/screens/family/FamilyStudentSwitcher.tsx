import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { useRole } from "../../auth/role";
import { radius, spacing } from "../../theme/tokens";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";

export function FamilyStudentSwitcher() {
  const { colors } = useAppTheme();
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
          padding: spacing.md,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          Nenhum atleta vinculado a esta conta.
        </Text>
      </View>
    );
  }

  const content = (
    <>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.full,
          backgroundColor: colors.successBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <GoAtletaIcon name="student" size={20} color={colors.successText} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
          {selectedFamilyStudent.studentName}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
          {selectedFamilyStudent.organizationName}
          {selectedFamilyStudent.className ? ` · ${selectedFamilyStudent.className}` : ""}
        </Text>
      </View>
      {familyContexts.length > 1 ? (
        <GoAtletaIcon name="chevronDown" size={18} color={colors.muted} />
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
          style={{
            minHeight: 58,
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            paddingHorizontal: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          {content}
        </Pressable>
      ) : (
        <View
          style={{
            minHeight: 58,
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            paddingHorizontal: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
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
          padding: spacing.md,
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
              Trocar atleta
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
              Selecione quem você quer acompanhar.
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Fechar"
            onPress={() => setOpen(false)}
            style={{
              width: 38,
              height: 38,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GoAtletaIcon name="close" size={21} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
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
                style={{
                  minHeight: 58,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: selected ? colors.primaryBg : colors.border,
                  backgroundColor: selected ? colors.successBg : colors.secondaryBg,
                  paddingHorizontal: spacing.sm,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <GoAtletaIcon name="student" size={19} color={selected ? colors.successText : colors.text} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "800" }}>
                    {context.studentName}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    {context.organizationName}
                  </Text>
                </View>
                {selected ? (
                  <GoAtletaIcon name="checkmarkCircle" size={19} color={colors.successText} />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </ModalSheet>
    </>
  );
}
