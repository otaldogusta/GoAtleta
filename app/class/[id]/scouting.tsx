import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenPageHeader } from "../../../src/components/ui/ScreenPageHeader";
import type {
  ClassGroup,
  ScoutingAction,
  ScoutingSession,
  ScoutingSessionType,
  TrainingSession,
} from "../../../src/core/models";
import {
  buildScoutingAthleteHighlights,
  buildScoutingTeamSignals,
  buildScoutingWeeklyPriorities,
  scoutingSessionTypes,
} from "../../../src/core/scouting";
import {
  createScoutingSession,
  getClassById,
  getScoutingSessionById,
  getScoutingSessionsByClass,
  getTrainingSessionsByClass,
} from "../../../src/db/seed";
import { navigateBackOrReplace } from "../../../src/navigation/safe-router";
import { Button } from "../../../src/ui/Button";
import { DateInput } from "../../../src/ui/DateInput";
import { ModalDialogFrame } from "../../../src/ui/ModalDialogFrame";
import { Pressable } from "../../../src/ui/Pressable";
import { useAppTheme } from "../../../src/ui/app-theme";
import { GoAtletaIcon } from "../../../src/ui/icon-registry";
import { getSectionCardStyle } from "../../../src/ui/section-styles";
import { useModalCardStyle } from "../../../src/ui/use-modal-card-style";

const toLocalIsoDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (value: string) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
};

const formatDateTime = (value: string) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const sessionTypeLabel = (type: ScoutingSessionType) =>
  scoutingSessionTypes.find((item) => item.id === type)?.label ?? "Treino";

