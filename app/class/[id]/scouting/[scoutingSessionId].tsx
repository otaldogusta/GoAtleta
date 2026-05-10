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
  const [isSavingAction, setIsSavingAction] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cached = await getCachedClassById(classId);
        if (alive && cached) setCls(cached);
        const [classData, sessionData, sessionActions, students] = await Promise.all([
          getClassById(classId),
          getScoutingSession(sessionId),
          listScoutingActionsBySession(sessionId),
          getStudentsByClass(classId),
        ]);
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
        notes: notes.trim() || undefined,
      });
      const nextActions = [created, ...actions];
      setActions(nextActions);
      setAthleteName("");
      setNotes("");
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={() =>
                  router.replace({
                    pathname: "/class/[id]/scouting",
                    params: { id: classId },
                  })
                }
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
              <Text style={{ color: colors.text, fontSize: isDesktop ? 28 : 24, fontWeight: "800" }}>
                Scouting
              </Text>
            </View>
            <Text style={{ color: colors.text, fontSize: isDesktop ? 20 : 18, fontWeight: "800", marginLeft: 42 }}>
              {session.title}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginLeft: 42 }}>
              {typeLabelMap[session.type]} · {formatDate(session.date)} · {statusLabelMap[session.status]}
            </Text>
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

        <DecisionMainLayout
          main={
            <>
              <ScoutingQuickRegister
                athleteName={athleteName}
                gamePhase={gamePhase}
                isDesktop={isDesktop}
                isSavingAction={isSavingAction}
                notes={notes}
                onAthleteNameChange={setAthleteName}
                onGamePhaseChange={setGamePhase}
                onNotesChange={setNotes}
                onQualityOptionChange={setQualityOptionId}
                onRegister={handleRegisterAction}
                onSkillChange={setSkill}
                qualityOptionId={qualityOptionId}
                quickAthletes={topAthletes}
                skill={skill}
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
