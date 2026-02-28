import { usePathname, useRouter } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Animated,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "../auth/auth";
import { markRender, measureAsync } from "../observability/perf";
import type { Signal as CopilotSignal } from "../ai/signal-engine";
import {
  listRegulationUpdates,
  markRegulationUpdateRead,
  type RegulationUpdate,
} from "../api/regulation-updates";
import {
  listRegulationRuleSets,
  type RegulationRuleSet,
} from "../api/regulation-rule-sets";
import { addNotification } from "../notificationsInbox";
import { useOrganization } from "../providers/OrganizationProvider";
import {
  getRecommendedSignalActions,
  isValidCopilotSignal,
  sortCopilotSignals,
} from "./signal-utils";
import {
  buildCentralSnapshot,
  countUnreadFromSnapshot,
  hasSnapshotChanged,
  type CentralSnapshot,
} from "./updates-utils";
import {
  buildOperationalContext,
  type OperationalContextResult,
} from "./operational-context";
import { getClasses } from "../db/seed";
import { Pressable } from "../ui/Pressable";
import { ModalSheet } from "../ui/ModalSheet";
import { useAppTheme } from "../ui/app-theme";

type CopilotContextData = {
  screen: string;
  title?: string;
  subtitle?: string;
  activeSignal?: CopilotSignal;
};

type CopilotActionResult = {
  message: string;
  citationsCount?: number;
  confidence?: number;
};

type CopilotAction = {
  id: string;
  title: string;
  description?: string;
  requires?: (ctx: CopilotContextData | null) => string | null;
  run: (ctx: CopilotContextData | null) => Promise<CopilotActionResult | string | void> | CopilotActionResult | string | void;
};

type CopilotHistoryItem = {
  id: string;
  actionTitle: string;
  message: string;
  createdAt: string;
  status: "success" | "error";
  citationsCount?: number;
  confidence?: number;
};

type InsightsCategory =
  | "reports"
  | "absences"
  | "nfc"
  | "attendance"
  | "engagement"
  | "regulation";

type SignalInsightsCategory = Exclude<InsightsCategory, "regulation">;

type InsightsView =
  | { mode: "root" }
  | { mode: "category"; category: InsightsCategory }
  | { mode: "detail"; category: InsightsCategory; itemId: string };

type CopilotState = {
  context: CopilotContextData | null;
  actions: CopilotAction[];
  signals: CopilotSignal[];
  regulationUpdates: RegulationUpdate[];
  regulationRuleSets: RegulationRuleSet[];
  selectedSignalId: string | null;
  open: boolean;
  runningActionId: string | null;
  history: CopilotHistoryItem[];
  hasUnreadUpdates: boolean;
  unreadCount: number;
};

type CopilotDataContextValue = {
  state: CopilotState;
  operationalContext: OperationalContextResult;
};

type CopilotActionsContextValue = {
  setContext: (ownerId: string, context: CopilotContextData | null) => void;
  clearContext: (ownerId: string) => void;
  setActions: (ownerId: string, actions: CopilotAction[]) => void;
  clearActions: (ownerId: string) => void;
  setSignals: (ownerId: string, signals: CopilotSignal[]) => void;
  clearSignals: (ownerId: string) => void;
  setActiveSignal: (signalId: string | null) => void;
  open: () => void;
  close: () => void;
  runAction: (action: CopilotAction) => Promise<void>;
};

const CopilotDataContext = createContext<CopilotDataContextValue | null>(null);
const CopilotActionsContext = createContext<CopilotActionsContextValue | null>(null);

const MAX_HISTORY_ITEMS = 12;
const REGULATION_POLL_INTERVAL_MS = 90_000;
const REGULATION_NOTIFIED_STORAGE_PREFIX = "reg_updates_notified_v1";
const CONTEXT_COMPOSER_MIN_HEIGHT = 40;
const CONTEXT_COMPOSER_MAX_HEIGHT = 120;
const CONTEXT_COMPOSER_MAX_HEIGHT_WEB = 84;

const publicRoutes = new Set(["/welcome", "/login", "/signup", "/reset-password"]);

const categoryLabelById: Record<InsightsCategory, string> = {
  reports: "Relatórios",
  absences: "Faltas consecutivas",
  nfc: "Presença NFC",
  attendance: "Queda de presença",
  engagement: "Risco de engajamento",
  regulation: "Regulamento atualizado",
};

const signalToCategory = (signalType: CopilotSignal["type"]): InsightsCategory => {
  switch (signalType) {
    case "report_delay":
      return "reports";
    case "repeated_absence":
      return "absences";
    case "unusual_presence_pattern":
      return "nfc";
    case "attendance_drop":
      return "attendance";
    case "engagement_risk":
      return "engagement";
  }
};

const buildRegulationNotificationKey = (userId: string, organizationId: string) =>
  `${REGULATION_NOTIFIED_STORAGE_PREFIX}:${userId}:${organizationId}`;

const normalizeNotificationIds = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const item of value) {
    const id = String(item ? "").trim();
    if (id) unique.add(id);
  }
  return Array.from(unique);
};

const regulationDateLabel = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Date(parsed).toLocaleDateString("pt-BR");
};

