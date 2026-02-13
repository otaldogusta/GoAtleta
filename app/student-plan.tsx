import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRole } from "../src/auth/role";
import type { TrainingPlan } from "../src/core/models";
import { getLatestTrainingPlanByClass, getTrainingPlans } from "../src/db/seed";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

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

const getWeekdayId = (isoDate: string) => {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const day = parsed.getDay();
  return day === 0 ? 7 : day;
};

export default function StudentPlanScreen() {
  const { colors } = useAppTheme();
  const { student } = useRole();
  const router = useRouter();
  const params = useLocalSearchParams<{ classId?: string; date?: string }>();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDayMode, setIsDayMode] = useState(false);

  const routeClassId = typeof params.classId === "string" ? params.classId : "";
  const routeDate = typeof params.date === "string" && isIsoDate(params.date) ? params.date : "";
  const targetClassId = routeClassId || student.classId || "";
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
          const weekdayId = getWeekdayId(targetDate);
          const plans = await getTrainingPlans();
          const byClass = plans.filter((item) => item.classId === targetClassId);
          const byDate = byClass.find((item) => item.applyDate === targetDate);
          const byWeekday =
            weekdayId == null
              ? null
              : byClass.find((item) => (item.applyDays ?? []).includes(weekdayId));
          const selected = byDate ?? byWeekday ?? null;
          if (alive) setPlan(selected);
          return;
        }

        const latest = await getLatestTrainingPlanByClass(targetClassId);
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
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>
            {isDayMode ? "Planejamento do dia" : "Plano do treino"}
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar</Text>
          </Pressable>
        </View>

        {targetDate ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>Data: {targetDateLabel}</Text>
        ) : null}

        {loading ? (
          <Text style={{ color: colors.muted }}>Carregando...</Text>
        ) : !plan ? (
          <View
            style={{
              padding: 16,
              borderRadius: 16,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {isDayMode ? "Ainda não tem planejamento para este dia" : "Nenhum plano encontrado"}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 6 }}>
              {isDayMode
                ? "Quando o treinador publicar, ele aparece aqui."
                : "O treinador ainda não publicou o plano mais recente."}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <View
              style={{
                padding: 16,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
                {plan.title}
              </Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>
                {plan.warmupTime} aquecimento | {plan.mainTime} principal | {plan.cooldownTime} volta a calma
              </Text>
            </View>

            <View
              style={{
                padding: 16,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 8,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>Aquecimento</Text>
              {plan.warmup.length ? (
                plan.warmup.map((item, index) => (
                  <Text key={index} style={{ color: colors.text }}>
                    - {item}
                  </Text>
                ))
              ) : (
                <Text style={{ color: colors.muted }}>Sem detalhes.</Text>
              )}
            </View>

            <View
              style={{
                padding: 16,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 8,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>Parte principal</Text>
              {plan.main.length ? (
                plan.main.map((item, index) => (
                  <Text key={index} style={{ color: colors.text }}>
                    - {item}
                  </Text>
                ))
              ) : (
                <Text style={{ color: colors.muted }}>Sem detalhes.</Text>
              )}
            </View>

            <View
              style={{
                padding: 16,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 8,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>Volta a calma</Text>
              {plan.cooldown.length ? (
                plan.cooldown.map((item, index) => (
                  <Text key={index} style={{ color: colors.text }}>
                    - {item}
                  </Text>
                ))
              ) : (
                <Text style={{ color: colors.muted }}>Sem detalhes.</Text>
              )}
            </View>
          </View>
        )}

        <Pressable
          onPress={() => router.push({ pathname: "/absence-report" })}
          style={{
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: colors.secondaryBg,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>Avisar ausência</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
