import { KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";
import type { WeeklyAutopilotPlanReview } from "../../../core/models";
import type { ThemeColors } from "../../../ui/app-theme";
import type { ConfirmDialogOptions } from "../../../ui/confirm-dialog";
import { ModalDialogFrame } from "../../../ui/ModalDialogFrame";
import { Pressable } from "../../../ui/Pressable";
import type { WeekSessionPreview } from "../application/build-week-session-preview";

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
  editPedagogicalRule: string;
  setEditPedagogicalRule: (v: string) => void;
  editJumpTarget: string;
  setEditJumpTarget: (v: string) => void;
  editPSETarget: string;
  setEditPSETarget: (v: string) => void;
  editTechnicalFocus: string;
  setEditTechnicalFocus: (v: string) => void;
  editPhysicalFocus: string;
  setEditPhysicalFocus: (v: string) => void;
  editConstraints: string;
  setEditConstraints: (v: string) => void;
  daysOfWeek: number[];
  weeklySessions: number;
  weekSessions: WeekSessionPreview[];
  isSavingWeek: boolean;
  onSave: () => void;
  onResetToAuto: () => void;
  onConfirmDialog: (opts: ConfirmDialogOptions) => void;
  normalizeText: (value: string) => string;
  planReview?: WeeklyAutopilotPlanReview | null;
};

const planReviewFieldLabels: Record<string, string> = {
  phase: "Fase",
  objective: "Objetivo",
  loadTarget: "Carga",
  intensityTarget: "Intensidade",
  technicalFocus: "Foco técnico",
  physicalFocus: "Foco físico",
  constraints: "Restrições",
  progressionModel: "Progressão",
};

const formatReviewValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean).join(" • ") || "Sem valor";
  }
  if (value == null) return "Sem valor";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "Sem valor";
    }
  }
  return String(value).trim() || "Sem valor";
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
  editPedagogicalRule,
  setEditPedagogicalRule,
  editJumpTarget,
  setEditJumpTarget,
  editPSETarget,
  setEditPSETarget,
  editTechnicalFocus,
  setEditTechnicalFocus,
  editPhysicalFocus,
  setEditPhysicalFocus,
  editConstraints,
  setEditConstraints,
  daysOfWeek,
  weeklySessions,
  weekSessions,
  isSavingWeek,
  onSave,
  onResetToAuto,
  onConfirmDialog,
  normalizeText,
  planReview,
}: Props) {
  const sessionCount = weekSessions.length || weeklySessions || daysOfWeek.length;
  const sessionWord = sessionCount === 1 ? "treino" : "treinos";
  const operationalSubtitle = `${normalizeText(selectedClassName)} · ${sessionCount} ${sessionWord}`;

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    color: colors.inputText,
    fontSize: 13,
  };
  const hasBlockingIssue = Boolean(planReview?.issues.some((issue) => issue.severity === "error"));

  return (
    <ModalDialogFrame
      visible={visible}
      onClose={onClose}
      cardStyle={modalCardStyle}
      position="center"
      colors={colors}
      title={`Planejamento da semana ${editingWeek}`}
      subtitle={operationalSubtitle}
      contentContainerStyle={{
        gap: 12,
        paddingBottom: 24,
        paddingTop: 12,
      }}
      footerStyle={{
        paddingTop: 10,
        paddingBottom: 4,
      }}
      footer={
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={onSave}
            disabled={isSavingWeek || hasBlockingIssue}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 14,
              alignItems: "center",
              backgroundColor: isSavingWeek
                ? colors.primaryDisabledBg
                : hasBlockingIssue
                  ? colors.dangerBg
                  : colors.primaryBg,
            }}
          >
            <Text
              style={{
                color: isSavingWeek
                  ? colors.secondaryText
                  : hasBlockingIssue
                    ? colors.dangerText
                    : colors.primaryText,
                fontWeight: "700",
              }}
            >
              {isSavingWeek
                ? "Salvando..."
                : hasBlockingIssue
                  ? "Corrigir alertas"
                  : "Salvar alterações"}
            </Text>
          </Pressable>

          <Pressable
            onPress={onClose}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 14,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Cancelar</Text>
          </Pressable>
        </View>
      }
    >
      <KeyboardAvoidingView
        style={{ width: "100%" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <View style={{ gap: 12 }}>
          {/* Cards de sessão com data real */}
          {weekSessions.length > 0 ? (
            <View style={{ gap: 4 }}>
              {weekSessions.map((item) => (
                <View
                  key={item.date}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 11, width: 68 }}>
                    Sessão {item.sessionIndex}/{sessionCount}
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                    {item.weekdayLabel} · {item.dateLabel}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {planReview ? (
            <View
              style={{
                gap: 8,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                  Revisão científica
                </Text>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: planReview.ok ? colors.successBg : colors.warningBg,
                  }}
                >
                  <Text
                    style={{
                      color: planReview.ok ? colors.successText : colors.warningText,
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    {planReview.ok ? "Plano validado" : `${planReview.issues.length} alerta(s)`}
                  </Text>
                </View>
              </View>

              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {normalizeText(`Base ${planReview.versionLabel} · ${planReview.domain}`)}
              </Text>

              {planReview.diffs.length ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                    Mudanças do rascunho
                  </Text>
                  {planReview.diffs.slice(0, 2).map((diff) => (
                    <View
                      key={diff.weekStart}
                      style={{
                        gap: 6,
                        padding: 10,
                        borderRadius: 12,
                        backgroundColor: colors.background,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      {diff.changes.slice(0, 2).map((change) => (
                        <Text key={`${diff.weekStart}_${change.field}`} style={{ color: colors.muted, fontSize: 12 }}>
                          {normalizeText(
                            `${planReviewFieldLabels[change.field] ?? change.field}: ${formatReviewValue(
                              change.before
                            )} → ${formatReviewValue(change.after)}`
                          )}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              ) : null}

              {planReview.issues.length ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                    Alertas
                  </Text>
                  {planReview.issues.slice(0, 2).map((issue) => (
                    <View
                      key={`${issue.weekStart}_${issue.code}`}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 12,
                        backgroundColor: colors.background,
                        borderWidth: 1,
                        borderColor:
                          issue.severity === "error"
                            ? colors.dangerBorder
                            : issue.severity === "warning"
                              ? colors.warningBg
                              : colors.border,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
                        {normalizeText(issue.message)}
                      </Text>
                      </View>
                    ))}
                  {hasBlockingIssue ? (
                    <Text style={{ color: colors.dangerText, fontSize: 12, fontWeight: "600" }}>
                      Corrija os alertas em vermelho antes de salvar.
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={{ color: colors.successText, fontSize: 12, fontWeight: "600" }}>
                  Sem alertas na base científica ativa.
                </Text>
              )}
            </View>
          ) : null}

          {/* Planejamento da semana */}
          <View style={{ gap: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg }}>
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

              <View style={{ gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {normalizeText("Regra pedagógica")}
                </Text>
                <TextInput
                  placeholder={normalizeText("Ex: ponto só vale com 3 contatos")}
                  value={editPedagogicalRule}
                  onChangeText={setEditPedagogicalRule}
                  placeholderTextColor={colors.placeholder}
                  style={inputStyle}
                />
              </View>
            </View>

            {/* Parâmetros da sessão */}
            <View style={{ gap: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg }}>
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

            </View>

            {/* Restrições */}
            <View style={{ gap: 6, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg }}>
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



        </View>
      </KeyboardAvoidingView>
    </ModalDialogFrame>
  );
}

