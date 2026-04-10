import { Ionicons } from "@expo/vector-icons";
import { Animated, Text, View } from "react-native";

import { type ThemeColors } from "../../ui/app-theme";
import { ClassGenderBadge } from "../../ui/ClassGenderBadge";
import { Pressable } from "../../ui/Pressable";
import { getSectionCardStyle } from "../../ui/section-styles";

import type { ClassGroup, ClassPlan } from "../../core/models";
import { isAnnualCycle, type VolumeLevel } from "../../core/periodization-basics";

type WeekPlan = {
  week: number;
  title: string;
  focus: string;
  volume: VolumeLevel;
  notes: string[];
  dateRange?: string;
  sessionDatesLabel?: string;
  jumpTarget: string;
  PSETarget: string;
  plannedSessionLoad: number;
  plannedWeeklyLoad: number;
  source: "AUTO" | "MANUAL";
};

type OverviewTabProps = {
  colors: ThemeColors;
  normalizeText: (value: string) => string;
  formatShortDate: (value: Date | null) => string;
  nextSessionDate: Date | null;
  classStartTimeLabel: string;
  hasInitialClass: boolean;
  showClassPicker: boolean;
  classTriggerRef: React.RefObject<View | null>;
  hasUnitSelected: boolean;
  togglePicker: (key: "class" | "unit" | "meso" | "micro") => void;
  setClassPickerTop: (value: number) => void;
  selectedClass: ClassGroup | null;
  showUnitPicker: boolean;
  unitTriggerRef: React.RefObject<View | null>;
  setUnitPickerTop: (value: number) => void;
  selectedUnit: string;
  mesoTriggerRef: React.RefObject<View | null>;
  showMesoPicker: boolean;
  cycleLength: number;
  microTriggerRef: React.RefObject<View | null>;
  showMicroPicker: boolean;
  sessionsPerWeek: number;
  volumeOrder: readonly VolumeLevel[];
  getVolumePalette: (level: VolumeLevel, colors: ThemeColors) => { bg: string; text: string; border: string };
  volumeCounts: Record<VolumeLevel, number>;
  progressBars: number[];
  weekPlans: WeekPlan[];
  painAlert: string | null;
  painAlertDates: string[];
  isOrgAdmin: boolean;
  router: { push: (params: any) => void };
  classPlans: ClassPlan[];
  isSavingPlans: boolean;
  onCompleteMissingCoverage: () => void;
  setShowGenerateModal: (value: boolean) => void;
  unitMismatchWarning: string;
};

