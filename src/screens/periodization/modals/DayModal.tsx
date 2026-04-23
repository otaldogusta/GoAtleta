import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import type { VolumeLevel } from "../../../core/periodization-basics";
import type {
  PeriodizationAutoPlanForCycleDayResult,
  PeriodizationDebugSignals,
} from "../application/build-auto-plan-for-cycle-day";
import type { SessionEnvironment } from "../../../core/models";
import type { ThemeColors } from "../../../ui/app-theme";
import { ModalDialogFrame } from "../../../ui/ModalDialogFrame";
import { Pressable } from "../../../ui/Pressable";
import { getSectionCardStyle } from "../../../ui/section-styles";

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

const formatDebugValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "-";
  }

  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
};

const formatSessionEnvironmentLabel = (value?: SessionEnvironment) => {
  switch (value) {
    case "quadra":
      return "Quadra";
    case "academia":
      return "Academia";
    case "mista":
      return "Mista";
    case "preventiva":
      return "Preventiva";
    default:
      return "";
  }
};

const formatSessionComponentLabel = (component: unknown) => {
  const componentType =
    typeof component === "object" && component && "type" in component
      ? String((component as { type?: string }).type)
      : "";

  switch (componentType) {
    case "quadra_tecnico_tatico":
      return "Quadra técnico-tático";
    case "academia_resistido":
      return "Academia resistido";
    case "preventivo":
      return "Preventivo";
    default:
      return componentType || "Sessão";
  }
};

const formatSessionComponentDetail = (component: unknown) => {
  const componentType =
    typeof component === "object" && component && "type" in component
      ? String((component as { type?: string }).type)
      : "";

  if (componentType === "academia_resistido") {
    const resistanceLabel = (component as { resistancePlan?: { label?: string } }).resistancePlan?.label;
    const durationMin = (component as { durationMin?: number }).durationMin;
    return `${resistanceLabel ?? "Plano de resistência"} · ${durationMin ?? "?"} min`;
  }

  const description = (component as { description?: string }).description;
  const durationMin = (component as { durationMin?: number }).durationMin;
  return `${description ?? "Descrição não disponível"} · ${durationMin ?? "?"} min`;
};

type DebugRowProps = {
  label: string;
  value: unknown;
  colors: ThemeColors;
  normalizeText: (value: string) => string;
};

