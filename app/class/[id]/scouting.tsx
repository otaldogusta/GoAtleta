// perf-check: ignore-inline-row-style - linhas compactas do scouting usam cores dinâmicas do tema; extração estrutural fica para refatoração visual dedicada.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  DecisionEmptyState,
  DecisionMainLayout,
  DecisionReasonCard,
  DecisionSignalPanel,
  DecisionSummaryCards,
} from "../../../src/components/decision";
import { ScreenLoadingState } from "../../../src/components/ui/ScreenLoadingState";
import type { ClassGroup, ScoutingLog, Student, StudentScoutingLog } from "../../../src/core/models";
import { getCachedClassById, getClassById } from "../../../src/db/classes";
import { getStudentScoutingByRange, listScoutingLogsByClass } from "../../../src/db/session";
import { getStudentsByClass } from "../../../src/db/students";
import type { ScoutingSession } from "../../../src/core/scouting-session";
import { NewScoutingSessionPanel } from "../../../src/screens/scouting/components/NewScoutingSessionPanel";
import { listScoutingSessionsByClass } from "../../../src/screens/scouting/scouting-session-actions";
import {
  buildScoutingHistory,
  buildStudentScoutingSummary,
  buildTeamScoutingSummary,
} from "../../../src/screens/scouting/scouting-dashboard";
import { buildTeamPlanningContextSummary } from "../../../src/screens/team-context/team-context-actions";
import { useAppTheme } from "../../../src/ui/app-theme";
import { AppPageHeader } from "../../../src/ui/AppPageHeader";
import { AppScreenShell } from "../../../src/ui/AppScreenShell";
import { getClassPalette } from "../../../src/ui/class-colors";
import { ClassGenderBadge } from "../../../src/ui/ClassGenderBadge";
import { LocationBadge } from "../../../src/ui/LocationBadge";
import { Pressable } from "../../../src/ui/Pressable";
import { getSectionCardStyle } from "../../../src/ui/section-styles";
import { markRender, measureAsync } from "../../../src/observability/perf";

const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (date: string, days: number) => {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
};

const formatDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
        new Date(`${value}T12:00:00`)
      )
    : "-";

const summarizeLatestScouting = (log: { mode: "treino" | "jogo"; date: string } | null) => {
  if (!log) return "Nenhuma análise registrada.";
  return `${log.mode === "jogo" ? "Jogo" : "Treino"} em ${formatDate(log.date)}`;
};

const modeToLabel = (value: string) => (value === "pre_match" ? "Pré-jogo" : value === "post_match" ? "Pós-jogo" : value === "recovery" ? "Recuperação" : value === "evaluation" ? "Avaliação" : "Normal");

