import { compactUiMetrics, radius } from "../src/theme/tokens";
import { resolveTrainingPlanForDate } from "../src/core/resolve-training-plan-for-date";
import { markRender, measureAsync } from "../src/observability/perf";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { OperationalText as Text } from "../src/ui/OperationalText";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRole } from "../src/auth/role";
import { ScreenPageHeader } from "../src/components/ui/ScreenPageHeader";
import type { TrainingPlan } from "../src/core/models";
import { getLatestTrainingPlanByClass, getTrainingPlans } from "../src/db/seed";
import { navigateBackOrReplace } from "../src/navigation/safe-router";
import { StudentAction } from "../src/screens/student/StudentUi";
import { AppShell } from "../src/ui/AppShell";
import { useAppTheme } from "../src/ui/app-theme";
import { useResponsiveLayout } from "../src/ui/use-responsive-layout";

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const formatFullDate = (isoDate: string) => {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

function StudentPlanScreenContent() {
  markRender("screen.studentPlan.render.root");
  const { colors } = useAppTheme();
  const responsiveLayout = useResponsiveLayout("dashboard");
  const sectionStyles = useMemo(() => StyleSheet.create({
    surface: { padding: responsiveLayout.density.cardPadding, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: compactUiMetrics.gap },
    section: { gap: compactUiMetrics.smallGap, paddingTop: 0, borderTopWidth: 0, borderTopColor: colors.border },
    followingSection: { paddingTop: compactUiMetrics.gap, borderTopWidth: 1 },
    title: { color: colors.text, fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight, fontWeight: "700" },
    item: { color: colors.text, fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight },
    empty: { color: colors.muted, fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight },
  }), [colors.border, colors.card, colors.muted, colors.text, responsiveLayout.density.cardPadding]);
  const { student } = useRole();
  const router = useRouter();
  const params = useLocalSearchParams<{ classId?: string; date?: string }>();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDayMode, setIsDayMode] = useState(false);

  const routeClassId = typeof params.classId === "string" ? params.classId : "";
  const routeDate = typeof params.date === "string" && isIsoDate(params.date) ? params.date : "";
  const targetClassId = routeClassId || student?.classId || "";
  const targetDate = routeDate || "";
  const targetDateLabel = useMemo(
    () => (targetDate ? formatFullDate(targetDate) : ""),
    [targetDate]
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setPlan(null);
      setIsDayMode(Boolean(targetDate));

      if (!targetClassId) {
        if (alive) setLoading(false);
        return;
      }

      try {
        if (targetDate) {
          const plans = await measureAsync("screen.studentPlan.load.plans", () => getTrainingPlans({ classId: targetClassId }));
          const selected = resolveTrainingPlanForDate(plans, targetClassId, targetDate);
          if (alive) setPlan(selected);
          return;
        }

        const latest = await measureAsync("screen.studentPlan.load.latestPlan", () => getLatestTrainingPlanByClass(targetClassId));
        if (alive) setPlan(latest);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [targetClassId, targetDate]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ width: "100%", maxWidth: Math.min(responsiveLayout.maxContentWidth, 960) + responsiveLayout.gutter * 2, alignSelf: "center", paddingHorizontal: responsiveLayout.gutter, paddingVertical: responsiveLayout.density.pageGap, gap: responsiveLayout.density.pageGap }}
        stickyHeaderIndices={[0]}
      >
        <ScreenPageHeader
          title={isDayMode ? "Planejamento do dia" : "Plano do treino"}
          subtitle={targetDate ? `Data: ${targetDateLabel}` : undefined}
          onBack={() => navigateBackOrReplace({ router, fallback: "/student/home" })}
        />

        {loading ? (
          <Text style={{ color: colors.muted, fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight }}>Carregando...</Text>
        ) : !plan ? (
          <View
            style={{
              padding: responsiveLayout.density.cardPadding,
              borderRadius: radius.card,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight, fontWeight: "700" }}>
              {isDayMode ? "Ainda não tem planejamento para este dia" : "Nenhum plano encontrado"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight, marginTop: compactUiMetrics.smallGap }}>
              {isDayMode
                ? "Quando o treinador publicar, ele aparece aqui."
                : "O treinador ainda não publicou o plano mais recente."}
            </Text>
          </View>
        ) : (
          <View style={{ gap: responsiveLayout.density.pageGap }}>
            <View
              style={{
                padding: responsiveLayout.density.cardPadding,
                borderRadius: radius.card,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontSize: compactUiMetrics.titleFontSize, fontWeight: "700" }}>
                {plan.title}
              </Text>
              <Text style={{ color: colors.muted, fontSize: compactUiMetrics.metadataFontSize, lineHeight: compactUiMetrics.metadataLineHeight, marginTop: 4 }}>
                {plan.warmupTime} aquecimento | {plan.mainTime} principal | {plan.cooldownTime} volta a calma
              </Text>
            </View>

            <View style={sectionStyles.surface}>
              {[
                { title: "Aquecimento", items: plan.warmup },
                { title: "Parte principal", items: plan.main },
                { title: "Volta a calma", items: plan.cooldown },
              ].map((section, sectionIndex) => (
                <View key={section.title} style={sectionIndex ? [sectionStyles.section, sectionStyles.followingSection] : sectionStyles.section}>
                  <Text style={sectionStyles.title}>{section.title}</Text>
                  {section.items.length ? section.items.map((item, index) => (
                    <Text key={index} style={sectionStyles.item}>- {item}</Text>
                  )) : <Text style={sectionStyles.empty}>Sem detalhes.</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        <StudentAction label="Avisar ausência" onPress={() => router.push({ pathname: "/absence-report" })} />
      </ScrollView>
    </SafeAreaView>
  );
}

export default function StudentPlanScreen() {
  return <AppShell role="student"><StudentPlanScreenContent /></AppShell>;
}
