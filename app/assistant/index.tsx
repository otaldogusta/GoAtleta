import { AssistantConversationScroll } from "../../src/assistant/components/AssistantConversationScroll";
import { AssistantWelcome } from "../../src/assistant/components/AssistantWelcome";
import { AssistantProgress } from "../../src/assistant/components/AssistantProgress";
import { appendAssistantProgress, type AssistantProgressCode } from "../../src/assistant/progress";
import { AssistantComposer } from "../../src/assistant/components/AssistantComposer";
import { AssistantClassSelector } from "../../src/assistant/components/AssistantClassSelector";
import { AssistantMessages, type AssistantMessageReportLink } from "../../src/assistant/components/AssistantMessages";
import { buildAssistantReportIdentity, collapseLatestStructuredProposalReply, resolveStructuredProposalReply } from "../../src/assistant/report-ui";
import { ScientificEvidencePanel, type ScientificReference } from "../../src/assistant/components/ScientificEvidencePanel";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Keyboard, Linking, Platform, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable } from "../../src/ui/Pressable";

import { AssistantModelSelector } from "../../src/assistant/components/AssistantModelSelector";
import type { AssistantModelChoice } from "../../src/assistant/model-choice";
import { requestAssistantConversation, saveAssistantClassRule } from "../../src/api/ai";
import { useAuth } from "../../src/auth/auth";
import { getValidAccessToken } from "../../src/auth/session";
import { useOptionalCopilot } from "../../src/copilot/CopilotProvider";
import { navigateBackOrReplace } from "../../src/navigation/safe-router";
import { useTrainerRouteScope } from "../../src/navigation/use-trainer-route-scope";
import { type AutoFixSuggestion } from "../../src/core/ai-operations";
import { type NextClassSuggestion } from "../../src/core/intelligence/suggestion-engine";
import type { ClassGroup, EvolutionSimulationResult, TrainingPlan } from "../../src/core/models";

import { listAssistantMemories, pruneExpiredAssistantMemories, saveAssistantMemoryEntry } from "../../src/db/ai-foundation";
import { clearPendingWritesDeadLetterCandidates, getClasses, reprocessPendingWritesNetworkFailures, saveTrainingPlan } from "../../src/db/seed";
import { getSessionLogByDate, saveSessionLog } from "../../src/db/session";
import { getScopedPlanningPath } from "../../src/navigation/profile-routes";
import { notifyTrainingCreated, notifyTrainingSaved } from "../../src/notifications";
import { useEffectiveProfile } from "../../src/hooks/use-effective-profile";
import { resolveNotificationInboxScope } from "../../src/notifications/inbox-scope";
import { markRender, measureAsync } from "../../src/observability/perf";
import { useOrganization } from "../../src/providers/organization-context";
import { useAppTheme } from "../../src/ui/app-theme";
import { Button } from "../../src/ui/Button";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";
import { GoAtletaIcon, type GoAtletaIconName } from "../../src/ui/icon-registry";
import { useResponsiveLayout } from "../../src/ui/use-responsive-layout";
import { formatIsoDateToPtBr } from "../../src/utils/date-time";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  reportLink?: AssistantMessageReportLink;
};

type AssistantSource = {
  title: string;
  author: string;
  url: string;
  scientificMetadata?: {
    doi: string;
    pmid: string;
    year: number | null;
    method: string;
    population: string;
    supportingExcerpt: string;
    limitations: string[];
  };
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
  reportProposal?: AssistantReportProposal | null;
  classMemoryProposal?: AssistantClassMemoryProposal | null;
  scientificEvidence?: {
    status: "not_needed" | "cache" | "searched" | "fallback" | "quota_exceeded";
    providers: ("internal" | "consensus" | "pubmed")[];
    candidateCount: number;
    warnings: string[];
  };
};

type AssistantReportProposal = {
  proposalId: string;
  classId: string;
  className: string;
  sessionDate: string;
  activity: string;
  conclusion: string;
  participantsCount: number | null;
  pse: number | null;
  technique: "boa" | "ok" | "ruim" | "nenhum" | null;
  attendance: number | null;
  painScore: number | null;
  confidence: "high" | "medium" | "low";
  reason: string;
  warnings: string[];
};

type AssistantClassMemoryProposal = {
  proposalId: string;
  classId: string;
  className: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  warnings: string[];
};

type AssistantErrorPayload = {
  error?: string;
  message?: string;
};

const ASSISTANT_CONTEXT_MESSAGES = 24;

type QuickPromptCard = {
  id: string;
  title: string;
  icon: GoAtletaIconName;
  description: string;
  prompt: string;
  tint: string;
  contextLabel: string;
};

