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
    Linking,
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

type ScientificReference = {
  id: string;
  title: string;
  author: string;
  url: string;
  doi: string;
  pmid: string;
  year: string;
  sourceLabel: string;
  evidence: string;
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

const DOI_REGEX = /\b10\.\d{4,9}\/[A-Z0-9._;()/:-]+\b/i;
const PMID_URL_REGEX = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)\/?/i;
const PMID_TEXT_REGEX = /\bPMID\s*[:=]?\s*(\d{5,})\b/i;
const URL_REGEX = /(https?:\/\/[^\s)]+)/i;
const YEAR_REGEX = /\b(19|20)\d{2}\b/;

const extractDoi = (value: string) => {
  const match = value.match(DOI_REGEX);
  return match ? match[0] : "";
};

const extractPmid = (value: string) => {
  const fromUrl = value.match(PMID_URL_REGEX);
  if (fromUrl?.[1]) return fromUrl[1];
  const fromText = value.match(PMID_TEXT_REGEX);
  return fromText?.[1] ?? "";
};

const extractFirstUrl = (value: string) => {
  const match = value.match(URL_REGEX);
  return match ? match[1] : "";
};

const extractYear = (value: string) => {
  const match = String(value ?? "").match(YEAR_REGEX);
  return match ? match[0] : "";
};

const extractSourceLabel = (evidence: string, fallback: string) => {
  const match = String(evidence ?? "").match(/fonte:\s*([^.;\n]+)/i);
  if (match?.[1]) return match[1].trim();
  return fallback || "Fonte não informada";
};