function DebugRow({ label, value, colors, normalizeText }: DebugRowProps) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: colors.muted, fontSize: 11 }}>{normalizeText(label)}</Text>
      <Text style={{ color: colors.text, fontSize: 12 }}>{normalizeText(formatDebugValue(value))}</Text>
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
  getVolumePalette,
  volumeToPSE,
  normalizeText,
}: Props) {
  const router = useRouter();
  const [showDebugSignals, setShowDebugSignals] = useState(false);
  const historyModeLabel =
    selectedDay?.autoPlan?.historyMode === "bootstrap"
      ? "Bootstrap do ciclo"
      : selectedDay?.autoPlan?.historyMode === "strong_history"
        ? "Historico forte"
        : selectedDay?.autoPlan?.historyMode === "partial_history"
          ? "Historico parcial"
          : "";
  const debugSignals = selectedDay?.autoPlan?.debugSignals;
  const shouldShowDebugSignals = __DEV__ && !isSelectedDayRest && !!debugSignals;

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
            : normalizeText(`Sessão de ${selectedDay.label}`)
          : normalizeText("Sessão")
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
            backgroundColor:
              selectedClass && !isSelectedDayRest ? colors.primaryBg : colors.primaryDisabledBg,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color:
                selectedClass && !isSelectedDayRest
                  ? colors.primaryText
                  : colors.secondaryText,
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
            <>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{normalizeText(activeWeek.title)}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {normalizeText(
                  `Foco: ${selectedDay?.autoPlan?.primarySkillLabel ?? activeWeek.focus}`
                )}
              </Text>

              {selectedDay?.autoPlan ? (
                <View style={{ gap: 4, marginTop: 8 }}>
                  {historyModeLabel ? (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {normalizeText(
                        `${historyModeLabel} · confiança ${selectedDay.autoPlan.historicalConfidence ?? "-"}`
                      )}
                    </Text>
                  ) : null}
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                    {normalizeText(
                      `Sessão ${selectedDay.sessionIndexInWeek ?? "-"}: ${selectedDay.session ?? ""}`
                    )}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {normalizeText(
                      `Intenção: ${selectedDay.autoPlan.pedagogicalIntentLabel}`
                    )}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {normalizeText(
                      `Famílias: ${selectedDay.autoPlan.drillFamiliesLabel || "-"}`
                    )}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {normalizeText(selectedDay.autoPlan.coachSummary)}
                  </Text>

                  {selectedDay.autoPlan.sessionEnvironment ? (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {normalizeText(`Ambiente: ${formatSessionEnvironmentLabel(selectedDay.autoPlan.sessionEnvironment)}`)}
                    </Text>
                  ) : null}

                  {selectedDay.autoPlan.sessionComponents?.length ? (
                    <View style={{ gap: 6, marginTop: 6 }}>
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                        {normalizeText("Componentes da sessão")}
                      </Text>
                      {selectedDay.autoPlan.sessionComponents.map((component, index) => (
                        <View
                          key={`${component.type}-${index}`}
                          style={{
                            padding: 10,
                            borderRadius: 12,
                            backgroundColor: colors.secondaryBg,
                          }}
                        >
                          <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                            {normalizeText(formatSessionComponentLabel(component))}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 12 }}>
                            {normalizeText(formatSessionComponentDetail(component))}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {shouldShowDebugSignals ? (
                    <View
                      style={{
                        marginTop: 8,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        overflow: "hidden",
                      }}
                    >
                      <Pressable
                        onPress={() => setShowDebugSignals((current) => !current)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          backgroundColor: colors.secondaryBg,
                          borderBottomWidth: showDebugSignals ? 1 : 0,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                          {normalizeText(
                            showDebugSignals
                              ? "Debug da periodização: ocultar"
                              : "Debug da periodização: mostrar"
                          )}
                        </Text>
                      </Pressable>

                      {showDebugSignals ? (
                        <View style={{ gap: 10, padding: 10 }}>
                          <View style={{ gap: 8 }}>
                            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                              {normalizeText("Entrada do adapter")}
                            </Text>
                            <DebugRow
                              label="Turma"
                              value={debugSignals.adapterInput.className}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                            <DebugRow
                              label="Objetivo"
                              value={debugSignals.adapterInput.goal}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                            <DebugRow
                              label="Faixa etária"
                              value={debugSignals.adapterInput.ageBand}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                            <DebugRow
                              label="Sessões por semana"
                              value={debugSignals.adapterInput.weeklySessions}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                            <DebugRow
                              label="Semana e volume"
                              value={`Semana ${debugSignals.adapterInput.week} · ${debugSignals.adapterInput.volume}`}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                            <DebugRow
                              label="Carga planejada"
                              value={`${debugSignals.adapterInput.plannedSessionLoad} / ${debugSignals.adapterInput.plannedWeeklyLoad}`}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                          </View>

                          <View style={{ gap: 8 }}>
                            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                              {normalizeText("Contexto do ciclo")}
                            </Text>
                            <DebugRow
                              label="Goal mapeado"
                              value={debugSignals.cycleContext.classGoal}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                            <DebugRow
                              label="Fase e intenção"
                              value={`${debugSignals.cycleContext.planningPhase ?? "-"} · ${debugSignals.cycleContext.phaseIntent}`}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                            <DebugRow
                              label="Estágio"
                              value={debugSignals.cycleContext.developmentStage}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                            <DebugRow
                              label="Carga semanal"
                              value={debugSignals.cycleContext.weeklyLoadIntent}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                            <DebugRow
                              label="Intenção pedagógica"
                              value={debugSignals.cycleContext.pedagogicalIntent}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                            <DebugRow
                              label="Evitar repetir"
                              value={debugSignals.cycleContext.mustAvoidRepeating}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                            <DebugRow
                              label="Restrições"
                              value={debugSignals.cycleContext.constraints}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                          </View>

                          <View style={{ gap: 8 }}>
                            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                              {normalizeText("Estratégia final")}
                            </Text>
                            <DebugRow
                              label="Habilidade primária"
                              value={debugSignals.strategy.primarySkill}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                            <DebugRow
                              label="Habilidade secundária"
                              value={debugSignals.strategy.secondarySkill}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                            <DebugRow
                              label="Progressão"
                              value={debugSignals.strategy.progressionDimension}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                            <DebugRow
                              label="Carga"
                              value={debugSignals.strategy.loadIntent}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                            <DebugRow
                              label="Famílias"
                              value={debugSignals.strategy.drillFamilies}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                            <DebugRow
                              label="Famílias proibidas"
                              value={debugSignals.strategy.forbiddenDrillFamilies}
                              colors={colors}
                              normalizeText={normalizeText}
                            />
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                {(() => {
                  const palette = getVolumePalette(activeWeek.volume, colors);
                  const sourcePalette =
                    activeWeek.source === "MANUAL"
                      ? { bg: colors.warningBg, text: colors.warningText }
                      : { bg: colors.secondaryBg, text: colors.text };

                  return (
                    <>
                      <View
                        style={{
                          paddingVertical: 3,
                          paddingHorizontal: 8,
                          borderRadius: 999,
                          backgroundColor: palette.bg,
                        }}
                      >
                        <Text style={{ color: palette.text, fontSize: 11 }}>
                          {normalizeText(`Volume: ${activeWeek.volume}`)}
                        </Text>
                      </View>

                      <View
                        style={{
                          paddingVertical: 3,
                          paddingHorizontal: 8,
                          borderRadius: 999,
                          backgroundColor: sourcePalette.bg,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ color: sourcePalette.text, fontSize: 11, fontWeight: "700" }}>
                          {activeWeek.source}
                        </Text>
                      </View>
                    </>
                  );
                })()}

                <View
                  style={{
                    paddingVertical: 3,
                    paddingHorizontal: 8,
                    borderRadius: 999,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 11 }}>
                    {normalizeText(volumeToPSE[activeWeek.volume])}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 4, marginTop: 8 }}>
                {activeWeek.notes.map((note) => (
                  <Text key={note} style={{ color: colors.muted, fontSize: 12 }}>
                    {normalizeText(`- ${note}`)}
                  </Text>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ModalDialogFrame>
  );
}
