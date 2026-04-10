import { Ionicons } from "@expo/vector-icons";
import { type RefObject } from "react";
import { Alert, StyleProp, Text, TextInput, View, ViewStyle } from "react-native";
import type { ClassGroup, Student } from "../../../core/models";
import type { ThemeColors } from "../../../ui/app-theme";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../../ui/AnchoredDropdownOption";
import { ConfirmCloseOverlay } from "../../../ui/ConfirmCloseOverlay";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import {
    buildWaMeLink,
    normalizePhoneBR,
    openWhatsApp,
} from "../../../utils/whatsapp";
import {
    WHATSAPP_TEMPLATES,
    calculateNextClassDate,
    type WhatsAppTemplateId,
} from "../../../utils/whatsapp-templates";

type Layout = { x: number; y: number; width: number; height: number };

export type WhatsAppModalProps = {
  // visibility
  visible: boolean;
  onClose: () => void;
  cardStyle: StyleProp<ViewStyle>;

  // student data
  selectedStudentId: string | null;
  students: Student[];
  classById: Map<string, ClassGroup>;

  // contact selection
  selectedContactType: "guardian" | "student";
  setSelectedContactType: (v: "guardian" | "student") => void;

  // template selection
  selectedTemplateId: WhatsAppTemplateId | null;
  selectedTemplateLabel: string | null;
  setSelectedTemplateId: (v: WhatsAppTemplateId | null) => void;
  setSelectedTemplateLabel: (v: string | null) => void;

  // custom fields & message
  customFields: Record<string, string>;
  setCustomFields: (v: Record<string, string>) => void;
  customStudentMessage: string;
  setCustomStudentMessage: (v: string) => void;

  // invite / revoke
  studentInviteBusy: boolean;
  showRevokeConfirm: boolean;
  setShowRevokeConfirm: (v: boolean) => void;
  applyStudentInviteTemplate: (
    student: Student,
    cls: ClassGroup | null,
    invitedTo: string,
    options: { revokeFirst: boolean; copyLink: boolean }
  ) => Promise<string | null>;

  // notice
  whatsappNotice: string;

  // template dropdown
  showTemplateList: boolean;
  setShowTemplateList: (v: boolean) => void;
  showTemplateListContent: boolean;
  templateTriggerLayout: Layout | null;
  whatsappContainerWindow: { x: number; y: number } | null;
  templateListAnimStyle: StyleProp<ViewStyle>;
  syncTemplateLayout: () => void;
  closeAllPickers: () => void;

  // refs
  whatsappContainerRef: RefObject<View | null>;
  templateTriggerRef: RefObject<View | null>;

  // settings
  groupInviteLinks: Record<string, string>;

  // theme
  colors: ThemeColors;

  // message builder
  buildStudentMessage: (
    student: Student,
    cls: ClassGroup | null,
    templateId: WhatsAppTemplateId,
    fields: Record<string, string>
  ) => string;
};

