import { ScrollView, Text, TextInput, View } from "react-native";

import { Pressable } from "../../../src/ui/Pressable";
import { radius } from "../../../src/theme/tokens";
import type { ThemeColors } from "../../../src/ui/app-theme";
import type { ConfirmDialogOptions } from "../../../src/ui/confirm-dialog";

import type { ClassCalendarException, ClassCompetitiveProfile } from "../../../src/core/models";

type Props = {
  colors: ThemeColors;
  normalizeText: (value: string) => string;
  isCompetitiveMode: boolean;
  handleDisableCompetitiveMode: () => Promise<void>;
  isSavingCompetitiveProfile: boolean;
  isCompetitiveProfileDirty: boolean;
  competitiveBlockPadding: number;
  competitiveExceptionsMaxHeight: number;
  competitiveProfile: ClassCompetitiveProfile | null;
  updateCompetitiveProfileDraft: (patch: Partial<ClassCompetitiveProfile>) => void;
  competitiveTargetDateInput: string;
  setCompetitiveTargetDateInput: (value: string) => void;
  competitiveCycleStartDateInput: string;
  setCompetitiveCycleStartDateInput: (value: string) => void;
  handleSaveCompetitiveProfile: () => Promise<void>;
  formatDateInputMask: (value: string) => string;
  calendarExceptions: ClassCalendarException[];
  exceptionDateInput: string;
  setExceptionDateInput: (value: string) => void;
  exceptionReasonInput: string;
  setExceptionReasonInput: (value: string) => void;
  isSavingCalendarException: boolean;
  handleAddCalendarException: () => Promise<void>;
  handleDeleteCalendarException: (id: string) => Promise<void>;
  formatDisplayDate: (value: string | null) => string;
  confirmDialog: (options: ConfirmDialogOptions) => void;
};

