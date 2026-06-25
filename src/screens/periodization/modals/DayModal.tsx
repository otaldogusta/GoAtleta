import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import type { SessionCoachGuidance } from "../../../core/models";
import type { VolumeLevel } from "../../../core/periodization-basics";
import type { ThemeColors } from "../../../ui/app-theme";
import { ModalDialogFrame } from "../../../ui/ModalDialogFrame";
import { Pressable } from "../../../ui/Pressable";
import { getSectionCardStyle } from "../../../ui/section-styles";
import type { PeriodizationAutoPlanForCycleDayResult } from "../application/build-auto-plan-for-cycle-day";

type WeekPlan = {
  title: string;
  focus: string;
  volume: VolumeLevel;
  notes: string[];
  source: "AUTO" | "MANUAL";
};

type DayItem = {
  label: string;
  session?: string;
  summary?: string;
  sessionIndexInWeek?: number;
  autoPlan?: PeriodizationAutoPlanForCycleDayResult | null;
};

type ClassGroup = {
  id: string;
  name: string;
  unit?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  modalCardStyle: object;
  colors: ThemeColors;
  selectedDay: DayItem | null | undefined;
  isSelectedDayRest: boolean;
  selectedClass: ClassGroup | null | undefined;
  selectedDayDate: Date | null | undefined;
  activeWeek: WeekPlan;
  formatDisplayDate: (iso: string) => string;
  formatIsoDate: (value: Date) => string;
  getVolumePalette: (level: VolumeLevel, colors: ThemeColors) => { bg: string; text: string };
  volumeToPSE: Record<VolumeLevel, string>;
  normalizeText: (value: string) => string;
};

const cleanText = (value: string | undefined, fallback: string, limit = 140) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  const resolved = text || fallback;
  return resolved.length > limit ? `${resolved.slice(0, Math.max(0, limit - 3)).trimEnd()}...` : resolved;
};

function GuidanceSection({
  title,
  items,
  colors,
  normalizeText,
}: {
  title: string;
  items: string[];
  colors: ThemeColors;
  normalizeText: (value: string) => string;
}) {
  if (!items.length) return null;

  return (
    <View style={{ gap: 4, flex: 1, minWidth: 190 }}>
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>{normalizeText(title)}</Text>
      {items.slice(0, 3).map((item) => (
        <Text key={item} style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
          {normalizeText(cleanText(item, "", 110))}
        </Text>
      ))}
    </View>
  );
}

