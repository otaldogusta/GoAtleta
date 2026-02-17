import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import {
    Alert,
    Animated,
    Keyboard,
    Platform,
    ScrollView,
    Text,
    TextInput,
    View,
    useWindowDimensions
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable } from "../../src/ui/Pressable";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../src/api/config";
import { useAuth } from "../../src/auth/auth";
import { getValidAccessToken } from "../../src/auth/session";
import {
    buildAutoFixSuggestions,
    buildCommunicationDraft,
    buildExecutiveSummary,
    buildSupportModeAnalysis,
    inferSkillsFromText,
    volleyballLessonPlanToDraft,
    type AutoFixSuggestion,
} from "../../src/core/ai-operations";
import { buildWeeklyAutopilotProposal } from "../../src/core/autopilot/weekly-autopilot";
import { buildNextClassSuggestion, type NextClassSuggestion } from "../../src/core/intelligence/suggestion-engine";
import type {
    ClassGroup,
    EvolutionSimulationResult,
    SessionLog,
    TrainingPlan,
    WeeklyAutopilotProposal,
} from "../../src/core/models";
import { buildNextVolleyballLessonPlan } from "../../src/core/progression-engine";
import { simulateClassEvolution } from "../../src/core/simulator/evolution-simulator";
import {
    getLatestSessionSkillSnapshot,
    listAssistantMemories,
    pruneExpiredAssistantMemories,
    saveAssistantMemoryEntry,
} from "../../src/db/ai-foundation";
import {
    buildSyncHealthReport,
    clearPendingWritesDeadLetterCandidates,
    getClasses,
    getSessionLogsByRange,
    getTrainingPlans,
    listWeeklyAutopilotProposals,
    reprocessPendingWritesNetworkFailures,
    saveTrainingPlan,
    saveWeeklyAutopilotProposal,
    updateWeeklyAutopilotProposalStatus,
} from "../../src/db/seed";
import { notifyTrainingCreated, notifyTrainingSaved } from "../../src/notifications";
import { useOrganization } from "../../src/providers/OrganizationProvider";
import { useAppTheme } from "../../src/ui/app-theme";
import { Button } from "../../src/ui/Button";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AssistantSource = {
  title: string;
  author: string;
  url: string;
};

type DraftTraining = {
  title: string;
  tags: string[];
  warmup: string[];
  main: string[];
  cooldown: string[];
  warmupTime: string;
  mainTime: string;
  cooldownTime: string;
};

type AssistantResponse = {
  reply: string;
  sources: AssistantSource[];
  draftTraining: DraftTraining | null;
  confidence?: number;
  citations?: { sourceTitle: string; evidence: string }[];
  assumptions?: string[];
  missingData?: string[];
};

const sanitizeList = (value: unknown) =>
  Array.isArray(value) ? value.map(String).filter(Boolean) : [];

const looksLikeJsonPayload = (value: string) => {
  const text = value.trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return false;
  return (
    text.includes('"title"') ||
    text.includes('"warmup"') ||
    text.includes('"main"') ||
    text.includes('"cooldown"')
  );
};

const renderList = (items: string[]) =>
  items.length ? items.join(" - ") : "Sem itens";

const toOptionalString = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const DEFAULT_WARMUP_TIME = "10 minutos";
const DEFAULT_COOLDOWN_TIME = "5 minutos";

const normalizeDraftTraining = (draft: DraftTraining): DraftTraining => ({
  ...draft,
  warmupTime: toOptionalString(draft.warmupTime) || DEFAULT_WARMUP_TIME,
  cooldownTime: toOptionalString(draft.cooldownTime) || DEFAULT_COOLDOWN_TIME,
  mainTime: toOptionalString(draft.mainTime),
});

const parseDraftTrainingFromReply = (value: string): DraftTraining | null => {
  try {
    const payload = JSON.parse(value) as Record<string, unknown>;
    return normalizeDraftTraining({
      title: toOptionalString(payload.title) || "Planejamento sugerido",
      tags: sanitizeList(payload.tags),
      warmup: sanitizeList(payload.warmup),
      main: sanitizeList(payload.main),
      cooldown: sanitizeList(payload.cooldown),
      warmupTime: toOptionalString(payload.warmupTime),
      mainTime: toOptionalString(payload.mainTime),
      cooldownTime: toOptionalString(payload.cooldownTime),
    });
  } catch {
    return null;
  }
};

const buildTraining = (draft: DraftTraining, classId: string): TrainingPlan => {
  const normalizedDraft = normalizeDraftTraining(draft);
  const nowIso = new Date().toISOString();
  return {
    id: "t_ai_" + Date.now(),
    classId,
    title: String(normalizedDraft.title || "Planejamento sugerido"),
    tags: sanitizeList(normalizedDraft.tags),
    warmup: sanitizeList(normalizedDraft.warmup),
    main: sanitizeList(normalizedDraft.main),
    cooldown: sanitizeList(normalizedDraft.cooldown),
    warmupTime: String(normalizedDraft.warmupTime || DEFAULT_WARMUP_TIME),
    mainTime: String(normalizedDraft.mainTime || ""),
    cooldownTime: String(normalizedDraft.cooldownTime || DEFAULT_COOLDOWN_TIME),
    createdAt: nowIso,
  };
};

