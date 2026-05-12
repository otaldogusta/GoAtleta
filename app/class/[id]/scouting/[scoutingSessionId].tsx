import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { DecisionMainLayout } from "../../../../src/components/decision";
import type { ClassGroup } from "../../../../src/core/models";
import type { ScoutingSession } from "../../../../src/core/scouting-session";
import {
  getDominantStrengths,
  getDominantWeaknesses,
  summarizeScoutingActions,
  type ScoutingAction,
} from "../../../../src/core/scouting-action";
import { getCachedClassById, getClassById } from "../../../../src/db/classes";
import { getStudentsByClass } from "../../../../src/db/students";
import { ScoutingQuickRegister } from "../../../../src/screens/scouting/components/ScoutingQuickRegister";
import { ScoutingRecentActions } from "../../../../src/screens/scouting/components/ScoutingRecentActions";
import { ScoutingSessionContextBar } from "../../../../src/screens/scouting/components/ScoutingSessionContextBar";
import { ScoutingSideSummary } from "../../../../src/screens/scouting/components/ScoutingSideSummary";
import { getScoutingSession } from "../../../../src/screens/scouting/scouting-session-actions";
import {
  createScoutingActionForSession,
  deleteScoutingAction,
  listScoutingActionsBySession,
} from "../../../../src/screens/scouting/scouting-action-actions";
import { generateAndSaveScoutingImpactForSession } from "../../../../src/screens/scouting/scouting-impact-actions";
import {
  getDefaultQualityOptionForSkill,
  getScoutingQualityOptionsForSkill,
  resolveScoutingQualityOption,
} from "../../../../src/screens/scouting/scouting-action-labels";
import { buildLegacyScoutingRoute } from "../../../../src/screens/scouting/scouting-session-navigation";
import { ScreenLoadingState } from "../../../../src/components/ui/ScreenLoadingState";
import { useAppTheme } from "../../../../src/ui/app-theme";
import { getClassPalette } from "../../../../src/ui/class-colors";
import { ClassGenderBadge } from "../../../../src/ui/ClassGenderBadge";
import { LocationBadge } from "../../../../src/ui/LocationBadge";
import { Pressable } from "../../../../src/ui/Pressable";
import { getSectionCardStyle } from "../../../../src/ui/section-styles";
import { markRender, measureAsync } from "../../../../src/observability/perf";