export function CompetitiveAgendaCard({
  colors,
  normalizeText,
  isCompetitiveMode,
  handleDisableCompetitiveMode,
  isSavingCompetitiveProfile,
  isCompetitiveProfileDirty,
  competitiveBlockPadding,
  competitiveExceptionsMaxHeight,
  competitiveProfile,
  updateCompetitiveProfileDraft,
  competitiveTargetDateInput,
  setCompetitiveTargetDateInput,
  competitiveCycleStartDateInput,
  setCompetitiveCycleStartDateInput,
  handleSaveCompetitiveProfile,
  formatDateInputMask,
  calendarExceptions,
  exceptionDateInput,
  setExceptionDateInput,
  exceptionReasonInput,
  setExceptionReasonInput,
  isSavingCalendarException,
  handleAddCalendarException,
  handleDeleteCalendarException,
  formatDisplayDate,
  confirmDialog,
}: Props) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "800" }}>
            {normalizeText("Modo competitivo da turma")}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 16 }}>
            {normalizeText(
              isCompetitiveMode
                ? "Perfil competitivo ativo para gerar semanas com datas reais."
                : "Complete os dados para ativar a periodização competitiva desta turma."
            )}
          </Text>
        </View>
        {isCompetitiveMode ? (
          <Pressable
            onPress={() => {
              void handleDisableCompetitiveMode();
            }}
            disabled={isSavingCompetitiveProfile}
            style={{
              height: 32,
              paddingHorizontal: 12,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.backgroundSubtle,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              opacity: isSavingCompetitiveProfile ? 0.6 : 1,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 12 }}>
              {normalizeText("Desativar")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: 18 }}>

      <View
        style={{
          gap: 10,
          padding: 0,
          backgroundColor: "transparent",
        }}
      >
        <Text style={{ color: colors.textPrimary, fontWeight: "900", fontSize: 13 }}>
          {normalizeText("Dados da competição")}
        </Text>

        <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 160, flexBasis: 0, gap: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "800" }}>{normalizeText("Competição-alvo")}</Text>
            <TextInput
              value={competitiveProfile?.targetCompetition ?? ""}
              onChangeText={(value) => updateCompetitiveProfileDraft({ targetCompetition: value })}
              placeholder={normalizeText("Ex.: Supertaça Unificada da Saúde")}
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.borderSubtle,
                padding: 10,
                fontSize: 13,
                borderRadius: radius.internal,
                backgroundColor: colors.inputBg,
                color: colors.textPrimary,
              }}
            />
          </View>
          <View style={{ flex: 1, minWidth: 160, flexBasis: 0, gap: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "800" }}>{normalizeText("Data-alvo")}</Text>
            <TextInput
              value={competitiveTargetDateInput}
              onChangeText={(value) => setCompetitiveTargetDateInput(formatDateInputMask(value))}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.borderSubtle,
                padding: 10,
                fontSize: 13,
                borderRadius: radius.internal,
                backgroundColor: colors.inputBg,
                color: colors.textPrimary,
              }}
            />
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 160, flexBasis: 0, gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{normalizeText("Início do ciclo")}</Text>
            <TextInput
              value={competitiveCycleStartDateInput}
              onChangeText={(value) => setCompetitiveCycleStartDateInput(formatDateInputMask(value))}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                fontSize: 13,
                borderRadius: 12,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
          </View>
          <View style={{ flex: 1, minWidth: 160, flexBasis: 0, gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{normalizeText("Sistema tático")}</Text>
            <TextInput
              value={competitiveProfile?.tacticalSystem ?? ""}
              onChangeText={(value) => updateCompetitiveProfileDraft({ tacticalSystem: value })}
              placeholder={normalizeText("Ex.: 5x1")}
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                fontSize: 13,
                borderRadius: 12,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 160, flexBasis: 0, gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{normalizeText("Fase atual")}</Text>
            <TextInput
              value={competitiveProfile?.currentPhase ?? "Base"}
              onChangeText={(value) => updateCompetitiveProfileDraft({ currentPhase: value })}
              placeholder={normalizeText("Base")}
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                fontSize: 13,
                borderRadius: 12,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 11 }}>{normalizeText("Observações")}</Text>
          <TextInput
            value={competitiveProfile?.notes ?? ""}
            onChangeText={(value) => updateCompetitiveProfileDraft({ notes: value })}
            placeholder={normalizeText("Contexto competitivo, foco do bloco e observações gerais")}
            placeholderTextColor={colors.placeholder}
            multiline
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              padding: 10,
              borderRadius: 12,
              backgroundColor: colors.inputBg,
              minHeight: 80,
              color: colors.inputText,
              fontSize: 13,
              textAlignVertical: "top",
            }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Pressable
            onPress={() => {
              void handleSaveCompetitiveProfile();
            }}
            disabled={isSavingCompetitiveProfile || !isCompetitiveProfileDirty}
            style={{
              minHeight: 42,
              borderRadius: 12,
              backgroundColor:
                isSavingCompetitiveProfile || !isCompetitiveProfileDirty
                  ? colors.primaryDisabledBg
                  : colors.primaryBg,
              opacity: isCompetitiveProfileDirty ? 1 : 0.55,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: isSavingCompetitiveProfile || !isCompetitiveProfileDirty ? colors.secondaryText : colors.primaryText, fontWeight: "700" }}>
              {normalizeText(isSavingCompetitiveProfile ? "Salvando..." : "Salvar alterações")}
            </Text>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => updateCompetitiveProfileDraft({
                targetCompetition: "",
                tacticalSystem: "",
                currentPhase: "Base",
                notes: "",
              })}
              style={{
                minHeight: 40,
                flex: 1,
                borderRadius: 10,
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                {normalizeText("Limpar campos")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setCompetitiveTargetDateInput("");
                setCompetitiveCycleStartDateInput("");
              }}
              style={{
                minHeight: 40,
                flex: 1,
                borderRadius: 10,
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                {normalizeText("Limpar datas")}
              </Text>
            </Pressable>
          </View>
        </View>
        </View>
      </View>

      <View
        style={{
          gap: 10,
          padding: 0,
          paddingTop: competitiveBlockPadding,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: "transparent",
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
          {normalizeText("Calendário da turma")}
        </Text>

        <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{normalizeText("Data sem treino")}</Text>
            <TextInput
              value={exceptionDateInput}
              onChangeText={(value) => setExceptionDateInput(formatDateInputMask(value))}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                fontSize: 13,
                borderRadius: 12,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
          </View>
          <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{normalizeText("Motivo")}</Text>
            <TextInput
              value={exceptionReasonInput}
              onChangeText={setExceptionReasonInput}
              placeholder={normalizeText("Feriado, viagem, pausa...")}
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                fontSize: 13,
                borderRadius: 12,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
          </View>
        </View>

        <Pressable
          onPress={() => {
            void handleAddCalendarException();
          }}
          disabled={isSavingCalendarException}
          style={{
            minHeight: 42,
            borderRadius: 12,
            backgroundColor: isSavingCalendarException ? colors.primaryDisabledBg : colors.primaryBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: isSavingCalendarException ? colors.secondaryText : colors.primaryText, fontWeight: "700" }}>
            {normalizeText(isSavingCalendarException ? "Salvando..." : "Adicionar exceção")}
          </Text>
        </Pressable>

        </View>
      </View>

      <View
        style={{
          gap: 10,
          padding: 0,
          paddingTop: competitiveBlockPadding,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: "transparent",
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
          {normalizeText(`Exceções cadastradas (${calendarExceptions.length})`)}
        </Text>

        <View style={{ gap: 8 }}>
        {calendarExceptions.length ? (
          <ScrollView
            style={{ maxHeight: competitiveExceptionsMaxHeight, minHeight: 120 }}
            contentContainerStyle={{ gap: 8, paddingRight: 2 }}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {calendarExceptions.map((item) => (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {formatDisplayDate(item.date)}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {normalizeText(item.reason || "Sem treino")}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    confirmDialog({
                      title: normalizeText("Remover exceção?"),
                      message: normalizeText("Essa data será removida do calendário competitivo da turma."),
                      confirmLabel: normalizeText("Remover"),
                      cancelLabel: normalizeText("Cancelar"),
                      tone: "danger",
                      onConfirm: () => {
                        void handleDeleteCalendarException(item.id);
                      },
                    });
                  }}
                  disabled={isSavingCalendarException}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    opacity: isSavingCalendarException ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {normalizeText("Remover")}
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {normalizeText("Nenhuma exceção cadastrada para esta turma.")}
          </Text>
        )}
        </View>
      </View>

      </View>
    </View>
  );
}
