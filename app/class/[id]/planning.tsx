// perf-check: ignore-render -- existing planning route has no render boundary; this PR focuses on layout and year navigation.
// perf-check: ignore-measure -- data loading stays inside the existing planning hook.
// perf-check: ignore-inline-row-style -- this route uses responsive inline layout objects outside virtualized rows.
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import type { DimensionValue } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenLoadingState } from "../../../src/components/ui/ScreenLoadingState";
import type { MonthPlanningSummary } from "../../../src/screens/planning/hooks/useClassPlanning";
import { useClassPlanning } from "../../../src/screens/planning/hooks/useClassPlanning";
import { useAppTheme } from "../../../src/ui/app-theme";
import { getClassPalette } from "../../../src/ui/class-colors";
import { ClassGenderBadge } from "../../../src/ui/ClassGenderBadge";
import { LocationBadge } from "../../../src/ui/LocationBadge";
import { Pressable } from "../../../src/ui/Pressable";
import { getSectionCardStyle } from "../../../src/ui/section-styles";
import type { ClassGender } from "../../../src/core/models";

const capitalize = (value: string) => value.replace(/^./, (char) => char.toUpperCase());

const getMonthKeyForNow = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const isKnownGender = (value: unknown): value is ClassGender =>
  value === "masculino" || value === "feminino" || value === "misto";

