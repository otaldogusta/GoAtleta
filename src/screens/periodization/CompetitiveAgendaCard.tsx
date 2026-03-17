import { Ionicons } from "@expo/vector-icons";
import { Animated, ScrollView, Text, TextInput, View } from "react-native";

import { Pressable } from "../../../src/ui/Pressable";
import type { ThemeColors } from "../../../src/ui/app-theme";
import type { ConfirmDialogOptions } from "../../../src/ui/confirm-dialog";
import { getSectionCardStyle } from "../../../src/ui/section-styles";

import type { ClassCalendarException, ClassCompetitiveProfile } from "../../../src/core/models";

type AnimatedStyle = {
  opacity: Animated.Value;
  transform: { translateY: Animated.AnimatedInterpolation<number> }[];
};

type Props = {
  colors: ThemeColors;
  normalizeText: (value: string) => string;
  isCompetitiveMode: boolean;
  handleDisableCompetitiveMode: () => Promise<void>;
  isSavingCompetitiveProfile: boolean;
  competitiveScrollRef: React.RefObject<ScrollView | null>;
  competitiveContentHeight: number;
  competitiveBlockPadding: number;
  toggleCompetitiveBlock: (key: "profile" | "calendar" | "exceptions") => void;
  competitiveBlocksOpen: Record<"profile" | "calendar" | "exceptions", boolean>;
  competitiveProfileAnimStyle: AnimatedStyle;
  showCompetitiveProfileContent: boolean;
  competitiveCalendarAnimStyle: AnimatedStyle;
  showCompetitiveCalendarContent: boolean;
  competitiveExceptionsAnimStyle: AnimatedStyle;
  showCompetitiveExceptionsContent: boolean;
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
  competitiveScrollRef,
  competitiveContentHeight,
  competitiveBlockPadding,
  toggleCompetitiveBlock,
  competitiveBlocksOpen,
  competitiveProfileAnimStyle,
  showCompetitiveProfileContent,
  competitiveCalendarAnimStyle,
  showCompetitiveCalendarContent,
  competitiveExceptionsAnimStyle,
  showCompetitiveExceptionsContent,
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
    <View
      style={[
        getSectionCardStyle(colors, "neutral", { padding: 24, radius: 16, shadow: false }),
        { gap: 14, borderWidth: 1, borderColor: colors.border },
      ]}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
            {normalizeText("Modo competitivo da turma")}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
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
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: isSavingCompetitiveProfile ? 0.6 : 1,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
              {normalizeText("Desativar")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={competitiveScrollRef}
        style={{ height: competitiveContentHeight }}
        contentContainerStyle={{ gap: 14, paddingRight: 2 }}
        showsVerticalScrollIndicator
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >

      <View
        style={{
          gap: 10,
          padding: competitiveBlockPadding,
          borderRadius: 12,
          backgroundColor: colors.secondaryBg,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => toggleCompetitiveBlock("profile")}
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
            {normalizeText("Dados da competição")}
          </Text>
          <Ionicons
            name={competitiveBlocksOpen.profile ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.muted}
          />
        </Pressable>

        {showCompetitiveProfileContent ? (
        <Animated.View style={[{ gap: 10 }, competitiveProfileAnimStyle]}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 160, flexBasis: 0, gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{normalizeText("Competição-alvo")}</Text>
            <TextInput
              value={competitiveProfile?.targetCompetition ?? ""}
              onChangeText={(value) => updateCompetitiveProfileDraft({ targetCompetition: value })}
              placeholder={normalizeText("Ex.: Supertaça Unificada da Saúde")}
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                fontSize: 13,
                borderRadius: 12,
                backgroundColor: colors.background,
                color: colors.inputText,
              }}
            />
          </View>
          <View style={{ flex: 1, minWidth: 160, flexBasis: 0, gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{normalizeText("Data-alvo")}</Text>
            <TextInput
              value={competitiveTargetDateInput}
              onChangeText={(value) => setCompetitiveTargetDateInput(formatDateInputMask(value))}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                fontSize: 13,
                borderRadius: 12,
                backgroundColor: colors.background,
                color: colors.inputText,
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
                backgroundColor: colors.background,
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
                backgroundColor: colors.background,
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
                backgroundColor: colors.background,
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
              backgroundColor: colors.background,
              minHeight: 80,
              color: colors.inputText,
              fontSize: 13,
              textAlignVertical: "top",
            }}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => {
              void handleSaveCompetitiveProfile();
            }}
            disabled={isSavingCompetitiveProfile}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: isSavingCompetitiveProfile ? colors.primaryDisabledBg : colors.primaryBg,
              alignItems: "center",
            }}
          >
            <Text style={{ color: isSavingCompetitiveProfile ? colors.secondaryText : colors.primaryText, fontWeight: "700" }}>
              {normalizeText(isSavingCompetitiveProfile ? "Salvando..." : "Salvar alterações")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => updateCompetitiveProfileDraft({
              targetCompetition: "",
              tacticalSystem: "",
              currentPhase: "Base",
              notes: "",
            })}
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
              {normalizeText("Limpar campos")}
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => {
            setCompetitiveTargetDateInput("");
            setCompetitiveCycleStartDateInput("");
          }}
          style={{
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: colors.secondaryBg,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
            {normalizeText("Limpar datas")}
          </Text>
        </Pressable>
        </Animated.View>
        ) : null}
      </View>

      <View
        style={{
          gap: 10,
          padding: competitiveBlockPadding,
          borderRadius: 12,
          backgroundColor: colors.secondaryBg,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => toggleCompetitiveBlock("calendar")}
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
            {normalizeText("Calendário da turma")}
          </Text>
          <Ionicons
            name={competitiveBlocksOpen.calendar ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.muted}
          />
        </Pressable>

        {showCompetitiveCalendarContent ? (
        <Animated.View style={[{ gap: 10 }, competitiveCalendarAnimStyle]}>
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
                backgroundColor: colors.background,
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
                backgroundColor: colors.background,
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
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: isSavingCalendarException ? colors.primaryDisabledBg : colors.primaryBg,
            alignItems: "center",
          }}
        >
          <Text style={{ color: isSavingCalendarException ? colors.secondaryText : colors.primaryText, fontWeight: "700" }}>
            {normalizeText(isSavingCalendarException ? "Salvando..." : "Adicionar exceção")}
          </Text>
        </Pressable>

        </Animated.View>
        ) : null}
      </View>

      <View
        style={{
          gap: 10,
          padding: competitiveBlockPadding,
          borderRadius: 12,
          backgroundColor: colors.secondaryBg,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => toggleCompetitiveBlock("exceptions")}
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
            {normalizeText(`Exceções cadastradas (${calendarExceptions.length})`)}
          </Text>
          <Ionicons
            name={competitiveBlocksOpen.exceptions ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.muted}
          />
        </Pressable>

        {showCompetitiveExceptionsContent ? (
        <Animated.View style={[{ gap: 8 }, competitiveExceptionsAnimStyle]}>
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
        </Animated.View>
        ) : null}
      </View>

      </ScrollView>
    </View>
  );
}
