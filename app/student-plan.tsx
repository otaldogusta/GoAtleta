import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import type { TrainingPlan } from "../src/core/models";
import { useRole } from "../src/auth/role";
import { getLatestTrainingPlanByClass } from "../src/db/seed";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

export default function StudentPlanScreen() {
  const { colors } = useAppTheme();
  const { student } = useRole();
  const router = useRouter();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!student?.classId) {
        if (alive) {
          setPlan(null);
          setLoading(false);
        }
        return;
      }
      try {
        const latest = await getLatestTrainingPlanByClass(student.classId);
        if (alive) setPlan(latest);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [student?.classId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>
            Plano do treino
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
              Nenhum plano encontrado
            </Text>
            <Text style={{ color: colors.muted, marginTop: 6 }}>
              O treinador ainda não publicou o plano mais recente.
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
                {plan.warmupTime} aquecimento | {plan.mainTime} principal |{" "}
                {plan.cooldownTime} volta a calma
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
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                Aquecimento
              </Text>
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
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                Parte principal
              </Text>
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
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                Volta a calma
              </Text>
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
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            Avisar ausência
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