export default function ClassPlanningHubRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const classId = typeof id === "string" ? id : "";
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

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

  const { selectedClass, months, isLoading, error } = useClassPlanning(classId);
  const currentMonthKey = useMemo(getMonthKeyForNow, []);
  const currentYear = useMemo(() => Number(currentMonthKey.slice(0, 4)), [currentMonthKey]);
  const selectedYearMonths = useMemo(
    () => months.filter((month) => month.year === selectedYear),
    [months, selectedYear]
  );
  const totals = useMemo(
    () =>
      selectedYearMonths.reduce(
        (acc, month) => ({
          weeks: acc.weeks + month.weekCount,
          lessons: acc.lessons + month.estimatedLessonCount,
        }),
        { weeks: 0, lessons: 0 }
      ),
    [selectedYearMonths]
  );
  const nextOpenMonthKey = useMemo(
    () =>
      selectedYearMonths.find((month) => month.monthKey >= currentMonthKey)?.monthKey ??
      selectedYearMonths[0]?.monthKey ??
      "",
    [currentMonthKey, selectedYearMonths]
  );

  const isDesktop = width >= 1040;
  const isTablet = width >= 720;
  const monthCardBasis = isDesktop ? "31.8%" : isTablet ? "48%" : "100%";
  const monthGridStyle = useMemo(
    () => ({ flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 12 }),
    []
  );
  const classPalette = getClassPalette(selectedClass?.colorKey ?? null, colors, selectedClass?.unit ?? "");
  const classGender = isKnownGender(selectedClass?.gender) ? selectedClass.gender : "misto";
  const classAgeBand = selectedClass?.ageBand || selectedClass?.name?.replace(/^Turma\s*/i, "") || "-";

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
          gap: 18,
          paddingHorizontal: isDesktop ? 24 : 16,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom + 40, 56),
          width: "100%",
          maxWidth: 1280,
          alignSelf: "center",
        }}
      >
        <View
          style={{
            flexDirection: isTablet ? "row" : "column",
            alignItems: isTablet ? "flex-start" : "stretch",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={handleBackToClass}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </Pressable>
              <Text style={{ color: colors.text, fontSize: isDesktop ? 30 : 26, fontWeight: "800" }}>
                Planejamentos
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 14, marginLeft: isTablet ? 42 : 0 }}>
              Meses, semanas e aulas da turma em ordem cronológica.
            </Text>
          </View>

          <View style={{ alignItems: isTablet ? "flex-end" : "flex-start", gap: 6, maxWidth: "100%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: classPalette.bg }} />
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                Turma {classAgeBand}
              </Text>
              <ClassGenderBadge gender={classGender} size="md" />
            </View>
            <LocationBadge
              location={selectedClass?.unit || "Unidade"}
              palette={classPalette}
              size="sm"
              showIcon
            />
          </View>
        </View>

        <View
          style={{
            paddingVertical: isDesktop ? 12 : 8,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <YearButton direction="back" colors={colors} onPress={() => setSelectedYear((year) => year - 1)} />

            <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
              <Text style={{ color: colors.text, fontSize: isDesktop ? 30 : 24, fontWeight: "800" }}>
                {selectedYear}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600", textAlign: "center" }}>
                {selectedYearMonths.length} meses · {totals.weeks} semanas · {totals.lessons} aulas previstas
              </Text>
            </View>

            <YearButton direction="forward" colors={colors} onPress={() => setSelectedYear((year) => year + 1)} />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <SummaryBox label="Meses" value={selectedYearMonths.length} colors={colors} />
            <SummaryBox label="Semanas" value={totals.weeks} colors={colors} />
            <SummaryBox label="Aulas previstas" value={totals.lessons} colors={colors} />
          </View>
        </View>

        {error ? (
          <View style={[getSectionCardStyle(colors, "primary", { radius: 14 }), { gap: 6 }]}>
            <Text style={{ color: colors.dangerText, fontWeight: "700" }}>Falha ao carregar</Text>
            <Text style={{ color: colors.muted }}>{error}</Text>
          </View>
        ) : null}

        {!months.length ? (
          <EmptyState
            colors={colors}
            title="Nenhum planejamento disponível"
            body="Gere ou edite semanas na periodização para começar a organizar os planejamentos por mês."
          />
        ) : !selectedYearMonths.length ? (
          <EmptyState
            colors={colors}
            title={`Sem planejamentos em ${selectedYear}`}
            body="Use as setas acima para trocar de ano e visualizar os meses já gerados para esta turma."
          />
        ) : (
          <View style={monthGridStyle}>
            {selectedYearMonths.map((month) => (
              <MonthCard
                key={month.monthKey}
                month={month}
                basis={monthCardBasis}
                isPast={month.monthKey < currentMonthKey}
                isCurrent={month.monthKey === currentMonthKey}
                isNext={month.monthKey === nextOpenMonthKey && month.monthKey !== currentMonthKey}
                colors={colors}
                onPress={() =>
                  router.push({
                    pathname: "/class/[id]/planning/[month]",
                    params: { id: classId, month: month.monthKey },
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function YearButton({
  direction,
  colors,
  onPress,
}: {
  direction: "back" | "forward";
  colors: ReturnType<typeof useAppTheme>["colors"];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 46,
        height: 46,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.secondaryBg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons
        name={direction === "back" ? "chevron-back" : "chevron-forward"}
        size={20}
        color={colors.text}
      />
    </Pressable>
  );
}

function SummaryBox({
  label,
  value,
  colors,
}: {
  label: string;
  value: number;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 150,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.secondaryBg,
        padding: 12,
        gap: 2,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}

function EmptyState({
  title,
  body,
  colors,
}: {
  title: string;
  body: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View
      style={{
        gap: 6,
        paddingVertical: 16,
        paddingHorizontal: 10,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>{title}</Text>
      <Text style={{ color: colors.muted }}>{body}</Text>
    </View>
  );
}

function MonthCard({
  month,
  basis,
  isPast,
  isCurrent,
  isNext,
  colors,
  onPress,
}: {
  month: MonthPlanningSummary;
  basis: DimensionValue;
  isPast: boolean;
  isCurrent: boolean;
  isNext: boolean;
  colors: ReturnType<typeof useAppTheme>["colors"];
  onPress: () => void;
}) {
  const labelColor = isPast ? colors.muted : colors.text;
  const bodyColor = isPast ? colors.muted : colors.muted;

  return (
    <Pressable
      onPress={onPress}
      style={[
        getSectionCardStyle(colors, "primary", { radius: 18 }),
        {
          flexBasis: basis,
          flexGrow: 1,
          minHeight: 128,
          borderWidth: 0,
          borderLeftWidth: 0,
          backgroundColor: isPast ? colors.secondaryBg : colors.card,
          opacity: isPast ? 0.62 : 1,
          paddingVertical: 16,
          gap: 14,
        },
      ]}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ color: labelColor, fontWeight: "800", fontSize: 18 }}>
            {capitalize(month.label)}
          </Text>
          <Text style={{ color: bodyColor, fontSize: 13 }}>
            {month.weekCount} semana(s) · {month.estimatedLessonCount} aula(s)
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={isPast ? colors.muted : colors.text} />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {isPast ? (
          <StatusPill label="Concluído" colors={colors} tone="muted" />
        ) : null}
        {isCurrent ? (
          <StatusPill label="Mês atual" colors={colors} tone="primary" />
        ) : null}
        {isNext ? (
          <StatusPill label="Próximo" colors={colors} tone="default" />
        ) : null}
      </View>
    </Pressable>
  );
}

function StatusPill({
  label,
  tone,
  colors,
}: {
  label: string;
  tone: "primary" | "default" | "muted";
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const bg = tone === "primary" ? colors.primaryBg : colors.secondaryBg;
  const text = tone === "primary" ? colors.primaryText : tone === "muted" ? colors.muted : colors.text;

  return (
    <View
      style={{
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: tone === "primary" ? 0 : 1,
        borderColor: colors.border,
        paddingHorizontal: 9,
        paddingVertical: 4,
      }}
    >
      <Text style={{ color: text, fontSize: 11, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}
