import { Animated, Text, View } from "react-native";

import { type ThemeColors } from "../../ui/app-theme";
import { ClassGenderBadge } from "../../ui/ClassGenderBadge";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { getSectionCardStyle } from "../../ui/section-styles";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";

import type { ClassGroup, ClassPlan, PlanningCycle, RecentSessionSummary } from "../../core/models";
import { isAnnualCycle } from "../../core/periodization-basics";
import { isRedeEsperancaEightToElevenClass } from "../../core/pedagogy/rede-esperanca-july-2026-alignment";
import { PeriodizationIntelligenceOverview } from "./PeriodizationIntelligenceOverview";

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
  cycleLength: number;
  microTriggerRef: React.RefObject<View | null>;
  showMicroPicker: boolean;
  sessionsPerWeek: number;
  painAlert: string | null;
  painAlertDates: string[];
  isOrgAdmin: boolean;
  router: { push: (params: any) => void };
  classPlans: ClassPlan[];
  hasWeekPlans: boolean;
  isSavingPlans: boolean;
  activeCycle: PlanningCycle | null;
  historyCycles: PlanningCycle[];
  onCompleteMissingCoverage: () => void;
  onGenerateCycle: () => void;
  onRemoveCycle: () => void;
  isPeriodizationConfigured: boolean;
  unitMismatchWarning: string;
  recentSessionSummaries: RecentSessionSummary[];
  onReviewEvolution: () => void;
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
  cycleLength,
  microTriggerRef,
  showMicroPicker,
  sessionsPerWeek,
  painAlert,
  painAlertDates,
  isOrgAdmin,
  router,
  classPlans,
  hasWeekPlans,
  isSavingPlans,
  activeCycle,
  historyCycles,
  onCompleteMissingCoverage,
  onGenerateCycle,
  onRemoveCycle,
  isPeriodizationConfigured,
  unitMismatchWarning,
  recentSessionSummaries,
  onReviewEvolution,
}: OverviewTabProps) {
  const responsiveLayout = useResponsiveLayout();
  if (selectedClass && isRedeEsperancaEightToElevenClass(selectedClass)) {
    return (
      <PeriodizationIntelligenceOverview
        colors={colors}
        recentSessions={recentSessionSummaries}
        onReviewEvolution={onReviewEvolution}
      />
    );
  }
  const reserveFloatingActionSpace = responsiveLayout.isMobile;
  const coveredWeeks = new Set(
    classPlans
      .map((plan) => plan.weekNumber)
      .filter((weekNumber) => Number.isFinite(weekNumber) && weekNumber >= 1 && weekNumber <= cycleLength)
  ).size;
  const missingWeeks = Math.max(0, cycleLength - coveredWeeks);
  const showAnnualCoverageWarning = Boolean(
    selectedClass && isPeriodizationConfigured && isAnnualCycle(cycleLength) && missingWeeks > 0
  );
  const hasGeneratedCycle = Boolean(activeCycle || hasWeekPlans);
  const canGenerateCycle =
    Boolean(selectedClass) && isPeriodizationConfigured && !isSavingPlans && !hasGeneratedCycle;
  const canRegenerateCycle =
    Boolean(selectedClass) && isPeriodizationConfigured && !isSavingPlans && hasGeneratedCycle;
  const canRemoveCycle = Boolean(selectedClass) && !isSavingPlans;

  const handleGenerateCycle = () => {
    if (!selectedClass || !isPeriodizationConfigured || isSavingPlans) return;
    onGenerateCycle();
  };

  return (
    <>

      <View
        style={[
          getSectionCardStyle(colors, "primary"),
          { borderLeftWidth: 1, borderLeftColor: colors.border },
        ]}
      >

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>

            {normalizeText("Visão geral")}

          </Text>

          {hasGeneratedCycle ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gerar ciclo novamente"
              onPress={() => {
                if (!canRegenerateCycle) return;
                handleGenerateCycle();
              }}
              disabled={!canRegenerateCycle}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: canRegenerateCycle ? 1 : 0.55,
              }}
            >
              <GoAtletaIcon
                name="refresh"
                size={16}
                color={canRegenerateCycle ? colors.text : colors.secondaryText}
              />
            </Pressable>
          ) : null}
        </View>

        {hasGeneratedCycle ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: colors.successBg,
              }}
            >
              <GoAtletaIcon name="checkmarkCircle" size={12} color={colors.successText} />
              <Text style={{ color: colors.successText, fontSize: 11, fontWeight: "700" }}>
                {normalizeText(activeCycle ? `Ciclo ativo · ${activeCycle.title}` : "Ciclo gerado")}
              </Text>
            </View>
            {historyCycles.length > 0 ? (
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {normalizeText(`${historyCycles.length} ciclo(s) no histórico`)}
              </Text>
            ) : null}
          </View>
        ) : selectedClass ? (
          <View style={{ marginTop: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {normalizeText("Nenhum ciclo ativo. Gere o ciclo para criar um.")}
            </Text>
          </View>
        ) : null}

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

                    <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} />

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

                    <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} />

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

            <GoAtletaIcon name="warningCircle" size={16} color={colors.warningText} />

            <Text style={{ color: colors.warningText, fontSize: 12, flex: 1 }}>

              {unitMismatchWarning}

            </Text>

          </View>

        ) : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
          <View

            style={[

              getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16, shadow: false }),

              { flex: 1, minWidth: 220 },

            ]}

          >

            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {normalizeText("Frequência semanal")}
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

                    {sessionsPerWeek === 1 ? "1 dia" : `${sessionsPerWeek} dias`}

                  </Text>

                  <Animated.View

                    style={{

                      transform: [{ rotate: showMicroPicker ? "180deg" : "0deg" }],

                    }}

                  >

                    <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} />

                  </Animated.View>

                </View>

              </Pressable>

            </View>

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

        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              Planejamento da turma
            </Text>
            <Text style={{ marginTop: 5, color: colors.muted, fontSize: 12, lineHeight: 17 }}>
              {selectedClass
                ? hasGeneratedCycle
                  ? "O ciclo desta turma já está pronto."
                  : isPeriodizationConfigured
                    ? "Gere o ciclo de semanas desta turma."
                    : "Conclua e salve a configuração antes de gerar o ciclo."
                : "Selecione uma turma para visualizar ou gerar o ciclo."}
            </Text>
          </View>

          {hasGeneratedCycle ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                borderRadius: 999,
                paddingHorizontal: 9,
                paddingVertical: 5,
                backgroundColor: colors.successBg,
              }}
            >
              <GoAtletaIcon name="checkmarkCircle" size={13} color={colors.successText} />
              <Text style={{ color: colors.successText, fontWeight: "800", fontSize: 11 }}>
                Gerado
              </Text>
            </View>
          ) : null}
        </View>

        {!hasGeneratedCycle ? (
          <Pressable
            onPress={() => {
              if (!canGenerateCycle) return;
              handleGenerateCycle();
            }}
            disabled={!canGenerateCycle}
            style={{
              marginTop: 10,
              marginRight: reserveFloatingActionSpace ? 72 : 0,
              paddingVertical: 10,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: !canGenerateCycle ? colors.primaryDisabledBg : colors.primaryBg,
            }}
          >
            <Text
              style={{
                color: !canGenerateCycle ? colors.secondaryText : colors.primaryText,
                fontWeight: "700",
              }}
            >
              {isSavingPlans
                ? "Salvando..."
                : !selectedClass
                  ? "Selecione uma turma"
                  : !isPeriodizationConfigured
                    ? "Configure a periodização"
                    : "Gerar ciclo"}
            </Text>
          </Pressable>
        ) : (
          <View
            style={{
              marginTop: 10,
              marginRight: reserveFloatingActionSpace ? 72 : 0,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                flex: 1,
                minWidth: 210,
                borderRadius: 12,
                paddingHorizontal: 10,
                paddingVertical: 8,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <GoAtletaIcon name="refresh" size={13} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>
                Para gerar novamente, use o ícone de atualizar na visão geral.
              </Text>
            </View>

            {hasWeekPlans ? (
              <Pressable
                onPress={() => {
                  if (!canRemoveCycle) return;
                  onRemoveCycle();
                }}
                disabled={!canRemoveCycle}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.dangerBorder,
                  backgroundColor: colors.dangerBg,
                  opacity: canRemoveCycle ? 1 : 0.6,
                }}
              >
                <GoAtletaIcon name="trash" size={13} color={colors.dangerText} />
                <Text style={{ color: colors.dangerText, fontWeight: "700", fontSize: 12 }}>
                  {isSavingPlans ? "Removendo..." : "Remover ciclo"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}

      </View>

      {showAnnualCoverageWarning ? (
        <View
          style={[
            getSectionCardStyle(colors, "warning", { padding: 12, radius: 14 }),
            { marginTop: 12, gap: 8 },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <GoAtletaIcon name="warningCircle" size={16} color={colors.warningText} />
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