const buildDoiUrl = (doi: string) => (doi ? `https://doi.org/${encodeURIComponent(doi)}` : "");

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
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);
  const composerInputRef = useRef<TextInput | null>(null);
  const thinkingPulse = useRef(new Animated.Value(0)).current;
  const sendButtonAnim = useRef(new Animated.Value(0)).current;
  const suggestionsExpandAnim = useRef(new Animated.Value(0)).current;

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
  const hasInputText = input.trim().length > 0;

  useEffect(() => {
    Animated.timing(sendButtonAnim, {
      toValue: hasInputText ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [hasInputText, sendButtonAnim]);

  const sendButtonScale = sendButtonAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1],
  });

  const sendButtonTranslateY = sendButtonAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0],
  });

  const suggestionsToggleRotate = suggestionsExpandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const className = selectedClass?.name ?? "Turma";

  const scientificReferences = useMemo<ScientificReference[]>(() => {
    if (!sources.length) return [];

    const refs = sources.map((source, index) => {
      const citationEvidence = citations[index]?.evidence ?? "";
      const mergedText = `${source.title} ${source.author} ${source.url} ${citationEvidence}`;
      const doi = extractDoi(mergedText);
      const pmid = extractPmid(mergedText);
      const year = extractYear(mergedText);
      const fallbackUrl = extractFirstUrl(citationEvidence);
      const officialUrl = source.url || fallbackUrl || buildDoiUrl(doi);
      const sourceLabel = extractSourceLabel(citationEvidence, source.author || "");

      return {
        id: `${source.title}-${source.url}-${index}`,
        title: source.title || "Referência científica",
        author: source.author || "Autor não informado",
        url: officialUrl,
        doi,
        pmid,
        year,
        sourceLabel,
        evidence: citationEvidence,
      };
    });

    const seen = new Set<string>();
    return refs.filter((ref) => {
      const key = `${ref.url}|${ref.doi}|${ref.pmid}|${ref.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [citations, sources]);

  const openReferenceLink = useCallback(async (url: string) => {
    const target = String(url ?? "").trim();
    if (!target) {
      Alert.alert("Link indisponível", "Essa referência não possui URL de acesso.");
      return;
    }

    try {
      const supported = await Linking.canOpenURL(target);
      if (!supported) {
        Alert.alert("Link inválido", "Não foi possível abrir esta referência.");
        return;
      }
      await Linking.openURL(target);
    } catch {
      Alert.alert("Erro ao abrir", "Não foi possível abrir o link da referência.");
    }
  }, []);

  const isDesktopLayout = Platform.OS === "web" && width >= 1100;
  const isCompactMobile = width < 420;

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
        title: "Gerar treino da turma",
        icon: "sparkles-outline" as const,
        prompt: "Monte um treino completo de 60 minutos para a turma atual com aquecimento, parte principal e volta à calma.",
      },
      {
        title: "Progressão técnica",
        icon: "trending-up-outline" as const,
        prompt: "Gere uma progressão técnica para as próximas 3 sessões da turma atual, com foco em consistência e tomada de decisão.",
      },
      {
        title: "Resumo da turma",
        icon: "document-text-outline" as const,
        prompt: "Crie um resumo executivo da turma com principais riscos, pontos fortes e prioridades da semana.",
      },
      {
        title: "Mensagem para pais",
        icon: "chatbox-ellipses-outline" as const,
        prompt: "Escreva uma mensagem curta para pais e alunos explicando objetivo e foco da próxima aula.",
      },
      {
        title: "Pós-sessão",
        icon: "book-outline" as const,
        prompt: "Analise os últimos registros da turma e gere recomendações objetivas para o próximo treino.",
      },
      {
        title: "Autopilot semanal",
        icon: "calendar-outline" as const,
        prompt: "Proponha um autopilot semanal para a turma atual com metas, ações e critérios de validação humana.",
      },
      {
        title: "Simular evolução",
        icon: "pulse-outline" as const,
        prompt: "Simule a evolução da turma por 6 semanas com intervenção balanceada e destaque premissas e limites.",
      },
      {
        title: "Support mode",
        icon: "shield-checkmark-outline" as const,
        prompt: "Analise o estado de sincronização e proponha auto-fixes seguros para reduzir pendências.",
      },
    ],
    []
  );

  const secondaryPromptSamples = useMemo(() => quickPrompts.slice(1, 4), [quickPrompts]);
  const hiddenQuickPrompts = useMemo(() => quickPrompts.slice(4), [quickPrompts]);

  useEffect(() => {
    if (messages.length > 0 && suggestionsExpanded) {
      setSuggestionsExpanded(false);
    }
  }, [messages.length, suggestionsExpanded]);

  useEffect(() => {
    Animated.timing(suggestionsExpandAnim, {
      toValue: suggestionsExpanded ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [suggestionsExpandAnim, suggestionsExpanded]);

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

      let memoryContext: string[] = [];
      try {
        await pruneExpiredAssistantMemories();
        const memoryEntries = await listAssistantMemories({
          organizationId: activeOrganization?.id ?? "",
          classId,
          userId: session?.user?.id,
          limit: 4,
        });
        memoryContext = memoryEntries.map((item) => item.content);
      } catch {
        memoryContext = [];
      }
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
      const reply = nextDraft
        ? "Montei um planejamento para você. Revise os blocos abaixo e ajuste se necessário."
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
        try {
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
        } catch {
          // Falha de cache local não deve bloquear resposta do assistant
        }
      }

      if (nextDraft) {
        void notifyTrainingCreated();
      }
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message.replace(/\s+/g, " ").trim().slice(0, 180)
          : "Falha de rede ou deploy da Edge Function.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Erro ao consultar o assistente. Confira o deploy/token e tente novamente. Detalhe: " + detail,
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
    if (autopilotProposal && autopilotProposal.status !== "approved") {
      Alert.alert(
        "Aprovação obrigatória",
        `A proposta semanal está com status \"${autopilotProposal.status}\". Nada aplica sem aprovação explícita.`
      );
      return;
    }
    setInput(nextClassSuggestion.nextTrainingPrompt);
    pushAssistantMessage("Sugestão aplicada no composer. Revise e gere o próximo treino quando estiver pronto.");
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  }, [autopilotProposal, nextClassSuggestion, pushAssistantMessage]);

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
                  minHeight: Platform.OS === "web" ? Math.max(360, Math.round(height * 0.45)) : undefined,
                  paddingHorizontal: isDesktopLayout ? 20 : 6,
                  paddingTop: isDesktopLayout ? 40 : 20,
                  paddingBottom: 10,
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: "100%",
                    maxWidth: 1120,
                    alignSelf: "center",
                    paddingHorizontal: isDesktopLayout ? 18 : 8,
                    gap: 12,
                    marginTop: 0,
                  }}
                >
                  {quickPrompts.length > 0 ? (
                    <Pressable
                      key={quickPrompts[0].title}
                      onPress={() => handleSelectQuickPrompt(quickPrompts[0].prompt)}
                      focusable={Platform.OS !== "web"}
                      style={{
                        alignSelf: "center",
                        minHeight: isCompactMobile ? 44 : 52,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        paddingHorizontal: isCompactMobile ? 14 : 18,
                        paddingVertical: isCompactMobile ? 8 : 10,
                        justifyContent: "center",
                        alignItems: "center",
                        overflow: "hidden",
                        gap: 6,
                        flexDirection: "row",
                        maxWidth: "95%",
                      }}
                    >
                      <Ionicons name={quickPrompts[0].icon} size={isCompactMobile ? 16 : 18} color={colors.text} />
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.text, fontWeight: "700", fontSize: isCompactMobile ? 14 : 16 }}
                      >
                        {quickPrompts[0].title}
                      </Text>
                    </Pressable>
                  ) : null}

                  <View
                    style={{
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        justifyContent: "center",
                        gap: 10,
                      }}
                    >
                      {secondaryPromptSamples.map((item) => (
                        <Pressable
                          key={item.title}
                          onPress={() => handleSelectQuickPrompt(item.prompt)}
                          focusable={Platform.OS !== "web"}
                          style={{
                            minHeight: isCompactMobile ? 44 : 48,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.card,
                            paddingHorizontal: isCompactMobile ? 12 : 16,
                            paddingVertical: isCompactMobile ? 8 : 10,
                            justifyContent: "center",
                            alignItems: "center",
                            overflow: "hidden",
                            gap: 6,
                            flexDirection: "row",
                          }}
                        >
                          <Ionicons name={item.icon} size={isCompactMobile ? 16 : 18} color={colors.text} />
                          <Text
                            numberOfLines={1}
                            style={{ color: colors.text, fontWeight: "700", fontSize: isCompactMobile ? 13 : 15 }}
                          >
                            {item.title}
                          </Text>
                        </Pressable>
                      ))}

                      {hiddenQuickPrompts.length > 0 ? (
                        <Pressable
                          onPress={() => setSuggestionsExpanded((prev) => !prev)}
                          style={{
                            width: isCompactMobile ? 40 : 44,
                            height: isCompactMobile ? 40 : 44,
                            borderRadius: isCompactMobile ? 20 : 22,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.secondaryBg,
                            justifyContent: "center",
                            alignItems: "center",
                            shadowColor: "#000",
                            shadowOpacity: 0.08,
                            shadowRadius: 6,
                            shadowOffset: { width: 0, height: 2 },
                            elevation: 1,
                          }}
                        >
                          <Animated.View style={{ transform: [{ rotate: suggestionsToggleRotate }] }}>
                            <Ionicons
                              name="add"
                              size={isCompactMobile ? 18 : 20}
                              color={colors.text}
                            />
                          </Animated.View>
                        </Pressable>
                      ) : null}
                    </View>

                    {hiddenQuickPrompts.length > 0 ? (
                      <Animated.View
                        style={{
                          overflow: "hidden",
                          opacity: suggestionsExpandAnim,
                          maxHeight: suggestionsExpandAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 140],
                          }),
                          transform: [
                            {
                              translateY: suggestionsExpandAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-6, 0],
                              }),
                            },
                          ],
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            justifyContent: "center",
                            gap: 10,
                            paddingTop: 2,
                          }}
                        >
                          {hiddenQuickPrompts.map((item) => (
                            <Pressable
                              key={`hidden-${item.title}`}
                              onPress={() => handleSelectQuickPrompt(item.prompt)}
                              focusable={Platform.OS !== "web"}
                              style={{
                                minHeight: isCompactMobile ? 42 : 46,
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: colors.border,
                                backgroundColor: colors.card,
                                paddingHorizontal: isCompactMobile ? 11 : 14,
                                paddingVertical: isCompactMobile ? 7 : 9,
                                justifyContent: "center",
                                alignItems: "center",
                                overflow: "hidden",
                                gap: 6,
                                flexDirection: "row",
                              }}
                            >
                              <Ionicons name={item.icon} size={isCompactMobile ? 15 : 17} color={colors.text} />
                              <Text
                                numberOfLines={1}
                                style={{ color: colors.text, fontWeight: "700", fontSize: isCompactMobile ? 12 : 14 }}
                              >
                                {item.title}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </Animated.View>
                    ) : null}
                  </View>
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

            { scientificReferences.length > 0 ? (
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
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  Referências científicas
                </Text>
                {scientificReferences.map((reference) => (
                  <Pressable
                    key={reference.id}
                    onPress={() => {
                      void openReferenceLink(reference.url);
                    }}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      borderRadius: 14,
                      padding: 10,
                      gap: 4,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      {reference.title}
                    </Text>
                    <Text style={{ color: colors.muted }}>
                      {reference.author}
                    </Text>
                    <Text style={{ color: colors.muted }}>
                      {reference.sourceLabel}
                      {reference.year ? ` • ${reference.year}` : ""}
                    </Text>
                    {reference.doi ? (
                      <Text style={{ color: colors.text }}>
                        DOI: {reference.doi}
                      </Text>
                    ) : null}
                    {reference.pmid ? (
                      <Text style={{ color: colors.text }}>
                        PMID: {reference.pmid}
                      </Text>
                    ) : null}
                    <Text style={{ color: colors.primaryBg, textDecorationLine: "underline" }}>
                      Link oficial: {reference.url || "indisponível"}
                    </Text>
                    {reference.evidence ? (
                      <Text style={{ color: colors.muted }} numberOfLines={2}>
                        Evidência: {reference.evidence}
                      </Text>
                    ) : null}
                  </Pressable>
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
                  disabled={Boolean(autopilotProposal && autopilotProposal.status !== "approved")}
                  onPress={applyNextClassSuggestion}
                  style={{
                    alignSelf: "flex-start",
                    borderRadius: 999,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    opacity: autopilotProposal && autopilotProposal.status !== "approved" ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Aplicar no próximo treino</Text>
                </Pressable>
                {autopilotProposal && autopilotProposal.status !== "approved" ? (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Bloqueado até aprovação do autopilot semanal.
                  </Text>
                ) : null}
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
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Contrato: nada aplica sem status aprovado.
                </Text>
                <Text style={{ color: colors.text }}>{autopilotProposal.summary}</Text>
                {autopilotProposal.actions.map((item, index) => (
                  <Text key={`autopilot-action-${index}`} style={{ color: colors.muted }}>
                    - {item}
                  </Text>
                ))}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    disabled={autopilotProposal.status === "approved"}
                    onPress={handleApproveAutopilot}
                    style={{
                      borderRadius: 999,
                      backgroundColor: colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      opacity: autopilotProposal.status === "approved" ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>Aprovar</Text>
                  </Pressable>
                  <Pressable
                    disabled={autopilotProposal.status === "rejected"}
                    onPress={handleRejectAutopilot}
                    style={{
                      borderRadius: 999,
                      backgroundColor: colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      opacity: autopilotProposal.status === "rejected" ? 0.6 : 1,
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
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
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
                  flex: 1,
                  minHeight: 52,
                  maxHeight: 120,
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
              <Animated.View
                pointerEvents={hasInputText ? "auto" : "none"}
                style={{
                  opacity: sendButtonAnim,
                  transform: [{ scale: sendButtonScale }, { translateY: sendButtonTranslateY }],
                }}
              >
                <Pressable
                  onPress={sendMessage}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.primaryBg,
                  }}
                >
                  <Ionicons
                    name={loading || assistantTyping ? "hourglass-outline" : "arrow-up"}
                    size={18}
                    color={colors.primaryText}
                  />
                </Pressable>
              </Animated.View>
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