import { Button } from "../../../../src/ui/Button";
import type { ScoutingActionGamePhase, ScoutingActionSkill } from "../../../../src/core/scouting-action";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00`));

const typeLabelMap: Record<ScoutingSession["type"], string> = {
  training: "Treino",
  friendly: "Amistoso",
  official_match: "Jogo oficial",
};

const statusLabelMap: Record<ScoutingSession["status"], string> = {
  draft: "Rascunho",
  in_progress: "Em andamento",
  completed: "Concluído",
  archived: "Arquivado",
};

export default function ScoutingSessionRoute() {
  const { id, scoutingSessionId } = useLocalSearchParams<{ id: string; scoutingSessionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const classId = typeof id === "string" ? id : "";
  const sessionId = typeof scoutingSessionId === "string" ? scoutingSessionId : "";
  const isDesktop = width >= 1040;
  const [isLoading, setIsLoading] = useState(true);
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [session, setSession] = useState<ScoutingSession | null>(null);
  const [actions, setActions] = useState<ScoutingAction[]>([]);
  const [quickAthletes, setQuickAthletes] = useState<string[]>([]);
  const [athleteName, setAthleteName] = useState("");
  const [skill, setSkill] = useState<ScoutingActionSkill>("receive");
  const [qualityOptionId, setQualityOptionId] = useState(getDefaultQualityOptionForSkill("receive").id);
  const [gamePhase, setGamePhase] = useState<ScoutingActionGamePhase>("sideout");
  const [notes, setNotes] = useState("");
  const [videoLabel, setVideoLabel] = useState("");
  const [isSavingAction, setIsSavingAction] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [impactMessage, setImpactMessage] = useState("");

  markRender("screen.scoutingSession.render.root", {
    hasSession: session ? 1 : 0,
    actions: actions.length,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cached = await getCachedClassById(classId);
        if (alive && cached) setCls(cached);
        const [classData, sessionData, sessionActions, students] = await measureAsync(
          "screen.scoutingSession.load.detail",
          () =>
            Promise.all([
              getClassById(classId),
              getScoutingSession(sessionId),
              listScoutingActionsBySession(sessionId),
              getStudentsByClass(classId),
            ])
        );
        if (!alive) return;
        setCls(classData);
        setSession(sessionData);
        setActions(sessionActions);
        setQuickAthletes(students.map((student) => student.name).filter(Boolean).slice(0, 5));
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [classId, sessionId]);

  const classPalette = getClassPalette(cls?.colorKey ?? null, colors, cls?.unit ?? "");
  const legacyRoute = useMemo(
    () => (session ? buildLegacyScoutingRoute({ classId, session }) : null),
    [classId, session]
  );
  const actionsSummary = useMemo(() => summarizeScoutingActions(actions), [actions]);
  const isVideoSession = session?.sourceType === "video";
  const topAthletes = useMemo(() => {
    const names = Array.from(
      new Set([
        ...quickAthletes,
        ...actions.map((item) => item.athleteName).filter((name): name is string => Boolean(name) && name !== "Equipe"),
      ])
    );
    return names.slice(0, 5);
  }, [actions, quickAthletes]);

  useEffect(() => {
    const nextOptions = getScoutingQualityOptionsForSkill(skill);
    if (!nextOptions.some((item) => item.id === qualityOptionId)) {
      setQualityOptionId(nextOptions[0]?.id ?? getDefaultQualityOptionForSkill("receive").id);
    }
  }, [qualityOptionId, skill]);

  const handleRegisterAction = async () => {
    if (!session) return;
    try {
      setIsSavingAction(true);
      const selectedOption = resolveScoutingQualityOption(skill, qualityOptionId);
      const created = await createScoutingActionForSession({
        scoutingSessionId: session.id,
        classId,
        athleteName: athleteName.trim() || undefined,
        skill,
        actionType: selectedOption.actionType,
        quality: selectedOption.quality,
        score: selectedOption.score,
        label: selectedOption.label,
        gamePhase,
        videoLabel: isVideoSession ? videoLabel.trim() || undefined : undefined,
        clipReference: isVideoSession ? session.videoClipType || undefined : undefined,
        notes: notes.trim() || undefined,
      });
      const nextActions = [created, ...actions];
      setActions(nextActions);
      setAthleteName("");
      setNotes("");
      setVideoLabel("");
      setQualityOptionId(getDefaultQualityOptionForSkill("receive").id);
      setSkill("receive");
      setGamePhase("sideout");
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleRemoveAction = async (actionId: string) => {
    const ok = await deleteScoutingAction(actionId);
    if (!ok) return;
    setActions((current) => current.filter((item) => item.id !== actionId));
  };

  const handleCompleteSession = async () => {
    if (!session) return;
    try {
      setIsCompleting(true);
      const { completeScoutingSessionById } = await import("../../../../src/screens/scouting/scouting-session-actions");
      const next = await completeScoutingSessionById(session.id);
      if (next) setSession(next);
      const result = await generateAndSaveScoutingImpactForSession(session.id);
      setImpactMessage(
        result.saved
          ? session.sourceType === "video"
            ? "Sinais do vídeo salvos para apoiar o próximo planejamento."
            : "Sinais salvos para apoiar o próximo planejamento."
          : "Ainda não há sinais suficientes para ajustar o planejamento."
      );
    } finally {
      setIsCompleting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenLoadingState />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={{
            gap: 18,
            paddingHorizontal: isDesktop ? 24 : 16,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom + 40, 56),
            width: "100%",
            maxWidth: 980,
            alignSelf: "center",
          }}
        >
          <View style={getSectionCardStyle(colors, "warning", { radius: 18 })}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
              Sessão de scouting não encontrada
            </Text>
            <Text style={{ color: colors.muted }}>
              A análise pode ter sido removida do cache local ou ainda não foi criada corretamente.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          gap: 14,
          paddingHorizontal: isDesktop ? 24 : 16,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom + 40, 56),
          width: "100%",
          maxWidth: 980,
          alignSelf: "center",
        }}
      >
        <View
          style={{
            flexDirection: isDesktop ? "row" : "column",
            justifyContent: "space-between",
            alignItems: isDesktop ? "flex-start" : "stretch",
            gap: 10,
          }}
        >
          <View style={{ gap: 4, flex: 1 }}>
            <Pressable
              onPress={() =>
                router.replace({
                  pathname: "/class/[id]/scouting",
                  params: { id: classId },
                })
              }
              style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </View>
              <Text style={{ color: colors.text, fontSize: isDesktop ? 28 : 24, fontWeight: "800" }}>
                Scouting
              </Text>
            </Pressable>
            <Text style={{ color: colors.text, fontSize: isDesktop ? 20 : 18, fontWeight: "800", marginLeft: 42 }}>
              {session.title}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginLeft: 42 }}>
              {typeLabelMap[session.type]} · {formatDate(session.date)} · {statusLabelMap[session.status]}
            </Text>
            {session.sourceType === "video" ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  marginLeft: 42,
                  marginTop: 4,
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: colors.infoBg,
                }}
              >
                <Text style={{ color: colors.infoText, fontWeight: "800", fontSize: 12 }}>
                  Análise por vídeo
                </Text>
              </View>
            ) : null}
            {session.sourceType === "video" && session.videoNotes ? (
              <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 42 }}>
                {session.videoNotes}
              </Text>
            ) : null}
          </View>
          <Button
            label="Finalizar análise"
            onPress={handleCompleteSession}
            loading={isCompleting}
            disabled={isCompleting || session.status === "completed" || session.status === "archived"}
          />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
            {cls?.name ?? "Turma"}
          </Text>
          <ClassGenderBadge gender={cls?.gender ?? "misto"} size="md" />
          <LocationBadge location={cls?.unit ?? "Unidade"} palette={classPalette} size="sm" showIcon />
        </View>

        <ScoutingSessionContextBar
          session={session}
          athletesCount={Array.from(new Set(actions.map((item) => item.athleteName).filter(Boolean))).length}
          totalActions={actionsSummary.totalActions}
        />

        {impactMessage ? (
          <View style={getSectionCardStyle(colors, "neutral", { radius: 14, padding: 12, shadow: false })}>
            <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>{impactMessage}</Text>
          </View>
        ) : null}

        <DecisionMainLayout
          main={
            <>
              <ScoutingQuickRegister
                athleteName={athleteName}
                gamePhase={gamePhase}
                isDesktop={isDesktop}
                isSavingAction={isSavingAction}
                isVideoSession={isVideoSession}
                notes={notes}
                onAthleteNameChange={setAthleteName}
                onGamePhaseChange={setGamePhase}
                onNotesChange={setNotes}
                onQualityOptionChange={setQualityOptionId}
                onRegister={handleRegisterAction}
                onSkillChange={setSkill}
                onVideoLabelChange={setVideoLabel}
                qualityOptionId={qualityOptionId}
                quickAthletes={topAthletes}
                skill={skill}
                videoLabel={videoLabel}
              />
              <ScoutingRecentActions
                actions={actions}
                isDesktop={isDesktop}
                onUndo={handleRemoveAction}
              />
            </>
          }
          side={
            <ScoutingSideSummary
              actions={actions}
              onOpenLegacy={legacyRoute ? () => router.push(legacyRoute) : undefined}
            />
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
