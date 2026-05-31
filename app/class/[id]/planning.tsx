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
          paddingBottom: Math.max(insets.bottom + 40, 56),
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

        <View style={[getSectionCardStyle(colors, "neutral", { radius: 16 }), { gap: 4 }]}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
            {activeCycle?.title ? `Ciclo ${activeCycle.title}` : "Meses do ciclo"}
          </Text>
          <Text style={{ color: colors.muted, lineHeight: 18 }}>
            Meses em ordem de janeiro a dezembro. Meses sem semanas salvas continuam visíveis para revisão ou
            regeneração.
          </Text>
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
              const tone = !isPast && !isEmpty ? "primary" : "neutral";
              const summary = month.hasPlans
                ? `${month.weekCount} semana(s) · ${month.estimatedLessonCount} aula(s) previstas`
                : "Sem semanas salvas · abrir para regenerar";

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
                      minHeight: 112,
                      borderWidth: 1,
                      borderColor: isEmpty ? colors.border : colors.borderStrong,
                      paddingVertical: 14,
                      opacity: isPast ? 0.72 : 1,
                      gap: 8,
                    },
                  ]}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 17, flex: 1 }}>
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
                  <Text style={{ color: colors.muted, lineHeight: 18 }}>{summary}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