export default function ClassScoutingRoute() {
  const { id, openNew, date: dateParam, type: typeParam, source: sourceParam } = useLocalSearchParams<{
    id: string;
    openNew?: string;
    date?: string;
    type?: string;
    source?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const classId = typeof id === "string" ? id : "";
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [scoutingLogs, setScoutingLogs] = useState<ScoutingLog[]>([]);
  const [scoutingSessions, setScoutingSessions] = useState<ScoutingSession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentLogs, setStudentLogs] = useState<StudentScoutingLog[]>([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof buildTeamPlanningContextSummary>> | null>(null);
  const [showNewPanel, setShowNewPanel] = useState(openNew === "1");

  markRender("screen.scouting.render.root", {
    hasClass: cls ? 1 : 0,
    sessions: scoutingSessions.length,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setIsLoading(true);
        setError("");
        await measureAsync("screen.scouting.load.dashboard", async () => {
          const cached = await getCachedClassById(classId);
          if (alive && cached) setCls(cached);
          const classData = await getClassById(classId);
          if (!alive) return;
          setCls(classData);

          const [logs, sessions] = await Promise.all([
            listScoutingLogsByClass(classId, { limit: 20 }),
            listScoutingSessionsByClass(classId),
          ]);
          if (!alive) return;
          setScoutingLogs(logs);
          setScoutingSessions(sessions);

          const [allStudents, planningSummary] = await Promise.all([
            getStudentsByClass(classId),
            buildTeamPlanningContextSummary(classId, todayIso()),
          ]);
          if (!alive) return;
          setStudents(allStudents);
          setSummary(planningSummary);

          const latestDate = logs[0]?.date ?? todayIso();
          const fromDate = addDays(latestDate, -28);
          const byStudent = await getStudentScoutingByRange(classId, fromDate, addDays(latestDate, 1));
          if (!alive) return;
          setStudentLogs(byStudent);
        });
      } catch (loadError) {
        if (!alive) return;
        setError(loadError instanceof Error ? loadError.message : "Falha ao carregar scouting.");
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [classId]);

  useEffect(() => {
    setShowNewPanel(openNew === "1");
  }, [openNew]);

  const latestScouting = scoutingSessions[0]
    ? {
        mode: (scoutingSessions[0].type === "training" ? "treino" : "jogo") as "treino" | "jogo",
        date: scoutingSessions[0].date,
      }
    : scoutingLogs[0]
      ? { mode: scoutingLogs[0].mode, date: scoutingLogs[0].date }
      : null;
  const classPalette = getClassPalette(cls?.colorKey ?? null, colors, cls?.unit ?? "");
  const activeScoutingSession = useMemo(
    () =>
      scoutingSessions.find((item) => item.status === "in_progress") ??
      scoutingSessions.find((item) => item.status === "draft") ??
      null,
    [scoutingSessions]
  );
  const historyItems = useMemo(
    () => buildScoutingHistory(scoutingLogs, summary?.scoutingImpacts ?? []),
    [scoutingLogs, summary?.scoutingImpacts]
  );
  const collectiveSummary = useMemo(() => buildTeamScoutingSummary(scoutingLogs), [scoutingLogs]);
  const individualSummary = useMemo(
    () => buildStudentScoutingSummary(students, studentLogs),
    [students, studentLogs]
  );

  const alerts = useMemo(() => {
    const items: string[] = [];
    if (collectiveSummary?.metrics) {
      for (const metric of collectiveSummary.metrics) {
        if (metric.trendLabel === "Queda recente") {
          items.push(`${metric.label} caiu nas análises recentes.`);
        } else if (metric.trendLabel === "Em evolução") {
          items.push(`${metric.label} melhorou nas últimas sessões.`);
        }
      }
    }
    if (!items.length && collectiveSummary?.focusLabel) {
      items.push(`Foco atual da equipe: ${collectiveSummary.focusLabel}.`);
    }
    return items.slice(0, 3);
  }, [collectiveSummary]);

  const priorities = useMemo(() => {
    const sources: { label: string; source: string }[] = [];
    for (const hint of summary?.context.focusHints ?? []) {
      const source =
        summary?.scoutingImpacts?.some((item) => item.recommendedFocus.includes(hint) || item.weaknesses.includes(hint))
          ? "scouting"
          : summary?.interventions?.some((item) => item.tags.includes(hint) || item.summary.toLowerCase().includes(hint.toLowerCase()))
          ? "intervenção"
          : "contexto competitivo";
      if (!sources.some((item) => item.label === hint)) {
        sources.push({ label: hint, source });
      }
    }
    return sources.slice(0, 3);
  }, [summary]);

  const evolution = useMemo(() => {
    if (!individualSummary.length) return { rising: [], falling: [], attention: [] as typeof individualSummary };
    const sortedByScore = [...individualSummary].sort((a, b) => b.overallScore - a.overallScore);
    const rising = sortedByScore.slice(0, 3);
    const attention = [...individualSummary].sort((a, b) => a.overallScore - b.overallScore).slice(0, 3);
    return { rising, falling: [], attention };
  }, [individualSummary]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace({ pathname: "/class/[id]", params: { id: classId } });
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
      <NewScoutingSessionPanel
        visible={showNewPanel}
        classId={classId}
        initialDate={typeof dateParam === "string" ? dateParam : undefined}
        initialSource={
          sourceParam === "session" || sourceParam === "event" ? sourceParam : "manual"
        }
        initialType={typeParam === "game" ? "jogo" : typeParam === "friendly" ? "amistoso" : "treino"}
        onClose={() => {
          setShowNewPanel(false);
          router.replace({ pathname: "/class/[id]/scouting", params: { id: classId } });
        }}
        onCreated={(route) => {
          setShowNewPanel(false);
          router.replace(route);
        }}
      />
      <AppScreenShell
        maxWidth={1320}
        header={
          <AppPageHeader
            title="Scouting"
            subtitle="Análise técnica, jogo e evolução da equipe."
            onBack={handleBack}
            actionLabel="+ Novo scouting"
            onAction={() => setShowNewPanel(true)}
            meta={
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: classPalette.bg }} />
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>
                    {cls?.name ?? "Turma"}
                  </Text>
                  <ClassGenderBadge gender={cls?.gender ?? "misto"} size="sm" />
                </View>
                <LocationBadge location={cls?.unit ?? "Unidade"} palette={classPalette} size="sm" showIcon />
              </View>
            }
          />
        }
      >
      <ScrollView
        contentContainerStyle={{
          gap: 18,
          paddingBottom: Math.max(insets.bottom + 40, 56),
        }}
      >

        {error ? (
          <View style={[getSectionCardStyle(colors, "warning", { radius: 16 }), { gap: 6 }]}>
            <Text style={{ color: colors.dangerText, fontWeight: "700" }}>Falha ao carregar</Text>
            <Text style={{ color: colors.muted }}>{error}</Text>
          </View>
        ) : null}

        <DecisionSummaryCards
          items={[
            {
              label: "Última análise",
              value: summarizeLatestScouting(latestScouting),
            },
            {
              label: "Próximo contexto",
              value: summary?.events?.[0]
                ? `${summary.events[0].title} · ${formatDate(summary.events[0].date)}`
                : "Sem evento próximo",
            },
            {
              label: "Modo atual",
              value: summary ? modeToLabel(summary.context.planningMode) : "Normal",
            },
          ]}
        />

        <DecisionMainLayout
          main={
            <View style={getSectionCardStyle(colors, "neutral", { radius: 18 })}>
              <View style={{ gap: 4 }}>
                <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800" }}>Últimos scoutings</Text>
                <Text style={{ color: colors.muted }}>
                  Registre ações do treino ou jogo para acompanhar pontos fortes e pontos de atenção.
                </Text>
              </View>
              {activeScoutingSession ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/class/[id]/scouting/[scoutingSessionId]",
                      params: { id: classId, scoutingSessionId: activeScoutingSession.id },
                    })
                  }
                  style={[
                    getSectionCardStyle(colors, "primary", { radius: 16, shadow: false }),
                    { gap: 6 },
                  ]}
                >
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                    Continuar análise em andamento
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    {activeScoutingSession.title} · {formatDate(activeScoutingSession.date)}
                  </Text>
                </Pressable>
              ) : null}
              {!historyItems.length && !scoutingSessions.length ? (
                <DecisionEmptyState
                  title="Ainda não há análises desta turma"
                  description="Comece registrando ações do treino ou jogo para enxergar pontos fortes e pontos de atenção."
                  actionLabel="Iniciar primeiro scouting"
                  onAction={() => setShowNewPanel(true)}
                />
              ) : (
                <>
                  {scoutingSessions.slice(0, 6).map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() =>
                        router.push({
                          pathname: "/class/[id]/scouting/[scoutingSessionId]",
                          params: { id: classId, scoutingSessionId: item.id },
                        })
                      }
                      style={[
                        getSectionCardStyle(colors, "primary", { radius: 16, shadow: false }),
                        { gap: 8 },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <View style={{ gap: 4, flex: 1 }}>
                          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{item.title}</Text>
                          <Text style={{ color: colors.muted }}>
                            {item.type === "training" ? "Treino" : item.type === "friendly" ? "Amistoso" : "Jogo"} ·{" "}
                            {formatDate(item.date)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                          <Badge colors={colors} label="Nova sessão" tone="soft" />
                          <Badge
                            colors={colors}
                            label={
                              item.status === "draft"
                                ? "Rascunho"
                                : item.status === "in_progress"
                                  ? "Em andamento"
                                  : item.status === "completed"
                                    ? "Concluído"
                                    : "Arquivado"
                            }
                            tone={item.status === "completed" ? "ok" : "soft"}
                          />
                        </View>
                      </View>
                      <Text style={{ color: colors.muted }}>
                        {item.opponent ? `Adversário: ${item.opponent}` : "Registro aberto no novo fluxo de scouting."}
                      </Text>
                    </Pressable>
                  ))}

                  {historyItems.slice(0, 4).map((item) => (
                    <View
                      key={item.id}
                      style={[getSectionCardStyle(colors, "neutral", { radius: 16, shadow: false }), { gap: 8 }]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <View style={{ gap: 4, flex: 1 }}>
                          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{item.title}</Text>
                          <Text style={{ color: colors.muted }}>
                            {item.modeLabel} · {formatDate(item.date)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                          <Badge colors={colors} label="Legado" tone="soft" />
                          <Badge
                            colors={colors}
                            label={item.statusLabel}
                            tone={item.statusLabel === "Finalizado" ? "ok" : "soft"}
                          />
                        </View>
                      </View>
                      <Text style={{ color: colors.muted }}>{item.totalActions} ações registradas.</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          }
          side={
            <>
              <DecisionSignalPanel
                title="Alertas da equipe"
                subtitle="Sinais rápidos para leitura técnica."
                items={alerts.map((alert) => ({ label: alert }))}
                emptyTitle="Sem sinais de atenção"
                emptyDescription="Os alertas aparecem quando o scouting indicar um padrão recorrente."
              />

              <DecisionReasonCard title="Prioridades da semana" items={priorities} />

              <DecisionSignalPanel
                title="Evolução individual"
                subtitle="Quem evoluiu e quem precisa de atenção no momento."
                items={[
                  ...evolution.rising.map((item) => ({
                    label: `${item.studentName} em destaque`,
                    detail: `Score ${item.overallScore.toFixed(1)} · prioridade ${item.priorityLabel}`,
                  })),
                  ...evolution.attention.slice(0, 2).map((item) => ({
                    label: `${item.studentName} precisa atenção`,
                    detail: `Score ${item.overallScore.toFixed(1)} · prioridade ${item.priorityLabel}`,
                  })),
                ].slice(0, 5)}
                emptyTitle="Aguardando ações por atleta"
                emptyDescription="Quando houver registros individuais, esta área mostra evolução e pontos de atenção."
              />
            </>
          }
        />
      </ScrollView>
      </AppScreenShell>
    </SafeAreaView>
  );
}

function Badge({
  label,
  tone,
  colors,
}: {
  label: string;
  tone: "ok" | "soft";
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View
      style={{
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: tone === "ok" ? colors.successBg : colors.secondaryBg,
      }}
    >
      <Text style={{ color: tone === "ok" ? colors.successText : colors.text, fontWeight: "700", fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}
