import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenLoadingState } from "../../../src/components/ui/ScreenLoadingState";
import { useClassPlanning } from "../../../src/screens/planning/hooks/useClassPlanning";
import { useAppTheme } from "../../../src/ui/app-theme";
import { Pressable } from "../../../src/ui/Pressable";
import { getSectionCardStyle } from "../../../src/ui/section-styles";

export default function ClassPlanningHubRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const classId = typeof id === "string" ? id : "";
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
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={handleBackToClass}
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
            }}
          >
            <Ionicons name="chevron-back" size={14} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: "600" }}>Voltar para turma</Text>
          </Pressable>

          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 22 }}>
            Planejamentos da turma
          </Text>
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

        {!months.length ? (
          <View style={[getSectionCardStyle(colors, "primary", { radius: 18 }), { gap: 6 }]}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>Nenhum mês disponível</Text>
            <Text style={{ color: colors.muted }}>
              Gere ou edite semanas na periodização para começar a organizar os planejamentos por mês.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {months.map((month) => (
              <Pressable
                key={month.monthKey}
                onPress={() =>
                  router.push({
                    pathname: "/class/[id]/planning/[month]",
                    params: { id: classId, month: month.monthKey },
                  })
                }
                style={[
                  getSectionCardStyle(colors, "primary", { radius: 18 }),
                  {
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: 14,
                    gap: 6,
                  },
                ]}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 17 }}>
                  {month.label.replace(/^./, (char) => char.toUpperCase())}
                </Text>
                <Text style={{ color: colors.muted }}>
                  {month.weekCount} semana(s) · {month.estimatedLessonCount} aula(s) previstas
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