export function WhatsAppModal({
  visible,
  onClose,
  cardStyle,
  selectedStudentId,
  students,
  classById,
  selectedContactType,
  setSelectedContactType,
  selectedTemplateId,
  selectedTemplateLabel,
  setSelectedTemplateId,
  setSelectedTemplateLabel,
  customFields,
  setCustomFields,
  customStudentMessage,
  setCustomStudentMessage,
  studentInviteBusy,
  showRevokeConfirm,
  setShowRevokeConfirm,
  applyStudentInviteTemplate,
  whatsappNotice,
  showTemplateList,
  setShowTemplateList,
  showTemplateListContent,
  templateTriggerLayout,
  whatsappContainerWindow,
  templateListAnimStyle,
  syncTemplateLayout,
  closeAllPickers,
  whatsappContainerRef,
  templateTriggerRef,
  groupInviteLinks,
  colors,
  buildStudentMessage,
}: WhatsAppModalProps) {
  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      cardStyle={cardStyle}
      position="center"
      backdropOpacity={0.65}
    >
      {(() => {
        if (!selectedStudentId) return null;
        const student = students.find((item) => item.id === selectedStudentId);
        if (!student) return null;
        const cls = classById.get(student.classId) ?? null;
        const guardianContact = normalizePhoneBR(student.guardianPhone);
        const studentContact = normalizePhoneBR(student.phone);
        const hasGuardian = guardianContact.isValid;
        const hasStudent = studentContact.isValid;
        const useGuardian = selectedContactType === "guardian" && hasGuardian;
        const useStudent = selectedContactType === "student" && hasStudent;
        const finalPhone = useGuardian
           ? guardianContact.phoneDigits
          : useStudent
            ? studentContact.phoneDigits
          : "";
        const nextClassDate = cls?.daysOfWeek?.length
          ? calculateNextClassDate(cls.daysOfWeek)
          : null;
        const sendMessage = async () => {
          if (!finalPhone) {
            Alert.alert(
              "Contato inválido",
              "Atualize o telefone do aluno ou responsável."
            );
            return;
          }
          let messageText = customStudentMessage.trim();
          if (selectedTemplateId === "student_invite" && !customFields.inviteLink) {
            const generated = await applyStudentInviteTemplate(
              student,
              cls,
              finalPhone,
              {
                revokeFirst: false,
                copyLink: false,
              }
            );
            if (generated) {
              messageText = generated.trim();
            }
          }
          if (!messageText) {
            Alert.alert("Mensagem vazia", "Escreva ou escolha um template.");
            return;
          }
          const url = buildWaMeLink(finalPhone, messageText);
          await openWhatsApp(url);
          onClose();
        };

        return (
          <View
            ref={whatsappContainerRef}
            style={{ gap: 12, overflow: "visible" }}
          >
            <ConfirmCloseOverlay
              visible={showRevokeConfirm}
              title="Revogar acesso do aluno?"
              message="Isso remove o acesso atual, revoga convites antigos e gera um novo link."
              confirmLabel="Revogar e gerar"
              cancelLabel="Cancelar"
              overlayZIndex={10000}
              onCancel={() => setShowRevokeConfirm(false)}
              onConfirm={() => {
                setShowRevokeConfirm(false);
                void applyStudentInviteTemplate(student, cls, finalPhone, {
                  revokeFirst: true,
                  copyLink: true,
                });
              }}
            />
            <View>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                {student.name}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                {cls?.name ?? "Turma"}
              </Text>
            </View>

            <View style={{ gap: 6 }}>
              <View ref={templateTriggerRef}>
                <Pressable
                  onPress={() => {
                    const next = !showTemplateList;
                    if (next) {
                      syncTemplateLayout();
                    }
                    setShowTemplateList(next);
                  }}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
                    {selectedTemplateId
                      ? WHATSAPP_TEMPLATES[selectedTemplateId]?.title
                      : selectedTemplateLabel ?? "Template"}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{
                      transform: [{ rotate: showTemplateList ? "180deg" : "0deg" }],
                    }}
                  />
                </Pressable>
              </View>
            </View>

            { selectedTemplateId === "student_invite" ? (
              <Pressable
                onPress={() => {
                  if (studentInviteBusy) return;
                  setShowRevokeConfirm(true);
                }}
                disabled={studentInviteBusy}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: studentInviteBusy
                    ? colors.primaryDisabledBg
                    : colors.dangerSolidBg,
                  alignItems: "center",
                  opacity: studentInviteBusy ? 0.6 : 1,
                }}
              >
                <Text style={{ color: colors.dangerSolidText, fontWeight: "700" }}>
                  {studentInviteBusy ? "Processando..." : "Revogar e gerar novo link"}
                </Text>
              </Pressable>
            ) : null}

            { whatsappNotice ? (
              <View
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: colors.successBg,
                  borderWidth: 1,
                  borderColor: colors.successBg,
                }}
              >
                <Text style={{ color: colors.successText, fontWeight: "700", fontSize: 12 }}>
                  {whatsappNotice}
                </Text>
              </View>
            ) : null}

            {selectedTemplateId ? (
              (WHATSAPP_TEMPLATES[selectedTemplateId].requires ?? []).map((field) => {
                if (
                  field === "nextClassDate" ||
                  field === "nextClassTime" ||
                  field === "groupInviteLink" ||
                  field === "inviteLink"
                ) {
                  return null;
                }
                const fieldLabel = field === "highlightNote" ? "Destaque" : "Texto";
                const fieldPlaceholder =
                  field === "highlightNote"
                     ? "Ex: excelente postura no saque!"
                    : "Ex: não haverá treino na sexta";
                return (
                  <View key={field} style={{ gap: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>
                      {fieldLabel}:
                    </Text>
                    <TextInput
                      placeholder={fieldPlaceholder}
                      placeholderTextColor={colors.placeholder}
                      value={customFields[field] || ""}
                      onChangeText={(text) => {
                        const updatedFields = { ...customFields, [field]: text };
                        setCustomFields(updatedFields);
                        if (selectedTemplateId) {
                          setCustomStudentMessage(
                            buildStudentMessage(student, cls, selectedTemplateId, updatedFields)
                          );
                        }
                      }}
                      multiline
                      numberOfLines={2}
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        backgroundColor: colors.background,
                        borderWidth: 1,
                        borderColor: colors.border,
                        color: colors.text,
                        fontSize: 12,
                        textAlignVertical: "top",
                      }}
                    />
                  </View>
                );
              })
            ) : null}

            { hasGuardian || hasStudent ? (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>
                  Enviar para:
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  { hasGuardian ? (
                    <Pressable
                      onPress={() => setSelectedContactType("guardian")}
                      style={{
                        flex: 1,
                        minWidth: 140,
                        padding: 10,
                        borderRadius: 8,
                        backgroundColor:
                          selectedContactType === "guardian"
                             ? colors.primaryBg
                            : colors.inputBg,
                        borderWidth: 1,
                        borderColor:
                          selectedContactType === "guardian"
                             ? colors.primaryBg
                            : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color:
                            selectedContactType === "guardian"
                               ? colors.primaryText
                              : colors.text,
                        }}
                      >
                        Responsável
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color:
                            selectedContactType === "guardian"
                               ? colors.primaryText
                              : colors.muted,
                          marginTop: 2,
                        }}
                      >
                        {student.guardianPhone || "Sem telefone"}
                      </Text>
                    </Pressable>
                  ) : null}
                  { hasStudent ? (
                    <Pressable
                      onPress={() => setSelectedContactType("student")}
                      style={{
                        flex: 1,
                        minWidth: 140,
                        padding: 10,
                        borderRadius: 8,
                        backgroundColor:
                          selectedContactType === "student"
                             ? colors.primaryBg
                            : colors.inputBg,
                        borderWidth: 1,
                        borderColor:
                          selectedContactType === "student"
                             ? colors.primaryBg
                            : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color:
                            selectedContactType === "student"
                               ? colors.primaryText
                              : colors.text,
                        }}
                      >
                        Aluno
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color:
                            selectedContactType === "student"
                               ? colors.primaryText
                              : colors.muted,
                          marginTop: 2,
                        }}
                      >
                        {student.phone || "Sem telefone"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Sem telefone válido cadastrado.
              </Text>
            )}

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>
                Mensagem:
              </Text>
              <TextInput
                placeholder="Escreva a mensagem"
                placeholderTextColor={colors.muted}
                value={customStudentMessage}
                onChangeText={setCustomStudentMessage}
                multiline
                numberOfLines={4}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.text,
                  fontSize: 12,
                  textAlignVertical: "top",
                  minHeight: 80,
                }}
              />
            </View>

            <Pressable
              onPress={sendMessage}
              style={{
                paddingVertical: 11,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: "#25D366",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>
                Enviar via WhatsApp
              </Text>
            </Pressable>

            <Pressable
              onPress={onClose}
              style={{
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: colors.secondaryBg,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>
                Fechar
              </Text>
            </Pressable>
            <AnchoredDropdown
              visible={showTemplateListContent}
              layout={templateTriggerLayout}
              container={whatsappContainerWindow}
              animationStyle={templateListAnimStyle}
              zIndex={9999}
              maxHeight={220}
              nestedScrollEnabled
              onRequestClose={closeAllPickers}
              scrollContentStyle={{ padding: 8, gap: 6 }}
            >
              {Object.values(WHATSAPP_TEMPLATES).map((template) => {
                const isSelected = selectedTemplateId === template.id;
                let canUse = true;
                let missingRequirement = "";
                if (template.requires) {
                  for (const req of template.requires) {
                    if (req === "nextClassDate" && !nextClassDate) {
                      canUse = false;
                      missingRequirement = "Dias da semana não configurados";
                      break;
                    }
                    if (req === "nextClassTime" && !cls?.startTime) {
                      canUse = false;
                      missingRequirement = "Horário não configurado";
                      break;
                    }
                    if (req === "groupInviteLink" && cls && !groupInviteLinks[cls.id]) {
                      canUse = false;
                      missingRequirement = "Link do grupo não configurado";
                      break;
                    }
                  }
                }
                return (
                  <AnchoredDropdownOption
                    key={template.id}
                    active={isSelected}
                    disabled={!canUse}
                    onPress={() => {
                      if (!canUse) {
                        Alert.alert("Template indisponível", missingRequirement);
                        return;
                      }
                      if (template.id === "student_invite") {
                        setShowTemplateList(false);
                        void applyStudentInviteTemplate(
                          student,
                          cls,
                          finalPhone,
                          {
                            revokeFirst: false,
                            copyLink: false,
                          }
                        );
                        return;
                      }
                      const fields: Record<string, string> = {};
                      setSelectedTemplateId(template.id);
                      setSelectedTemplateLabel(template.title);
                      setCustomFields(fields);
                      setCustomStudentMessage(
                        buildStudentMessage(student, cls, template.id, fields)
                      );
                      setShowTemplateList(false);
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      backgroundColor: isSelected ? colors.primaryBg : colors.card,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primaryBg : colors.border,
                      opacity: canUse ? 1 : 0.5,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: isSelected ? colors.primaryText : colors.text,
                      }}
                    >
                      {template.title}
                    </Text>
                    { !canUse ? (
                      <Text style={{ fontSize: 11, color: colors.dangerText, marginTop: 2 }}>
                        {missingRequirement}
                      </Text>
                    ) : null}
                  </AnchoredDropdownOption>
                );
              })}
            </AnchoredDropdown>
          </View>
        );
      })()}
    </ModalSheet>
  );
}
