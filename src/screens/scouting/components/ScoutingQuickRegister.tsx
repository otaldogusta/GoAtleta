import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import { formatScoutingSkillLabel, getScoutingQualityOptionsForSkill } from "../scouting-action-labels";
import type { ScoutingActionGamePhase, ScoutingActionSkill } from "../../../core/scouting-action";
import { useAppTheme } from "../../../ui/app-theme";
import { Button } from "../../../ui/Button";
import { Pressable } from "../../../ui/Pressable";
import { getSectionCardStyle } from "../../../ui/section-styles";

type Props = {
  athleteName: string;
  gamePhase: ScoutingActionGamePhase;
  isDesktop: boolean;
  isSavingAction: boolean;
  notes: string;
  videoLabel?: string;
  isVideoSession?: boolean;
  onAthleteNameChange: (value: string) => void;
  onGamePhaseChange: (value: ScoutingActionGamePhase) => void;
  onNotesChange: (value: string) => void;
  onQualityOptionChange: (value: string) => void;
  onRegister: () => void;
  onSkillChange: (value: ScoutingActionSkill) => void;
  onVideoLabelChange?: (value: string) => void;
  qualityOptionId: string;
  quickAthletes: string[];
  skill: ScoutingActionSkill;
};

export function ScoutingQuickRegister({
  athleteName,
  gamePhase,
  isDesktop,
  isSavingAction,
  isVideoSession = false,
  notes,
  onAthleteNameChange,
  onGamePhaseChange,
  onNotesChange,
  onQualityOptionChange,
  onRegister,
  onSkillChange,
  onVideoLabelChange,
  qualityOptionId,
  quickAthletes,
  skill,
  videoLabel = "",
}: Props) {
  const { colors } = useAppTheme();
  const [showNotes, setShowNotes] = useState(false);
  const qualityOptions = getScoutingQualityOptionsForSkill(skill);
  const selectedQuickAthlete = quickAthletes.includes(athleteName);
  const showManualAthleteField = !selectedQuickAthlete;
  const showNotesField = showNotes || notes.trim().length > 0;

  return (
    <View style={[getSectionCardStyle(colors, "neutral", { radius: 18, padding: 16, shadow: false }), { gap: 10 }]}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Registro rápido</Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          {isVideoSession
            ? "Registre os lances observados no vídeo."
            : "Escolha atleta, fundamento e resultado. Um toque registra a ação."}
        </Text>
      </View>

      {quickAthletes.length ? (
        <PickerPills
          label="Atleta"
          value={athleteName}
          onChange={onAthleteNameChange}
          options={quickAthletes.slice(0, 5).map((name) => ({ value: name, label: name }))}
          allowClearChip
        />
      ) : null}

      {showManualAthleteField || showNotesField ? (
        <View style={{ flexDirection: isDesktop ? "row" : "column", gap: 10 }}>
          {showManualAthleteField ? (
            <View style={{ flex: 1 }}>
              <Field
                label="Atleta ou nome"
                value={athleteName}
                onChangeText={onAthleteNameChange}
                placeholder="Ex.: Maria"
              />
            </View>
          ) : null}
          {showNotesField ? (
            <View style={{ flex: 1 }}>
              <Field
                label="Observação rápida"
                value={notes}
                onChangeText={onNotesChange}
                placeholder="Contexto rápido da ação"
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {!showNotesField ? (
        <View style={{ alignItems: "flex-start" }}>
          <Pressable onPress={() => setShowNotes(true)}>
            <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>+ Adicionar observação</Text>
          </Pressable>
        </View>
      ) : null}

      {isVideoSession ? (
        <Field
          label="Lance do vídeo"
          value={videoLabel}
          onChangeText={onVideoLabelChange ?? (() => undefined)}
          placeholder="Ex.: rally longo, saque no início do recorte"
        />
      ) : null}

      <View style={{ flexDirection: isDesktop ? "row" : "column", gap: 10 }}>
        <View style={{ flex: 1.45 }}>
          <PickerPills
            label="Fundamento"
            value={skill}
            onChange={(value) => onSkillChange(value as ScoutingActionSkill)}
            options={[
              { value: "serve", label: "Saque" },
              { value: "receive", label: "Recepção" },
              { value: "set", label: "Levantamento" },
              { value: "attack", label: "Ataque" },
              { value: "block", label: "Bloqueio" },
              { value: "defense", label: "Defesa" },
              { value: "coverage", label: "Cobertura" },
              { value: "transition", label: "Transição" },
              { value: "communication", label: "Comunicação" },
            ]}
            maxRows={isDesktop ? 2 : undefined}
          />
        </View>
        <View style={{ flex: 0.95 }}>
          <PickerPills
            label="Fase"
            value={gamePhase}
            onChange={(value) => onGamePhaseChange(value as ScoutingActionGamePhase)}
            options={[
              { value: "serve", label: "Saque" },
              { value: "sideout", label: "Side-out" },
              { value: "transition", label: "Transição" },
              { value: "freeball", label: "Freeball" },
              { value: "out_of_system", label: "Pressão" },
            ]}
          />
        </View>
      </View>

      <View
        style={{
          flexDirection: isDesktop ? "row" : "column",
          gap: 10,
          alignItems: isDesktop ? "flex-end" : "stretch",
        }}
      >
        <View style={{ flex: 1 }}>
          <PickerPills
            label={`Resultado da ${formatScoutingSkillLabel(skill).toLowerCase()}`}
            value={qualityOptionId}
            onChange={onQualityOptionChange}
            options={qualityOptions.map((item) => ({ value: item.id, label: item.label }))}
            colorModeByOption
          />
        </View>
        <View style={{ width: isDesktop ? 160 : "100%" }}>
          <Button
            label="Registrar"
            onPress={onRegister}
            loading={isSavingAction}
            disabled={isSavingAction}
          />
        </View>
      </View>
    </View>
  );
}

function Field({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={{
          minHeight: 42,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.inputBg,
          paddingHorizontal: 12,
          paddingVertical: 8,
          color: colors.text,
          fontSize: 14,
        }}
      />
    </View>
  );
}

function optionTone(value: string) {
  if (value.includes("error")) return "danger";
  if (value.includes("low") || value.includes("pass_c") || value.includes("in_play")) return "warning";
  if (value.includes("medium") || value.includes("pass_b") || value.includes("difficult")) return "info";
  return "success";
}

function PickerPills({
  allowClearChip = false,
  colorModeByOption = false,
  label,
  maxRows,
  onChange,
  options,
  value,
}: {
  allowClearChip?: boolean;
  colorModeByOption?: boolean;
  label: string;
  maxRows?: number;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  value: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{label}</Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          maxHeight: maxRows ? maxRows * 34 + (maxRows - 1) * 8 : undefined,
          overflow: maxRows ? "hidden" : "visible",
        }}
      >
        {options.map((option) => {
          const active = option.value === value;
          const tone = optionTone(option.value);
          const palette =
            tone === "danger"
              ? { bg: colors.dangerBg, text: colors.dangerText }
              : tone === "warning"
                ? { bg: colors.warningBg, text: colors.warningText }
                : tone === "info"
                  ? { bg: colors.infoBg, text: colors.infoText }
                  : { bg: colors.successBg, text: colors.successText };
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={{
                paddingVertical: 7,
                paddingHorizontal: 11,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? colors.text : colors.border,
                backgroundColor: colorModeByOption ? palette.bg : active ? colors.text : colors.card,
              }}
            >
              <Text
                style={{
                  color: colorModeByOption ? palette.text : active ? colors.background : colors.text,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
        {allowClearChip ? (
          <Pressable
            onPress={() => onChange("")}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 11,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>+ Outro</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
