import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { ptBR } from "../../../constants/copy/pt-br";
import {
  type ScoutingCounts,
  type ScoutingScore,
  type ScoutingSkill,
  scoutingSkillHelp,
  scoutingSkills,
} from "../../../core/scouting";
import { Pressable } from "../../../ui/Pressable";
import type { ThemeColors } from "../../../ui/app-theme";

type ScoutingMode = "treino" | "jogo";

type ScoutingSkillMetric = {
  total: number;
  avg: number;
  goodPct: number;
};

type ScoutingFocusSuggestion = {
  label: string;
  text: string;
} | null;

type SessionScoutingTabProps = {
  colors: ThemeColors;
  canOpenAdvancedScouting: boolean;
  scoutingMode: ScoutingMode;
  totalActions: number;
  showScoutingGuide: boolean;
  scoutingCounts: ScoutingCounts;
  scoutingTotals: ScoutingSkillMetric[];
  focusSuggestion: ScoutingFocusSuggestion;
  scoutingHasChanges: boolean;
  scoutingSaving: boolean;
  onOpenAdvancedScouting: () => void;
  onChangeScoutingMode: (mode: ScoutingMode) => void;
  onToggleScoutingGuide: () => void;
  onUpdateScoutingCount: (
    skillId: ScoutingSkill,
    score: ScoutingScore,
    delta: 1 | -1
  ) => void;
  onSaveScouting: () => void;
};

export function SessionScoutingTab({
  colors,
  canOpenAdvancedScouting,
  scoutingMode,
  totalActions,
  showScoutingGuide,
  scoutingCounts,
  scoutingTotals,
  focusSuggestion,
  scoutingHasChanges,
  scoutingSaving,
  onOpenAdvancedScouting,
  onChangeScoutingMode,
  onToggleScoutingGuide,
  onUpdateScoutingCount,
  onSaveScouting,
}: SessionScoutingTabProps) {
  const saveDisabled = !scoutingHasChanges || scoutingSaving;

  return (
    <View
      style={{
        padding: 14,
        borderRadius: 18,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
        gap: 10,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
          {ptBR.scouting.title}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {ptBR.scouting.operationHint}
        </Text>
        <Pressable
          onPress={onOpenAdvancedScouting}
          disabled={!canOpenAdvancedScouting}
          style={{
            marginTop: 6,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: colors.primaryBg,
            alignSelf: "flex-start",
            opacity: canOpenAdvancedScouting ? 1 : 0.65,
          }}
        >
          <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "800" }}>
            Abrir scouting com leitura do jogo
          </Text>
        </Pressable>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          {(["treino", "jogo"] as const).map((mode) => {
            const isActive = scoutingMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => onChangeScoutingMode(mode)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isActive ? colors.primaryBg : colors.border,
                  backgroundColor: isActive ? colors.primaryBg : colors.secondaryBg,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: isActive ? colors.primaryText : colors.text,
                    fontWeight: "700",
                  }}
                >
                  {mode === "treino" ? ptBR.scouting.modeTrain : ptBR.scouting.modeMatch}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {ptBR.scouting.totalActions}: {totalActions}
        </Text>
        <Pressable
          onPress={onToggleScoutingGuide}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
        >
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
            {showScoutingGuide ? ptBR.scouting.hideGuide : ptBR.scouting.showGuide}
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={colors.muted}
            style={{ transform: [{ rotate: showScoutingGuide ? "180deg" : "0deg" }] }}
          />
        </Pressable>
      </View>

      {showScoutingGuide ? (
        <View
          style={{
            padding: 10,
            borderRadius: 12,
            backgroundColor: colors.inputBg,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 6,
          }}
        >
          <Text style={{ fontWeight: "700", color: colors.text, fontSize: 12 }}>
            {ptBR.scouting.quickGuideTitle}
          </Text>
          <View style={{ gap: 2 }}>
            {scoutingSkills.map((skill) => (
              <Text key={skill.id} style={{ color: colors.muted, fontSize: 12 }}>
                {skill.label}: {scoutingSkillHelp[skill.id].join(" | ")}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        {scoutingSkills.map((skill, index) => {
          const metrics = scoutingTotals[index] ?? { total: 0, avg: 0, goodPct: 0 };
          const counts = scoutingCounts[skill.id];
          const goodPct = Math.round(metrics.goodPct * 100);
          const shortGuide = scoutingSkillHelp[skill.id]
            .map((line, idx) => `${idx} ${line}`)
            .join(" • ");

          return (
            <View
              key={skill.id}
              style={{
                padding: 12,
                borderRadius: 14,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  {skill.label}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {metrics.total} ações | {ptBR.scouting.averageLabel} {metrics.avg.toFixed(2)}
                </Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{shortGuide}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {([0, 1, 2] as const).map((score) => {
                  const palette =
                    score === 2
                      ? { bg: colors.successBg, text: colors.successText }
                      : score === 1
                        ? { bg: colors.inputBg, text: colors.text }
                        : { bg: colors.dangerSolidBg, text: colors.dangerSolidText };

                  return (
                    <Pressable
                      key={score}
                      onPress={() => onUpdateScoutingCount(skill.id, score, 1)}
                      onLongPress={() => onUpdateScoutingCount(skill.id, score, -1)}
                      onContextMenu={(event) => {
                        if (
                          event &&
                          typeof (event as { preventDefault?: () => void }).preventDefault ===
                            "function"
                        ) {
                          (event as { preventDefault: () => void }).preventDefault();
                        }
                        onUpdateScoutingCount(skill.id, score, -1);
                      }}
                      delayLongPress={200}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 12,
                        alignItems: "center",
                        backgroundColor: palette.bg,
                      }}
                    >
                      <Text style={{ color: palette.text, fontWeight: "700" }}>
                        {score}
                      </Text>
                      <Text style={{ color: palette.text, fontSize: 11, opacity: 0.9 }}>
                        x{counts[score]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {ptBR.scouting.goodRateLabel}: {goodPct}%
              </Text>
            </View>
          );
        })}
      </View>

      {focusSuggestion ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            {ptBR.scouting.nextSessionFocus}: {focusSuggestion.label}
          </Text>
          <Text style={{ color: colors.muted }}>{focusSuggestion.text}</Text>
        </View>
      ) : (
        <Text style={{ color: colors.muted }}>
          {ptBR.scouting.minimumActionsHint}
        </Text>
      )}

      <Pressable
        onPress={onSaveScouting}
        disabled={saveDisabled}
        style={{
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: saveDisabled ? colors.primaryDisabledBg : colors.primaryBg,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: saveDisabled ? colors.secondaryText : colors.primaryText,
            fontWeight: "700",
          }}
        >
          {ptBR.scouting.saveAction}
        </Text>
      </Pressable>
    </View>
  );
}