type QuickPromptGridProps = {
  items: QuickPromptCard[];
  onSelectPrompt: (prompt: string) => void;
  supportsSplitLayout: boolean;
  isCompactMobile: boolean;
  mode: string;
  borderColor: string;
  inputBg: string;
  cardBg: string;
  secondaryBg: string;
  mutedText: string;
  primaryText: string;
};

const quickPromptGridStyles = StyleSheet.create({
  grid: { width: "100%", maxWidth: 720, alignSelf: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: {
    flexGrow: 1,
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontWeight: "700", fontSize: 13 },
  description: { fontSize: 11, lineHeight: 14 },
});

// perf-check: ignore-inline-row-style -- quick prompt grid uses dynamic palette and responsive basis.
const MemoQuickPromptGrid = memo(function QuickPromptGrid({
  items,
  onSelectPrompt,
  supportsSplitLayout,
  isCompactMobile,
  mode,
  borderColor,
  inputBg,
  cardBg,
  secondaryBg,
  mutedText,
  primaryText,
}: QuickPromptGridProps) {
  markRender("screen.assistant.render.quickPromptGrid", { size: items.length });
  return (
    <View style={quickPromptGridStyles.grid}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onSelectPrompt(item.prompt)}
          style={[
            quickPromptGridStyles.card,
            {
              flexBasis: isCompactMobile ? "100%" : "48.5%",
              borderColor,
              backgroundColor: inputBg,
            },
          ]}
        >
          <View
            style={[
              quickPromptGridStyles.iconWrap,
              { backgroundColor: cardBg, borderColor },
            ]}
          >
            <GoAtletaIcon name={item.icon} size={16} color={mode === "dark" ? "#FFFFFF" : item.tint} />
          </View>
          <View style={quickPromptGridStyles.copy}>
            <Text numberOfLines={1} style={[quickPromptGridStyles.title, { color: primaryText }]}>{item.title}</Text>
            <Text numberOfLines={1} style={[quickPromptGridStyles.description, { color: mutedText }]}>{item.description}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
});

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

const buildAssistantDraftBlock = (items: string[]) => ({
  summary: sanitizeList(items).slice(0, 2).join(" / "),
  activities: sanitizeList(items).map((name, index) => ({
    name,
    description: "Rascunho do assistente: revisar organização, troca e regra antes de aplicar na aula.",
    source: "fallback" as const,
    confidence: 0.5,
    constraints: ["assistant_draft_requires_human_review"],
    presentation: {
      standardText:
        "Rascunho do assistente. Revise a dinâmica de quadra antes de salvar como aula aplicada.",
    },
    validation: {
      flags: ["assistant_draft_requires_human_review"],
      checklist: {
        requiresHumanReview: true,
      },
    },
    id: `assistant_draft_${index + 1}`,
  })),
});

const extractAssistantPayloadError = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null;
  const payload = value as AssistantErrorPayload;
  const errorMessage =
    (typeof payload.error === "string" && payload.error.trim()) ||
    (typeof payload.message === "string" && payload.message.trim()) ||
    "";
  return errorMessage || null;
};

const extractEmbeddedReplyError = (reply: string): string | null => {
  const normalized = String(reply ?? "").trim();
  if (!normalized.startsWith("{") || !normalized.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(normalized) as AssistantErrorPayload;
    return extractAssistantPayloadError(parsed);
  } catch {
    return null;
  }
};

const toFriendlyAssistantError = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "Nao consegui processar essa pergunta agora.";
  const normalized = raw.toLowerCase();
  if (normalized.includes("entrada invalida") || normalized.includes("invalid input")) {
    return "Nao consegui interpretar essa pergunta. Tente reformular com mais contexto da turma.";
  }
  if (normalized.includes("timeout")) {
    return "A resposta demorou mais que o esperado. Tente novamente em alguns instantes.";
  }
  if (normalized.includes("token") || normalized.includes("auth")) {
    return "Sua sessao expirou. Faca login novamente para continuar.";
  }
  if (normalized.includes("failed to fetch") || normalized.includes("network request failed")) {
    return "Falha de conexao com o assistente. Verifique sua internet e tente novamente.";
  }
  return "Nao consegui processar essa pergunta agora. Tente novamente em instantes.";
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
    status: "generated",
    origin: "assistant",
    generatedAt: nowIso,
    pedagogy: {
      generationExplanation: {
        historyMode: "bootstrap",
        summary: "Rascunho criado pelo assistente.",
        coachSummary:
          "Rascunho do assistente: precisa de revisão humana antes de virar aula aplicada.",
        generationMode: "class_bootstrap",
        planningBasis: "class_based_bootstrap",
      },
      sessionObjective: String(normalizedDraft.title || "Planejamento sugerido"),
      sessionObjectiveSource: "generated",
      blocks: {
        warmup: buildAssistantDraftBlock(normalizedDraft.warmup),
        main: buildAssistantDraftBlock(normalizedDraft.main),
        cooldown: buildAssistantDraftBlock(normalizedDraft.cooldown),
      },
      override: {
        type: "methodology",
        fromRuleId: "assistant_draft",
        toRuleId: "human_review_required",
        fromApproach: "assistant_draft",
        toApproach: "human_review_required",
        reason: {
          text: "Planos gerados pelo assistente não são aplicados sem revisão.",
          tags: ["assistant_guardrail"],
        },
        createdAt: nowIso,
      },
    },
  };
};