export default function AssistantScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { activeOrganization } = useOrganization();
  const { confirm: confirmDialog } = useConfirmDialog();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [classId, setClassId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [draft, setDraft] = useState<DraftTraining | null>(null);
  const [sources, setSources] = useState<AssistantSource[]>([]);
  const [showSavedLink, setShowSavedLink] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [citations, setCitations] = useState<{ sourceTitle: string; evidence: string }[]>([]);
  const [missingData, setMissingData] = useState<string[]>([]);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [autoFixSuggestions, setAutoFixSuggestions] = useState<AutoFixSuggestion[]>([]);
  const [nextClassSuggestion, setNextClassSuggestion] = useState<NextClassSuggestion | null>(null);
  const [autopilotProposal, setAutopilotProposal] = useState<WeeklyAutopilotProposal | null>(null);
  const [simulationResult, setSimulationResult] = useState<EvolutionSimulationResult | null>(null);
  const [memoryContextHints, setMemoryContextHints] = useState<string[]>([]);
  const [composerHeight, setComposerHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [composerFocused, setComposerFocused] = useState(false);
  const composerInputRef = useRef<TextInput | null>(null);
  const thinkingPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getClasses();
      if (!alive) return;
      setClasses(data);
      if (!classId && data.length > 0) {
        setClassId(data[0].id);
      }
    })();
    return () => {
      alive = false;
    };
  }, [classId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!classId) {
        if (alive) setAutopilotProposal(null);
        return;
      }
      const list = await listWeeklyAutopilotProposals({
        classId,
        organizationId: activeOrganization?.id,
        limit: 1,
      });
      if (!alive) return;
      setAutopilotProposal(list[0] ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [activeOrganization?.id, classId]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (event: any) => {
      const height = event.endCoordinates.height ?? 0;
      setKeyboardHeight(height);
    };
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      thinkingPulse.stopAnimation();
      thinkingPulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(thinkingPulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(thinkingPulse, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => {
      loop.stop();
      thinkingPulse.stopAnimation();
      thinkingPulse.setValue(0);
    };
  }, [loading, thinkingPulse]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === classId) ?? null,
    [classes, classId]
  );
  const className = selectedClass?.name ?? "Turma";

  const isDesktopLayout = Platform.OS === "web" && width >= 1100;
  const quickPromptColumns = width >= 1080 ? 3 : width >= 700 ? 2 : 1;
  const quickPromptCardWidth =
    quickPromptColumns === 3 ? "31.8%" : quickPromptColumns === 2 ? "48.5%" : "100%";

  const userDisplayName = useMemo(() => {
    const meta = (session?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const profileName =
      toOptionalString(meta.full_name) ||
      toOptionalString(meta.name) ||
      toOptionalString(meta.display_name) ||
      toOptionalString(meta.preferred_username);

    if (profileName) {
      return profileName;
    }

    return "Coach";
  }, [session?.user?.user_metadata]);

  const recentUserPrompts = useMemo(
    () => messages.filter((message) => message.role === "user").slice(-6).reverse(),
    [messages]
  );

  const quickPrompts = useMemo(
    () => [
      {
        title: "Gerar treino",
        subtitle: "Crie um plano por fase",
        icon: "sparkles-outline" as const,
        prompt: "Monte um treino de 60 minutos para a turma atual com aquecimento, parte principal e volta à calma.",
      },
      {
        title: "Melhorar prompt",
        subtitle: "Refine para melhores resultados",
        icon: "create-outline" as const,
        prompt: "Me ajude a melhorar este pedido para o assistente gerar um treino mais específico para a turma atual.",
      },
      {
        title: "Explorar estilos",
        subtitle: "Variações por objetivo",
        icon: "color-palette-outline" as const,
        prompt: "Sugira 3 variações de treino para foco em técnica, físico e jogo reduzido.",
      },
    ],
    []
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    setDraft(null);
    setSources([]);
    setConfidence(null);
    setCitations([]);
    setMissingData([]);
    setAssumptions([]);
    setAutoFixSuggestions([]);
    setNextClassSuggestion(null);
    setAutopilotProposal(null);
    setSimulationResult(null);
    setMemoryContextHints([]);
    setShowSavedLink(false);
    setInput("");
  }, []);

  const pushAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => [...prev, { role: "assistant", content }]);
  }, []);

  const typeAssistantReply = useCallback(async (reply: string) => {
    const content = reply ?? "";
    setAssistantTyping(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const chunkSize = Platform.OS === "web" ? 3 : 2;
    const tickMs = 18;

    await new Promise<void>((resolve) => {
      let index = 0;
      const timer = setInterval(() => {
        index = Math.min(content.length, index + chunkSize);
        const nextContent = content.slice(0, index);

        setMessages((prev) => {
          if (prev.length === 0) {
            return [{ role: "assistant", content: nextContent }];
          }
          const next = [...prev];
          const lastIndex = next.length - 1;
          if (next[lastIndex].role === "assistant") {
            next[lastIndex] = { ...next[lastIndex], content: nextContent };
          } else {
            next.push({ role: "assistant", content: nextContent });
          }
          return next;
        });

        if (index >= content.length) {
          clearInterval(timer);
          resolve();
        }
      }, tickMs);
    });

    setAssistantTyping(false);
  }, []);

  const handleSelectQuickPrompt = useCallback((prompt: string) => {
    setInput(prompt);
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const active = document.activeElement as HTMLElement | null;
      active?.blur?.();
    }
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading || assistantTyping) return;
    const nextMessages = [...messages, { role: "user", content: input.trim() }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setDraft(null);
    setSources([]);
    setConfidence(null);
    setCitations([]);
    setMissingData([]);
    setAssumptions([]);
    setAutoFixSuggestions([]);
    setNextClassSuggestion(null);
    setAutopilotProposal(null);
    setSimulationResult(null);
    setMemoryContextHints([]);
    setShowSavedLink(false);

    try {
      const accessToken = await getValidAccessToken();
      if (!accessToken) {
        Alert.alert("Sessão expirada", "Faca login novamente para usar o assistente.");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sessão expirada. Faca login novamente e tente de novo.",
          },
        ]);
        return;
      }

      await pruneExpiredAssistantMemories();
      const memoryEntries = await listAssistantMemories({
        organizationId: activeOrganization?.id ?? "",
        classId,
        userId: session?.user?.id,
        limit: 4,
      });
      const memoryContext = memoryEntries.map((item) => item.content);
      setMemoryContextHints(memoryContext);

      const response = await fetch(`${SUPABASE_URL}/functions/v1/assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          classId,
          organizationId: activeOrganization?.id ?? "",
          sport: selectedClass?.modality ?? "volleyball",
          memoryContext,
        }),
      });

      const payloadText = await response.text();
      if (!response.ok) {
        throw new Error(payloadText || "Falha no assistente");
      }

      const data = JSON.parse(payloadText) as AssistantResponse;
      const rawReply =
        typeof data.reply === "string" && data.reply.trim()
           ? data.reply
          : "Sem resposta do assistente. Tente novamente.";
      const draftFromReply = looksLikeJsonPayload(rawReply)
        ? parseDraftTrainingFromReply(rawReply)
        : null;
      const nextDraft = data.draftTraining
        ? normalizeDraftTraining(data.draftTraining)
        : draftFromReply;
      const reply =
        nextDraft && looksLikeJsonPayload(rawReply)
          ? "Montei um planejamento para você. Revise os blocos abaixo."
          : rawReply;

      setLoading(false);
      await typeAssistantReply(reply);
      setSources(Array.isArray(data.sources) ? data.sources : []);
      setConfidence(
        Number.isFinite(data.confidence) ? Math.max(0, Math.min(1, Number(data.confidence))) : null
      );
      setCitations(Array.isArray(data.citations) ? data.citations : []);
      setMissingData(Array.isArray(data.missingData) ? data.missingData : []);
      setAssumptions(Array.isArray(data.assumptions) ? data.assumptions : []);
      setDraft(nextDraft);

      const nowIso = new Date().toISOString();
      if (session?.user?.id && activeOrganization?.id) {
        const lastUser = nextMessages[nextMessages.length - 1]?.content ?? "";
        if (lastUser.trim()) {
          await saveAssistantMemoryEntry({
            id: `mem_local_user_${Date.now()}`,
            organizationId: activeOrganization.id,
            classId,
            userId: session.user.id,
            scope: classId ? "class" : "organization",
            role: "user",
            content: lastUser,
            createdAt: nowIso,
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          });
        }

        if (reply.trim()) {
          await saveAssistantMemoryEntry({
            id: `mem_local_assistant_${Date.now()}`,
            organizationId: activeOrganization.id,
            classId,
            userId: session.user.id,
            scope: classId ? "class" : "organization",
            role: "assistant",
            content: reply,
            createdAt: nowIso,
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          });
        }
      }

      if (nextDraft) {
        void notifyTrainingCreated();
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Erro ao consultar o assistente. Confira o deploy e tente novamente.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async () => {
    if (!draft || !classId) return;
    try {
      const plan = buildTraining(draft, classId);
      await saveTrainingPlan(plan);
      setDraft(null);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Planejamento salvo com sucesso." },
      ]);
      setShowSavedLink(true);
      void notifyTrainingSaved();
    } catch (error) {
      const detail =
        error instanceof Error && error.message
          ? error.message
          : "Erro desconhecido.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Não consegui salvar o planejamento. " +
            "Detalhe: " +
            detail.replace(/\s+/g, " "),
        },
      ]);
    }
  };

  const getRecentLogs = useCallback(async () => {
    const now = new Date();
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const logs = await getSessionLogsByRange(start.toISOString(), now.toISOString(), {
      organizationId: activeOrganization?.id,
    });
    return logs.filter((log) => log.classId === classId);
  }, [activeOrganization?.id, classId]);

  const handleGenerateProgression = useCallback(async () => {
    if (!classId || !selectedClass) {
      Alert.alert("Atenção", "Selecione uma turma para gerar progressão.");
      return;
    }
    setLoading(true);
    try {
      const snapshot = await getLatestSessionSkillSnapshot(classId);
      const logs = await getRecentLogs();
      const fallbackConsistency = logs.length
        ? Math.min(0.95, Math.max(0.3, logs.filter((log) => log.technique !== "ruim").length / logs.length))
        : 0.55;
      const fallbackSuccess = logs.length
        ? Math.min(0.95, Math.max(0.3, logs.filter((log) => log.attendance >= 1).length / logs.length))
        : 0.55;

      const latestLog = [...logs].sort((a, b) =>
        String(a.createdAt).localeCompare(String(b.createdAt))
      )[logs.length - 1];

      const plan = buildNextVolleyballLessonPlan({
        classId,
        unitId: selectedClass.unitId || "",
        mesoWeek: 1,
        microDay: "D1",
        lastRpeGroup: Number(latestLog?.PSE ?? 6),
        lastAttendanceCount: Number(latestLog?.participantsCount ?? 0),
        className: selectedClass.name,
        objective: `Progressão para ${selectedClass.name}`,
        focusSkills: inferSkillsFromText([input, ...messages.map((item) => item.content)].join(" ")),
        previousSnapshot: {
          consistencyScore: snapshot?.consistencyScore ?? fallbackConsistency,
          successRate: snapshot?.successRate ?? fallbackSuccess,
          decisionQuality: snapshot?.decisionQuality ?? 0.62,
          notes: snapshot?.notes ?? [],
        },
      });

      const nextDraft = volleyballLessonPlanToDraft(plan, selectedClass.name);
      setDraft(nextDraft);
      setSources([]);
      setConfidence(0.74);
      setCitations(
        plan.citations.map((citation) => ({
          sourceTitle: `${citation.docId} (${citation.pages})`,
          evidence: citation.why,
        }))
      );
      setMissingData([]);
      setAssumptions([
        "Progressão baseada no snapshot mais recente ou fallback de sessões dos últimos 7 dias.",
      ]);
      setAutoFixSuggestions([]);
      pushAssistantMessage(
        `Gerei a próxima aula com foco em ${plan.primaryFocus.skill}/${plan.secondaryFocus.skill}, regras explícitas (${plan.rulesTriggered.length}) e critérios mensuráveis.`
      );
    } catch (error) {
      pushAssistantMessage("Não consegui gerar a progressão automática agora.");
    } finally {
      setLoading(false);
    }
  }, [classId, getRecentLogs, input, messages, pushAssistantMessage, selectedClass]);

  const handleExecutiveSummary = useCallback(async () => {
    if (!classId || !selectedClass) return;
    setLoading(true);
    try {
      const [trainingPlans, sessionLogs, syncHealth] = await Promise.all([
        getTrainingPlans({ organizationId: activeOrganization?.id }),
        getRecentLogs(),
        buildSyncHealthReport({ organizationId: activeOrganization?.id }),
      ]);

      const classPlans = trainingPlans.filter((plan) => plan.classId === classId);
      const summary = buildExecutiveSummary({
        className: selectedClass.name,
        trainingPlans: classPlans,
        sessionLogs: sessionLogs as SessionLog[],
        syncHealth,
      });
      setAutoFixSuggestions([]);
      pushAssistantMessage(summary);
    } finally {
      setLoading(false);
    }
  }, [activeOrganization?.id, classId, getRecentLogs, pushAssistantMessage, selectedClass]);

  const handleCommunicationCopilot = useCallback(() => {
    if (!selectedClass) return;
    const text = buildCommunicationDraft({
      className: selectedClass.name,
      nextObjective: "evoluir consistência de passe e transição ofensiva",
      criticalPoint: "reduzir erro não forçado no primeiro contato",
    });
    setInput(text);
    pushAssistantMessage("Copiloto de comunicação pronto. Ajuste o texto e envie no canal desejado.");
  }, [pushAssistantMessage, selectedClass]);

  const handleSupportMode = useCallback(async () => {
    setLoading(true);
    try {
      const health = await buildSyncHealthReport({ organizationId: activeOrganization?.id });
      const analysis = buildSupportModeAnalysis(health);
      const suggestions = buildAutoFixSuggestions(health);
      setAutoFixSuggestions(suggestions);
      pushAssistantMessage(analysis);
    } finally {
      setLoading(false);
    }
  }, [activeOrganization?.id, pushAssistantMessage]);

  const handlePostSessionIntelligence = useCallback(async () => {
    if (!classId || !selectedClass) return;
    setLoading(true);
    try {
      const logs = await getRecentLogs();
      const suggestion = buildNextClassSuggestion({
        className: selectedClass.name,
        logs: logs as SessionLog[],
      });
      setNextClassSuggestion(suggestion);
      setAutoFixSuggestions([]);
      setConfidence(suggestion.radarScore);
      setCitations([]);
      setMissingData(logs.length ? [] : ["Sem sessões recentes registradas nos últimos 7 dias."]);
      setAssumptions([
        "Leitura determinística baseada em sessões recentes da turma e regras explícitas de tendência.",
      ]);
      pushAssistantMessage(
        `${suggestion.headline}\n${suggestion.coachSummary}\nAprovação humana necessária antes de aplicar no treino.`
      );
    } finally {
      setLoading(false);
    }
  }, [classId, getRecentLogs, pushAssistantMessage, selectedClass]);

  const applyNextClassSuggestion = useCallback(() => {
    if (!nextClassSuggestion) return;
    setInput(nextClassSuggestion.nextTrainingPrompt);
    pushAssistantMessage("Sugestão aplicada no composer. Revise e gere o próximo treino quando estiver pronto.");
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  }, [nextClassSuggestion, pushAssistantMessage]);

  const handleWeeklyAutopilot = useCallback(async () => {
    if (!selectedClass || !activeOrganization?.id || !session?.user?.id) return;
    setLoading(true);
    try {
      const logs = await getRecentLogs();
      const proposal = buildWeeklyAutopilotProposal({
        classGroup: selectedClass,
        logs: logs as SessionLog[],
        organizationId: activeOrganization.id,
        createdBy: session.user.id,
      });

      await saveWeeklyAutopilotProposal(proposal);
      setAutopilotProposal(proposal);
      setAssumptions([
        "Autopilot semanal é apenas proposta: só entra em vigor após aprovação humana explícita.",
      ]);
      pushAssistantMessage(`Autopilot semanal proposto para ${selectedClass.name}. Revise e aprove/rejeite.`);
    } finally {
      setLoading(false);
    }
  }, [activeOrganization?.id, getRecentLogs, pushAssistantMessage, selectedClass, session?.user?.id]);

  const handleApproveAutopilot = useCallback(() => {
    if (!autopilotProposal) return;
    confirmDialog({
      title: "Aprovar autopilot semanal?",
      message: "Esta ação confirma o plano semanal sugerido para execução humana.",
      confirmLabel: "Aprovar",
      cancelLabel: "Cancelar",
      onConfirm: async () => {
        await updateWeeklyAutopilotProposalStatus(autopilotProposal.id, "approved");
        setAutopilotProposal((prev) => (prev ? { ...prev, status: "approved", updatedAt: new Date().toISOString() } : null));
        pushAssistantMessage("Autopilot semanal aprovado. Próximo passo: gerar/validar treinos da semana.");
      },
    });
  }, [autopilotProposal, confirmDialog, pushAssistantMessage]);

  const handleRejectAutopilot = useCallback(() => {
    if (!autopilotProposal) return;
    confirmDialog({
      title: "Rejeitar autopilot semanal?",
      message: "A proposta será mantida em histórico com status rejeitado.",
      confirmLabel: "Rejeitar",
      cancelLabel: "Cancelar",
      tone: "danger",
      onConfirm: async () => {
        await updateWeeklyAutopilotProposalStatus(autopilotProposal.id, "rejected");
        setAutopilotProposal((prev) => (prev ? { ...prev, status: "rejected", updatedAt: new Date().toISOString() } : null));
        pushAssistantMessage("Autopilot semanal rejeitado. Ajuste manual recomendado antes de nova proposta.");
      },
    });
  }, [autopilotProposal, confirmDialog, pushAssistantMessage]);

  const handleRunEvolutionSimulation = useCallback(async () => {
    if (!selectedClass) return;
    setLoading(true);
    try {
      const logs = await getRecentLogs();
      const result = simulateClassEvolution({
        classId: selectedClass.id,
        logs: logs as SessionLog[],
        horizonWeeks: 6,
        interventionIntensity: "balanced",
      });
      setSimulationResult(result);
      pushAssistantMessage(
        `Simulação de evolução gerada para ${selectedClass.name}. Projeção de ${result.horizonWeeks} semanas com aprovação humana obrigatória.`
      );
    } finally {
      setLoading(false);
    }
  }, [getRecentLogs, pushAssistantMessage, selectedClass]);

  const applyAutoFixSuggestion = useCallback(
    (suggestion: AutoFixSuggestion) => {
      confirmDialog({
        title: suggestion.title,
        message: `${suggestion.rationale} Impacto: ${suggestion.impact}`,
        confirmLabel: "Aplicar",
        cancelLabel: "Cancelar",
        tone: suggestion.action === "move_dead_letter" ? "danger" : "default",
        onConfirm: async () => {
          try {
            if (suggestion.action === "reprocess_network") {
              const result = await reprocessPendingWritesNetworkFailures();
              pushAssistantMessage(
                `Auto-fix aplicado: reprocessados ${result.flushed} itens. Restantes na fila: ${result.remaining}.`
              );
            } else {
              const result = await clearPendingWritesDeadLetterCandidates(10);
              pushAssistantMessage(
                `Auto-fix aplicado: ${result.removed} item(ns) movidos para dead-letter. Restantes: ${result.remaining}.`
              );
            }
            setAutoFixSuggestions([]);
          } catch {
            pushAssistantMessage("Não foi possível aplicar auto-fix agora.");
          }
        },
      });
    },
    [confirmDialog, pushAssistantMessage]
  );

  const handleComposerKeyPress = useCallback(
    (event: any) => {
      if (Platform.OS !== "web") return;
      const key = event?.nativeEvent?.key;
      const shiftKey = Boolean(event?.nativeEvent?.shiftKey);
      if (key !== "Enter" || shiftKey) return;
      event?.preventDefault?.();
      event?.stopPropagation?.();
      void sendMessage();
    },
    [sendMessage]
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !composerFocused) return;

    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      void sendMessage();
    };

    window.addEventListener("keydown", onWindowKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown, true);
    };
  }, [composerFocused, sendMessage]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: isDesktopLayout ? 20 : 14,
          paddingTop: 12,
          paddingBottom: 12,
          gap: 12,
          flexDirection: isDesktopLayout ? "row" : "column",
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 14,
            gap: 12,
          }}
        >
          <ScrollView
            contentContainerStyle={{
              gap: 10,
              paddingBottom: composerHeight + keyboardHeight + insets.bottom + 12,
            }}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 ? (
              <View
                style={{
                  width: "100%",
                  maxWidth: isDesktopLayout ? 860 : undefined,
                  alignSelf: "center",
                  minHeight: Platform.OS === "web" ? Math.max(470, Math.round(height * 0.6)) : undefined,
                  paddingHorizontal: isDesktopLayout ? 20 : 6,
                  paddingTop: isDesktopLayout ? 26 : 18,
                  paddingBottom: 10,
                  gap: 16,
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="sparkles" size={30} color={colors.muted} />
                </View>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: isDesktopLayout ? 42 : 34,
                    fontWeight: "800",
                    textAlign: "center",
                  }}
                >
                  Bem-vindo, {userDisplayName}!
                </Text>
                <Text style={{ color: colors.muted, textAlign: "center" }}>
                  Como posso ajudar hoje?
                </Text>
                <View
                  style={{
                    width: "100%",
                    maxWidth: 920,
                    alignSelf: "center",
                    paddingHorizontal: isDesktopLayout ? 18 : 8,
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 12,
                    justifyContent: quickPromptColumns === 1 ? "flex-start" : "center",
                    marginTop: 10,
                  }}
                >
                  {quickPrompts.map((item) => (
                    <Pressable
                      key={item.title}
                      onPress={() => handleSelectQuickPrompt(item.prompt)}
                      focusable={Platform.OS !== "web"}
                      style={{
                        width: quickPromptCardWidth,
                        minHeight: quickPromptColumns === 1 ? 116 : 152,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        overflow: "hidden",
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: colors.secondaryBg,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Ionicons name={item.icon} size={16} color={colors.muted} />
                      </View>
                      <View style={{ gap: 4, flexShrink: 1 }}>
                        <Text
                          numberOfLines={2}
                          style={{
                            color: colors.text,
                            fontWeight: "700",
                            fontSize: quickPromptColumns === 1 ? 18 : 16,
                            lineHeight: quickPromptColumns === 1 ? 24 : 22,
                            width: "100%",
                          }}
                        >
                          {item.title}
                        </Text>
                        <Text
                          numberOfLines={2}
                          style={{
                            color: colors.muted,
                            fontSize: quickPromptColumns === 1 ? 15 : 13,
                            lineHeight: quickPromptColumns === 1 ? 20 : 18,
                          }}
                        >
                          {item.subtitle}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {messages.map((message, index) => (
              <View
                key={String(index)}
                style={{
                  alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: message.role === "user" ? colors.primaryBg : colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: message.role === "user" ? colors.primaryText : colors.text }}>
                  {message.content}
                </Text>
              </View>
            ))}

            {loading ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  maxWidth: "58%",
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {[0, 1, 2].map((index) => {
                    const phase = index * 0.2;
                    const opacity = thinkingPulse.interpolate({
                      inputRange: [0, phase, phase + 0.2, 1],
                      outputRange: [0.3, 0.45, 1, 0.35],
                      extrapolate: "clamp",
                    });
                    const translateY = thinkingPulse.interpolate({
                      inputRange: [0, phase, phase + 0.2, 1],
                      outputRange: [0, 0, -3, 0],
                      extrapolate: "clamp",
                    });

                    return (
                      <Animated.View
                        key={`thinking-dot-${index}`}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: colors.muted,
                          opacity,
                          transform: [{ translateY }],
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            ) : null}

            { draft ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  Planejamento sugerido
                </Text>
                <Text style={{ color: colors.muted, marginTop: 6 }}>
                  {draft.title}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <Text style={{ color: colors.muted }}>
                    {"Turma: " + className}
                  </Text>
                  { selectedClass ? (
                    <ClassGenderBadge gender={selectedClass.gender} size="sm" />
                  ) : null}
                </View>
                <View
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: colors.text }}>
                    Aquecimento {draft.warmupTime ? "(" + draft.warmupTime + ")" : ""}
                  </Text>
                  <Text style={{ color: colors.text }}>{renderList(draft.warmup)}</Text>
                </View>
                <View
                  style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: colors.text }}>
                    Parte principal {draft.mainTime ? "(" + draft.mainTime + ")" : ""}
                  </Text>
                  <Text style={{ color: colors.text }}>{renderList(draft.main)}</Text>
                </View>
                <View
                  style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: colors.text }}>
                    Volta a calma {draft.cooldownTime ? "(" + draft.cooldownTime + ")" : ""}
                  </Text>
                  <Text style={{ color: colors.text }}>
                    {renderList(draft.cooldown)}
                  </Text>
                </View>
                { draft.tags.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {draft.tags.map((tag) => (
                      <View
                        key={tag}
                        style={{
                          paddingVertical: 3,
                          paddingHorizontal: 8,
                          borderRadius: 999,
                          backgroundColor: colors.secondaryBg,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 12 }}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={{ marginTop: 10 }}>
                  <Button label="Salvar planejamento" onPress={saveDraft} />
                </View>
              </View>
            ) : null}

            { showSavedLink ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  Planejamento salvo
                </Text>
                <Text style={{ color: colors.muted, marginTop: 6 }}>
                  Clique para ver na lista de planejamentos.
                </Text>
                <View style={{ marginTop: 10 }}>
                  <Button
                    label="Ver planejamentos"
                    onPress={() => router.push({ pathname: "/training" })}
                    variant="secondary"
                  />
                </View>
              </View>
            ) : null}

            { sources.length > 0 ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  Fontes citadas
                </Text>
                {sources.map((source, index) => (
                  <View key={String(index)} style={{ marginTop: 8 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      {source.title}
                    </Text>
                    <Text style={{ color: colors.muted }}>
                      {source.author + " - " + source.url}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {confidence !== null || citations.length > 0 || assumptions.length > 0 || missingData.length > 0 ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 8,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.text }}>Qualidade da resposta</Text>
                {confidence !== null ? (
                  <Text style={{ color: colors.muted }}>
                    Confiança: {(confidence * 100).toFixed(0)}%
                  </Text>
                ) : null}
                {citations.length > 0 ? (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>Evidências</Text>
                    {citations.map((item, index) => (
                      <Text key={`citation-${index}`} style={{ color: colors.muted }}>
                        - {item.sourceTitle}: {item.evidence}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {assumptions.length > 0 ? (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>Premissas</Text>
                    {assumptions.map((item, index) => (
                      <Text key={`assumption-${index}`} style={{ color: colors.muted }}>
                        - {item}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {missingData.length > 0 ? (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>Dados faltantes</Text>
                    {missingData.map((item, index) => (
                      <Text key={`missing-${index}`} style={{ color: colors.muted }}>
                        - {item}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {autoFixSuggestions.length > 0 ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 8,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.text }}>Auto-fix sugerido</Text>
                {autoFixSuggestions.map((suggestion) => (
                  <View key={suggestion.id} style={{ gap: 6 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>{suggestion.title}</Text>
                    <Text style={{ color: colors.muted }}>{suggestion.rationale}</Text>
                    <Pressable
                      onPress={() => applyAutoFixSuggestion(suggestion)}
                      style={{
                        alignSelf: "flex-start",
                        borderRadius: 999,
                        backgroundColor: colors.secondaryBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700" }}>Aplicar</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {nextClassSuggestion ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 8,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.text }}>{nextClassSuggestion.headline}</Text>
                <Text style={{ color: colors.muted }}>
                  Radar da turma: {(nextClassSuggestion.radarScore * 100).toFixed(0)}% ({nextClassSuggestion.trendLabel})
                </Text>
                <Text style={{ color: colors.text }}>{nextClassSuggestion.coachSummary}</Text>
                {nextClassSuggestion.alerts.length > 0 ? (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>Alertas</Text>
                    {nextClassSuggestion.alerts.map((item, index) => (
                      <Text key={`radar-alert-${index}`} style={{ color: colors.muted }}>
                        - {item}
                      </Text>
                    ))}
                  </View>
                ) : null}
                <View style={{ gap: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Ações sugeridas</Text>
                  {nextClassSuggestion.actions.map((item, index) => (
                    <Text key={`radar-action-${index}`} style={{ color: colors.muted }}>
                      - {item}
                    </Text>
                  ))}
                </View>
                <Pressable
                  onPress={applyNextClassSuggestion}
                  style={{
                    alignSelf: "flex-start",
                    borderRadius: 999,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Aplicar no próximo treino</Text>
                </Pressable>
              </View>
            ) : null}

            {autopilotProposal ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 8,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.text }}>Autopilot semanal</Text>
                <Text style={{ color: colors.muted }}>Status: {autopilotProposal.status}</Text>
                <Text style={{ color: colors.text }}>{autopilotProposal.summary}</Text>
                {autopilotProposal.actions.map((item, index) => (
                  <Text key={`autopilot-action-${index}`} style={{ color: colors.muted }}>
                    - {item}
                  </Text>
                ))}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={handleApproveAutopilot}
                    style={{
                      borderRadius: 999,
                      backgroundColor: colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>Aprovar</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleRejectAutopilot}
                    style={{
                      borderRadius: 999,
                      backgroundColor: colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>Rejeitar</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {simulationResult ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 8,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.text }}>Simulação de evolução (assistiva)</Text>
                <Text style={{ color: colors.muted }}>
                  Baseline: {(simulationResult.baselineScore * 100).toFixed(0)}% • Horizonte: {simulationResult.horizonWeeks} semanas
                </Text>
                {simulationResult.points.slice(0, 4).map((point) => (
                  <Text key={`sim-point-${point.week}`} style={{ color: colors.muted }}>
                    - Semana {point.week}: {(point.projectedScore * 100).toFixed(0)}% ({point.focus})
                  </Text>
                ))}
              </View>
            ) : null}

            {memoryContextHints.length > 0 ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 8,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.text }}>Memória de contexto</Text>
                {memoryContextHints.slice(0, 3).map((item, index) => (
                  <Text key={`memory-hint-${index}`} style={{ color: colors.muted }}>
                    - {item}
                  </Text>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <View
            onLayout={(event) => {
              const next = Math.round(event.nativeEvent.layout.height);
              if (next !== composerHeight) setComposerHeight(next);
            }}
            style={{
              gap: 8,
              padding: 12,
              borderRadius: 16,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: keyboardHeight,
              paddingBottom: 12 + insets.bottom,
            }}
          >
            <TextInput
              ref={composerInputRef}
              placeholder="Descreva a aula ou o planejamento..."
              value={input}
              onChangeText={setInput}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              onKeyPress={handleComposerKeyPress}
              placeholderTextColor={colors.placeholder}
              multiline
              style={{
                minHeight: 54,
                maxHeight: 130,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                paddingHorizontal: 10,
                paddingVertical: 10,
                color: colors.inputText,
                textAlignVertical: "top",
              }}
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => setInput(quickPrompts[0].prompt)}
                  style={{
                    borderRadius: 999,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>Sugestão</Text>
                </Pressable>
                <Pressable
                  onPress={clearConversation}
                  style={{
                    borderRadius: 999,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>Limpar chat</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleGenerateProgression()}
                  style={{
                    borderRadius: 999,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>Progressão</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleExecutiveSummary()}
                  style={{
                    borderRadius: 999,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>Resumo</Text>
                </Pressable>
                <Pressable
                  onPress={handleCommunicationCopilot}
                  style={{
                    borderRadius: 999,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>Comunicação</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleSupportMode()}
                  style={{
                    borderRadius: 999,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>Support mode</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handlePostSessionIntelligence()}
                  style={{
                    borderRadius: 999,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>Pós-sessão</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleWeeklyAutopilot()}
                  style={{
                    borderRadius: 999,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>Autopilot</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleRunEvolutionSimulation()}
                  style={{
                    borderRadius: 999,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>Simular</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={sendMessage}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: colors.primaryBg,
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                  {loading || assistantTyping ? "..." : "Enviar"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {isDesktopLayout ? (
          <View
            style={{
              width: 320,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 12,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 30, fontWeight: "800" }}>
              Histórico
            </Text>
            <TextInput
              placeholder="Buscar..."
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 10,
                paddingVertical: 8,
                color: colors.inputText,
                backgroundColor: colors.background,
              }}
            />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }}>
              {recentUserPrompts.length === 0 ? (
                <View
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    padding: 10,
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Sem conversas recentes.
                  </Text>
                </View>
              ) : (
                recentUserPrompts.map((message, index) => (
                  <Pressable
                    key={`history-${index}`}
                    onPress={() => setInput(message.content)}
                    style={{
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      padding: 10,
                      gap: 4,
                    }}
                  >
                    <Text numberOfLines={2} style={{ color: colors.text, fontWeight: "700" }}>
                      {message.content}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      Prompt recente
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Pressable
              onPress={clearConversation}
              style={{
                borderRadius: 999,
                backgroundColor: colors.primaryBg,
                alignItems: "center",
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                Novo chat
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
