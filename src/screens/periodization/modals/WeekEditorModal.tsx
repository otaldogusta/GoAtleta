import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import type { ThemeColors } from "../../../ui/app-theme";
import type { ConfirmDialogOptions } from "../../../ui/confirm-dialog";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";

type Props = {
  visible: boolean;
  onClose: () => void;
  modalCardStyle: object;
  colors: ThemeColors;
  editingWeek: number;
  selectedClassName: string;
  cycleLength: number;
  // form fields
  editPhase: string;
  setEditPhase: (v: string) => void;
  editTheme: string;
  setEditTheme: (v: string) => void;
  editJumpTarget: string;
  setEditJumpTarget: (v: string) => void;
  editPSETarget: string;
  setEditPSETarget: (v: string) => void;
  editTechnicalFocus: string;
  setEditTechnicalFocus: (v: string) => void;
  editPhysicalFocus: string;
  setEditPhysicalFocus: (v: string) => void;
  editSource: "AUTO" | "MANUAL";
  setEditSource: (v: "AUTO" | "MANUAL") => void;
  editConstraints: string;
  setEditConstraints: (v: string) => void;
  applyWeeks: number[];
  setApplyWeeks: (v: number[]) => void;
  isSavingWeek: boolean;
  onSave: () => void;
  onResetToAuto: () => void;
  onApplyDraftToWeeks: (weeks: number[]) => void;
  onConfirmDialog: (opts: ConfirmDialogOptions) => void;
  normalizeText: (value: string) => string;
};

