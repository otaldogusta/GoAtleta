import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenLoadingState } from "../../../src/components/ui/ScreenLoadingState";
import type { ClassGroup, ScoutingLog, Student, StudentScoutingLog } from "../../../src/core/models";
import { getCachedClassById, getClassById } from "../../../src/db/classes";
import { getStudentScoutingByRange, listScoutingLogsByClass } from "../../../src/db/session";
import { getStudentsByClass } from "../../../src/db/students";
import type { ScoutingSession } from "../../../src/core/scouting-session";
import { listScoutingSessionsByClass } from "../../../src/screens/scouting/scouting-session-actions";
import {
  buildScoutingHistory,
  buildStudentScoutingSummary,
  buildTeamScoutingSummary,
} from "../../../src/screens/scouting/scouting-dashboard";
import { buildTeamPlanningContextSummary } from "../../../src/screens/team-context/team-context-actions";
import { useAppTheme } from "../../../src/ui/app-theme";
import { getClassPalette } from "../../../src/ui/class-colors";
import { ClassGenderBadge } from "../../../src/ui/ClassGenderBadge";
import { LocationBadge } from "../../../src/ui/LocationBadge";
import { Pressable } from "../../../src/ui/Pressable";
import { getSectionCardStyle } from "../../../src/ui/section-styles";

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const classId = typeof id === "string" ? id : "";
  const isDesktop = width >= 1040;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [scoutingLogs, setScoutingLogs] = useState<ScoutingLog[]>([]);
  const [scoutingSessions, setScoutingSessions] = useState<ScoutingSession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentLogs, setStudentLogs] = useState<StudentScoutingLog[]>([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof buildTeamPlanningContextSummary>> | null>(null);
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setIsLoading(true);
        setError("");
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

  useEffect(() => {
    if (isLoading || error || !activeScoutingSession || hasRedirected) return;
    setHasRedirected(true);
    router.replace({
      pathname: "/class/[id]/scouting/[scoutingSessionId]",
      params: { id: classId, scoutingSessionId: activeScoutingSession.id },
    });
  }, [activeScoutingSession, classId, error, hasRedirected, isLoading, router]);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenLoadingState />
      </SafeAreaView>
    );
  }

  if (activeScoutingSession && !hasRedirected) {
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
          maxWidth: 1320,
          alignSelf: "center",
        }}
      >
        <View
          style={{
            flexDirection: isDesktop ? "row" : "column",
            alignItems: isDesktop ? "flex-start" : "stretch",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Pressable
                onPress={handleBack}
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
                Scouting
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 14, marginLeft: 42 }}>
              Análise técnica, jogo e evolução da equipe.
            </Text>
          </View>

          <View style={{ alignItems: isDesktop ? "flex-end" : "flex-start", gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                {cls?.name ?? "Turma"}
              </Text>
              <ClassGenderBadge gender={cls?.gender ?? "misto"} size="md" />
            </View>
            <LocationBadge location={cls?.unit ?? "Unidade"} palette={classPalette} size="sm" showIcon />
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/class/[id]/scouting/new",
                  params: { id: classId },
                })
              }
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: colors.text,
              }}
            >
              <Text style={{ color: colors.background, fontWeight: "800" }}>+ Novo scouting</Text>
            </Pressable>
          </View>
        </View>

        {error ? (
          <View style={[getSectionCardStyle(colors, "warning", { radius: 16 }), { gap: 6 }]}>
            <Text style={{ color: colors.dangerText, fontWeight: "700" }}>Falha ao carregar</Text>
            <Text style={{ color: colors.muted }}>{error}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <TopInfoCard colors={colors} label="Última análise" value={summarizeLatestScouting(latestScouting)} />
          <TopInfoCard
            colors={colors}
            label="Próximo contexto"
            value={summary?.events?.[0] ? `${summary.events[0].title} · ${formatDate(summary.events[0].date)}` : "Sem evento próximo"}
          />
          <TopInfoCard
            colors={colors}
            label="Modo atual"
            value={summary ? modeToLabel(summary.context.planningMode) : "Normal"}
          />
        </View>

        <View
          style={{
            flexDirection: isDesktop ? "row" : "column",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <View style={{ flex: isDesktop ? 1.8 : undefined, width: "100%", gap: 16 }}>
            <View style={getSectionCardStyle(colors, "neutral", { radius: 18 })}>
              <SectionTitle
                title="Últimos scoutings"
                subtitle="Abra uma análise recente ou inicie um novo scouting de treino, amistoso ou jogo."
                colors={colors}
              />
              {!historyItems.length && !scoutingSessions.length ? (
                <EmptyCard
                  colors={colors}
                  title="Nenhum scouting registrado"
                  body="Crie uma análise para começar o histórico técnico da turma."
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
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <View style={{ gap: 4, flex: 1 }}>
                          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{item.title}</Text>
                          <Text style={{ color: colors.muted }}>
                            {item.type === "training" ? "Treino" : item.type === "friendly" ? "Amistoso" : "Jogo"} · {formatDate(item.date)}
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
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
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
          </View>

          <View style={{ flex: isDesktop ? 0.95 : undefined, width: "100%", gap: 16 }}>
            <SummaryPanel
              title="Alertas da equipe"
              subtitle="Sinais rápidos para leitura técnica."
              colors={colors}
              items={alerts.map((alert) => ({ title: alert }))}
              emptyTitle="Sem alertas críticos"
              emptyBody="Assim que houver volume suficiente de análise, os sinais técnicos aparecem aqui."
              tone="warning"
            />

            <SummaryPanel
              title="Prioridades da semana"
              subtitle="O que deve puxar a próxima decisão de treino."
              colors={colors}
              items={priorities.map((item) => ({ title: item.label, subtitle: `Origem: ${item.source}` }))}
              emptyTitle="Sem prioridades resolvidas"
              emptyBody="Eventos, intervenções e scouting recente vão aparecer aqui como prioridade semanal."
              tone="primary"
              chipMode
            />

            <View style={[getSectionCardStyle(colors, "neutral", { radius: 18 }), { gap: 12 }]}>
              <SectionTitle
                title="Evolução individual"
                subtitle="Quem evoluiu e quem precisa de atenção no momento."
                colors={colors}
              />
              {!individualSummary.length ? (
                <EmptyCard
                  colors={colors}
                  title="Sem leitura individual ainda"
                  body="Quando houver lançamentos por atleta, esta área mostra evolução e atenção individual."
                />
              ) : (
                <>
                  <EvolutionColumn
                    title="Em destaque"
                    items={evolution.rising}
                    colors={colors}
                    emptyLabel="Sem atletas em destaque ainda."
                  />
                  <EvolutionColumn
                    title="Precisam atenção"
                    items={evolution.attention}
                    colors={colors}
                    emptyLabel="Sem alertas individuais ainda."
                  />
                </>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({
  title,
  subtitle,
  colors,
}: {
  title: string;
  subtitle: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800" }}>{title}</Text>
      <Text style={{ color: colors.muted }}>{subtitle}</Text>
    </View>
  );
}

function TopInfoCard({
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
      style={[
        getSectionCardStyle(colors, "neutral", { radius: 16, shadow: false }),
        { flexGrow: 1, flexBasis: 220 },
      ]}
    >
      <Text style={{ color: colors.muted, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 17 }}>{value}</Text>
    </View>
  );
}

function SummaryPanel({
  title,
  subtitle,
  items,
  colors,
  emptyTitle,
  emptyBody,
  tone,
  chipMode = false,
}: {
  title: string;
  subtitle: string;
  items: { title: string; subtitle?: string }[];
  colors: ReturnType<typeof useAppTheme>["colors"];
  emptyTitle: string;
  emptyBody: string;
  tone: "primary" | "warning";
  chipMode?: boolean;
}) {
  return (
    <View style={[getSectionCardStyle(colors, "neutral", { radius: 18 }), { gap: 12 }]}>
      <SectionTitle title={title} subtitle={subtitle} colors={colors} />
      {!items.length ? (
        <>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>{emptyTitle}</Text>
          <Text style={{ color: colors.muted }}>{emptyBody}</Text>
        </>
      ) : chipMode ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {items.map((item) => (
            <View
              key={item.title}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>{item.title}</Text>
              {item.subtitle ? <Text style={{ color: colors.muted, fontSize: 12 }}>{item.subtitle}</Text> : null}
            </View>
          ))}
        </View>
      ) : (
        items.map((item) => (
          <View key={item.title} style={{ gap: 2 }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{item.title}</Text>
            {item.subtitle ? <Text style={{ color: colors.muted, fontSize: 12 }}>{item.subtitle}</Text> : null}
          </View>
        ))
      )}
    </View>
  );
}

function EmptyCard({
  title,
  body,
  colors,
}: {
  title: string;
  body: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View style={getSectionCardStyle(colors, "neutral", { radius: 16, shadow: false })}>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>{title}</Text>
      <Text style={{ color: colors.muted }}>{body}</Text>
    </View>
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

function EvolutionColumn({
  title,
  items,
  colors,
  emptyLabel,
}: {
  title: string;
  items: ReturnType<typeof buildStudentScoutingSummary>;
  colors: ReturnType<typeof useAppTheme>["colors"];
  emptyLabel: string;
}) {
  return (
    <View style={[getSectionCardStyle(colors, "neutral", { radius: 16, shadow: false }), { flex: 1, gap: 10 }]}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>{title}</Text>
      {!items.length ? (
        <Text style={{ color: colors.muted }}>{emptyLabel}</Text>
      ) : (
        items.map((item) => (
          <View key={item.studentId} style={{ gap: 2 }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{item.studentName}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Score {item.overallScore.toFixed(1)} · prioridade {item.priorityLabel}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}