function CoachGuidancePanel({
  guidance,
  fallbackTitle,
  fallbackObjective,
  colors,
  normalizeText,
}: {
  guidance: SessionCoachGuidance | null | undefined;
  fallbackTitle: string;
  fallbackObjective: string;
  colors: ThemeColors;
  normalizeText: (value: string) => string;
}) {
  const resolvedGuidance: SessionCoachGuidance = guidance ?? {
    title: fallbackTitle,
    subtitle: fallbackObjective,
    doNow: [
      fallbackObjective,
      "Comece com tarefa curta com bola.",
      "Feche com jogo simples e regra clara.",
    ],
    avoidToday: [
      "Evite explicar muitas regras ao mesmo tempo.",
      "Evite corrigir tudo durante o jogo.",
      "Evite avançar se a turma perder organização.",
    ],
    advanceIf: [
      "A maioria cumprir a tarefa sem parar a rodada.",
      "A comunicação aparecer antes do contato com a bola.",
      "A bola for direcionada com intenção.",
    ],
    simplifyIf: [
      "A bola cair logo no primeiro contato.",
      "Os alunos ficarem parados esperando.",
      "A regra principal não ficar clara para a turma.",
    ],
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{normalizeText("Aula sugerida")}</Text>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
          {normalizeText(cleanText(resolvedGuidance.title, fallbackTitle, 80))}
        </Text>
        {resolvedGuidance.subtitle ? (
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            {normalizeText(cleanText(resolvedGuidance.subtitle, fallbackObjective, 150))}
          </Text>
        ) : null}
        {resolvedGuidance.setupHint ? (
          <Text style={{ color: colors.text, fontSize: 12, lineHeight: 18 }}>
            {normalizeText(cleanText(resolvedGuidance.setupHint, "", 150))}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <GuidanceSection title="Faça" items={resolvedGuidance.doNow ?? []} colors={colors} normalizeText={normalizeText} />
        <GuidanceSection title="Evite" items={resolvedGuidance.avoidToday ?? []} colors={colors} normalizeText={normalizeText} />
        <GuidanceSection title="Avance se" items={resolvedGuidance.advanceIf ?? []} colors={colors} normalizeText={normalizeText} />
        <GuidanceSection title="Simplifique se" items={resolvedGuidance.simplifyIf ?? []} colors={colors} normalizeText={normalizeText} />
      </View>
    </View>
  );
}

export function DayModal({
  visible,
  onClose,
  modalCardStyle,
  colors,
  selectedDay,
  isSelectedDayRest,
  selectedClass,
  selectedDayDate,
  activeWeek,
  formatDisplayDate,
  formatIsoDate,
  normalizeText,
}: Props) {
  const router = useRouter();
  const autoPlan = selectedDay?.autoPlan;
  const lessonTitle = cleanText(selectedDay?.session || autoPlan?.sessionLabel || activeWeek.title, "Aula do dia");
  const lessonObjective = cleanText(
    autoPlan?.coachSummary || selectedDay?.summary || activeWeek.focus,
    "Conduza a aula com objetivo simples."
  );

  return (
    <ModalDialogFrame
      visible={visible}
      onClose={onClose}
      cardStyle={[modalCardStyle, { paddingBottom: 12, maxHeight: "92%", height: "92%" }]}
      position="center"
      colors={colors}
      title={
        selectedDay
          ? isSelectedDayRest
            ? normalizeText(`Descanso de ${selectedDay.label}`)
            : normalizeText(`Aula de ${selectedDay.label}`)
          : normalizeText("Aula")
      }
      subtitle={selectedClass ? normalizeText(selectedClass.name) : undefined}
      footer={
        <Pressable
          onPress={() => {
            if (!selectedClass || !selectedDayDate || isSelectedDayRest) return;
            router.push({
              pathname: "/class/[id]/session",
              params: {
                id: selectedClass.id,
                date: formatIsoDate(selectedDayDate),
                autogenerate: selectedDay?.autoPlan ? "1" : "0",
                source: "periodization",
              },
            });
            onClose();
          }}
          style={{
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: selectedClass && !isSelectedDayRest ? colors.primaryBg : colors.primaryDisabledBg,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: selectedClass && !isSelectedDayRest ? colors.primaryText : colors.secondaryText,
              fontWeight: "700",
            }}
          >
            {isSelectedDayRest ? "Dia de descanso" : "Abrir Aula do Dia"}
          </Text>
        </Pressable>
      }
    >
      <ScrollView
        contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
        style={{ maxHeight: "92%" }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        <View style={getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16 })}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Turma</Text>
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            {normalizeText(selectedClass?.name ?? "Selecione uma turma")}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {normalizeText(selectedClass?.unit ?? "Sem unidade")}
          </Text>
          {selectedDayDate ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {"Data sugerida: " + formatDisplayDate(formatIsoDate(selectedDayDate))}
            </Text>
          ) : null}
        </View>

        <View style={getSectionCardStyle(colors, "info", { padding: 12, radius: 16 })}>
          {isSelectedDayRest ? (
            <>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{normalizeText("Dia de descanso")}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {normalizeText("Sem sessão planejada para este dia.")}
              </Text>
            </>
          ) : (
            <CoachGuidancePanel
              guidance={autoPlan?.coachGuidance}
              fallbackTitle={lessonTitle}
              fallbackObjective={lessonObjective}
              colors={colors}
              normalizeText={normalizeText}
            />
          )}
        </View>
      </ScrollView>
    </ModalDialogFrame>
  );
}