export function WeekEditorModal({
  visible,
  onClose,
  modalCardStyle,
  colors,
  editingWeek,
  selectedClassName,
  cycleLength,
  editPhase,
  setEditPhase,
  editTheme,
  setEditTheme,
  editJumpTarget,
  setEditJumpTarget,
  editPSETarget,
  setEditPSETarget,
  editTechnicalFocus,
  setEditTechnicalFocus,
  editPhysicalFocus,
  setEditPhysicalFocus,
  editSource,
  setEditSource,
  editConstraints,
  setEditConstraints,
  applyWeeks,
  setApplyWeeks,
  isSavingWeek,
  onSave,
  onResetToAuto,
  onApplyDraftToWeeks,
  onConfirmDialog,
  normalizeText,
}: Props) {
  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    color: colors.inputText,
    fontSize: 13,
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      cardStyle={[
        modalCardStyle,
        {
          paddingBottom: 0,
          maxHeight: "92%",
          height: "92%",
          minHeight: 0,
          overflow: "hidden",
        },
      ]}
      position="center"
    >
      <View style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 8 }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
              {`Editar agenda da semana ${editingWeek}`}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {normalizeText(selectedClassName)}
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            style={{
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.secondaryBg,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
              Fechar
            </Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={{ width: "100%", flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        >
          <ScrollView
            contentContainerStyle={{
              gap: 12,
              paddingBottom: 24,
              paddingHorizontal: 12,
              paddingTop: 16,
            }}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {/* ── Planejamento da semana ── */}
            <View style={{ gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                {normalizeText("Planejamento da semana")}
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 160, gap: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {normalizeText("Fase")}
                  </Text>
                  <TextInput
                    placeholder={normalizeText("Fase (ex: Base, Recuperação)")}
                    value={editPhase}
                    onChangeText={setEditPhase}
                    placeholderTextColor={colors.placeholder}
                    style={inputStyle}
                  />
                </View>

                <View style={{ flex: 1, minWidth: 160, gap: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {normalizeText("Tema")}
                  </Text>
                  <TextInput
                    placeholder={normalizeText("Tema (ex: Manchete, Saque)")}
                    value={editTheme}
                    onChangeText={setEditTheme}
                    placeholderTextColor={colors.placeholder}
                    style={inputStyle}
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 160, gap: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {normalizeText("Meta de saltos")}
                  </Text>
                  <TextInput
                    placeholder={normalizeText("Saltos alvo (ex: 20-40)")}
                    value={editJumpTarget}
                    onChangeText={setEditJumpTarget}
                    placeholderTextColor={colors.placeholder}
                    style={inputStyle}
                  />
                </View>

                <View style={{ flex: 1, minWidth: 160, gap: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {normalizeText("Meta de PSE")}
                  </Text>
                  <TextInput
                    placeholder={normalizeText("PSE alvo (0-10, ex: 3-4)")}
                    value={editPSETarget}
                    onChangeText={setEditPSETarget}
                    placeholderTextColor={colors.placeholder}
                    style={inputStyle}
                  />
                </View>
              </View>
            </View>

            {/* ── Parâmetros da sessão ── */}
            <View style={{ gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                {normalizeText("Parâmetros da sessão")}
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 160, gap: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {normalizeText("Foco técnico")}
                  </Text>
                  <TextInput
                    placeholder={normalizeText("Foco técnico")}
                    value={editTechnicalFocus}
                    onChangeText={setEditTechnicalFocus}
                    placeholderTextColor={colors.placeholder}
                    style={inputStyle}
                  />
                </View>

                <View style={{ flex: 1, minWidth: 160, gap: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {normalizeText("Foco físico")}
                  </Text>
                  <TextInput
                    placeholder={normalizeText("Foco físico")}
                    value={editPhysicalFocus}
                    onChangeText={setEditPhysicalFocus}
                    placeholderTextColor={colors.placeholder}
                    style={inputStyle}
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(["AUTO", "MANUAL"] as const).map((value) => {
                  const active = editSource === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setEditSource(value)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        backgroundColor: active ? colors.primaryBg : colors.background,
                        borderWidth: 1,
                        borderColor: active ? colors.primaryBg : colors.border,
                      }}
                    >
                      <Text style={{ color: active ? colors.primaryText : colors.text, fontSize: 12, fontWeight: "700" }}>
                        {value}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* ── Restrições ── */}
            <View style={{ gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {normalizeText("Restrições")}
              </Text>
              <TextInput
                placeholder={normalizeText("Restrições / regras")}
                value={editConstraints}
                onChangeText={setEditConstraints}
                multiline
                textAlignVertical="top"
                placeholderTextColor={colors.placeholder}
                style={[inputStyle, { minHeight: 84 }]}
              />
            </View>

            {/* ── Ações rápidas ── */}
            <View style={{ gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                {normalizeText("Ações rápidas")}
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Pressable
                  onPress={() =>
                    onConfirmDialog({
                      title: normalizeText("Resetar para AUTO?"),
                      message: normalizeText("O plano volta para o modelo automático desta semana."),
                      confirmLabel: normalizeText("Resetar"),
                      cancelLabel: normalizeText("Cancelar"),
                      tone: "default",
                      onConfirm: onResetToAuto,
                    })
                  }
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                    Resetar para AUTO
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => onApplyDraftToWeeks([editingWeek + 1])}
                  disabled={editingWeek >= cycleLength}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor:
                      editingWeek >= cycleLength ? colors.primaryDisabledBg : colors.primaryBg,
                  }}
                >
                  <Text
                    style={{
                      color:
                        editingWeek >= cycleLength ? colors.secondaryText : colors.primaryText,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    Copiar para próxima
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* ── Aplicar para outras semanas ── */}
            <View style={{ gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                Aplicar estrutura para outras semanas
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {Array.from({ length: cycleLength }, (_, index) => index + 1).map((week) => {
                  const active = applyWeeks.includes(week);
                  const disabled = week === editingWeek;
                  return (
                    <Pressable
                      key={`apply-week-${week}`}
                      onPress={() => {
                        if (disabled) return;
                        setApplyWeeks(
                          applyWeeks.includes(week)
                            ? applyWeeks.filter((item) => item !== week)
                            : [...applyWeeks, week]
                        );
                      }}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: disabled
                          ? colors.secondaryBg
                          : active
                            ? colors.primaryBg
                            : colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                        opacity: disabled ? 0.6 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: active ? colors.primaryText : colors.text,
                          fontSize: 12,
                          fontWeight: active ? "700" : "500",
                        }}
                      >
                        {week}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => onApplyDraftToWeeks(applyWeeks)}
                disabled={!applyWeeks.length}
                style={{
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: applyWeeks.length ? colors.primaryBg : colors.primaryDisabledBg,
                }}
              >
                <Text
                  style={{
                    color: applyWeeks.length ? colors.primaryText : colors.secondaryText,
                    fontWeight: "700",
                  }}
                >
                  Aplicar semanas selecionadas
                </Text>
              </Pressable>
            </View>

            {/* ── Ações finais ── */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={onSave}
                disabled={isSavingWeek}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: isSavingWeek ? colors.primaryDisabledBg : colors.primaryBg,
                }}
              >
                <Text style={{ color: isSavingWeek ? colors.secondaryText : colors.primaryText, fontWeight: "700" }}>
                  {isSavingWeek ? "Salvando..." : "Salvar alterações"}
                </Text>
              </Pressable>

              <Pressable
                onPress={onClose}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  Cancelar
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ModalSheet>
  );
}