export function OverviewTab({
  colors,
  normalizeText,
  formatShortDate,
  nextSessionDate,
  classStartTimeLabel,
  hasInitialClass,
  showClassPicker,
  classTriggerRef,
  hasUnitSelected,
  togglePicker,
  setClassPickerTop,
  selectedClass,
  showUnitPicker,
  unitTriggerRef,
  setUnitPickerTop,
  selectedUnit,
  mesoTriggerRef,
  showMesoPicker,
  cycleLength,
  microTriggerRef,
  showMicroPicker,
  sessionsPerWeek,
  volumeOrder,
  getVolumePalette,
  volumeCounts,
  progressBars,
  weekPlans,
  painAlert,
  painAlertDates,
  isOrgAdmin,
  router,
  classPlans,
  isSavingPlans,
  onCompleteMissingCoverage,
  setShowGenerateModal,
  unitMismatchWarning,
}: OverviewTabProps) {
  const coveredWeeks = new Set(
    classPlans
      .map((plan) => plan.weekNumber)
      .filter((weekNumber) => Number.isFinite(weekNumber) && weekNumber >= 1 && weekNumber <= cycleLength)
  ).size;
  const missingWeeks = Math.max(0, cycleLength - coveredWeeks);
  const showAnnualCoverageWarning = Boolean(
    selectedClass && isAnnualCycle(cycleLength) && missingWeeks > 0
  );

  return (
    <>

      <View
        style={[
          getSectionCardStyle(colors, "primary"),
          { borderLeftWidth: 1, borderLeftColor: colors.border },
        ]}
      >

        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>

          {normalizeText("Visão geral")}

        </Text>

          <Text style={{ color: colors.muted, fontSize: 12 }}>

            {normalizeText("Panorama rápido do ciclo e da turma atual")}

        </Text>

        <View

          style={[

            getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16, shadow: false }),

            { marginTop: 12, zIndex: 0, position: "relative" },

          ]}

        >

          <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>

            {normalizeText("Próxima sessão")}

          </Text>

          <View

            style={{

              flexDirection: "row",

              alignItems: "center",

              marginTop: 6,

              justifyContent: "center",

            }}

          >

            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>

              {formatShortDate(nextSessionDate)}

            </Text>

            <View

              style={{

                width: 1,

                height: 18,

                marginHorizontal: 10,

                backgroundColor: colors.border,

              }}

            />

            <Text style={{ color: colors.muted, fontSize: 12 }}>

              {classStartTimeLabel}

            </Text>

          </View>

        </View>

        { !hasInitialClass ? (
        <View

          style={{

            flexDirection: "row",

            flexWrap: "wrap",

            gap: 12,

            marginTop: 6,

            overflow: "visible",

          }}

        >

          <View

            style={[

              getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16, shadow: false }),

              {

                flexBasis: "48%",

                zIndex: showClassPicker ? 30 : 1,

                position: "relative",

                overflow: "visible",

              },

            ]}

          >

            <Text style={{ color: colors.muted, fontSize: 12 }}>Turma</Text>

            <View ref={classTriggerRef} style={{ position: "relative" }}>

              <Pressable

                onPress={() => {

                  if (!hasUnitSelected) return;

                  togglePicker("class");

                }}

                disabled={!hasUnitSelected}

                onLayout={(event) => {

                  setClassPickerTop(event.nativeEvent.layout.height);

                }}

                style={{

                  marginTop: 6,

                  paddingVertical: 10,

                  paddingHorizontal: 12,

                  borderRadius: 12,

                  backgroundColor: colors.inputBg,

                  borderWidth: 1,

                  borderColor: colors.border,

                  opacity: hasUnitSelected ? 1 : 0.6,

                }}

              >

                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 }}>

                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>

                        {normalizeText(selectedClass?.name ?? "Selecione")}

                      </Text>

                      { selectedClass ? (

                        <ClassGenderBadge gender={selectedClass?.gender ?? "misto"} />

                      ) : null}

                    </View>

                    <Animated.View

                      style={{

                        transform: [{ rotate: showClassPicker ? "180deg" : "0deg" }],

                      }}

                    >

                    <Ionicons name="chevron-down" size={16} color={colors.muted} />

                    </Animated.View>

                </View>

              </Pressable>

            </View>

          </View>

          <View

            style={[

              getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16, shadow: false }),

              {

                flexBasis: "48%",

                zIndex: showUnitPicker ? 30 : 1,

                position: "relative",

                overflow: "visible",

              },

            ]}

          >

            <Text style={{ color: colors.muted, fontSize: 12 }}>Unidade</Text>

            <View ref={unitTriggerRef} style={{ position: "relative" }}>

              <Pressable

                onPress={() => togglePicker("unit")}

                onLayout={(event) => {

                  setUnitPickerTop(event.nativeEvent.layout.height);

                }}

                style={{

                  marginTop: 6,

                  paddingVertical: 10,

                  paddingHorizontal: 12,

                  borderRadius: 12,

                  backgroundColor: colors.inputBg,

                  borderWidth: 1,

                  borderColor: colors.border,

                }}

              >

                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>

                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>

                    {selectedUnit
                      ? normalizeText(selectedClass?.unit ?? selectedUnit)
                      : normalizeText("Selecione")}

                  </Text>

                  <Animated.View

                    style={{

                      transform: [{ rotate: showUnitPicker ? "180deg" : "0deg" }],

                    }}

                  >

                    <Ionicons name="chevron-down" size={16} color={colors.muted} />

                  </Animated.View>

                </View>

              </Pressable>

            </View>

          </View>

        </View>

        ) : null}
        { unitMismatchWarning ? (

          <View

            style={[

              getSectionCardStyle(colors, "warning", { padding: 10, radius: 12, shadow: false }),

              { marginTop: 8, flexDirection: "row", gap: 8, alignItems: "center" },

            ]}

          >

            <Ionicons name="alert-circle" size={16} color={colors.warningText} />

            <Text style={{ color: colors.warningText, fontSize: 12, flex: 1 }}>

              {unitMismatchWarning}

            </Text>

          </View>

        ) : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 }}>

          <View

            style={[

              getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16, shadow: false }),

              { flexBasis: "48%" },

            ]}

          >

            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {normalizeText("Mesociclo")}
            </Text>

            <View ref={mesoTriggerRef} style={{ position: "relative" }}>

              <Pressable

                onPress={() => togglePicker("meso")}

                style={{

                  marginTop: 6,

                  paddingVertical: 10,

                  paddingHorizontal: 12,

                  borderRadius: 12,

                  backgroundColor: colors.inputBg,

                  borderWidth: 1,

                  borderColor: colors.border,

                }}

              >

                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>

                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>

                    {cycleLength} semanas

                  </Text>

                  <Animated.View

                    style={{

                      transform: [{ rotate: showMesoPicker ? "180deg" : "0deg" }],

                    }}

                  >

                    <Ionicons name="chevron-down" size={16} color={colors.muted} />

                  </Animated.View>

                </View>

              </Pressable>

            </View>

          </View>

          <View

            style={[

              getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16, shadow: false }),

              { flexBasis: "48%" },

            ]}

          >

            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {normalizeText("Microciclo")}
            </Text>

            <View ref={microTriggerRef} style={{ position: "relative" }}>

              <Pressable

                onPress={() => togglePicker("micro")}

                style={{

                  marginTop: 6,

                  paddingVertical: 10,

                  paddingHorizontal: 12,

                  borderRadius: 12,

                  backgroundColor: colors.inputBg,

                  borderWidth: 1,

                  borderColor: colors.border,

                }}

              >

                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>

                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>

                    {sessionsPerWeek} dias

                  </Text>

                  <Animated.View

                    style={{

                      transform: [{ rotate: showMicroPicker ? "180deg" : "0deg" }],

                    }}

                  >

                    <Ionicons name="chevron-down" size={16} color={colors.muted} />

                  </Animated.View>

                </View>

              </Pressable>

            </View>

          </View>

        </View>

        <View style={{ marginTop: 8, gap: 8 }}>

          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {normalizeText("Distribuição de carga")}
          </Text>

          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>

            {volumeOrder.map((level) => {

              const palette = getVolumePalette(level, colors);

              const count = volumeCounts[level];

              const height = 20 + count * 10;

              return (

                <View key={level} style={{ alignItems: "center", gap: 4 }}>

                  <View

                    style={{

                      width: 28,

                      height,

                      borderRadius: 10,

                      backgroundColor: palette.bg,

                      opacity: 0.9,

                    }}

                  />

                  <Text style={{ color: colors.muted, fontSize: 11 }}>

                    {level} ({count})

                  </Text>

                </View>

              );

            })}

          </View>

        </View>

        <View style={{ marginTop: 8, gap: 8 }}>

          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {normalizeText("Tendência de carga")}
          </Text>

          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>

            {progressBars.map((ratio, index) => {

              const level = weekPlans[index]?.volume ?? "médio";

              const palette = getVolumePalette(level, colors);

              const size = 28;

              return (

                <View

                  key={`trend-${index}`}

                  style={{

                    width: size,

                    height: size,

                    borderRadius: 8,

                    backgroundColor: palette.bg,

                    opacity: ratio,

                    alignItems: "center",

                    justifyContent: "center",

                  }}

                >

                  <Text style={{ color: palette.text, fontSize: 11, fontWeight: "700" }}>

                    {index + 1}

                  </Text>

                </View>

              );

            })}

          </View>

        </View>

        { painAlert ? (

          <View

            style={[

              getSectionCardStyle(colors, "warning", { padding: 12, radius: 14 }),

              { marginTop: 10 },

            ]}

          >

            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>

              Alerta de dor

            </Text>

            <Text style={{ color: colors.text, fontSize: 12, marginTop: 4 }}>

              {painAlert}

            </Text>

            { painAlertDates.length ? (

              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>

                Datas: {painAlertDates.join(" | ")}

              </Text>

            ) : null}

            {isOrgAdmin ? (
            <Pressable

              onPress={() => router.push({ pathname: "/coord/reports" })}

              style={{

                alignSelf: "flex-start",

                marginTop: 8,

                paddingVertical: 6,

                paddingHorizontal: 10,

                borderRadius: 999,

                backgroundColor: colors.secondaryBg,

                borderWidth: 1,

                borderColor: colors.border,

              }}

            >

              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>

                Abrir relatórios

              </Text>

            </Pressable>
            ) : null}

          </View>

        ) : null}

      </View>


      <View style={getSectionCardStyle(colors, "info")}>

        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>

          Planejamento da turma

        </Text>

        <Text style={{ color: colors.muted, fontSize: 12 }}>

          {classPlans.length

            ? "Planejamento salvo para esta turma."

            : "Gere o planejamento semanal para esta turma."}

        </Text>

        <Pressable

          onPress={() => {

            if (!selectedClass || isSavingPlans) return;

            setShowGenerateModal(true);

          }}

          disabled={!selectedClass || isSavingPlans}

          style={{

            marginTop: 10,

            paddingVertical: 10,

            borderRadius: 12,

            alignItems: "center",

            backgroundColor:

              !selectedClass || isSavingPlans

                ? colors.primaryDisabledBg

                : colors.primaryBg,

            }}

          >

          <Text

            style={{

              color:

                !selectedClass || isSavingPlans

                  ? colors.secondaryText

                  : colors.primaryText,

              fontWeight: "700",

            }}

          >

            {isSavingPlans ? "Salvando..." : "Gerar ciclo"}

          </Text>

        </Pressable>

      </View>

      {showAnnualCoverageWarning ? (
        <View
          style={[
            getSectionCardStyle(colors, "warning", { padding: 12, radius: 14 }),
            { marginTop: 12, gap: 8 },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="alert-circle" size={16} color={colors.warningText} />
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700", flex: 1 }}>
              Cobertura anual incompleta
            </Text>
          </View>

          <Text style={{ color: colors.text, fontSize: 12 }}>
            Cobertura atual: {coveredWeeks} de {cycleLength} semanas.
          </Text>

          <Text style={{ color: colors.warningText, fontSize: 12 }}>
            Faltam {missingWeeks} semana{missingWeeks === 1 ? "" : "s"} para completar o ciclo anual desta turma.
          </Text>

          <Pressable
            onPress={onCompleteMissingCoverage}
            disabled={isSavingPlans}
            style={{
              alignSelf: "flex-start",
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.warningText,
              backgroundColor: colors.card,
              opacity: isSavingPlans ? 0.6 : 1,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
              Completar semanas faltantes
            </Text>
          </Pressable>
        </View>
      ) : null}

    </>
  );
}
