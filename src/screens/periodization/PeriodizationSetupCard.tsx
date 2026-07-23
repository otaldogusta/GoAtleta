import type React from "react";
import { Text, TextInput, View } from "react-native";

import { CLASS_DEVELOPMENT_LEVEL_OPTIONS } from "../../core/class-development-level";
import { Button } from "../../ui/Button";
import { DateInput } from "../../ui/DateInput";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { getSectionCardStyle } from "../../ui/section-styles";
import type { ThemeColors } from "../../ui/app-theme";

const LEVEL_OPTIONS = CLASS_DEVELOPMENT_LEVEL_OPTIONS;

type PeriodizationSetupCardProps = {
  colors: ThemeColors;
  goal: string;
  mvLevel: string;
  cycleStartDate: string;
  cycleLength: number;
  showCyclePicker: boolean;
  cycleTriggerRef: React.RefObject<View | null>;
  configured: boolean;
  dirty: boolean;
  saving: boolean;
  error: string;
  onGoalChange: (value: string) => void;
  onMvLevelChange: (value: string) => void;
  onCycleStartDateChange: (value: string) => void;
  onToggleCyclePicker: () => void;
  onOpenCalendar: () => void;
  onSave: () => void;
};

export function PeriodizationSetupCard({
  colors,
  goal,
  mvLevel,
  cycleStartDate,
  cycleLength,
  showCyclePicker,
  cycleTriggerRef,
  configured,
  dirty,
  saving,
  error,
  onGoalChange,
  onMvLevelChange,
  onCycleStartDateChange,
  onToggleCyclePicker,
  onOpenCalendar,
  onSave,
}: PeriodizationSetupCardProps) {
  return (
    <View style={[getSectionCardStyle(colors, "primary"), { gap: 14 }]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <View style={{ flex: 1, minWidth: 220 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
            Configuração da periodização
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 }}>
            Defina objetivo, nível e macrociclo desta turma antes de gerar o ciclo.
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            borderRadius: 999,
            paddingHorizontal: 9,
            paddingVertical: 5,
            backgroundColor: configured ? colors.successBg : colors.secondaryBg,
          }}
        >
          <GoAtletaIcon
            name={configured ? "checkmarkCircle" : "warningCircle"}
            size={13}
            color={configured ? colors.successText : colors.muted}
          />
          <Text
            style={{
              color: configured ? colors.successText : colors.muted,
              fontSize: 11,
              fontWeight: "700",
            }}
          >
            {configured ? "Configurada" : "Pendente"}
          </Text>
        </View>
      </View>

      <View style={{ gap: 5 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Objetivo da turma</Text>
        <TextInput
          accessibilityLabel="Objetivo da periodização"
          placeholder="Ex.: Fundamentos, potência ou competição"
          value={goal}
          onChangeText={onGoalChange}
          placeholderTextColor={colors.placeholder}
          style={{
            minHeight: 44,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            backgroundColor: colors.inputBg,
            color: colors.inputText,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 13,
          }}
        />
      </View>

      <View style={{ gap: 5 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Nível da turma</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {LEVEL_OPTIONS.map((option) => {
            const active = mvLevel === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={`Nível ${option.label}`}
                onPress={() => onMvLevelChange(option.value)}
                style={{
                  minHeight: 38,
                  justifyContent: "center",
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? colors.primaryBg : colors.border,
                  backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                  paddingHorizontal: 13,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    color: active ? colors.primaryText : colors.text,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 210, gap: 5 }}>
          <Text style={{ color: colors.muted, fontSize: 11 }}>Macrociclo anual</Text>
          <View ref={cycleTriggerRef}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Duração do macrociclo anual"
              onPress={onToggleCyclePicker}
              style={{
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                backgroundColor: colors.inputBg,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                {cycleLength} semanas
              </Text>
              <GoAtletaIcon
                name="chevronDown"
                size={16}
                color={colors.muted}
                style={{ transform: [{ rotate: showCyclePicker ? "180deg" : "0deg" }] }}
              />
            </Pressable>
          </View>
        </View>

        <View style={{ flex: 1, minWidth: 210, gap: 5 }}>
          <Text style={{ color: colors.muted, fontSize: 11 }}>Início do ciclo</Text>
          <DateInput
            value={cycleStartDate}
            onChange={onCycleStartDateChange}
            onOpenCalendar={onOpenCalendar}
            placeholder="DD/MM/AAAA"
          />
        </View>
      </View>

      {error ? <Text style={{ color: colors.dangerText, fontSize: 12 }}>{error}</Text> : null}

      <Button
        label={
          saving
            ? "Salvando..."
            : dirty
              ? "Salvar configuração"
              : configured
                ? "Configuração salva"
                : "Complete a configuração"
        }
        onPress={onSave}
        disabled={saving || !dirty}
      />
    </View>
  );
}
