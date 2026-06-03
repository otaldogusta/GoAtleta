import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackTitleHeader } from "../../../src/components/ui/BackTitleHeader";
import type { ClassGroup, ScoutingLog } from "../../../src/core/models";
import {
  countsFromLog,
  getFocusSuggestion,
  getSkillMetrics,
  getTechnicalPerformanceScore,
  getTotalActions,
  scoutingSkills,
} from "../../../src/core/scouting";
import { getClassById, getLatestScoutingLog } from "../../../src/db/seed";
import { Button } from "../../../src/ui/Button";
import { ClassGenderBadge } from "../../../src/ui/ClassGenderBadge";
import { LocationBadge } from "../../../src/ui/LocationBadge";
import { useAppTheme } from "../../../src/ui/app-theme";
import { getClassPalette } from "../../../src/ui/class-colors";

const formatDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00`))
    : "-";

export default function ClassScoutingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const classId = typeof id === "string" ? id : "";
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [latestScouting, setLatestScouting] = useState<ScoutingLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const [classData, scoutingLog] = await Promise.all([
          getClassById(classId),
          getLatestScoutingLog(classId),
        ]);
        if (!alive) return;
        setCls(classData);
        setLatestScouting(scoutingLog);
      } catch (loadError) {
        if (!alive) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar a análise de scouting.",
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [classId]);

  const classPalette = useMemo(
    () => getClassPalette(cls?.colorKey ?? null, colors, cls?.unit ?? ""),
    [cls?.colorKey, cls?.unit, colors],
  );

  const scoutingCounts = useMemo(
    () => (latestScouting ? countsFromLog(latestScouting) : null),
    [latestScouting],
  );
  const totalActions = useMemo(
    () => (scoutingCounts ? getTotalActions(scoutingCounts) : 0),
    [scoutingCounts],
  );
  const performanceScore = useMemo(
    () => (scoutingCounts ? getTechnicalPerformanceScore(scoutingCounts) : null),
    [scoutingCounts],
  );
  const focusSuggestion = useMemo(
    () => (scoutingCounts ? getFocusSuggestion(scoutingCounts, 10) : null),
    [scoutingCounts],
  );

  const goBack = () => {
    if (classId) {
      router.replace({ pathname: "/class/[id]", params: { id: classId } });
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/prof/classes");
  };

  const openFastScouting = () => {
    if (!classId) return;
    router.push({
      pathname: "/class/[id]/session",
      params: { id: classId, tab: "scouting" },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 96,
          gap: 18,
          width: "100%",
          maxWidth: 980,
          alignSelf: "center",
        }}
      >
        <BackTitleHeader title="Análise de scouting" onBack={goBack} />

        <View
          style={{
            padding: 16,
            borderRadius: 18,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: classPalette.bg,
              }}
            />
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>
              {cls?.name ?? "Turma"}
            </Text>
            <ClassGenderBadge gender={cls?.gender ?? "misto"} size="md" />
          </View>
          <LocationBadge location={cls?.unit || "Unidade"} palette={classPalette} size="sm" showIcon />
          <Text style={{ color: colors.muted, lineHeight: 22 }}>
            Área para leitura técnica da turma, jogos, vídeos e sinais que ajudam a ajustar o
            próximo treino.
          </Text>
        </View>

        {loading ? (
          <View
            style={{
              padding: 18,
              borderRadius: 18,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              gap: 10,
            }}
          >
            <ActivityIndicator color={colors.primaryBg} />
            <Text style={{ color: colors.muted }}>Carregando scouting...</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View
            style={{
              padding: 16,
              borderRadius: 18,
              backgroundColor: colors.dangerBg,
              borderWidth: 1,
              borderColor: colors.dangerBorder,
              gap: 8,
            }}
          >
            <Text style={{ color: colors.dangerText, fontWeight: "800" }}>Falha ao carregar</Text>
            <Text style={{ color: colors.dangerText }}>{error}</Text>
          </View>
        ) : null}

        {!loading && !error ? (
          <View
            style={{
              padding: 16,
              borderRadius: 18,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 14,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
                  Scouting recente
                </Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>
                  {latestScouting
                    ? `${latestScouting.mode === "jogo" ? "Jogo" : "Treino"} em ${formatDate(
                        latestScouting.date,
                      )}`
                    : "Nenhum scouting registrado ainda."}
                </Text>
              </View>
              <View
                style={{
                  minWidth: 86,
                  borderRadius: 14,
                  backgroundColor: colors.secondaryBg,
                  padding: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 12 }}>Ações</Text>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>
                  {totalActions}
                </Text>
              </View>
            </View>

            {latestScouting && scoutingCounts ? (
              <>
                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                  <MetricPill
                    label="Desempenho"
                    value={performanceScore === null ? "-" : `${performanceScore.toFixed(1)}%`}
                    colors={colors}
                  />
                  <MetricPill
                    label="Foco"
                    value={focusSuggestion?.label ?? "Aguardando dados"}
                    colors={colors}
                  />
                </View>

                <View style={{ gap: 10 }}>
                  {scoutingSkills.map((skill) => {
                    const metrics = getSkillMetrics(scoutingCounts[skill.id]);
                    return (
                      <View
                        key={skill.id}
                        style={{
                          padding: 12,
                          borderRadius: 14,
                          backgroundColor: colors.secondaryBg,
                          borderWidth: 1,
                          borderColor: colors.border,
                          gap: 6,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <Text style={{ color: colors.text, fontWeight: "800" }}>{skill.label}</Text>
                          <Text style={{ color: colors.muted }}>{metrics.total} ações</Text>
                        </View>
                        <Text style={{ color: colors.muted }}>
                          Média {metrics.avg.toFixed(2)} · boas {Math.round(metrics.goodPct * 100)}%
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <Text style={{ color: colors.muted, lineHeight: 22 }}>
                Use o scouting rápido da Aula do Dia para registrar ações. Quando houver dados, o
                resumo técnico aparece aqui.
              </Text>
            )}
          </View>
        ) : null}

        <View
          style={{
            padding: 16,
            borderRadius: 18,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
            Vídeos e jogos
          </Text>
          <Text style={{ color: colors.muted, lineHeight: 22 }}>
            Use esta área para revisar a leitura da turma. O registro rápido continua na Aula do Dia;
            esta tela consolida a análise fora da aula operacional.
          </Text>
          <Button label="Abrir scouting rápido da aula" onPress={openFastScouting} variant="secondary" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricPill({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        minWidth: 140,
        padding: 12,
        borderRadius: 14,
        backgroundColor: colors.infoBg,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 4,
      }}
    >
      <Text style={{ color: colors.infoText, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}
