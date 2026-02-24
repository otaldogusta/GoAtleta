import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { useOptionalCopilot } from "../../src/copilot/CopilotProvider";
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

type QuickPromptCard = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  prompt: string;
  tint: string;
  contextLabel: string;
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

const normalizeClassNameLabel = (value: string) =>
  String(value ?? "")
    .trim()
    .replace(/^turma\s+/i, "")
    .trim();

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
const MAX_STRATEGIC_BULLETS = 3;
const MAX_BULLET_LINE_LENGTH = 88;

const clampBulletLine = (value: string) => {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= MAX_BULLET_LINE_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_BULLET_LINE_LENGTH - 1).trimEnd()}…`;
};

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
  const params = useLocalSearchParams<{ prompt?: string; source?: string }>();
  const { session } = useAuth();
  const optionalCopilot = useOptionalCopilot();
  const { activeOrganization } = useOrganization();
  const { confirm: confirmDialog } = useConfirmDialog();
  const { colors, mode } = useAppTheme();
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
  const [nowMs, setNowMs] = useState(() => Date.now());
  const appliedPromptRef = useRef("");
  const composerInputRef = useRef<TextInput | null>(null);
  const thinkingPulse = useRef(new Animated.Value(0)).current;
  const sendButtonAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const incomingPrompt = String(params.prompt ?? "").trim();
    if (!incomingPrompt) return;
    if (incomingPrompt === appliedPromptRef.current) return;
    appliedPromptRef.current = incomingPrompt;
    setInput(incomingPrompt);
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  }, [params.prompt]);

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
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);
    return () => clearInterval(timer);
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
  const classNameById = useMemo(() => {
    const entries = new Map<string, string>();
    classes.forEach((item) => {
      entries.set(item.id, normalizeClassNameLabel(item.name) || item.name);
    });
    return entries;
  }, [classes]);
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
  const isCompactMobile = width < 360;

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

  const selectedClassDisplayName = useMemo(
    () => normalizeClassNameLabel(selectedClass?.name ?? ""),
    [selectedClass?.name]
  );

  useEffect(() => {
    const contextClassId = optionalCopilot?.appSnapshot?.activeSignal?.classId;
    if (!contextClassId) return;
    if (!classes.some((item) => item.id === contextClassId)) return;
    setClassId((current) => (current === contextClassId ? current : contextClassId));
  }, [classes, optionalCopilot?.appSnapshot?.activeSignal?.classId]);

  const assistantScopeLabel = selectedClassDisplayName
    ? `Turma ${selectedClassDisplayName}`
    : "Organização atual";

  const classContextTarget = selectedClassDisplayName
    ? `a turma ${selectedClassDisplayName}`
    : "a organização atual";

  const contextScreenLabel = useMemo(() => {
    const screen = String(optionalCopilot?.appSnapshot?.screen ?? "");
    if (screen.startsWith("coordination")) return "Coordenação";
    if (screen.startsWith("events")) return "Torneios";
    if (screen.startsWith("classes") || screen.startsWith("class_")) return "Turmas";
    if (screen.startsWith("periodization")) return "Periodização";
    if (screen.startsWith("nfc")) return "Presença NFC";
    return "Central";
  }, [optionalCopilot?.appSnapshot?.screen]);

  const quickPrompts = useMemo<QuickPromptCard[]>(() => {
    const baseCards: QuickPromptCard[] = [
      {
        id: "generate_training",
        title: "Gerar treino",
        icon: "sparkles-outline",
        description: "Monte sessão completa com foco no contexto ativo.",
        prompt: `Monte um treino completo de 60 minutos para ${classContextTarget}, com aquecimento, parte principal e volta à calma.`,
        tint: colors.primaryBg,
        contextLabel: assistantScopeLabel,
      },
      {
        id: "technical_summary",
        title: "Resumo técnico",
        icon: "document-text-outline",
        description: "Consolide o que já aconteceu e próximas prioridades.",
        prompt: `Crie um resumo executivo para ${classContextTarget}, com principais riscos, pontos fortes e prioridades da semana.`,
        tint: colors.infoText,
        contextLabel: contextScreenLabel,
      },
      {
        id: "engagement_analysis",
        title: "Analisar engajamento",
        icon: "pulse-outline",
        description: "Leia sinais de risco e níveis de consistência.",
        prompt: `Simule a evolução de ${classContextTarget} por 6 semanas com intervenção balanceada e destaque premissas e limites.`,
        tint: colors.warningText,
        contextLabel: assistantScopeLabel,
      },
      {
        id: "quick_research",
        title: "Pesquisa rápida",
        icon: "search-outline",
        description: "Encontre referência científica para a decisão.",
        prompt: selectedClassDisplayName
          ? `Busque evidências científicas recentes para melhorar o próximo treino da turma ${selectedClassDisplayName}.`
          : "Busque evidências científicas recentes para melhorar o próximo treino do contexto atual.",
        tint: colors.text,
        contextLabel: "Evidência",
      },
      {
        id: "family_message",
        title: "Mensagem para pais",
        icon: "chatbubble-ellipses-outline",
        description: "Rascunhe comunicação objetiva e profissional.",
        prompt: `Crie uma mensagem curta para pais/responsáveis com orientações da semana de ${classContextTarget}.`,
        tint: colors.successText,
        contextLabel: assistantScopeLabel,
      },
      {
        id: "session_checklist",
        title: "Checklist da sessão",
        icon: "checkmark-done-outline",
        description: "Liste itens operacionais antes da aula no contexto ativo.",
        prompt: `Monte um checklist prático para conduzir a próxima sessão de ${classContextTarget}.`,
        tint: colors.primaryBg,
        contextLabel: contextScreenLabel,
      },
    ];

    const signalCards: QuickPromptCard[] = (optionalCopilot?.appSnapshot?.signalsTop ?? [])
      .slice(0, 2)
      .map((signal, index) => {
        const signalClassLabel =
          signal.classId && classNameById.get(signal.classId)
            ? `Turma ${classNameById.get(signal.classId)}`
            : "Sinal do app";
        const id = `signal_${signal.id}_${index}`;
        if (signal.type === "report_delay") {
          return {
            id,
            title: "Regularizar relatórios",
            icon: "document-attach-outline",
            description: "Defina plano curto para reduzir pendências de relatório.",
            prompt: `Crie um plano objetivo para reduzir pendências de relatório em ${classContextTarget} nesta semana.`,
            tint: colors.warningText,
            contextLabel: signalClassLabel,
          };
        }
        if (signal.type === "repeated_absence") {
          return {
            id,
            title: "Plano para faltas",
            icon: "people-outline",
            description: "Estruture ações para reduzir faltas consecutivas.",
            prompt: `Crie uma estratégia prática para reduzir faltas consecutivas em ${classContextTarget}.`,
            tint: colors.warningText,
            contextLabel: signalClassLabel,
          };
        }
        if (signal.type === "unusual_presence_pattern") {
          return {
            id,
            title: "Analisar presença NFC",
            icon: "radio-outline",
            description: "Investigue padrão anômalo de presença recente.",
            prompt: `Analise o padrão de presença NFC em ${classContextTarget} e proponha ações corretivas.`,
            tint: colors.warningText,
            contextLabel: signalClassLabel,
          };
        }
        return {
          id,
          title: "Plano de intervenção",
          icon: "construct-outline",
          description: "Monte próximos passos com base no sinal atual.",
          prompt: `Gere um plano de intervenção para o sinal atual de ${classContextTarget}, com ações para 7 dias.`,
          tint: colors.warningText,
          contextLabel: signalClassLabel,
        };
      });

    const recentAction = optionalCopilot?.appSnapshot?.recentActions?.[0];
    const appActionCard: QuickPromptCard[] = recentAction
      ? [
          {
            id: "recent_action",
            title: "Continuar ação",
            icon: "play-forward-outline",
            description: recentAction.actionTitle,
            prompt: `Continue a ação "${recentAction.actionTitle}" para ${classContextTarget} com próximos passos claros.`,
            tint: colors.primaryBg,
            contextLabel: assistantScopeLabel,
          },
        ]
      : [];

    const ordered = [...appActionCard, ...signalCards, ...baseCards];
    const dedup = new Map<string, QuickPromptCard>();
    ordered.forEach((item) => {
      if (!dedup.has(item.id)) dedup.set(item.id, item);
    });
    return Array.from(dedup.values()).slice(0, 6);
  }, [
    classNameById,
    assistantScopeLabel,
    classContextTarget,
    colors.infoText,
    colors.primaryBg,
    colors.successText,
    colors.text,
    colors.warningText,
    contextScreenLabel,
    selectedClassDisplayName,
    optionalCopilot?.appSnapshot?.recentActions,
    optionalCopilot?.appSnapshot?.signalsTop,
  ]);

  const greetingLine = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return `Bom dia, ${userDisplayName}.`;
    if (hour < 18) return `Boa tarde, ${userDisplayName}.`;
    return `Boa noite, ${userDisplayName}.`;
  }, [userDisplayName]);

  const localDayScheduleStatus = useMemo<"no_classes" | "in_progress" | "concluded">(() => {
    const now = new Date(nowMs);
    const weekday = now.getDay();
    const todayClasses = classes.filter((item) => (item.daysOfWeek ?? []).includes(weekday));
    if (!todayClasses.length) return "no_classes";

    const hasPendingWindow = todayClasses.some((item) => {
      const match = String(item.startTime ?? "").match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return false;
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return false;

      const startAt = new Date(now);
      startAt.setHours(hour, minute, 0, 0);
      const durationMinutes = Number.isFinite(item.durationMinutes)
        ? Math.max(15, Number(item.durationMinutes))
        : 60;
      const endWithGraceMs = startAt.getTime() + durationMinutes * 60_000 + 60 * 60_000;
      return nowMs < endWithGraceMs;
    });

    return hasPendingWindow ? "in_progress" : "concluded";
  }, [classes, nowMs]);

  const dayScheduleStatus =
    optionalCopilot?.appSnapshot?.dayScheduleStatus ?? localDayScheduleStatus;

  const strategicBullets = useMemo(() => {
    const bullets: string[] = [];
    const snapshot = optionalCopilot?.appSnapshot;
    const signals = snapshot?.signalsTop ?? [];
    const regulationContext = snapshot?.regulationContext;

    if (signals.length > 0) {
      bullets.push(`${signals.length} ponto${signals.length === 1 ? "" : "s"} de atenção em foco.`);
    }

    if ((regulationContext?.latestChangedTopics?.length ?? 0) > 0) {
      bullets.push(
        `Regulamento: ${regulationContext?.latestChangedTopics
          .slice(0, 2)
          .join(", ")}.`
      );
    }

    if ((snapshot?.recentActions?.length ?? 0) > 0) {
      bullets.push(`Ação recente: ${snapshot?.recentActions[0]?.actionTitle}.`);
    }

    if (dayScheduleStatus === "concluded" && bullets.length < MAX_STRATEGIC_BULLETS) {
      bullets.push("Dia concluído: não há mais turmas pendentes hoje.");
    }

    if (bullets.length === 0) {
      if (dayScheduleStatus === "no_classes") {
        bullets.push("Sem turmas agendadas para hoje.");
      } else if (dayScheduleStatus === "concluded") {
        bullets.push("Dia concluído: não há mais turmas pendentes hoje.");
      } else {
        bullets.push("Nenhum alerta urgente no momento.");
      }
    }

    return bullets
      .map(clampBulletLine)
      .filter(Boolean)
      .slice(0, MAX_STRATEGIC_BULLETS);
  }, [dayScheduleStatus, optionalCopilot?.appSnapshot]);

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
      const appSnapshot = optionalCopilot?.appSnapshot ?? null;

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
          appSnapshot,
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
                  maxWidth: isDesktopLayout ? 980 : undefined,
                  alignSelf: "center",
                  minHeight:
                    Platform.OS === "web"
                      ? Math.max(360, Math.round(height * 0.42))
                      : undefined,
                  paddingHorizontal: isDesktopLayout ? 20 : 6,
                  paddingTop: isDesktopLayout ? 34 : 18,
                  paddingBottom: 8,
                  gap: 18,
                }}
              >
                <View style={{ alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: 35,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.inputBg,
                    }}
                  >
                    <View
                      style={{
                        position: "absolute",
                        width: 54,
                        height: 54,
                        borderRadius: 27,
                        backgroundColor: colors.primaryBg,
                        opacity: 0.16,
                      }}
                    />
                    <Ionicons name="sparkles-outline" size={26} color={colors.primaryBg} />
                  </View>
                  <Text style={{ color: colors.text, fontSize: isCompactMobile ? 28 : 42, fontWeight: "800" }}>
                    {greetingLine}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 16, textAlign: "center", maxWidth: 580 }}>
                    Hoje, o que você quer resolver?
                  </Text>
                  {classes.length > 1 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingTop: 4 }}
                    >
                      {classes.slice(0, 8).map((item) => {
                        const optionLabel = normalizeClassNameLabel(item.name) || item.name;
                        const selected = item.id === classId;
                        return (
                          <Pressable
                            key={`context-class-${item.id}`}
                            onPress={() => setClassId(item.id)}
                            style={{
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: selected ? colors.primaryBg : colors.border,
                              backgroundColor: selected ? colors.primaryBg : colors.inputBg,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                            }}
                          >
                            <Text
                              style={{
                                color: selected ? colors.primaryText : colors.text,
                                fontSize: 12,
                                fontWeight: "700",
                              }}
                            >
                              {optionLabel}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : null}
                </View>

                <View
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    padding: 12,
                    gap: 8,
                  }}
                >
                  {strategicBullets.map((bullet) => (
                    <View key={bullet} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="ellipse" size={8} color={colors.primaryBg} />
                      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "600", flex: 1 }}>
                        {bullet}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={{ width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {quickPrompts.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => handleSelectQuickPrompt(item.prompt)}
                      style={{
                        flexBasis: isDesktopLayout ? "31.9%" : isCompactMobile ? "100%" : "48.5%",
                        flexGrow: 1,
                        minHeight: 102,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.inputBg,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        gap: 8,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <View
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 10,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: colors.card,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <Ionicons
                            name={item.icon}
                            size={16}
                            color={mode === "dark" ? "#FFFFFF" : item.tint}
                          />
                        </View>
                        <View
                          style={{
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.secondaryBg,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            maxWidth: "75%",
                          }}
                        >
                          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
                            {item.contextLabel}
                          </Text>
                        </View>
                      </View>
                      <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                        {item.title}
                      </Text>
                      <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, lineHeight: 16 }}>
                        {item.description}
                      </Text>
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
                      {reference.year ? ` . ${reference.year}` : ""}
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
                  Baseline: {(simulationResult.baselineScore * 100).toFixed(0)}% . Horizonte: {simulationResult.horizonWeeks} semanas
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
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: keyboardHeight,
              paddingBottom: 12 + insets.bottom,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
              <TextInput
                ref={composerInputRef}
                placeholder="Perguntar algo..."
                value={input}
                onChangeText={setInput}
                onFocus={() => setComposerFocused(true)}
                onBlur={() => setComposerFocused(false)}
                onKeyPress={handleComposerKeyPress}
                placeholderTextColor={colors.placeholder}
                multiline
                style={{
                  flex: 1,
                  minHeight: 48,
                  maxHeight: 96,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.inputBg,
                  paddingHorizontal: 12,
                  paddingVertical: 11,
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
      </View>
    </SafeAreaView>
  );
}