const regulationRelativeLabel = (value: string | null | undefined, nowMs: number) => {
  if (!value) return "sem data";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "sem data";
  const diffHours = Math.max(0, (nowMs - parsed) / 36e5);
  if (diffHours < 1) return "agora";
  if (diffHours < 24) return `h? ${Math.floor(diffHours)}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `h? ${diffDays}d`;
  return regulationDateLabel(value);
};

const toActionResult = (value: CopilotActionResult | string | void): CopilotActionResult => {
  if (!value) return { message: "A??o conclu?da." };
  if (typeof value === "string") return { message: value };
  return value;
};

const extractEmbeddedErrorMessage = (value: string) => {
  const normalized = String(value ? "").trim();
  if (!normalized.startsWith("{") || !normalized.endsWith("}")) return "";
  try {
    const payload = JSON.parse(normalized) as { error?: string; message?: string };
    const message =
      (typeof payload.error === "string" && payload.error.trim()) ||
      (typeof payload.message === "string" && payload.message.trim()) ||
      "";
    return message;
  } catch {
    return "";
  }
};

const toFriendlyContextError = (value: string | null | undefined) => {
  const raw = String(value ? "").trim();
  if (!raw) return "Falha ao executar a a??o.";
  const normalized = raw.toLowerCase();
  if (normalized.includes("entrada invalida") || normalized.includes("invalid input")) {
    return "N?o consegui interpretar essa solicita??o no contexto atual.";
  }
  if (normalized.includes("timeout")) {
    return "A resposta demorou mais que o esperado. Tente novamente.";
  }
  if (normalized.includes("failed to fetch") || normalized.includes("network request failed")) {
    return "Falha de conex?o. Verifique sua internet e tente novamente.";
  }
  if (normalized.includes("token") || normalized.includes("auth")) {
    return "Sess?o expirada. Fa?a login novamente.";
  }
  return "Falha ao executar a a??o.";
};

const buildHistoryItem = (params: {
  actionTitle: string;
  result: CopilotActionResult;
  status: "success" | "error";
}): CopilotHistoryItem => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  actionTitle: params.actionTitle,
  message: params.result.message,
  createdAt: new Date().toISOString(),
  status: params.status,
  citationsCount: params.result.citationsCount,
  confidence: params.result.confidence,
});

const resolveContextActionIcon = (action: CopilotAction): keyof typeof Ionicons.glyphMap => {
  const key = normalizeComposerText(`${action.id} ${action.title}`);
  if (key.includes("treino")) return "sparkles-outline";
  if (key.includes("resumo")) return "document-text-outline";
  if (key.includes("engaj") || key.includes("risco")) return "pulse-outline";
  if (key.includes("pesquisa") || key.includes("cient")) return "search-outline";
  if (key.includes("mensagem") || key.includes("whatsapp")) return "chatbubble-outline";
  if (key.includes("checklist")) return "checkmark-done-outline";
  if (key.includes("regul")) return "shield-checkmark-outline";
  if (key.includes("duplic")) return "copy-outline";
  if (key.includes("nfc") || key.includes("presenca")) return "radio-outline";
  return "flash-outline";
};

const normalizeComposerText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const hasAnyKeyword = (input: string, keywords: string[]) =>
  keywords.some((keyword) => input.includes(keyword));

const buildContextualComposerReply = (params: {
  prompt: string;
  screen: string | null | undefined;
  panel: OperationalContextResult["panel"];
  actions: CopilotAction[];
}) => {
  const normalizedPrompt = normalizeComposerText(params.prompt);
  if (!normalizedPrompt) return null;

  const globalIntentKeywords = [
    "todas as turmas",
    "organizacao inteira",
    "organizacao geral",
    "fora dessa tela",
    "fora desta tela",
    "assistente geral",
    "chat geral",
    "pesquisa cientifica",
    "artigo cientifico",
    "benchmark",
  ];
  if (hasAnyKeyword(normalizedPrompt, globalIntentKeywords)) return null;

  const screen = String(params.screen ? "").toLowerCase();
  const screenKeywordsByPrefix: Record<string, string[]> = {
    nfc: ["nfc", "tag", "duplicad", "presenca", "checkin", "sincron"],
    class: ["turma", "aluno", "falta", "engajamento", "presenca", "relatorio"],
    classes: ["turma", "aluno", "falta", "engajamento", "presenca", "relatorio"],
    coordination: ["coordenacao", "relatorio", "pendencia", "engajamento", "organizacao"],
    events: ["torneio", "regulamento", "chaveamento", "evento", "regras"],
    periodization: ["periodizacao", "microciclo", "treino", "carga"],
  };
  const matchingScreenKey =
    Object.keys(screenKeywordsByPrefix).find((key) => screen.startsWith(key)) ? null;
  const screenKeywords = matchingScreenKey ? screenKeywordsByPrefix[matchingScreenKey] : [];
  const genericContextKeywords = ["aqui", "dessa tela", "desta tela", "neste contexto", "agora", "pendencia", "alerta"];

  const hasContextHint =
    hasAnyKeyword(normalizedPrompt, screenKeywords) ||
    hasAnyKeyword(normalizedPrompt, genericContextKeywords);

  if (!hasContextHint) return null;

  const attentionSignals = params.panel.attentionSignals.slice(0, 2);
  const quickActions = params.actions.slice(0, 3).map((item) => item.title);
  const hasAlerts = attentionSignals.length > 0;
  const topAlerts = attentionSignals.map((item) => item.title).join(" | ");
  const contextNameByScreen: Record<string, string> = {
    nfc: "NFC",
    class: "turma atual",
    classes: "lista de turmas",
    coordination: "coordenacao",
    events: "eventos e torneios",
    periodization: "periodizacao",
  };
  const contextName = matchingScreenKey ? contextNameByScreen[matchingScreenKey] : "tela atual";

  const wantsSummary = hasAnyKeyword(normalizedPrompt, [
    "resumo",
    "status",
    "situacao",
    "como ta",
    "como esta",
  ]);
  const wantsActions = hasAnyKeyword(normalizedPrompt, [
    "proxima",
    "proximas",
    "passos",
    "acao",
    "acoes",
    "o que fazer",
  ]);
  const wantsDuplicates = hasAnyKeyword(normalizedPrompt, [
    "duplicad",
    "duplo",
    "repetid",
  ]);
  const wantsRegulation = hasAnyKeyword(normalizedPrompt, [
    "regra",
    "regras",
    "regulamento",
    "vigencia",
    "vigencia",
    "pendente",
    "pending",
  ]);

  if (matchingScreenKey === "nfc" && wantsDuplicates) {
    const duplicateSignal = attentionSignals.find((item) =>
      normalizeComposerText(`${item.title} ${item.summary}`).includes("duplicad")
    );
    if (!duplicateSignal) {
      return "No NFC atual, nao encontrei padrao forte de duplicidade.";
    }
    return `No NFC atual, duplicidades em foco: ${duplicateSignal.summary}`;
  }

  if (matchingScreenKey === "events" && wantsRegulation) {
    let message = `Regulamento ativo: ${params.panel.activeRuleSetLabel}.`;
    if (params.panel.pendingRuleSetLabel) {
      message += ` Proximo ciclo: ${params.panel.pendingRuleSetLabel}.`;
    }
    if (params.panel.unreadRegulationCount > 0) {
      message += ` Ha ${params.panel.unreadRegulationCount} atualizacao(oes) pendente(s).`;
    }
    return message;
  }

  if (wantsActions) {
    if (!quickActions.length) {
      return `Neste contexto (${contextName}), nao ha acoes recomendadas agora.`;
    }
    return `Proximos passos para ${contextName}: ${quickActions.join(", ")}.`;
  }

  if (!hasAlerts) {
    let message = `Tudo em ordem em ${contextName}.`;
    if (params.panel.unreadRegulationCount > 0) {
      message += ` Ha ${params.panel.unreadRegulationCount} atualizacao(oes) de regulamento pendente(s).`;
    }
    if (quickActions.length) {
      message += ` Se quiser, sigo com: ${quickActions.join(", ")}.`;
    }
    return message;
  }

  if (wantsSummary || hasAnyKeyword(normalizedPrompt, ["alerta", "pendencia", "pendencias"])) {
    return `Resumo de ${contextName}: ${topAlerts}.`;
  }

  let message = `Ponto principal em ${contextName}: ${topAlerts}.`;
  if (quickActions.length) {
    message += ` Posso executar: ${quickActions.join(", ")}.`;
  }
  return message;
};

const buildDefaultContextReply = (params: {
  screen: string | null | undefined;
  panel: OperationalContextResult["panel"];
  actions: CopilotAction[];
}) => {
  const screen = String(params.screen ? "").toLowerCase();
  const contextNameByScreen: Record<string, string> = {
    nfc: "NFC",
    class: "turma atual",
    classes: "lista de turmas",
    coordination: "coordenacao",
    events: "eventos e torneios",
    periodization: "periodizacao",
  };
  const matchingScreenKey =
    Object.keys(contextNameByScreen).find((key) => screen.startsWith(key)) ? null;
  const contextName = matchingScreenKey ? contextNameByScreen[matchingScreenKey] : "tela atual";
  const quickActions = params.actions.slice(0, 3).map((item) => item.title);
  const attentionSignals = params.panel.attentionSignals.slice(0, 2);

  if (attentionSignals.length) {
    let message = `Atencao em ${contextName}: ${attentionSignals.map((item) => item.title).join(" | ")}.`;
    if (quickActions.length) {
      message += ` Posso seguir com: ${quickActions.join(", ")}.`;
    }
    return message;
  }

  let message = `Tudo em ordem em ${contextName}.`;
  if (params.panel.unreadRegulationCount > 0) {
    message += ` Ha ${params.panel.unreadRegulationCount} atualizacao(oes) de regulamento pendente(s).`;
  }
  if (quickActions.length) {
    message += ` Se quiser, posso te ajudar com: ${quickActions.join(", ")}.`;
  }
  return message;
};

const buildNfcQuickActionReply = (actionId: string, state: CopilotState) => {
  const screen = String(state.context?.screen ? "").toLowerCase();
  if (!screen.startsWith("nfc")) return null;

  const nfcSignals = state.signals.filter((item) => item.type === "unusual_presence_pattern");
  const repeatedAbsenceSignals = state.signals.filter((item) => item.type === "repeated_absence");

  if (actionId === "nfc_summary") {
    if (!nfcSignals.length && !repeatedAbsenceSignals.length) {
      return "No contexto NFC atual, n?o h? alerta urgente.";
    }
    return `No contexto NFC atual: ${nfcSignals.length} alerta(s) de presen?a incomum e ${repeatedAbsenceSignals.length} alerta(s) de aus?ncia recorrente.`;
  }

  if (actionId === "nfc_actions") {
    if (nfcSignals.length > 0) {
      return "Pr?ximos passos: revisar tags com leitura duplicada, validar v?nculo da turma ativa e sincronizar pend?ncias.";
    }
    return "Pr?ximos passos: manter leitura ativa, revisar v?nculos de tag e confirmar sincroniza??o ao final da sess?o.";
  }

  if (actionId === "nfc_duplicates") {
    if (nfcSignals.length > 0) {
      return `Duplicidades em foco: ${nfcSignals[0].summary}`;
    }
    return "Sem padr?o forte de duplicidade no contexto NFC atual.";
  }

  return null;
};

const buildContextSignature = (input: CopilotContextData | null) => {
  if (!input) return "__none__";
  const signal = input.activeSignal;
  return JSON.stringify({
    screen: input.screen ? "",
    title: input.title ? "",
    subtitle: input.subtitle ? "",
    activeSignal: signal
      ? {
          id: signal.id,
          type: signal.type,
          severity: signal.severity,
          classId: signal.classId ? null,
          studentId: signal.studentId ? null,
          detectedAt: signal.detectedAt,
          title: signal.title,
          summary: signal.summary,
        }
      : null,
  });
};

const buildSignalsSignature = (signals: CopilotSignal[]) =>
  [...(signals ? [])]
    .filter(isValidCopilotSignal)
    .map((signal) => `${signal.id}:${signal.severity}:${signal.detectedAt}`)
    .sort((left, right) => left.localeCompare(right))
    .join("|");

type ScheduleWindow = {
  daysOfWeek: number[];
  startTime: string | null;
  durationMinutes: number | null;
};

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const pathname = usePathname();
  const { session } = useAuth();
  const { activeOrganizationId } = useOrganization();
  const insets = useSafeAreaInsets();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();

  const contextRegistryRef = useRef<Map<string, CopilotContextData | null>>(new Map());
  const actionsRegistryRef = useRef<Map<string, CopilotAction[]>>(new Map());
  const signalsRegistryRef = useRef<Map<string, CopilotSignal[]>>(new Map());
  const activeOwnerRef = useRef<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const lastSeenSnapshotRef = useRef<CentralSnapshot | null>(null);
  const lastComputedSnapshotRef = useRef<CentralSnapshot | null>(null);
  const currentSnapshotRef = useRef<CentralSnapshot | null>(null);
  const notifiedUpdatesCacheKeyRef = useRef<string | null>(null);
  const notifiedUpdateIdsRef = useRef<Set<string>>(new Set());

  const [state, setState] = useState<CopilotState>({
    context: null,
    actions: [],
    signals: [],
    regulationUpdates: [],
    regulationRuleSets: [],
    selectedSignalId: null,
    open: false,
    runningActionId: null,
    history: [],
    hasUnreadUpdates: false,
    unreadCount: 0,
  });
  const [insightsView, setInsightsView] = useState<InsightsView>({ mode: "root" });
  const [composerValue, setComposerValue] = useState("");
  const [composerInputHeight, setComposerInputHeight] = useState(CONTEXT_COMPOSER_MIN_HEIGHT);
  const [showAllRootActions, setShowAllRootActions] = useState(false);
  const [scheduleWindows, setScheduleWindows] = useState<ScheduleWindow[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [contextPreview, setContextPreview] = useState<{ actionTitle: string; message: string } | null>(null);
  const stateRef = useRef(state);
  const thinkingPulse = useRef(new Animated.Value(0)).current;
  const pendingReplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  markRender("screen.copilot.render.provider", { open: state.open ? 1 : 0 });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setContext = useCallback((ownerId: string, context: CopilotContextData | null) => {
    contextRegistryRef.current.set(ownerId, context);
    activeOwnerRef.current = ownerId;
    setState((prev) => ({ ...prev, context }));
  }, []);

  const clearContext = useCallback((ownerId: string) => {
    contextRegistryRef.current.delete(ownerId);
    const activeOwner = activeOwnerRef.current;
    if (activeOwner === ownerId) {
      const nextContext = contextRegistryRef.current.size
        ? Array.from(contextRegistryRef.current.values())[contextRegistryRef.current.size - 1] ? null
        : null;
      setState((prev) => ({ ...prev, context: nextContext }));
    }
  }, []);

  const setActions = useCallback((ownerId: string, actions: CopilotAction[]) => {
    actionsRegistryRef.current.set(ownerId, actions);
    activeOwnerRef.current = ownerId;
    setState((prev) => ({ ...prev, actions }));
  }, []);

  const clearActions = useCallback((ownerId: string) => {
    actionsRegistryRef.current.delete(ownerId);
    const activeOwner = activeOwnerRef.current;
    if (activeOwner === ownerId) {
      const nextActions = actionsRegistryRef.current.size
        ? Array.from(actionsRegistryRef.current.values())[actionsRegistryRef.current.size - 1] ? []
        : [];
      setState((prev) => ({ ...prev, actions: nextActions }));
    }
  }, []);

  const setSignals = useCallback((ownerId: string, signals: CopilotSignal[]) => {
    const sortedSignals = sortCopilotSignals((signals ? []).filter(isValidCopilotSignal));
    signalsRegistryRef.current.set(ownerId, sortedSignals);
    activeOwnerRef.current = ownerId;
    setState((prev) => {
      const selectedStillExists = prev.selectedSignalId
        ? sortedSignals.some((item) => item.id === prev.selectedSignalId)
        : false;
      return {
        ...prev,
        signals: sortedSignals,
        selectedSignalId: selectedStillExists
          ? prev.selectedSignalId
          : sortedSignals[0]?.id ? null,
      };
    });
  }, []);

  const clearSignals = useCallback((ownerId: string) => {
    signalsRegistryRef.current.delete(ownerId);
    const activeOwner = activeOwnerRef.current;
    if (activeOwner === ownerId) {
      const nextSignals = signalsRegistryRef.current.size
        ? Array.from(signalsRegistryRef.current.values())[signalsRegistryRef.current.size - 1] ? []
        : [];
      setState((prev) => ({
        ...prev,
        signals: nextSignals,
        selectedSignalId: nextSignals[0]?.id ? null,
      }));
    }
  }, []);

  const setActiveSignal = useCallback((signalId: string | null) => {
    setState((prev) => {
      if (!signalId) return { ...prev, selectedSignalId: null };
      const exists = prev.signals.some((item) => item.id === signalId);
      return { ...prev, selectedSignalId: exists ? signalId : prev.selectedSignalId };
    });
  }, []);

  const loadNotifiedRegulationIds = useCallback(async () => {
    const userId = session?.user?.id ? "";
    const organizationId = activeOrganizationId ? "";
    if (!userId || !organizationId) {
      notifiedUpdatesCacheKeyRef.current = null;
      notifiedUpdateIdsRef.current = new Set();
      return new Set<string>();
    }

    const storageKey = buildRegulationNotificationKey(userId, organizationId);
    if (notifiedUpdatesCacheKeyRef.current === storageKey) {
      return new Set(notifiedUpdateIdsRef.current);
    }

    let loadedIds: string[] = [];
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) {
        loadedIds = normalizeNotificationIds(JSON.parse(raw));
      }
    } catch {
      loadedIds = [];
    }

    notifiedUpdatesCacheKeyRef.current = storageKey;
    notifiedUpdateIdsRef.current = new Set(loadedIds);
    return new Set(notifiedUpdateIdsRef.current);
  }, [activeOrganizationId, session?.user?.id]);

  const persistNotifiedRegulationIds = useCallback(async (nextIds: Set<string>) => {
    const storageKey = notifiedUpdatesCacheKeyRef.current;
    if (!storageKey) return;
    const serialized = Array.from(nextIds).slice(-300);
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(serialized));
    } catch {
      // Non-blocking cache write.
    }
  }, []);

  const loadRegulationUpdates = useCallback(async () => {
    const organizationId = activeOrganizationId ? "";
    if (!organizationId) {
      setState((prev) => ({ ...prev, regulationUpdates: [], regulationRuleSets: [] }));
      return;
    }

    try {
      const [updatesResult, ruleSets] = await measureAsync(
        "screen.copilot.load.regulation",
        () =>
          Promise.all([
            listRegulationUpdates({
              organizationId,
              unreadOnly: false,
              limit: 25,
            }),
            listRegulationRuleSets({
              organizationId,
              sport: "volleyball",
              limit: 30,
            }),
          ]),
        { screen: "copilot", organizationId }
      );
      const updates = updatesResult.items;
      setState((prev) => ({
        ...prev,
        regulationUpdates: updates,
        regulationRuleSets: ruleSets,
      }));

      const unreadUpdates = updates.filter((item) => !item.isRead);
      if (!unreadUpdates.length) return;

      const knownIds = await loadNotifiedRegulationIds();
      const freshUpdates = unreadUpdates.filter((item) => !knownIds.has(item.id));
      if (!freshUpdates.length) return;

      for (const update of freshUpdates.slice(0, 3)) {
        const topicsPreview = update.changedTopics.slice(0, 2).join(", ");
        const impactPreview = update.impactAreas.slice(0, 2).join(", ");
        const body = topicsPreview
          ? `Mudan?as em: ${topicsPreview}.${impactPreview ? ` Impacto: ${impactPreview}.` : ""}`
          : update.diffSummary;
        await addNotification("Regulamento atualizado", body);
      }

      const mergedIds = new Set([...knownIds, ...freshUpdates.map((item) => item.id)]);
      notifiedUpdateIdsRef.current = mergedIds;
      await persistNotifiedRegulationIds(mergedIds);
    } catch {
      setState((prev) => ({ ...prev, regulationUpdates: [], regulationRuleSets: [] }));
    }
  }, [activeOrganizationId, loadNotifiedRegulationIds, persistNotifiedRegulationIds]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const organizationId = activeOrganizationId ? "";
      if (!organizationId) {
        if (!cancelled) setScheduleWindows([]);
        return;
      }
      try {
        const classes = await measureAsync(
          "screen.copilot.load.scheduleWindows",
          () => getClasses({ organizationId }),
          { screen: "copilot", organizationId }
        );
        if (cancelled) return;
        setScheduleWindows(
          classes.map((item) => ({
            daysOfWeek: Array.isArray(item.daysOfWeek) ? item.daysOfWeek : [],
            startTime: item.startTime ? null,
            durationMinutes: Number.isFinite(item.durationMinutes)
              ? Number(item.durationMinutes)
              : null,
          }))
        );
      } catch {
        if (!cancelled) setScheduleWindows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeOrganizationId]);

  useEffect(() => {
    if (!assistantTyping) {
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
  }, [assistantTyping, thinkingPulse]);

  const clearPendingReplyTimer = useCallback(() => {
    if (!pendingReplyTimerRef.current) return;
    clearTimeout(pendingReplyTimerRef.current);
    pendingReplyTimerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearPendingReplyTimer();
    };
  }, [clearPendingReplyTimer]);

  const enqueueContextReply = useCallback(
    (
      actionTitle: string,
      result: CopilotActionResult,
      status: "success" | "error"
    ) => {
      clearPendingReplyTimer();
      setAssistantTyping(true);
      pendingReplyTimerRef.current = setTimeout(() => {
        pendingReplyTimerRef.current = null;
        setContextPreview({
          actionTitle,
          message: result.message,
        });
        setState((prev) => ({
          ...prev,
          history: [buildHistoryItem({ actionTitle, result, status }), ...prev.history].slice(
            0,
            MAX_HISTORY_ITEMS
          ),
        }));
        setAssistantTyping(false);
      }, 620);
    },
    [clearPendingReplyTimer]
  );

  const selectedSignal =
    state.signals.find((item) => item.id === state.selectedSignalId) ? null;
  const operationalContext = useMemo(
    () =>
      buildOperationalContext({
        screen: state.context?.screen ? null,
        contextTitle: state.context?.title ? null,
        contextSubtitle: state.context?.subtitle ? null,
        signals: state.signals,
        selectedSignalId: state.selectedSignalId,
        regulationUpdates: state.regulationUpdates,
        regulationRuleSets: state.regulationRuleSets,
        history: state.history.map((item) => ({
          actionTitle: item.actionTitle,
          status: item.status,
          createdAt: item.createdAt,
        })),
        scheduleWindows,
        nowMs,
      }),
    [
      nowMs,
      scheduleWindows,
      state.context?.screen,
      state.context?.subtitle,
      state.context?.title,
      state.history,
      state.regulationRuleSets,
      state.regulationUpdates,
      state.selectedSignalId,
      state.signals,
    ]
  );

  const currentSnapshot = useMemo(() => {
    return buildCentralSnapshot({
      screenKey: state.context?.screen ? "__none__",
      snapshotHash: operationalContext.snapshot.snapshotHash,
      signals: state.signals,
      ruleUpdates: state.regulationUpdates.map((item) => ({
        id: item.id,
        publishedAt: item.publishedAt ? null,
        createdAt: item.createdAt,
        checksum: item.checksumSha256,
      })),
      actions: state.actions,
      historyHead: state.history[0]
        ? { id: state.history[0].id, createdAt: state.history[0].createdAt }
        : null,
    });
  }, [
    operationalContext.snapshot.snapshotHash,
    state.actions,
    state.context?.screen,
    state.history,
    state.regulationUpdates,
    state.signals,
  ]);

  useEffect(() => {
    currentSnapshotRef.current = currentSnapshot;
  }, [currentSnapshot]);

  const open = useCallback(() => {
    const latestSnapshot =
      lastComputedSnapshotRef.current ?
      currentSnapshotRef.current;
    if (latestSnapshot) {
      lastSeenSnapshotRef.current = latestSnapshot;
    }
    clearPendingReplyTimer();
    setAssistantTyping(false);
    setContextPreview({
      actionTitle: "",
      message: buildDefaultContextReply({
        screen: state.context?.screen ? null,
        panel: operationalContext.panel,
        actions: state.actions,
      }),
    });
    setInsightsView({ mode: "root" });
    setShowAllRootActions(false);
    setState((prev) => ({
      ...prev,
      open: true,
      hasUnreadUpdates: false,
      unreadCount: 0,
    }));
  }, [clearPendingReplyTimer, operationalContext.panel, state.actions, state.context?.screen]);

  const close = useCallback(() => {
    clearPendingReplyTimer();
    setAssistantTyping(false);
    setState((prev) => ({ ...prev, open: false }));
  }, [clearPendingReplyTimer]);

  useEffect(() => {
    const previousSnapshot = lastComputedSnapshotRef.current;
    const changed = hasSnapshotChanged(previousSnapshot, currentSnapshot);
    lastComputedSnapshotRef.current = currentSnapshot;

    if (state.open) {
      lastSeenSnapshotRef.current = currentSnapshot;
      if (state.hasUnreadUpdates || state.unreadCount > 0) {
        setState((prev) => ({
          ...prev,
          hasUnreadUpdates: false,
          unreadCount: 0,
        }));
      }
      return;
    }

    if (!changed) return;
    const unread = countUnreadFromSnapshot(lastSeenSnapshotRef.current, currentSnapshot);
    if (unread <= 0) return;

    setState((prev) => {
      if (prev.open) return prev;
      if (prev.hasUnreadUpdates && prev.unreadCount === unread) return prev;
      return {
        ...prev,
        hasUnreadUpdates: true,
        unreadCount: unread,
      };
    });
  }, [currentSnapshot, state.hasUnreadUpdates, state.open, state.unreadCount]);

  useEffect(() => {
    void loadRegulationUpdates();
  }, [loadRegulationUpdates]);

  useEffect(() => {
    if (!state.open) return;
    void loadRegulationUpdates();
    const timer = setInterval(() => {
      void loadRegulationUpdates();
    }, REGULATION_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadRegulationUpdates, state.open]);

  const runAction = useCallback(async (action: CopilotAction) => {
    const currentState = stateRef.current;
    const selectedSignal =
      currentState.signals.find((item) => item.id === currentState.selectedSignalId) ? null;
    const actionContext: CopilotContextData | null = selectedSignal
      ? {
          ...(currentState.context ? { screen: "assistant" }),
          activeSignal: selectedSignal,
        }
      : currentState.context ? null;

    const requirementError = action.requires?.(actionContext);
    if (requirementError) {
      enqueueContextReply(action.title, { message: requirementError }, "error");
      return;
    }

    const nfcQuickReply = buildNfcQuickActionReply(action.id, currentState);
    if (nfcQuickReply) {
      enqueueContextReply(action.title, { message: nfcQuickReply }, "success");
      return;
    }

    setAssistantTyping(true);
    setState((prev) => ({ ...prev, runningActionId: action.id }));
    try {
      const output = await action.run(actionContext);
      const normalized = toActionResult(output);
      setState((prev) => ({ ...prev, runningActionId: null }));
      enqueueContextReply(action.title, normalized, "success");
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "";
      const embeddedMessage = extractEmbeddedErrorMessage(rawMessage);
      const result: CopilotActionResult = {
        message: toFriendlyContextError(embeddedMessage || rawMessage || "Falha ao executar a a??o."),
      };
      setState((prev) => ({ ...prev, runningActionId: null }));
      enqueueContextReply(action.title, result, "error");
    }
  }, [enqueueContextReply]);

  const dataValue = useMemo<CopilotDataContextValue>(
    () => ({
      state,
      operationalContext,
    }),
    [operationalContext, state]
  );

  const actionsValue = useMemo<CopilotActionsContextValue>(
    () => ({
      setContext,
      clearContext,
      setActions,
      clearActions,
      setSignals,
      clearSignals,
      setActiveSignal,
      open,
      close,
      runAction,
    }),
    [
      clearActions,
      clearContext,
      clearSignals,
      close,
      open,
      runAction,
      setActions,
      setActiveSignal,
      setContext,
      setSignals,
    ]
  );

  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const signalsByCategory = useMemo<Record<SignalInsightsCategory, CopilotSignal[]>>(
    () => ({
      reports: state.signals.filter((item) => signalToCategory(item.type) === "reports"),
      absences: state.signals.filter((item) => signalToCategory(item.type) === "absences"),
      nfc: state.signals.filter((item) => signalToCategory(item.type) === "nfc"),
      attendance: state.signals.filter((item) => signalToCategory(item.type) === "attendance"),
      engagement: state.signals.filter((item) => signalToCategory(item.type) === "engagement"),
    }),
    [state.signals]
  );
  const unreadRegulationCount = useMemo(
    () => state.regulationUpdates.filter((item) => !item.isRead).length,
    [state.regulationUpdates]
  );
  const hasRuleSetContext = Boolean(
    operationalContext.snapshot.regulationContext.activeRuleSetId ||
      operationalContext.snapshot.regulationContext.pendingRuleSetId
  );
  const showRegulationSection =
    normalizedPath.startsWith("/events") || unreadRegulationCount > 0 || hasRuleSetContext;
  const latestRegulationUpdate = useMemo(() => {
    return [...state.regulationUpdates]
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0] ? null;
  }, [state.regulationUpdates]);
  const detailSignal = useMemo(() => {
    if (insightsView.mode !== "detail") return null;
    if (insightsView.category === "regulation") return null;
    return state.signals.find((item) => item.id === insightsView.itemId) ? null;
  }, [insightsView, state.signals]);
  const detailRegulationUpdate = useMemo(() => {
    if (insightsView.mode !== "detail") return null;
    if (insightsView.category !== "regulation") return null;
    return state.regulationUpdates.find((item) => item.id === insightsView.itemId) ? null;
  }, [insightsView, state.regulationUpdates]);
  const activeDrawerSignal =
    insightsView.mode === "detail" && insightsView.category === "regulation"
      ? null
      : detailSignal ? selectedSignal;
  const activeCategoryForActions =
    insightsView.mode === "category" || insightsView.mode === "detail"
      ? insightsView.category === "regulation"
        ? null
        : insightsView.category
      : activeDrawerSignal
        ? signalToCategory(activeDrawerSignal.type)
        : null;

  useEffect(() => {
    if (insightsView.mode === "root") return;
    if (insightsView.mode === "category") {
      if (insightsView.category === "regulation") {
        if (!unreadRegulationCount) {
          setInsightsView({ mode: "root" });
        }
        return;
      }
      if (!signalsByCategory[insightsView.category as SignalInsightsCategory].length) {
        setInsightsView({ mode: "root" });
      }
      return;
    }
    if (insightsView.category === "regulation") {
      if (detailRegulationUpdate) return;
      if (unreadRegulationCount) {
        setInsightsView({ mode: "category", category: "regulation" });
      } else {
        setInsightsView({ mode: "root" });
      }
      return;
    }
    if (!detailSignal) {
      if (signalsByCategory[insightsView.category as SignalInsightsCategory].length) {
        setInsightsView({ mode: "category", category: insightsView.category });
      } else {
        setInsightsView({ mode: "root" });
      }
    }
  }, [detailRegulationUpdate, detailSignal, insightsView, signalsByCategory, unreadRegulationCount]);

  useEffect(() => {
    if (insightsView.mode !== "detail" || insightsView.category !== "regulation") return;
    if (!detailRegulationUpdate || detailRegulationUpdate.isRead) return;
    if (!activeOrganizationId) return;

    let cancelled = false;
    void (async () => {
      try {
        await markRegulationUpdateRead({
          organizationId: activeOrganizationId,
          ruleUpdateId: detailRegulationUpdate.id,
        });
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          regulationUpdates: prev.regulationUpdates.map((item) =>
            item.id === detailRegulationUpdate.id
              ? { ...item, isRead: true, readAt: new Date().toISOString() }
              : item
          ),
        }));
      } catch {
        // Non-blocking failure.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeOrganizationId, detailRegulationUpdate, insightsView]);

  const recommendedActions = useMemo(() => {
    return getRecommendedSignalActions(activeDrawerSignal, state.actions);
  }, [activeDrawerSignal, state.actions]);
  const recommendedActionIds = useMemo(() => {
    return new Set(recommendedActions.map((item) => item.id));
  }, [recommendedActions]);
  const orderedActions = useMemo(() => {
    if (!recommendedActions.length) return state.actions;
    const remainingActions = state.actions.filter((item) => !recommendedActionIds.has(item.id));
    return [...recommendedActions, ...remainingActions];
  }, [recommendedActionIds, recommendedActions, state.actions]);
  const rootQuickActions = useMemo(
    () => (showAllRootActions ? state.actions : state.actions.slice(0, 4)),
    [showAllRootActions, state.actions]
  );
  const canExpandRootActions = state.actions.length > 4 && !showAllRootActions;
  const hasRegulationDetails =
    showRegulationSection &&
    (hasRuleSetContext ||
      unreadRegulationCount > 0 ||
      operationalContext.panel.topImpactAreas.length > 0);
  const latestRegulationSourceUrl = latestRegulationUpdate?.sourceUrl ? "";
  const selectedSeverityColor =
    activeDrawerSignal?.severity === "critical"
      ? colors.dangerText
      : activeDrawerSignal?.severity === "high"
        ? colors.warningText
        : activeDrawerSignal?.severity === "medium"
          ? colors.text
          : colors.muted;
  const selectedSeverityLabel =
    activeDrawerSignal?.severity === "critical"
      ? "Cr?tico"
      : activeDrawerSignal?.severity === "high"
        ? "Alto"
        : activeDrawerSignal?.severity === "medium"
          ? "M?dio"
          : "Baixo";
  const activeCategoryLabel = activeCategoryForActions
    ? categoryLabelById[activeCategoryForActions]
    : null;
  const showFab =
    Boolean(session) &&
    !publicRoutes.has(normalizedPath) &&
    normalizedPath !== "/" &&
    normalizedPath !== "/index" &&
    normalizedPath !== "/assistant" &&
    !normalizedPath.startsWith("/assistant/") &&
    !normalizedPath.startsWith("/home") &&
    !normalizedPath.startsWith("/invite");
  const sheetContentBottomPadding = Math.max(
    insets.bottom + 10,
    Platform.OS === "web" ? 16 : 14
  );
  const sheetMaxHeight = Math.max(
    420,
    Math.min(viewportHeight * (Platform.OS === "web" ? 0.9 : 0.88), viewportHeight - 8)
  );
  const sheetMinHeight = Math.min(sheetMaxHeight, Math.max(360, viewportHeight * 0.6));
  const sheetMaxWidth = Platform.OS === "web" ? Math.max(420, Math.min(viewportWidth - 28, 1100)) : undefined;
  const isWebModal = Platform.OS === "web";

  useEffect(() => {
    if (!(showFab && !state.open && state.hasUnreadUpdates)) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => {
      loop.stop();
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
    };
  }, [pulseAnim, showFab, state.hasUnreadUpdates, state.open]);

  const submitComposer = useCallback(() => {
    const prompt = composerValue.trim();
    if (!prompt) return;

    const contextualReply = buildContextualComposerReply({
      prompt,
      screen: state.context?.screen ? null,
      panel: operationalContext.panel,
      actions: state.actions,
    });

    setComposerValue("");
    setComposerInputHeight(CONTEXT_COMPOSER_MIN_HEIGHT);

    if (contextualReply) {
      enqueueContextReply(
        "",
        { message: contextualReply },
        "success"
      );
      return;
    }

    close();
    router.push({
      pathname: "/assistant",
      params: {
        prompt,
        source: state.context?.screen ? "insights",
      },
    });
  }, [close, composerValue, enqueueContextReply, operationalContext.panel, router, state.actions, state.context?.screen]);

  const handleComposerKeyPress = useCallback(
    (event: any) => {
      if (Platform.OS !== "web") return;
      const key = event?.nativeEvent?.key;
      const shiftKey = Boolean(event?.nativeEvent?.shiftKey);
      if (key !== "Enter" || shiftKey) return;
      event?.preventDefault?.();
      event?.stopPropagation?.();
      submitComposer();
    },
    [submitComposer]
  );

  return (
    <CopilotActionsContext.Provider value={actionsValue}>
      <CopilotDataContext.Provider value={dataValue}>
      {children}
      {showFab && !state.open ? (
        <View pointerEvents="box-none" style={styles.fabWrapper}>
          {state.hasUnreadUpdates ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.fabPulseRing,
                {
                  borderColor: colors.primaryBg,
                  opacity: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.28, 0],
                  }),
                  transform: [
                    {
                      scale: pulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.14],
                      }),
                    },
                  ],
                },
              ]}
            />
          ) : null}
          <Pressable
            onPress={open}
            accessibilityRole="button"
            accessibilityLabel="Abrir chat"
            style={{
              borderRadius: 999,
              width: 58,
              height: 58,
              backgroundColor: "#111111",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOpacity: 0.26,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 8 },
              elevation: 7,
            }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={24} color="#FFFFFF" />
            {state.hasUnreadUpdates ? (
              <View
                style={{
                  position: "absolute",
                  top: 9,
                  right: 9,
                  borderRadius: 999,
                  width: 8,
                  height: 8,
                  backgroundColor: colors.primaryBg,
                }}
              />
            ) : null}
          </Pressable>
        </View>
      ) : null}

      <ModalSheet
        visible={state.open}
        onClose={close}
        backdropOpacity={0.5}
        position={isWebModal ? "center" : "bottom"}
        slideOffset={isWebModal ? 10 : 24}
        cardStyle={{
          width: isWebModal ? "94%" : "100%",
          maxWidth: isWebModal ? Math.max(420, Math.min(viewportWidth - 42, 860)) : sheetMaxWidth,
          alignSelf: "center",
          maxHeight: isWebModal ? Math.min(viewportHeight - 36, 820) : sheetMaxHeight,
          minHeight: isWebModal ? Math.min(Math.max(560, viewportHeight * 0.75), viewportHeight - 48) : sheetMinHeight,
          marginBottom: isWebModal ? 0 : 0,
          borderBottomLeftRadius: isWebModal ? 28 : 0,
          borderBottomRightRadius: isWebModal ? 28 : 0,
          borderTopLeftRadius: isWebModal ? 28 : 20,
          borderTopRightRadius: isWebModal ? 28 : 20,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          overflow: "hidden",
          paddingTop: 12,
          paddingHorizontal: 14,
          paddingBottom: sheetContentBottomPadding,
          gap: 10,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Pressable
            onPress={() => {
              close();
              router.push("/assistant");
            }}
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="time-outline" size={18} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={close}
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator
          contentContainerStyle={{ gap: 10, paddingBottom: 6, paddingHorizontal: 2 }}
        >
          {insightsView.mode !== "root" ? (
            <Pressable
              onPress={() => {
                if (insightsView.mode === "detail") {
                  setInsightsView({ mode: "category", category: insightsView.category });
                  return;
                }
                setInsightsView({ mode: "root" });
              }}
              style={{
                alignSelf: "flex-start",
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Voltar</Text>
            </Pressable>
          ) : null}

          {insightsView.mode === "root" ? (
            <View style={{ gap: 12 }}>
              <View style={{ alignItems: "center", gap: 4, paddingVertical: 4 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: isWebModal ? 28 : 22,
                    fontWeight: "800",
                    textAlign: "center",
                  }}
                >
                  Como posso ajudar?
                </Text>
                <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>
                  {operationalContext.panel.headerTitle}
                </Text>
              </View>
              {operationalContext.panel.attentionSignals.length ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 }}>
                    PONTOS DE ATEN??O
                  </Text>
                  {operationalContext.panel.attentionSignals.map((signal, index) => (
                    <View key={signal.id} style={{ gap: 6 }}>
                      <Pressable
                        onPress={() => {
                          setActiveSignal(signal.id);
                          setInsightsView({
                            mode: "detail",
                            category: signalToCategory(signal.type),
                            itemId: signal.id,
                          });
                        }}
                        style={{ paddingVertical: 3, gap: 2 }}
                      >
                        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "700" }}>
                          {signal.title}
                        </Text>
                        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
                          {categoryLabelById[signalToCategory(signal.type)]} - {regulationRelativeLabel(signal.detectedAt, nowMs)}
                        </Text>
                      </Pressable>
                      {index < operationalContext.panel.attentionSignals.length - 1 ? (
                        <View style={{ height: 1, backgroundColor: colors.border }} />
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {hasRegulationDetails ? (
                <View style={{ gap: 8 }}>
                  {operationalContext.panel.attentionSignals.length ? (
                    <View style={{ height: 1, backgroundColor: colors.border }} />
                  ) : null}
                  <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 }}>
                    REGULAMENTA??O
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                    {operationalContext.panel.activeRuleSetLabel === "Sem ruleset ativo"
                      ? "Sem regulamento ativo definido"
                      : operationalContext.panel.activeRuleSetLabel + " - ativo"}
                  </Text>
                  {operationalContext.panel.pendingRuleSetLabel ? (
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
                      Pr?ximo ciclo: {operationalContext.panel.pendingRuleSetLabel}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {operationalContext.panel.unreadRegulationCount > 0 ? (
                      <Pressable
                        onPress={() => setInsightsView({ mode: "category", category: "regulation" })}
                        style={{
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.secondaryBg,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                          Ver mudan?as
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => {
                        close();
                        router.push("/regulation-history");
                      }}
                      style={{
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.secondaryBg,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                        Comparar
                      </Text>
                    </Pressable>
                    {latestRegulationSourceUrl ? (
                      <Pressable
                        onPress={() => {
                          void Linking.openURL(latestRegulationSourceUrl);
                        }}
                        style={{
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.secondaryBg,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Fonte</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {state.actions.length ? (
                <View style={{ gap: 8 }}>
                  {hasRegulationDetails || operationalContext.panel.attentionSignals.length ? (
                    <View style={{ height: 1, backgroundColor: colors.border }} />
                  ) : null}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {rootQuickActions.map((action) => (
                      <Pressable
                        key={"root_action_" + action.id}
                        onPress={() => {
                          void runAction(action);
                        }}
                        disabled={Boolean(state.runningActionId)}
                        style={{
                          flexGrow: 1,
                          flexBasis: "48.5%",
                          minHeight: 98,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.inputBg,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          gap: 8,
                          opacity: state.runningActionId && state.runningActionId !== action.id ? 0.6 : 1,
                        }}
                      >
                        <View
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 10,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.card,
                          }}
                        >
                          <Ionicons name={resolveContextActionIcon(action)} size={16} color={colors.text} />
                        </View>
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14, flexShrink: 1 }}>
                          {state.runningActionId === action.id ? "Executando..." : action.title}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 16, flexShrink: 1 }}>
                          {action.description ?? "A??o contextual para este momento."}
                        </Text>
                      </Pressable>
                    ))}
                    {canExpandRootActions ? (
                      <Pressable
                        onPress={() => setShowAllRootActions(true)}
                        style={{
                          flexGrow: 1,
                          flexBasis: "48.5%",
                          minHeight: 98,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.inputBg,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          gap: 8,
                          alignItems: "flex-start",
                          justifyContent: "center",
                        }}
                      >
                        <View
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 10,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.card,
                          }}
                        >
                          <Ionicons name="add" size={16} color={colors.text} />
                        </View>
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>Ver mais a??es</Text>
                        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 16 }}>
                          Mostrar lista completa de a??es dispon?veis.
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {insightsView.mode === "category" ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                {categoryLabelById[insightsView.category]}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {insightsView.category === "regulation"
                  ? "Toque em uma atualiza??o para ver detalhes e fonte oficial."
                  : "Toque em um insight para ver detalhes e a??es relacionadas."}
              </Text>
              {insightsView.category === "regulation"
                ? state.regulationUpdates.filter((item) => !item.isRead).map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        setInsightsView({
                          mode: "detail",
                          category: "regulation",
                          itemId: item.id,
                        });
                      }}
                      style={{
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        padding: 10,
                        gap: 4,
                      }}
                    >
                      <Text style={{ color: colors.primaryBg, fontWeight: "800", fontSize: 11 }}>
                        {item.sourceAuthority}
                      </Text>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>{item.title}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>{item.diffSummary}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>
                        Publicado em {regulationDateLabel(item.publishedAt ? item.createdAt)}
                        {item.isRead ? " - lido" : " - n?o lido"}
                      </Text>
                    </Pressable>
                  ))
                : signalsByCategory[insightsView.category as SignalInsightsCategory].map((signal) => {
                    const severityColor =
                      signal.severity === "critical"
                        ? colors.dangerText
                        : signal.severity === "high"
                          ? colors.warningText
                          : signal.severity === "medium"
                            ? colors.text
                            : colors.muted;
                    return (
                      <Pressable
                        key={signal.id}
                        onPress={() => {
                          setActiveSignal(signal.id);
                          setInsightsView({
                            mode: "detail",
                            category: insightsView.category,
                            itemId: signal.id,
                          });
                        }}
                        style={{
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                          padding: 10,
                          gap: 4,
                        }}
                      >
                        <Text style={{ color: severityColor, fontWeight: "800", fontSize: 11 }}>
                          {signal.severity.toUpperCase()}
                        </Text>
                        <Text style={{ color: colors.text, fontWeight: "700" }}>{signal.title}</Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>{signal.summary}</Text>
                      </Pressable>
                    );
                  })}
            </View>
          ) : null}

          {insightsView.mode === "detail" && insightsView.category === "regulation" && detailRegulationUpdate ? (
            <View style={{ gap: 10 }}>
              <View
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  padding: 12,
                  gap: 6,
                }}
              >
                <Text style={{ color: colors.primaryBg, fontWeight: "800", fontSize: 11 }}>
                  {detailRegulationUpdate.sourceAuthority}
                </Text>
                <Text style={{ color: colors.text, fontWeight: "800" }}>
                  {detailRegulationUpdate.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {detailRegulationUpdate.diffSummary}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  Publicado em {regulationDateLabel(detailRegulationUpdate.publishedAt ? detailRegulationUpdate.createdAt)}
                </Text>
                {detailRegulationUpdate.changedTopics.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    {detailRegulationUpdate.changedTopics.map((topic) => (
                      <View
                        key={`${detailRegulationUpdate.id}_${topic}`}
                        style={{
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.secondaryBg,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>
                          {topic}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {detailRegulationUpdate.impactAreas.length ? (
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Impacto: {detailRegulationUpdate.impactAreas.join(", ")}
                  </Text>
                ) : null}
              </View>

              <Pressable
                onPress={() => {
                  if (!detailRegulationUpdate.sourceUrl) return;
                  void Linking.openURL(detailRegulationUpdate.sourceUrl);
                }}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.primaryBg,
                  backgroundColor: colors.secondaryBg,
                  paddingVertical: 11,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "800" }}>Ver fonte</Text>
              </Pressable>

              {detailRegulationUpdate.impactActions.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {detailRegulationUpdate.impactActions.map((action) => (
                    <Pressable
                      key={`${detailRegulationUpdate.id}_${action.route}`}
                      onPress={() => {
                        close();
                        router.push(action.route as never);
                      }}
                      style={{
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                        {action.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {insightsView.mode === "detail" && insightsView.category !== "regulation" && activeDrawerSignal ? (
            <>
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: "800" }}>
                  {activeCategoryLabel ? "Insight selecionado"}
                </Text>
                <View
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    padding: 10,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: selectedSeverityColor, fontSize: 11, fontWeight: "800" }}>
                    Prioridade - {selectedSeverityLabel}
                  </Text>
                  <Text style={{ color: colors.text, fontWeight: "800" }}>{activeDrawerSignal.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{activeDrawerSignal.summary}</Text>
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: "800" }}>A??es gerais</Text>
                {recommendedActions.length ? (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    As a??es recomendadas para este insight aparecem primeiro.
                  </Text>
                ) : null}
                {orderedActions.length ? (
                  orderedActions.map((action) => {
                    const isRecommended = recommendedActionIds.has(action.id);
                    return (
                      <Pressable
                        key={action.id}
                        onPress={() => {
                          void runAction(action);
                        }}
                        disabled={Boolean(state.runningActionId)}
                        style={{
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: isRecommended ? colors.primaryBg : colors.border,
                          backgroundColor: colors.card,
                          padding: 12,
                          opacity: state.runningActionId && state.runningActionId !== action.id ? 0.6 : 1,
                        }}
                      >
                        {isRecommended ? (
                          <Text style={{ color: colors.primaryBg, fontSize: 10, fontWeight: "800", marginBottom: 4 }}>
                            RECOMENDADA PARA ESTE INSIGHT
                          </Text>
                        ) : null}
                        <Text style={{ color: colors.text, fontWeight: "700" }}>
                          {state.runningActionId === action.id ? "Executando..." : action.title}
                        </Text>
                        {action.description ? (
                          <Text style={{ color: colors.muted, marginTop: 3, fontSize: 12 }}>{action.description}</Text>
                        ) : null}
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={{ color: colors.muted }}>Sem a??es dispon?veis neste contexto.</Text>
                )}
              </View>
            </>
          ) : null}
        </ScrollView>

        {assistantTyping ? (
          <View
            style={{
              alignSelf: "flex-start",
              maxWidth: "58%",
              paddingHorizontal: 12,
              paddingVertical: 11,
              borderRadius: 16,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: 8,
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
                    key={`context-thinking-dot-${index}`}
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

        {!assistantTyping && contextPreview ? (
          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 8,
              gap: 4,
            }}
          >
            {contextPreview.actionTitle ? (
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
                {contextPreview.actionTitle}
              </Text>
            ) : null}
            <Text style={{ color: colors.text, fontSize: 13 }}>{contextPreview.message}</Text>
          </View>
        ) : null}

        <View
          style={{
            borderRadius: 28,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            paddingHorizontal: 10,
            paddingVertical: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <Pressable
              onPress={() => {
                close();
                router.push("/assistant");
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Ionicons name="add" size={20} color={colors.text} />
            </Pressable>
            <TextInput
              value={composerValue}
              onChangeText={(value) => {
                setComposerValue(value);
                if (!value.trim() && composerInputHeight !== CONTEXT_COMPOSER_MIN_HEIGHT) {
                  setComposerInputHeight(CONTEXT_COMPOSER_MIN_HEIGHT);
                }
              }}
              placeholder="Pergunte sobre este contexto..."
              placeholderTextColor={colors.muted}
              returnKeyType="send"
              onSubmitEditing={submitComposer}
              onKeyPress={handleComposerKeyPress}
              onContentSizeChange={(event) => {
                if (!composerValue.trim()) {
                  if (composerInputHeight !== CONTEXT_COMPOSER_MIN_HEIGHT) {
                    setComposerInputHeight(CONTEXT_COMPOSER_MIN_HEIGHT);
                  }
                  return;
                }
                const maxHeight =
                  Platform.OS === "web" ? CONTEXT_COMPOSER_MAX_HEIGHT_WEB : CONTEXT_COMPOSER_MAX_HEIGHT;
                const next = Math.max(
                  CONTEXT_COMPOSER_MIN_HEIGHT,
                  Math.min(maxHeight, Math.ceil(event.nativeEvent.contentSize.height))
                );
                if (next !== composerInputHeight) {
                  setComposerInputHeight(next);
                }
              }}
              multiline
              scrollEnabled={
                composerInputHeight >=
                (Platform.OS === "web" ? CONTEXT_COMPOSER_MAX_HEIGHT_WEB : CONTEXT_COMPOSER_MAX_HEIGHT)
              }
              style={{
                flex: 1,
                minHeight: CONTEXT_COMPOSER_MIN_HEIGHT,
                height: composerInputHeight,
                color: colors.text,
                paddingHorizontal: 2,
                paddingTop: 8,
                paddingBottom: 8,
                fontSize: 16,
                textAlignVertical: "top",
                ...(Platform.OS === "web"
                  ? ({
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    } as const)
                  : null),
              }}
            />
            <Pressable
              onPress={submitComposer}
              disabled={!composerValue.trim()}
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                backgroundColor: colors.primaryBg,
                alignItems: "center",
                justifyContent: "center",
                opacity: composerValue.trim() ? 1 : 0.55,
              }}
            >
              <Ionicons name="arrow-up" size={20} color={colors.primaryText} />
            </Pressable>
          </View>
        </View>
      </ModalSheet>
      </CopilotDataContext.Provider>
    </CopilotActionsContext.Provider>
  );
}

export function useCopilot() {
  const dataContext = useContext(CopilotDataContext);
  const actionsContext = useContext(CopilotActionsContext);
  if (!dataContext || !actionsContext) {
    throw new Error("useCopilot must be used within CopilotProvider");
  }
  const { state, operationalContext } = dataContext;
  return {
    open: actionsContext.open,
    close: actionsContext.close,
    runAction: actionsContext.runAction,
    isOpen: state.open,
    actionCount: state.actions.length,
    signalCount: state.signals.length,
    hasUnreadUpdates: state.hasUnreadUpdates,
    unreadCount: state.unreadCount,
    signals: state.signals,
    regulationUpdates: state.regulationUpdates,
    regulationRuleSets: state.regulationRuleSets,
    activeSignal:
      state.signals.find((item) => item.id === state.selectedSignalId) ? null,
    setActiveSignal: actionsContext.setActiveSignal,
    context: state.context,
    history: state.history,
    operationalContext,
    appSnapshot: operationalContext.snapshot,
  };
}

export function useOptionalCopilot() {
  const dataContext = useContext(CopilotDataContext);
  const actionsContext = useContext(CopilotActionsContext);
  if (!dataContext || !actionsContext) return null;
  const { state, operationalContext } = dataContext;
  return {
    open: actionsContext.open,
    close: actionsContext.close,
    runAction: actionsContext.runAction,
    isOpen: state.open,
    actionCount: state.actions.length,
    signalCount: state.signals.length,
    hasUnreadUpdates: state.hasUnreadUpdates,
    unreadCount: state.unreadCount,
    signals: state.signals,
    regulationUpdates: state.regulationUpdates,
    regulationRuleSets: state.regulationRuleSets,
    activeSignal:
      state.signals.find((item) => item.id === state.selectedSignalId) ? null,
    setActiveSignal: actionsContext.setActiveSignal,
    context: state.context,
    history: state.history,
    operationalContext,
    appSnapshot: operationalContext.snapshot,
  };
}

export function useCopilotContext(input: CopilotContextData | null) {
  const context = useContext(CopilotActionsContext);
  if (!context) {
    throw new Error("useCopilotContext must be used within CopilotProvider");
  }

  const ownerIdRef = useRef(`copilot_ctx_${Math.random().toString(36).slice(2, 10)}`);
  const contextSignature = useMemo(() => buildContextSignature(input), [input]);
  const payload = useMemo<CopilotContextData | null>(() => {
    if (!input) return null;
    return {
      screen: input.screen,
      title: input.title,
      subtitle: input.subtitle,
      activeSignal: input.activeSignal ? undefined,
    };
  }, [contextSignature]);

  useEffect(() => {
    const ownerId = ownerIdRef.current;
    context.setContext(ownerId, payload);
  }, [context, payload]);

  useEffect(
    () => () => {
      context.clearContext(ownerIdRef.current);
    },
    [context]
  );
}

export function useCopilotActions(actions: CopilotAction[]) {
  const context = useContext(CopilotActionsContext);
  if (!context) {
    throw new Error("useCopilotActions must be used within CopilotProvider");
  }

  const ownerIdRef = useRef(`copilot_actions_${Math.random().toString(36).slice(2, 10)}`);
  const stableActions = useMemo(() => actions, [actions]);

  useEffect(() => {
    const ownerId = ownerIdRef.current;
    context.setActions(ownerId, stableActions);
    return () => {
      context.clearActions(ownerId);
    };
  }, [context, stableActions]);
}

export function useCopilotSignals(signals: CopilotSignal[]) {
  const context = useContext(CopilotActionsContext);
  if (!context) {
    throw new Error("useCopilotSignals must be used within CopilotProvider");
  }

  const ownerIdRef = useRef(`copilot_signals_${Math.random().toString(36).slice(2, 10)}`);
  const signalsSignature = useMemo(() => buildSignalsSignature(signals), [signals]);
  const stableSignals = useMemo(
    () => sortCopilotSignals((signals ? []).filter(isValidCopilotSignal)),
    [signalsSignature]
  );

  useEffect(() => {
    const ownerId = ownerIdRef.current;
    context.setSignals(ownerId, stableSignals);
    return () => {
      context.clearSignals(ownerId);
    };
  }, [context, stableSignals]);
}

const styles = StyleSheet.create({
  fabWrapper: {
    position: "absolute",
    right: 16,
    bottom: 24,
    zIndex: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  fabPulseRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
  },
});

export type { CopilotAction, CopilotActionResult, CopilotContextData, CopilotSignal };