export default function ClassScoutingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const modalCardStyle = useModalCardStyle({ maxWidth: 560, maxHeight: "88%" });
  const classId = typeof id === "string" ? id : "";
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [sessions, setSessions] = useState<ScoutingSession[]>([]);
  const [actions, setActions] = useState<ScoutingAction[]>([]);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newType, setNewType] = useState<ScoutingSessionType>("treino");
  const [newDate, setNewDate] = useState(toLocalIsoDate());
  const [newOpponent, setNewOpponent] = useState("");
  const [newNote, setNewNote] = useState("");

  const loadData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError("");
    try {
      const [classData, scoutingSessions, upcomingContext] = await Promise.all([
        getClassById(classId),
        getScoutingSessionsByClass(classId, { limit: 12 }),
        getTrainingSessionsByClass(classId),
      ]);
      const details = await Promise.all(
        scoutingSessions.slice(0, 8).map((session) => getScoutingSessionById(session.id))
      );
      setCls(classData);
      setSessions(scoutingSessions);
      setActions(details.flatMap((detail) => detail?.actions ?? []));
      setTrainingSessions(upcomingContext);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar o scouting da turma."
      );
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const latestSession = sessions[0] ?? null;
  const actionCountBySessionId = useMemo(() => {
    const map = new Map<string, number>();
    actions.forEach((action) => {
      map.set(action.sessionId, (map.get(action.sessionId) ?? 0) + 1);
    });
    return map;
  }, [actions]);
  const [screenOpenedAt] = useState(() => Date.now());

  const nextContext = useMemo(() => {
    return [...trainingSessions]
      .filter((session) => new Date(session.startAt).getTime() >= screenOpenedAt)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0] ?? null;
  }, [screenOpenedAt, trainingSessions]);

  const signals = useMemo(() => buildScoutingTeamSignals(actions), [actions]);
  const priorities = useMemo(() => buildScoutingWeeklyPriorities(actions), [actions]);
  const highlights = useMemo(() => buildScoutingAthleteHighlights(actions), [actions]);

  const goBack = () => {
    if (classId) {
      navigateBackOrReplace({
        router,
        fallback: { pathname: "/class/[id]", params: { id: classId } },
      });
      return;
    }
    navigateBackOrReplace({ router, fallback: "/classes" });
  };

  const openSession = (sessionId: string) => {
    router.push({
      pathname: "/class/[id]/scouting/[scoutingSessionId]",
      params: { id: classId, scoutingSessionId: sessionId },
    });
  };

  const handleCreateSession = async () => {
    if (!cls || saving || !newDate) return;
    setSaving(true);
    try {
      const session = await createScoutingSession({
        classId: cls.id,
        organizationId: cls.organizationId,
        type: newType,
        date: newDate,
        opponent: newOpponent,
        initialNote: newNote,
      });
      setShowCreateModal(false);
      setNewType("treino");
      setNewDate(toLocalIsoDate());
      setNewOpponent("");
      setNewNote("");
      router.push({
        pathname: "/class/[id]/scouting/[scoutingSessionId]",
        params: { id: cls.id, scoutingSessionId: session.id },
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Não foi possível criar o scouting."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenPageHeader
        title="Scouting"
        subtitle="Análise técnica, jogo e evolução da equipe"
        onBack={goBack}
        right={<Button label="+ Nova análise" onPress={() => setShowCreateModal(true)} />}
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 2,
          paddingBottom: 96,
          gap: 16,
          width: "100%",
          maxWidth: 1180,
          alignSelf: "center",
        }}
      >
        {error ? (
          <View style={getSectionCardStyle(colors, "warning", { shadow: false })}>
            <Text style={{ color: colors.warningText, fontWeight: "800" }}>Atenção</Text>
            <Text style={{ color: colors.warningText }}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={[getSectionCardStyle(colors, "neutral", { shadow: false }), { alignItems: "center" }]}>
            <ActivityIndicator color={colors.primaryBg} />
            <Text style={{ color: colors.muted }}>Carregando scouting...</Text>
          </View>
        ) : null}

        {!loading ? (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <ContextCard
                title="Última análise"
                primary={
                  latestSession
                    ? formatDate(latestSession.date)
                    : "Sem scouting ainda"
                }
                secondary={
                  latestSession
                    ? latestSession.title
                    : "Crie uma análise para acompanhar a evolução da equipe."
                }
                badge={latestSession ? sessionTypeLabel(latestSession.type) : undefined}
                colors={colors}
              />
              <ContextCard
                title="Próximo contexto"
                primary={nextContext ? formatDateTime(nextContext.startAt) : "Sem evento próximo"}
                secondary={nextContext?.title || "Nenhum treino ou jogo futuro encontrado."}
                badge={nextContext ? (nextContext.type === "match" ? "Jogo" : "Treino") : undefined}
                colors={colors}
              />
              <ContextCard
                title="Modo atual"
                primary={sessions.some((session) => session.type === "jogo" || session.type === "amistoso") ? "Competitivo" : "Normal"}
                secondary={
                  latestSession?.status === "em_andamento"
                    ? "Análise em andamento"
                    : actions.length >= 8
                      ? "Leitura técnica ativa"
                      : "Sem sinais suficientes"
                }
                colors={colors}
              />
              <ContextCard
                title="Ações registradas"
                primary={actions.length ? String(actions.length) : "Sem ações"}
                secondary={actions.length ? "Nas análises da turma" : "Registre ações em uma análise para consolidar leitura."}
                colors={colors}
              />
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              <View style={{ flex: 1, minWidth: 320, gap: 16 }}>
                <Section title="Últimos scoutings" colors={colors}>
                  {sessions.length ? (
                    sessions.slice(0, 5).map((session) => (
                      <ListRow
                        key={session.id}
                        title={session.title}
                        subtitle={`${formatDate(session.date)} · ${session.opponent || sessionTypeLabel(session.type)} · ${
                          actionCountBySessionId.get(session.id) ?? 0
                        } ações`}
                        badge={session.status === "concluido" ? "Concluído" : "Em andamento"}
                        onPress={() => openSession(session.id)}
                        colors={colors}
                      />
                    ))
                  ) : (
                    <EmptyState
                      title="Nenhuma análise registrada ainda"
                      text="Crie uma análise para acompanhar a evolução da equipe."
                      colors={colors}
                    />
                  )}
                </Section>

                <Section title="Evolução individual" colors={colors}>
                  {highlights.length ? (
                    highlights.map((item) => (
                      <ListRow
                        key={item.studentId ?? item.name}
                        title={item.name}
                        subtitle={`${item.score}% · ${item.positiveActions} ações positivas`}
                        badge="Em alta"
                        colors={colors}
                      />
                    ))
                  ) : (
                    <EmptyState title="Sem leitura individual ainda" text="Registre ações por atleta para gerar destaques." colors={colors} />
                  )}
                </Section>
              </View>

              <View style={{ flex: 1, minWidth: 320, gap: 16 }}>
                <Section title="Sinais para treino" colors={colors}>
                  {signals.length ? (
                    signals.map((signal) => (
                      <ListRow
                        key={`${signal.title}-${signal.tone}`}
                        title={signal.title}
                        subtitle={signal.description}
                        badge={signal.tone === "success" ? "Ponto forte" : signal.tone === "danger" ? "Prioridade alta" : "Atenção"}
                        colors={colors}
                      />
                    ))
                  ) : (
                    <EmptyState title="Sem alertas relevantes" text="Amostra atual ainda não sustenta sinais confiáveis." colors={colors} />
                  )}
                </Section>

                <Section title="Prioridades da semana" colors={colors}>
                  {priorities.length ? (
                    priorities.map((priority, index) => (
                      <ListRow
                        key={priority.title}
                        title={`${index + 1}. ${priority.title}`}
                        subtitle={priority.description}
                        colors={colors}
                      />
                    ))
                  ) : (
                    <EmptyState title="Sem prioridades geradas" text="As prioridades aparecem quando houver volume técnico suficiente." colors={colors} />
                  )}
                </Section>

                <Section title="Vídeo" colors={colors}>
                  <EmptyState
                    title="Sem vídeo vinculado"
                    text="A integração de vídeo será adicionada quando houver fonte real para revisar lances."
                    colors={colors}
                  />
                </Section>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      <ModalDialogFrame
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        cardStyle={modalCardStyle}
        colors={colors}
        title="Nova análise"
        subtitle="Crie uma análise da turma para registrar ações e sinais técnicos."
        footer={
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
            <Button label="Cancelar" variant="secondary" onPress={() => setShowCreateModal(false)} />
            <Button label="Iniciar análise" loading={saving} disabled={!newDate} onPress={handleCreateSession} />
          </View>
        }
      >
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>Tipo</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {scoutingSessionTypes.map((type) => (
              <Chip
                key={type.id}
                label={type.label}
                active={newType === type.id}
                onPress={() => setNewType(type.id)}
                colors={colors}
              />
            ))}
          </View>
        </View>
        <FieldLabel label="Data" colors={colors} />
        <DateInput value={newDate} onChange={setNewDate} placeholder="Data da análise" />
        <FieldLabel label="Adversário opcional" colors={colors} />
        <TextInput
          value={newOpponent}
          onChangeText={setNewOpponent}
          placeholder="Ex.: UniBrasil"
          placeholderTextColor={colors.placeholder}
          style={{
            minHeight: 44,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            color: colors.inputText,
            paddingHorizontal: 12,
          }}
        />
        <FieldLabel label="Observação inicial opcional" colors={colors} />
        <TextInput
          value={newNote}
          onChangeText={setNewNote}
          placeholder="Contexto da análise"
          placeholderTextColor={colors.placeholder}
          multiline
          style={{
            minHeight: 82,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            color: colors.inputText,
            paddingHorizontal: 12,
            paddingVertical: 10,
            textAlignVertical: "top",
          }}
        />
      </ModalDialogFrame>
    </SafeAreaView>
  );
}

function ContextCard({
  title,
  primary,
  secondary,
  badge,
  colors,
}: {
  title: string;
  primary: string;
  secondary: string;
  badge?: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View style={[getSectionCardStyle(colors, "neutral", { shadow: false }), { flex: 1, minWidth: 230 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{title}</Text>
        {badge ? <SmallBadge label={badge} colors={colors} /> : null}
      </View>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>{primary}</Text>
      <Text style={{ color: colors.muted }}>{secondary}</Text>
    </View>
  );
}

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: ReactNode;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View style={getSectionCardStyle(colors, "neutral", { shadow: false })}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>{title}</Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function ListRow({
  title,
  subtitle,
  badge,
  onPress,
  colors,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  onPress?: () => void;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.secondaryBg,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "900" }}>{title}</Text>
        <Text style={{ color: colors.muted, marginTop: 2 }}>{subtitle}</Text>
      </View>
      {badge ? <SmallBadge label={badge} colors={colors} /> : null}
      {onPress ? <GoAtletaIcon name="chevronForward" size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

function SmallBadge({
  label,
  colors,
}: {
  label: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View
      style={{
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: colors.infoBg,
      }}
    >
      <Text style={{ color: colors.infoText, fontSize: 11, fontWeight: "900" }}>{label}</Text>
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

function Chip({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.primaryBg : colors.border,
        backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
      }}
    >
      <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: "900" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function FieldLabel({
  label,
  colors,
}: {
  label: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return <Text style={{ color: colors.text, fontWeight: "800" }}>{label}</Text>;
}
