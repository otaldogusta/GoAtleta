import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { BackTitleHeader } from "../../../src/components/ui/BackTitleHeader";
import { ScreenLoadingState } from "../../../src/components/ui/ScreenLoadingState";
import type { MonthPlanningSummary } from "../../../src/screens/planning/application/month-planning-summary";
import { useClassPlanning } from "../../../src/screens/planning/hooks/useClassPlanning";
import { useAppTheme } from "../../../src/ui/app-theme";
import { Pressable } from "../../../src/ui/Pressable";
import { getSectionCardStyle } from "../../../src/ui/section-styles";

const capitalizeFirst = (value: string) => value.replace(/^./, (char) => char.toUpperCase());

const getCurrentMonthKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

const getMonthStatusLabel = (month: MonthPlanningSummary, currentMonthKey: string) => {
  if (!month.hasPlans) return "Sem planejamento";
  if (month.monthKey < currentMonthKey) return "Encerrado";
  if (month.monthKey === currentMonthKey) return "Mês atual";
  return "Programado";
};

const getCompactMonthLabel = (label: string) =>
  capitalizeFirst(label.replace(/\s+de\s+\d{4}$/i, ""));

const getMonthYearLabel = (label: string) => label.match(/(\d{4})$/)?.[1] ?? "";

const getCurrentYear = () => new Date().getFullYear();

