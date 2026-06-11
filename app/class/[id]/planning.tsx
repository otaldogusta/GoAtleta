import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  const isWideLayout = width >= 960;
  const isTabletLayout = width >= 700;
  const monthCardWidth = isWideLayout ? "31.8%" : isTabletLayout ? "48.5%" : "100%";
  const currentMonthKey = getCurrentMonthKey();
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

  const { selectedClass, activeCycle, months, isLoading, error } = useClassPlanning(classId);
  const plannedMonthsCount = months.filter((month) => month.hasPlans).length;
  const plannedLessonsCount = months.reduce((total, month) => total + month.estimatedLessonCount, 0);
  const currentMonth = months.find((month) => month.monthKey === currentMonthKey);

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
                {activeCycle?.title ? `Ciclo ${activeCycle.title}` : "Meses do ciclo"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                Abra um mês para revisar semanas e aulas.
              </Text>
            </View>
            <Ionicons name="calendar-outline" size={18} color={colors.muted} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <SummaryPill label="Meses" value={`${plannedMonthsCount}/${months.length || 0}`} colors={colors} />
            <SummaryPill label="Aulas" value={String(plannedLessonsCount)} colors={colors} />
            <SummaryPill
              label="Atual"
              value={currentMonth ? capitalizeFirst(currentMonth.label.replace(/\s+de\s+\d{4}$/i, "")) : "-"}
              muted={!currentMonth}
              colors={colors}
            />
          </View>
        </View>

        {!months.length ? (
          <View style={[getSectionCardStyle(colors, "primary", { radius: 18 }), { gap: 6 }]}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>Nenhum mês disponível</Text>
            <Text style={{ color: colors.muted }}>
              Gere ou edite semanas na periodização para começar a organizar os planejamentos por mês.
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {months.map((month) => {
              const isPast = month.hasPlans && month.monthKey < currentMonthKey;
              const isEmpty = !month.hasPlans;
              const isMutedStatus = isEmpty || isPast;
              const statusLabel = getMonthStatusLabel(month, currentMonthKey);
              const isCurrentMonth = month.monthKey === currentMonthKey;
              const tone = isCurrentMonth ? "primary" : "neutral";

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
                    getSectionCardStyle(colors, tone, { radius: 18 }),
                    {
                      width: monthCardWidth,
                      minHeight: 84,
                      borderWidth: 1,
                      borderColor: isCurrentMonth ? colors.primaryBg : colors.border,
                      paddingVertical: 11,
                      opacity: isPast ? 0.68 : 1,
                      gap: 7,
                      shadowOpacity: 0.12,
                      shadowRadius: 14,
                    },
                  ]}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16, flex: 1 }}>
                      {capitalizeFirst(month.label)}
                    </Text>
                    <View
                      style={{
                        alignSelf: "flex-start",
                        borderRadius: 999,
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                        backgroundColor: isMutedStatus ? colors.secondaryBg : colors.successBg,
                        borderWidth: 1,
                        borderColor: isMutedStatus ? colors.border : colors.successBorder,
                      }}
                    >
                      <Text
                        style={{
                          color: isMutedStatus ? colors.muted : colors.successText,
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        {statusLabel}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 }}>
                      {month.hasPlans ? (
                        <>
                          <SummaryPill label="Sem." value={String(month.weekCount)} colors={colors} />
                          <SummaryPill label="Aulas" value={String(month.estimatedLessonCount)} colors={colors} />
                        </>
                      ) : (
                        <Text style={{ color: colors.muted, fontSize: 12 }}>Abrir para regenerar</Text>
                      )}
                    </View>
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
