import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenPageHeader } from "../../../../src/components/ui/ScreenPageHeader";
import { GoAtletaIcon, type GoAtletaIconName } from "../../../../src/ui/icon-registry";
import type {
  ScoutingAction,
  ScoutingActionFundamental,
  ScoutingActionPhase,
  ScoutingSession,
  Student,
} from "../../../../src/core/models";
import {
  buildScoutingAthleteHighlights,
  buildScoutingTeamSignals,
  buildScoutingWeeklyPriorities,
  getScoutingResultOptions,
  scoutingActionFundamentals,
  scoutingActionPhases,
  scoutingSessionTypes,
} from "../../../../src/core/scouting";
import {
  addScoutingAction,
  completeScoutingSession,
  deleteLastScoutingAction,
  getScoutingSessionById,
  getStudentsByClass,
} from "../../../../src/db/seed";
import { Button } from "../../../../src/ui/Button";
import { Pressable } from "../../../../src/ui/Pressable";
import { useAppTheme } from "../../../../src/ui/app-theme";
import { getSectionCardStyle } from "../../../../src/ui/section-styles";

const formatDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00`))
    : "-";

const formatTime = (value: string) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "";

const typeLabel = (type: ScoutingSession["type"]) =>
  scoutingSessionTypes.find((item) => item.id === type)?.label ?? "Treino";

const fundamentalLabel = (id: ScoutingActionFundamental) =>
  scoutingActionFundamentals.find((item) => item.id === id)?.label ?? id;

const phaseLabel = (id: ScoutingActionPhase) =>
  scoutingActionPhases.find((item) => item.id === id)?.label ?? id;

export default function ClassScoutingSessionRoute() {
  const { id, scoutingSessionId } = useLocalSearchParams<{
    id: string;
    scoutingSessionId?: string;
  }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const classId = typeof id === "string" ? id : "";
  const sessionId = typeof scoutingSessionId === "string" ? scoutingSessionId : "";
  const [session, setSession] = useState<ScoutingSession | null>(null);
  const [actions, setActions] = useState<ScoutingAction[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [manualAthlete, setManualAthlete] = useState("");
  const [fundamental, setFundamental] = useState<ScoutingActionFundamental>("recepcao");
  const [phase, setPhase] = useState<ScoutingActionPhase>("side_out");
  const [resultKey, setResultKey] = useState("erro");

  const loadData = useCallback(async () => {
    if (!classId || !sessionId) return;
    setLoading(true);
    setError("");
    try {
      const [detail, classStudents] = await Promise.all([
        getScoutingSessionById(sessionId),
        getStudentsByClass(classId),
      ]);
      setSession(detail?.session ?? null);
      setActions(detail?.actions ?? []);
      setStudents(classStudents);
      setSelectedStudentId((current) => current ?? classStudents[0]?.id ?? null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar a sessão de scouting."
      );
    } finally {
      setLoading(false);
    }
  }, [classId, sessionId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const options = getScoutingResultOptions(fundamental);
    if (!options.some((option) => option.key === resultKey)) {
      setResultKey(options[0]?.key ?? "erro");
    }
  }, [fundamental, resultKey]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, students]
  );
  const isCompleted = session?.status === "concluido";
  const athletesEvaluated = useMemo(
    () =>
      new Set(
        actions
          .map((action) => action.studentId || action.athleteName)
          .filter((value): value is string => Boolean(value))
      ).size,
    [actions]
  );
  const signals = useMemo(() => buildScoutingTeamSignals(actions), [actions]);
  const priorities = useMemo(() => buildScoutingWeeklyPriorities(actions), [actions]);
  const highlights = useMemo(() => buildScoutingAthleteHighlights(actions), [actions]);
  const resultOptions = getScoutingResultOptions(fundamental);
  const selectedResult = resultOptions.find((option) => option.key === resultKey) ?? resultOptions[0];
  const positiveActions = useMemo(
    () => actions.filter((action) => action.resultLevel >= 2).length,
    [actions]
  );
  const positiveRate = actions.length ? Math.round((positiveActions / actions.length) * 100) : null;
  const sampleStatus = actions.length >= 8 ? "Amostra útil" : `${actions.length}/8 para sinais`;

  const goBack = () => {
    router.replace({ pathname: "/class/[id]/scouting", params: { id: classId } });
  };

  const applyDetail = (detail: { session: ScoutingSession; actions: ScoutingAction[] } | null) => {
    if (!detail) return;
    setSession(detail.session);
    setActions(detail.actions);
  };

  const handleRegister = async () => {
    if (!session || saving || isCompleted) return;
    setSaving(true);
    setError("");
    try {
      const detail = await addScoutingAction({
        sessionId: session.id,
        studentId: selectedStudent?.id ?? null,
        athleteName: selectedStudent?.name ?? manualAthlete,
        fundamental,
        phase,
        resultKey,
      });
      applyDetail(detail);
      setManualAthlete("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível registrar a ação.");
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = async () => {
    if (!session || saving || isCompleted) return;
    setSaving(true);
    setError("");
    try {
      const detail = await deleteLastScoutingAction(session.id);
      applyDetail(detail);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível desfazer.");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!session || saving || isCompleted) return;
    setSaving(true);
    setError("");
    try {
      const detail = await completeScoutingSession(session.id);
      applyDetail(detail);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível finalizar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingBottom: 96,
          gap: 16,
          width: "100%",
          maxWidth: 1480,
          alignSelf: "center",
        }}
      >
        <ScreenPageHeader
          title="Scouting"
          subtitle={`${session?.title ?? "Análise da turma"}${session ? ` · ${formatDate(session.date)}` : ""}`}
          onBack={goBack}
          right={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {session ? (
                <StatusPill
                  label={isCompleted ? "Concluído" : "Em andamento"}
                  tone={isCompleted ? "neutral" : "success"}
                  colors={colors}
                />
              ) : null}
              <Button
                label={isCompleted ? "Análise finalizada" : "Finalizar análise"}
                onPress={handleComplete}
                disabled={!session || isCompleted}
                loading={saving && !isCompleted}
                variant={isCompleted ? "secondary" : "primary"}
              />
            </View>
          }
          style={{ marginHorizontal: -24, marginTop: -24 }}
        />

        {loading ? (
          <View style={[getSectionCardStyle(colors, "neutral", { shadow: false }), { alignItems: "center" }]}>
            <ActivityIndicator color={colors.primaryBg} />
            <Text style={{ color: colors.muted }}>Carregando sessão...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={getSectionCardStyle(colors, "warning", { shadow: false })}>
            <Text style={{ color: colors.warningText, fontWeight: "900" }}>Atenção</Text>
            <Text style={{ color: colors.warningText }}>{error}</Text>
          </View>
        ) : null}

        {!loading && session ? (
          <>
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 12,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <StatCard icon="calendar" label="Data" value={formatDate(session.date)} colors={colors} />
              <StatCard icon="plan" label="Contexto" value={typeLabel(session.type)} colors={colors} />
              <StatCard icon="nfc" label="Amostra" value={sampleStatus} colors={colors} />
              <StatCard icon="students" label="Atletas" value={String(athletesEvaluated)} colors={colors} />
              <StatCard icon="scouting" label="Ações" value={String(actions.length)} colors={colors} />
              <StatCard
                icon="periodization"
                label="Positivas"
                value={positiveRate == null ? "Sem dados" : `${positiveRate}%`}
                colors={colors}
              />
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
              <View style={{ flex: 1.45, minWidth: 320, gap: 16 }}>
                <View style={[getSectionCardStyle(colors, "primary", { shadow: false, padding: 18 }), { gap: 16 }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
                        Codificar lance
                      </Text>
                      <Text style={{ color: colors.muted, marginTop: 4 }}>
                        Registro técnico por ação para gerar sinais reais de treino.
                      </Text>
                    </View>
                    <Button
                      label="Registrar"
                      onPress={handleRegister}
                      loading={saving}
                      disabled={isCompleted}
                    />
                  </View>
                  {isCompleted ? (
                    <Text style={{ color: colors.muted }}>
                      Esta análise está concluída. Os registros ficam disponíveis para leitura.
                    </Text>
                  ) : null}

                  <View
                    style={{
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      padding: 8,
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <SelectedContextItem
                      label="Atleta"
                      value={selectedStudent?.name || manualAthlete || "Equipe"}
                      colors={colors}
                    />
                    <SelectedContextItem
                      label="Fundamento"
                      value={fundamentalLabel(fundamental)}
                      colors={colors}
                    />
                    <SelectedContextItem label="Fase" value={phaseLabel(phase)} colors={colors} />
                    <SelectedContextItem
                      label="Resultado"
                      value={selectedResult?.label ?? "Erro"}
                      colors={colors}
                    />
                  </View>

                  <View style={{ gap: 14 }}>
                    <ControlGroup title="Atleta" colors={colors}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {students.slice(0, 12).map((student) => (
                          <Chip
                            key={student.id}
                            label={student.name}
                            active={selectedStudentId === student.id}
                            onPress={() => {
                              setSelectedStudentId(student.id);
                              setManualAthlete("");
                            }}
                            disabled={isCompleted}
                            colors={colors}
                          />
                        ))}
                        <Chip
                          label="+ Outro"
                          active={!selectedStudentId}
                          onPress={() => setSelectedStudentId(null)}
                          disabled={isCompleted}
                          colors={colors}
                        />
                      </View>
                      {!selectedStudentId ? (
                        <TextInput
                          value={manualAthlete}
                          onChangeText={setManualAthlete}
                          editable={!isCompleted}
                          placeholder="Nome da atleta opcional"
                          placeholderTextColor={colors.placeholder}
                          style={{
                            minHeight: 40,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.background,
                            color: colors.inputText,
                            paddingHorizontal: 12,
                          }}
                        />
                      ) : null}
                    </ControlGroup>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
                      <View
                        style={{
                          flex: 1.1,
                          minWidth: 280,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                          padding: 12,
                        }}
                      >
                        <ControlGroup title="Fundamento" colors={colors}>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                            {scoutingActionFundamentals.map((item) => (
                              <Chip
                                key={item.id}
                                label={item.label}
                                active={fundamental === item.id}
                                onPress={() => setFundamental(item.id)}
                                disabled={isCompleted}
                                colors={colors}
                              />
                            ))}
                          </View>
                        </ControlGroup>
                      </View>

                      <View style={{ flex: 0.9, minWidth: 260, gap: 12 }}>
                        <View
                          style={{
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.background,
                            padding: 12,
                          }}
                        >
                          <ControlGroup title="Fase" colors={colors}>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                              {scoutingActionPhases.map((item) => (
                                <Chip
                                  key={item.id}
                                  label={item.label}
                                  active={phase === item.id}
                                  onPress={() => setPhase(item.id)}
                                  disabled={isCompleted}
                                  colors={colors}
                                />
                              ))}
                            </View>
                          </ControlGroup>
                        </View>

                        <View
                          style={{
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.background,
                            padding: 12,
                          }}
                        >
                          <ControlGroup title="Resultado" colors={colors}>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                              {resultOptions.map((item) => (
                                <Chip
                                  key={item.key}
                                  label={item.label}
                                  active={resultKey === item.key}
                                  onPress={() => setResultKey(item.key)}
                                  disabled={isCompleted}
                                  tone={item.level >= 3 ? "success" : item.level === 0 ? "danger" : "neutral"}
                                  colors={colors}
                                />
                              ))}
                            </View>
                          </ControlGroup>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={getSectionCardStyle(colors, "neutral", { shadow: false })}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                    <View>
                      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
                        Timeline
                      </Text>
                      <Text style={{ color: colors.muted, marginTop: 2 }}>
                        Últimas ações registradas na análise.
                      </Text>
                    </View>
                    <Button
                      label="Desfazer"
                      variant="secondary"
                      onPress={handleUndo}
                      disabled={!actions.length || isCompleted}
                      loading={saving && !isCompleted}
                    />
                  </View>
                  {actions.length ? (
                    actions.slice(0, 12).map((action) => (
                      <ActionRow key={action.id} action={action} colors={colors} />
                    ))
                  ) : (
                    <EmptyState title="Nenhuma ação registrada" text="Codifique o primeiro lance para iniciar a timeline." colors={colors} />
                  )}
                </View>
              </View>

              <View style={{ flex: 0.78, minWidth: 360 }}>
                <View style={[getSectionCardStyle(colors, "neutral", { shadow: false, padding: 18 }), { gap: 16 }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
                        Painel técnico
                      </Text>
                      <Text style={{ color: colors.muted, marginTop: 4 }}>
                        Leitura consolidada da sessão.
                      </Text>
                    </View>
                    <StatusPill
                      label={actions.length >= 8 ? "Confiável" : "Amostra baixa"}
                      tone={actions.length >= 8 ? "success" : "warning"}
                      colors={colors}
                    />
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <MiniMetric label="Ações" value={String(actions.length)} colors={colors} />
                    <MiniMetric label="Atletas" value={String(athletesEvaluated)} colors={colors} />
                    <MiniMetric
                      label="Positivas"
                      value={positiveRate == null ? "-" : `${positiveRate}%`}
                      colors={colors}
                    />
                  </View>

                  <View
                    style={{
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      padding: 12,
                      gap: 8,
                    }}
                  >
                    <SummaryLine
                      label="Ponto forte"
                      value={signals.find((signal) => signal.tone === "success")?.title ?? "Sem leitura ainda"}
                      colors={colors}
                    />
                    <SummaryLine
                      label="Atenção"
                      value={
                        signals.find((signal) => signal.tone !== "success")?.title ?? "Sem alerta relevante"
                      }
                      colors={colors}
                    />
                  </View>

                  <InsightBlock title="Sinais para treino" colors={colors}>
                    {signals.length ? (
                      signals.map((signal) => (
                        <Text key={signal.title} style={{ color: colors.muted }}>
                          {signal.title} · {signal.description}
                        </Text>
                      ))
                    ) : (
                      <Text style={{ color: colors.muted }}>Sem alertas relevantes</Text>
                    )}
                  </InsightBlock>

                  <InsightBlock title="Atletas em destaque" colors={colors}>
                    {highlights.length ? (
                      highlights.map((item) => (
                        <Text key={item.studentId ?? item.name} style={{ color: colors.muted }}>
                          {item.name} · {item.score}% · {item.positiveActions} ações positivas
                        </Text>
                      ))
                    ) : (
                      <Text style={{ color: colors.muted }}>Sem leitura individual ainda</Text>
                    )}
                  </InsightBlock>

                  <InsightBlock title="Prioridades" colors={colors}>
                    {priorities.length ? (
                      priorities.map((item, index) => (
                        <Text key={item.title} style={{ color: colors.muted }}>
                          {index + 1}. {item.title} · {item.description}
                        </Text>
                      ))
                    ) : (
                      <Text style={{ color: colors.muted }}>Sem prioridades geradas</Text>
                    )}
                  </InsightBlock>

                  <InsightBlock title="Vídeo" colors={colors}>
                    <Text style={{ color: colors.muted }}>
                      Integração com vídeo será adicionada futuramente.
                    </Text>
                  </InsightBlock>
                </View>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  label,
  value,
  colors,
}: {
  icon: GoAtletaIconName;
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 150,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: colors.secondaryBg,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.card,
        }}
      >
        <GoAtletaIcon name={icon} size={15} color={colors.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{label}</Text>
        <Text
          numberOfLines={2}
          style={{ color: colors.text, fontSize: 15, fontWeight: "900", marginTop: 2 }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function StatusPill({
  label,
  tone,
  colors,
}: {
  label: string;
  tone: "neutral" | "success" | "warning";
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const palette =
    tone === "success"
      ? { bg: colors.successBg, text: colors.successText, border: colors.successBg }
      : tone === "warning"
        ? { bg: colors.warningBg, text: colors.warningText, border: colors.warningBg }
        : { bg: colors.secondaryBg, text: colors.secondaryText, border: colors.border };
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingVertical: 5,
        paddingHorizontal: 9,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.bg,
      }}
    >
      <Text style={{ color: palette.text, fontSize: 11, fontWeight: "900" }}>{label}</Text>
    </View>
  );
}

function SelectedContextItem({
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
        flex: 1,
        minWidth: 150,
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: colors.secondaryBg,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, fontWeight: "900", marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

function MiniMetric({
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
        flex: 1,
        minWidth: 96,
        padding: 10,
        borderRadius: 12,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900", marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

function ControlGroup({
  title,
  children,
  colors,
}: {
  title: string;
  children: ReactNode;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  active,
  disabled,
  onPress,
  tone = "neutral",
  colors,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
  tone?: "neutral" | "success" | "danger";
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const activePalette =
    tone === "success"
      ? { bg: colors.successBg, text: colors.successText, border: colors.successBg }
      : tone === "danger"
        ? { bg: colors.dangerBg, text: colors.dangerText, border: colors.dangerBorder }
        : { bg: colors.primaryBg, text: colors.primaryText, border: colors.primaryBg };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: active ? activePalette.border : colors.border,
        backgroundColor: active ? activePalette.bg : colors.secondaryBg,
        opacity: disabled ? 0.62 : 1,
        maxWidth: 240,
      }}
    >
      <Text
        numberOfLines={1}
        style={{ color: active ? activePalette.text : colors.text, fontSize: 13, fontWeight: "900" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ActionRow({
  action,
  colors,
}: {
  action: ScoutingAction;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View
      style={{
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.secondaryBg,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: action.resultLevel >= 2 ? colors.successBg : colors.warningBg,
        }}
      >
        <GoAtletaIcon
          name={action.resultLevel >= 2 ? "trend" : "warning"}
          size={16}
          color={action.resultLevel >= 2 ? colors.successText : colors.warningText}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "900" }}>
          {action.athleteName || "Equipe"} · {fundamentalLabel(action.fundamental)}
        </Text>
        <Text style={{ color: colors.muted }}>
          {action.resultLabel} · {phaseLabel(action.phase)} · {formatTime(action.createdAt)}
        </Text>
      </View>
    </View>
  );
}

function SummaryLine({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ color: colors.muted }}>{label}</Text>
      <Text
        numberOfLines={2}
        style={{ color: colors.text, fontWeight: "900", flex: 1, textAlign: "right" }}
      >
        {value}
      </Text>
    </View>
  );
}

function InsightBlock({
  title,
  children,
  colors,
}: {
  title: string;
  children: ReactNode;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 12,
        gap: 6,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>{title}</Text>
      <View style={{ gap: 6 }}>{children}</View>
    </View>
  );
}

function EmptyState({
  title,
  text,
  colors,
}: {
  title: string;
  text: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.secondaryBg }}>
      <Text style={{ color: colors.text, fontWeight: "900" }}>{title}</Text>
      <Text style={{ color: colors.muted, marginTop: 4 }}>{text}</Text>
    </View>
  );
}