function SummaryPill({
  label,
  value,
  muted = false,
  colors,
}: {
  label: string;
  value: string;
  muted?: boolean;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: colors.secondaryBg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color: muted ? colors.muted : colors.text, fontSize: 12, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}

export default function ClassPlanningHubRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const classId = typeof id === "string" ? id : "";
  const isTabletLayout = width >= 700;
  const isDesktopLayout = width >= 1120;
  const monthCardWidth = isDesktopLayout ? "23.6%" : isTabletLayout ? "31.8%" : "100%";
  const currentMonthKey = getCurrentMonthKey();
  const [selectedYear, setSelectedYear] = useState(getCurrentYear);
  const handleBackToClass = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (classId) {
      router.replace({ pathname: "/class/[id]", params: { id: classId } });
      return;
    }

    router.replace("/");
  };

  const { selectedClass, activeCycle, months: planningMonths, isLoading, error } = useClassPlanning(classId);
  const availableYears = [...new Set(planningMonths.map((month) => month.year))].sort((a, b) => a - b);
  const availableYearKey = availableYears.join("|");
  const selectedYearIndex = availableYears.indexOf(selectedYear);
  const canGoPreviousYear = selectedYearIndex > 0;
  const canGoNextYear = selectedYearIndex >= 0 && selectedYearIndex < availableYears.length - 1;
  const visibleMonths = planningMonths.filter((month) => month.year === selectedYear);
  const plannedMonthsCount = visibleMonths.filter((month) => month.hasPlans).length;
  const plannedLessonsCount = visibleMonths.reduce((total, month) => total + month.estimatedLessonCount, 0);
  const currentMonth = visibleMonths.find((month) => month.monthKey === currentMonthKey);

  useEffect(() => {
    if (!availableYears.length) return;
    const currentYear = getCurrentYear();
    if (availableYears.includes(selectedYear)) return;
    setSelectedYear(availableYears.includes(currentYear) ? currentYear : availableYears[0]);
  }, [availableYearKey, selectedYear]);

  const goToPreviousYear = () => {
    if (!canGoPreviousYear) return;
    setSelectedYear(availableYears[selectedYearIndex - 1]);
  };

  const goToNextYear = () => {
    if (!canGoNextYear) return;
    setSelectedYear(availableYears[selectedYearIndex + 1]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenLoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          gap: 14,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom + 104, 128),
        }}
      >
        <View style={{ gap: 8 }}>
          <BackTitleHeader title="Planejamentos da turma" onBack={handleBackToClass} />
          <Text style={{ color: colors.muted }}>
            {selectedClass?.name ? `${selectedClass.name} · visão mês > semana > aulas` : "Visão mês > semana > aulas"}
          </Text>
        </View>

        {error ? (
          <View style={[getSectionCardStyle(colors, "primary", { radius: 14 }), { gap: 6 }]}>
            <Text style={{ color: colors.dangerText, fontWeight: "700" }}>Falha ao carregar</Text>
            <Text style={{ color: colors.muted }}>{error}</Text>
          </View>
        ) : null}

        <View style={[getSectionCardStyle(colors, "neutral", { padding: 12, radius: 14, shadow: false }), { gap: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
                Meses do ciclo
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                {activeCycle?.title
                  ? `Ciclo ${activeCycle.title} · abra um mês para revisar semanas e aulas.`
                  : "Abra um mês para revisar semanas e aulas."}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                borderRadius: 999,
                paddingHorizontal: 6,
                paddingVertical: 4,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Pressable
                accessibilityLabel="Ano anterior"
                disabled={!canGoPreviousYear}
                onPress={goToPreviousYear}
                style={{ opacity: canGoPreviousYear ? 1 : 0.35, padding: 3 }}
              >
                <Ionicons name="chevron-back" size={15} color={colors.text} />
              </Pressable>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13, minWidth: 42, textAlign: "center" }}>
                {selectedYear}
              </Text>
              <Pressable
                accessibilityLabel="Próximo ano"
                disabled={!canGoNextYear}
                onPress={goToNextYear}
                style={{ opacity: canGoNextYear ? 1 : 0.35, padding: 3 }}
              >
                <Ionicons name="chevron-forward" size={15} color={colors.text} />
              </Pressable>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            <SummaryPill label="Meses" value={`${plannedMonthsCount}/${visibleMonths.length || 0}`} colors={colors} />
            <SummaryPill label="Aulas" value={String(plannedLessonsCount)} colors={colors} />
            <SummaryPill
              label="Atual"
              value={currentMonth ? getCompactMonthLabel(currentMonth.label) : "-"}
              muted={!currentMonth}
              colors={colors}
            />
          </View>
        </View>

        {!visibleMonths.length ? (
          <View style={[getSectionCardStyle(colors, "primary", { radius: 18 }), { gap: 6 }]}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>Nenhum mês disponível</Text>
            <Text style={{ color: colors.muted }}>
              Gere ou edite semanas na periodização para começar a organizar os planejamentos de {selectedYear}.
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {visibleMonths.map((month) => {
              const isPast = month.hasPlans && month.monthKey < currentMonthKey;
              const isEmpty = !month.hasPlans;
              const isMutedStatus = isEmpty || isPast;
              const statusLabel = getMonthStatusLabel(month, currentMonthKey);
              const isCurrentMonth = month.monthKey === currentMonthKey;
              const compactLabel = getCompactMonthLabel(month.label);
              const yearLabel = getMonthYearLabel(month.label);
              const statusColor = isMutedStatus ? colors.muted : colors.successText;
              const statusBg = isMutedStatus ? colors.secondaryBg : colors.successBg;
              const statusBorder = isMutedStatus ? colors.border : colors.successBorder;

              return (
                <Pressable
                  key={month.monthKey}
                  onPress={() =>
                    router.push({
                      pathname: "/class/[id]/planning/[month]",
                      params: { id: classId, month: month.monthKey },
                    })
                  }
                  style={[
                    getSectionCardStyle(colors, "neutral", { padding: 10, radius: 14, shadow: false }),
                    {
                      width: monthCardWidth,
                      minHeight: 72,
                      borderWidth: 1,
                      borderColor: isCurrentMonth ? colors.primaryBg : colors.border,
                      opacity: isPast ? 0.58 : 1,
                      gap: 8,
                    },
                  ]}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }} numberOfLines={1}>
                        {compactLabel}
                      </Text>
                      {yearLabel ? (
                        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1 }}>{yearLabel}</Text>
                      ) : null}
                    </View>
                    <View
                      style={{
                        alignSelf: "flex-start",
                        borderRadius: 999,
                        paddingHorizontal: 7,
                        paddingVertical: 3,
                        backgroundColor: statusBg,
                        borderWidth: 1,
                        borderColor: statusBorder,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: statusColor,
                        }}
                      />
                      <Text
                        style={{
                          color: statusColor,
                          fontSize: 10,
                          fontWeight: "700",
                        }}
                      >
                        {statusLabel}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }} numberOfLines={1}>
                      {month.hasPlans
                        ? `${month.weekCount} sem. · ${month.estimatedLessonCount} aula${month.estimatedLessonCount === 1 ? "" : "s"}`
                        : "Abrir para regenerar"}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
