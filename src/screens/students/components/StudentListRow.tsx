import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Text, View } from "react-native";

import type { Student } from "../../../core/models";
import type { deriveStudentHealthAssessment } from "../../../core/student-health";
import { FadeHorizontalScroll } from "../../../ui/FadeHorizontalScroll";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme, type ThemeColors } from "../../../ui/app-theme";
import { getContactPhone } from "../../../utils/whatsapp";

type StudentListRowProps = {
  student: Student;
  classPalette: { bg: string; text: string };
  healthAssessment: ReturnType<typeof deriveStudentHealthAssessment>;
  hasBirthDateWarning: boolean;
  onPress: (student: Student) => void;
  onWhatsApp: (student: Student) => void;
  onInvite: (student: Student) => void;
  onPhotoPress: (student: Student) => void;
};

export function StudentListRow({
  student,
  classPalette,
  healthAssessment,
  hasBirthDateWarning,
  onPress,
  onWhatsApp,
  onInvite,
  onPhotoPress,
}: StudentListRowProps) {
  const { colors } = useAppTheme();

  return (
    <StudentListRowContent
      colors={colors}
      student={student}
      classPalette={classPalette}
      healthAssessment={healthAssessment}
      hasBirthDateWarning={hasBirthDateWarning}
      onPress={onPress}
      onWhatsApp={onWhatsApp}
      onInvite={onInvite}
      onPhotoPress={onPhotoPress}
    />
  );
}

export function StudentListRowContent({
  colors,
  student,
  classPalette,
  healthAssessment,
  hasBirthDateWarning,
  onPress,
  onWhatsApp,
  onInvite,
  onPhotoPress,
}: StudentListRowProps & { colors: ThemeColors }) {
  const contact = getContactPhone(student);
  const disabled = contact.status === "missing";
  const nameParts = student.name.trim().split(/\s+/);
  const shortName = nameParts.slice(0, 2).join(" ");
  const restName = nameParts.slice(2).join(" ");

  return (
    <Pressable
      onPress={() => onPress(student)}
      style={{
        padding: 14,
        borderRadius: 18,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: hasBirthDateWarning ? colors.dangerSolidBg : classPalette.bg,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
          {hasBirthDateWarning ? (
            <View
              style={{
                alignSelf: "flex-start",
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                borderWidth: 1,
                borderColor: colors.dangerSolidBg,
                backgroundColor: colors.dangerBg,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Ionicons name="alert-circle" size={12} color={colors.dangerText} />
              <Text style={{ color: colors.dangerText, fontSize: 10, fontWeight: "800" }}>
                Data suspeita
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable
              onPress={() => onPhotoPress(student)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {student.photoUrl ? (
                <Image
                  source={{ uri: student.photoUrl }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : (
                <Ionicons name="person" size={18} color={colors.text} />
              )}
            </Pressable>
            <FadeHorizontalScroll
              containerStyle={{ flex: 1, minWidth: 0 }}
              fadeColor={colors.card}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: colors.text,
                }}
                numberOfLines={1}
              >
                {shortName}
                {restName ? " " + restName : ""}
              </Text>
            </FadeHorizontalScroll>
            {student.isExperimental ? (
              <View
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                  Experimental
                </Text>
              </View>
            ) : null}
            {healthAssessment.level !== "apto" ? (
              <View
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor:
                    healthAssessment.level === "revisar"
                      ? colors.dangerBorder
                      : colors.warningBg,
                  backgroundColor:
                    healthAssessment.level === "revisar"
                      ? colors.dangerBg
                      : colors.warningBg,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{
                    color:
                      healthAssessment.level === "revisar"
                        ? colors.dangerText
                        : colors.warningText,
                    fontSize: 10,
                    fontWeight: "700",
                  }}
                >
                  {healthAssessment.label}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Pressable
          onPress={() => onInvite(student)}
          style={{
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: colors.primaryBg,
          }}
          accessibilityLabel="Gerar convite do aluno"
        >
          <Ionicons name="link-outline" size={16} color={colors.primaryText} />
        </Pressable>
        <Pressable
          onPress={() => onWhatsApp(student)}
          disabled={disabled}
          style={{
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: disabled ? colors.secondaryBg : "#25D366",
            opacity: disabled ? 0.5 : 1,
          }}
          accessibilityLabel="Abrir WhatsApp do aluno"
        >
          <Ionicons name="logo-whatsapp" size={18} color={disabled ? colors.muted : "white"} />
        </Pressable>
      </View>
    </Pressable>
  );
}