export default function AssistantScreen() {
  markRender("screen.assistant.render.root");

  const router = useRouter();
  const scopedRoutes = useTrainerRouteScope();
  const pathname = usePathname();
  const effectiveProfile = useEffectiveProfile();
  const notificationInboxScope = resolveNotificationInboxScope({
    pathname,
    effectiveProfile,
  });
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
  const [modelPreference, setModelPreference] = useState<AssistantModelChoice>("auto");
  const activeReplyRequest = useRef<AbortController | null>(null);
  useEffect(() => () => { activeReplyRequest.current?.abort(); }, [activeOrganization?.id, classId]);
  const [partialReply, setPartialReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [assistantProgress, setAssistantProgress] = useState<AssistantProgressCode[]>([]);
  const [draft, setDraft] = useState<DraftTraining | null>(null);
  const [sources, setSources] = useState<AssistantSource[]>([]);
  const [showSavedLink, setShowSavedLink] = useState(false);
  const [, setConfidence] = useState<number | null>(null);
  const [citations, setCitations] = useState<{ sourceTitle: string; evidence: string }[]>([]);
  const [scientificEvidence, setScientificEvidence] = useState<AssistantResponse["scientificEvidence"]>();
  const [reportProposal, setReportProposal] = useState<AssistantReportProposal | null>(null);
  const [savingReport, setSavingReport] = useState(false);
  const [classMemoryProposal, setClassMemoryProposal] = useState<AssistantClassMemoryProposal | null>(null);
  const [savingClassMemory, setSavingClassMemory] = useState(false);
  const [, setMissingData] = useState<string[]>([]);
  const [, setAssumptions] = useState<string[]>([]);
  const [autoFixSuggestions, setAutoFixSuggestions] = useState<AutoFixSuggestion[]>([]);
  const [nextClassSuggestion, setNextClassSuggestion] = useState<NextClassSuggestion | null>(null);
  const [simulationResult, setSimulationResult] = useState<EvolutionSimulationResult | null>(null);
  const [memoryContextHints, setMemoryContextHints] = useState<string[]>([]);
  const [composerHeight, setComposerHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [composerFocused, setComposerFocused] = useState(false);
  const scopedPlanningPath = useMemo(() => getScopedPlanningPath(pathname), [pathname]);

  const appliedPromptRef = useRef("");
  const composerInputRef = useRef<TextInput | null>(null);

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
      try {
        const data = await measureAsync(
          "screen.assistant.load.classes",
          () => getClasses(),
          { screen: "assistant" }
        );
        if (!alive) return;
        setClasses(data);
        if (!classId && data.length > 0) {
          setClassId(data[0].id);
        }
      } catch {
        if (!alive) return;
        setClasses([]);
      }
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


  const className = selectedClass?.name ?? "Turma";
  const scientificReferences = useMemo<ScientificReference[]>(() => {
    if (!sources.length) return [];

    const refs = sources.map((source, index) => {
      const citationEvidence = citations[index]?.evidence ?? "";
      const mergedText = `${source.title} ${source.author} ${source.url} ${citationEvidence}`;
      const doi = source.scientificMetadata?.doi || extractDoi(mergedText);
      const pmid = source.scientificMetadata?.pmid || extractPmid(mergedText);
      const year = source.scientificMetadata?.year ? String(source.scientificMetadata.year) : extractYear(mergedText);
      const fallbackUrl = extractFirstUrl(citationEvidence);
      const officialUrl = source.url || fallbackUrl || buildDoiUrl(doi);

      return {
        id: `${source.title}-${source.url}-${index}`,
        title: source.title || "Referência científica",
        author: source.author || "Autor não informado",
        url: officialUrl,
        doi,
        pmid,
        year,
        method: source.scientificMetadata?.method ?? "",
        population: source.scientificMetadata?.population ?? "",
        supportingExcerpt: source.scientificMetadata?.supportingExcerpt || citationEvidence,
        limitations: source.scientificMetadata?.limitations ?? [],
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

  const { supportsSplitView } = useResponsiveLayout("dashboard");
  const supportsSplitLayout = supportsSplitView;
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
    Promise.resolve().then(() => {
      setClassId((current) => (current === contextClassId ? current : contextClassId));
    });
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
        icon: "assistant",
        description: "Monte sessão completa com foco no contexto ativo.",
        prompt: `Monte um treino completo de 60 minutos para ${classContextTarget}, com aquecimento, parte principal e volta à calma.`,
        tint: colors.primaryBg,
        contextLabel: assistantScopeLabel,
      },
      {
        id: "technical_summary",
        title: "Resumo técnico",
        icon: "document",
        description: "Consolide o que já aconteceu e próximas prioridades.",
        prompt: `Crie um resumo executivo para ${classContextTarget}, com principais riscos, pontos fortes e prioridades da semana.`,
        tint: colors.infoText,
        contextLabel: contextScreenLabel,
      },
      {
        id: "engagement_analysis",
        title: "Analisar engajamento",
        icon: "engagement",
        description: "Leia sinais de risco e níveis de consistência.",
        prompt: `Simule a evolução de ${classContextTarget} por 6 semanas com intervenção balanceada e destaque premissas e limites.`,
        tint: colors.warningText,
        contextLabel: assistantScopeLabel,
      },
      {
        id: "quick_research",
        title: "Pesquisa rápida",
        icon: "search",
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
        icon: "chat",
        description: "Rascunhe comunicação objetiva e profissional.",
        prompt: `Crie uma mensagem curta para pais/responsáveis com orientações da semana de ${classContextTarget}.`,
        tint: colors.successText,
        contextLabel: assistantScopeLabel,
      },
      {
        id: "session_checklist",
        title: "Checklist da sessão",
        icon: "attendance",
        description: "Liste itens operacionais antes da aula no contexto ativo.",
        prompt: `Monte um checklist prático para conduzir a próxima sessão de ${classContextTarget}.`,
        tint: colors.primaryBg,
        contextLabel: contextScreenLabel,
      },
    ];

    const signalCards: QuickPromptCard[] = (optionalCopilot?.appSnapshot?.signalsTop ?? [])
      .filter(
        (
          signal
        ): signal is {
          id: string;
          type: string;
          severity: string;
          title: string;
          classId: string | null;
          studentId: string | null;
        } => Boolean(signal && typeof signal === "object" && "id" in signal)
      )
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
            icon: "documentAttach",
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
            icon: "students",
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
            icon: "nfc",
            description: "Investigue padrão anômalo de presença recente.",
            prompt: `Analise o padrão de presença NFC em ${classContextTarget} e proponha ações corretivas.`,
            tint: colors.warningText,
            contextLabel: signalClassLabel,
          };
        }
        return {
          id,
          title: "Plano de intervenção",
          icon: "construct",
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
            icon: "playForward",
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
    return Array.from(dedup.values()).slice(0, 4);
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

  const pushAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => [...prev, { role: "assistant", content }]);
  }, []);

  const showAssistantReply = useCallback((reply: string) => {
    setMessages(prev => [...prev, { role: "assistant", content: reply ?? "" }]);
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

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;
    const controller = new AbortController();
    activeReplyRequest.current = controller;
    const nextMessages = [...messages, { role: "user" as const, content: input.trim() }];
    const requestMessages = nextMessages.slice(-ASSISTANT_CONTEXT_MESSAGES);
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setAssistantProgress(["preparing_context"]);
    setPartialReply("");
    setDraft(null);
    setSources([]);
    setConfidence(null);
    setCitations([]);
    setScientificEvidence(undefined);
    setReportProposal(null);
    setClassMemoryProposal(null);
    setMissingData([]);
    setAssumptions([]);
    setAutoFixSuggestions([]);
    setNextClassSuggestion(null);
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
        memoryContext = memoryEntries.map((item: { content: string }) => item.content);
      } catch {
        memoryContext = [];
      }
      setMemoryContextHints(memoryContext);
      const appSnapshot = optionalCopilot?.appSnapshot ?? null;

      const data = await requestAssistantConversation({
        signal: controller.signal,
        onReply: text => {
          if (controller.signal.aborted) return;
          setAssistantProgress(current => appendAssistantProgress(current, "writing_response"));
          setPartialReply(text);
        },
        onStatus: status => {
          if (controller.signal.aborted) return;
          setAssistantProgress(current => appendAssistantProgress(current, status));
        },
        modelPreference,
        accessToken,
        messages: requestMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        classId,
        organizationId: activeOrganization?.id ?? "",
        sport: selectedClass?.modality ?? "volleyball",
        memoryContext,
        appSnapshot,
      }) as AssistantResponse | AssistantErrorPayload;
      if (controller.signal.aborted) return;
      setPartialReply("");
      const payloadError = extractAssistantPayloadError(data);
      const rawReply =
        typeof (data as AssistantResponse).reply === "string" && (data as AssistantResponse).reply.trim()
           ? (data as AssistantResponse).reply
          : "Sem resposta do assistente. Tente novamente.";
      const embeddedReplyError = extractEmbeddedReplyError(rawReply);
      const responseError = payloadError || embeddedReplyError;
      const draftFromReply = looksLikeJsonPayload(rawReply)
        ? parseDraftTrainingFromReply(rawReply)
        : null;
      const nextDraft = responseError
        ? null
        : (data as AssistantResponse).draftTraining
        ? normalizeDraftTraining((data as AssistantResponse).draftTraining!)
        : draftFromReply;
      const nextReportProposal = responseError ? null : (data as AssistantResponse).reportProposal ?? null;
      const nextClassMemoryProposal = responseError ? null : (data as AssistantResponse).classMemoryProposal ?? null;
      const reply = responseError
        ? toFriendlyAssistantError(responseError)
        : nextDraft
        ? "Montei um planejamento para você. Revise os blocos abaixo e ajuste se necessário."
        : resolveStructuredProposalReply({
            rawReply,
            hasReportProposal: Boolean(nextReportProposal),
            hasClassMemoryProposal: Boolean(nextClassMemoryProposal),
          });

      setLoading(false);
      setAssistantProgress([]);
      setPartialReply("");
      showAssistantReply(reply);
      setSources(responseError ? [] : Array.isArray((data as AssistantResponse).sources) ? (data as AssistantResponse).sources : []);
      setConfidence(
        responseError
          ? null
          : Number.isFinite((data as AssistantResponse).confidence)
          ? Math.max(0, Math.min(1, Number((data as AssistantResponse).confidence)))
          : null
      );
      setCitations(responseError ? [] : Array.isArray((data as AssistantResponse).citations) ? ((data as AssistantResponse).citations ?? []) : []);
      setScientificEvidence(responseError ? undefined : (data as AssistantResponse).scientificEvidence);
      setReportProposal(nextReportProposal);
      setClassMemoryProposal(nextClassMemoryProposal);
      setMissingData(responseError ? [] : Array.isArray((data as AssistantResponse).missingData) ? ((data as AssistantResponse).missingData ?? []) : []);
      setAssumptions(responseError ? [] : Array.isArray((data as AssistantResponse).assumptions) ? ((data as AssistantResponse).assumptions ?? []) : []);
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
        void notifyTrainingCreated({ inboxScope: notificationInboxScope });
      }
    } catch (error) {
      const detailRaw =
        error instanceof Error
          ? error.message.replace(/\s+/g, " ").trim().slice(0, 180)
          : "Falha de rede ou deploy da Edge Function.";
      const detail = extractEmbeddedReplyError(detailRaw) ?? detailRaw;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Erro ao consultar o assistente. " + toFriendlyAssistantError(detail),
        },
      ]);
    } finally {
      setLoading(false);
      setPartialReply("");
      setAssistantProgress([]);
    }
  }, [activeOrganization, classId, input, loading, messages, modelPreference, notificationInboxScope, optionalCopilot, selectedClass, session, showAssistantReply]);

  const saveReportProposal = useCallback(() => {
    if (!reportProposal || !activeOrganization?.id || !session?.user?.id || savingReport) return;
    const proposal = reportProposal;
    confirmDialog({
      title: `Salvar relatório da ${proposal.className}?`,
      message: `Data: ${formatIsoDateToPtBr(proposal.sessionDate)}. O conteúdo revisado abaixo será salvo no relatório da turma.`,
      confirmLabel: "Salvar relatório",
      cancelLabel: "Continuar revisando",
      loadingLabel: "Salvando relatório",
      onConfirm: async () => {
        setSavingReport(true);
        try {
          const existing = await getSessionLogByDate(proposal.classId, proposal.sessionDate, {
            organizationId: activeOrganization.id,
          });
          if (existing) {
            setReportProposal(null);
            const formattedDate = formatIsoDateToPtBr(proposal.sessionDate);
            setMessages((previous) => [...previous, {
              role: "assistant",
              content: `O relatório da **${proposal.className}** em ${formattedDate} já existe. Abra para revisar.`,
              reportLink: {
                classId: proposal.classId,
                className: proposal.className,
                sessionDate: proposal.sessionDate,
                leadingText: "O relatório da ",
                trailingText: ` em ${formattedDate} já existe. Abra para revisar.`,
              },
            }]);
            return;
          }
          const createdAt = `${proposal.sessionDate}T12:00:00.000Z`;
          const reportIdentity = buildAssistantReportIdentity({
            organizationId: activeOrganization.id,
            classId: proposal.classId,
            sessionDate: proposal.sessionDate,
          });
          await saveSessionLog({
            id: reportIdentity,
            clientId: reportIdentity,
            classId: proposal.classId,
            PSE: proposal.pse ?? 0,
            technique: proposal.technique ?? "nenhum",
            attendance: proposal.attendance ?? 0,
            activity: proposal.activity,
            conclusion: proposal.conclusion,
            participantsCount: proposal.participantsCount ?? undefined,
            photos: "",
            painScore: proposal.painScore ?? undefined,
            createdAt,
          }, {
            allowQueue: false,
            organizationId: activeOrganization.id,
            origin: { userId: session.user.id, organizationId: activeOrganization.id },
          });
          setReportProposal(null);
          setMessages((previous) => [
            ...previous,
            {
              role: "assistant",
              content: `Relatório da **${proposal.className}** salvo em ${formatIsoDateToPtBr(proposal.sessionDate)}.`,
              reportLink: {
                classId: proposal.classId,
                className: proposal.className,
                sessionDate: proposal.sessionDate,
              },
            },
          ]);
        } catch (error) {
          Alert.alert(
            "Não foi possível salvar",
            error instanceof Error ? error.message : "Revise os dados e tente novamente."
          );
        } finally {
          setSavingReport(false);
        }
      },
    });
  }, [activeOrganization, confirmDialog, reportProposal, savingReport, session]);

  const saveClassMemoryProposal = useCallback(() => {
    if (!classMemoryProposal || !activeOrganization?.id || savingClassMemory) return;
    const proposal = classMemoryProposal;
    confirmDialog({
      title: `Salvar regra da ${proposal.className}?`,
      message: `${proposal.summary}\n\nEla será usada apenas no contexto desta turma e poderá orientar os próximos planejamentos.`,
      confirmLabel: "Salvar regra",
      cancelLabel: "Continuar revisando",
      loadingLabel: "Salvando regra",
      onConfirm: async () => {
        setSavingClassMemory(true);
        try {
          await saveAssistantClassRule({
            organizationId: activeOrganization.id,
            classId: proposal.classId,
            proposalId: proposal.proposalId,
            summary: proposal.summary,
          });
          setClassMemoryProposal(null);
          setMessages((previous) => [...previous, {
            role: "assistant",
            content: `Regra salva para a **${proposal.className}**: ${proposal.summary}`,
          }]);
        } catch (error) {
          Alert.alert("Não foi possível salvar", error instanceof Error ? error.message : "Tente novamente.");
        } finally {
          setSavingClassMemory(false);
        }
      },
    });
  }, [activeOrganization, classMemoryProposal, confirmDialog, savingClassMemory]);

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
      void notifyTrainingSaved({ inboxScope: notificationInboxScope });
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

  const applyDraftToPlanning = useCallback(() => {
    if (!draft) return;
    const encodedDraft = encodeURIComponent(JSON.stringify(draft));
    router.push({
      pathname: scopedPlanningPath,
      params: {
        openForm: "1",
        targetClassId: classId,
        aiDraft: encodedDraft,
      },
    });
  }, [classId, draft, router, scopedPlanningPath]);

  const applyNextClassSuggestion = useCallback(() => {
    if (!nextClassSuggestion) return;
    setInput(nextClassSuggestion.nextTrainingPrompt);
    pushAssistantMessage("Sugestão aplicada no composer. Revise e gere o próximo treino quando estiver pronto.");
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  }, [nextClassSuggestion, pushAssistantMessage]);

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

  const openSavedReport = useCallback((report: AssistantMessageReportLink) => {
    router.push({
      pathname: "/class/[id]/session",
      params: {
        id: report.classId,
        date: report.sessionDate,
        tab: "relatório",
      },
    });
  }, [router]);

  const resolveSavedReportLink = useCallback((content: string): AssistantMessageReportLink | undefined => {
    const match = content.match(/^Relatório da \*\*(.+?)\*\* salvo em (\d{2})\/(\d{2})\/(\d{4})\.$/);
    if (!match) return undefined;
    const className = match[1]?.trim() ?? "";
    const targetClass = classes.find((item) => normalizeClassNameLabel(item.name) === normalizeClassNameLabel(className));
    if (!targetClass) return undefined;
    return {
      classId: targetClass.id,
      className,
      sessionDate: `${match[4]}-${match[3]}-${match[2]}`,
    };
  }, [classes]);

  const visibleMessages = useMemo(() => collapseLatestStructuredProposalReply({
    messages,
    hasReportProposal: Boolean(reportProposal),
    hasClassMemoryProposal: Boolean(classMemoryProposal),
  }), [classMemoryProposal, messages, reportProposal]);

  const messageBubbles = (
    <AssistantMessages
      messages={visibleMessages}
      onOpenReport={openSavedReport}
      resolveReportLink={resolveSavedReportLink}
    />
  );
  const partialReplyBubble = partialReply
    ? <AssistantMessages messages={[{ role: "assistant", content: partialReply }]} />
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: supportsSplitLayout ? 20 : 14,
          paddingTop: 12,
          paddingBottom: 12,
          gap: 12,
          flexDirection: supportsSplitLayout ? "row" : "column",
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
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: supportsSplitLayout ? 4 : 0,
              paddingBottom: 4,
            }}
          >
            <Pressable
              onPress={() => navigateBackOrReplace({ router, fallback: scopedRoutes.home })}
              accessibilityLabel="Voltar"
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <GoAtletaIcon name="chevronBack" size={20} color={colors.text} />
            </Pressable>
          </View>
          <AssistantConversationScroll contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
            {messages.length === 0 ? (
              <View
                style={{
                  width: "100%",
                  maxWidth: supportsSplitLayout ? 980 : undefined,
                  alignSelf: "center",
                  minHeight:
                    Platform.OS === "web"
                      ? Math.max(
                          360,
                          Math.round(height - composerHeight - (supportsSplitLayout ? 180 : 150))
                        )
                      : undefined,
                  justifyContent: "center",
                  paddingHorizontal: supportsSplitLayout ? 20 : 6,
                  paddingVertical: supportsSplitLayout ? 24 : 18,
                  gap: 18,
                }}
              >
                <View style={{ alignItems: "center", gap: 10 }}>
                  <AssistantWelcome
                    heading={greetingLine}
                    compact={isCompactMobile}
                    subtitle={classes.length > 0 ? (
                      <AssistantClassSelector
                        classes={classes}
                        value={classId}
                        onChange={setClassId}
                        normalizeLabel={normalizeClassNameLabel}
                        inlinePrompt
                      />
                    ) : undefined}
                  />
                </View>

                <MemoQuickPromptGrid
                  items={quickPrompts}
                  onSelectPrompt={handleSelectQuickPrompt}
                  supportsSplitLayout={supportsSplitLayout}
                  isCompactMobile={isCompactMobile}
                  mode={mode}
                  borderColor={colors.border}
                  inputBg={colors.inputBg}
                  cardBg={colors.card}
                  secondaryBg={colors.secondaryBg}
                  mutedText={colors.muted}
                  primaryText={colors.text}
                />
              </View>
            ) : null}

            {messageBubbles}

            {loading ? <AssistantProgress steps={assistantProgress} /> : null}

            {partialReplyBubble}

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
                  <View style={{ gap: 8 }}>
                    <Button label="Aplicar ao planejamento" onPress={applyDraftToPlanning} />
                    <Button
                      label="Salvar planejamento"
                      onPress={saveDraft}
                      variant="secondary"
                    />
                  </View>
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
                    onPress={() => router.push({ pathname: scopedPlanningPath })}
                    variant="secondary"
                  />
                </View>
              </View>
            ) : null}

            {reportProposal ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ fontWeight: "700", color: colors.text }}>Relatório sugerido</Text>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>
                      {reportProposal.className} · {formatIsoDateToPtBr(reportProposal.sessionDate)}
                    </Text>
                  </View>
                  <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: colors.secondaryBg }}>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                      {reportProposal.confidence === "high" ? "Alta confiança" : reportProposal.confidence === "medium" ? "Revisar" : "Baixa confiança"}
                    </Text>
                  </View>
                </View>

                {reportProposal.activity ? (
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>Atividade</Text>
                    <Text style={{ color: colors.text }}>{reportProposal.activity}</Text>
                  </View>
                ) : null}
                {reportProposal.conclusion ? (
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>Conclusão</Text>
                    <Text style={{ color: colors.text }}>{reportProposal.conclusion}</Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {reportProposal.participantsCount != null ? (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{reportProposal.participantsCount} participantes</Text>
                  ) : null}
                  {reportProposal.pse != null ? (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>PSE {reportProposal.pse}/10</Text>
                  ) : null}
                  {reportProposal.technique ? (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Técnica: {reportProposal.technique}</Text>
                  ) : null}
                </View>

                {[...reportProposal.warnings, "Nada será salvo sem sua confirmação."].map((warning) => (
                  <Text key={warning} style={{ color: colors.muted, fontSize: 12 }}>• {warning}</Text>
                ))}

                <View style={{ gap: 8 }}>
                  <Button
                    label="Salvar relatório"
                    loading={savingReport}
                    loadingLabel="Salvando relatório"
                    disabled={savingReport}
                    onPress={saveReportProposal}
                  />
                  <Button
                    label="Ignorar sugestão"
                    variant="ghost"
                    disabled={savingReport}
                    onPress={() => setReportProposal(null)}
                  />
                </View>
              </View>
            ) : null}

            {classMemoryProposal ? (
              <View style={{
                padding: 14,
                borderRadius: 18,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 10,
              }}>
                <View style={{ gap: 3 }}>
                  <Text style={{ fontWeight: "700", color: colors.text }}>Regra da turma sugerida</Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{classMemoryProposal.className}</Text>
                </View>
                <Text style={{ color: colors.text }}>{classMemoryProposal.summary}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Será usada somente nesta turma. Nada será salvo sem sua confirmação.
                </Text>
                {classMemoryProposal.warnings.map((warning) => (
                  <Text key={warning} style={{ color: colors.muted, fontSize: 12 }}>• {warning}</Text>
                ))}
                <View style={{ gap: 8 }}>
                  <Button label="Salvar regra da turma" loading={savingClassMemory} loadingLabel="Salvando regra" disabled={savingClassMemory} onPress={saveClassMemoryProposal} />
                  <Button label="Ignorar sugestão" variant="ghost" disabled={savingClassMemory} onPress={() => setClassMemoryProposal(null)} />
                </View>
              </View>
            ) : null}

            <ScientificEvidencePanel
              references={scientificReferences}
              status={scientificEvidence?.status}
              onOpenReference={openReferenceLink}
            />

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
                <View style={{ gap: 10 }}>
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
                    <View style={{ gap: 6 }}>
                      {nextClassSuggestion.alerts.map((item, index) => (
                        <Text key={`radar-alert-${index}`} style={{ color: colors.muted }}>
                          - {item}
                        </Text>
                      ))}
                    </View>
                  </View>
                ) : null}
                <View style={{ gap: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Ações sugeridas</Text>
                  <View style={{ gap: 6 }}>
                    {nextClassSuggestion.actions.map((item, index) => (
                      <Text key={`radar-action-${index}`} style={{ color: colors.muted }}>
                        - {item}
                      </Text>
                    ))}
                  </View>
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
                <View style={{ gap: 6 }}>
                  {simulationResult.points.slice(0, 4).map((point) => (
                    <Text key={`sim-point-${point.week}`} style={{ color: colors.muted }}>
                      - Semana {point.week}: {(point.projectedScore * 100).toFixed(0)}% ({point.focus})
                    </Text>
                  ))}
                </View>
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
                <View style={{ gap: 6 }}>
                  {memoryContextHints.slice(0, 3).map((item, index) => (
                    <Text key={`memory-hint-${index}`} style={{ color: colors.muted }}>
                      - {item}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}
          </AssistantConversationScroll>

          <View
            onLayout={(event) => {
              const next = Math.round(event.nativeEvent.layout.height);
              if (next !== composerHeight) setComposerHeight(next);
            }}
            style={{
              borderRadius: 28,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              paddingHorizontal: 10,
              paddingVertical: 10,
              gap: 8,
              marginTop: 2,
              marginBottom: keyboardHeight,
              paddingBottom: 10 + insets.bottom,
            }}
          >
            <AssistantComposer value={input} onChangeText={setInput} onSend={() => { void sendMessage(); }}
              busy={loading} inputRef={composerInputRef}
              onFocus={() => setComposerFocused(true)} onBlur={() => setComposerFocused(false)}
              onKeyPress={handleComposerKeyPress}
              trailingControl={<AssistantModelSelector value={modelPreference} onChange={setModelPreference} disabled={loading} compact />}
              voiceScope={activeOrganization && activeOrganization.role_level >= 10 ? { organizationId: activeOrganization.id, classId: classId || undefined } : undefined} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
