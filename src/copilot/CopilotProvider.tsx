import { usePathname, useRouter } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRenderDiagnostic } from "../dev/useRenderDiagnostic";

import {
  markRegulationUpdateRead,
  type RegulationUpdate,
} from "../api/regulation-updates";
import { useAuth } from "../auth/auth";
import { getClasses } from "../db/seed";
import { getScopedAssistantPath, isAssistantRoutePath } from "../navigation/profile-routes";
import { markRender, measureAsync } from "../observability/perf";
import { useOptionalOrganization } from "../providers/OrganizationProvider";
import { useAppTheme } from "../ui/app-theme";
import { CopilotFab } from "./components/CopilotFab";
import { CopilotModal } from "./components/CopilotModal";
import {
  buildDefaultContextReply,
  buildNfcQuickActionReply,
  resolveComposerSubmission,
} from "./context-replies";
import {
  resolveCopilotFabHint,
  resolveUnreadState,
  shouldPulseCopilotFab,
} from "./fab-selectors";
import { useRegistryManager } from "./hooks/useRegistryManager";
import { useRegulationUpdates } from "./hooks/useRegulationUpdates";
import {
  buildOperationalContext,
  type OperationalContextResult,
} from "./operational-context";
import {
  getRecommendedSignalActions,
  isValidCopilotSignal,
  sortCopilotSignals,
} from "./signal-utils";
import type {
  CopilotAction,
  CopilotActionResult,
  CopilotContextData,
  CopilotHistoryItem,
  CopilotSignal,
  CopilotState,
  InsightsCategory,
  InsightsView,
  SignalInsightsCategory,
} from "./types";
import {
  buildCentralSnapshot,
  type CentralSnapshot,
} from "./updates-utils";

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
const CONTEXT_COMPOSER_MIN_HEIGHT = 40;
const CONTEXT_COMPOSER_MAX_HEIGHT = 120;
const CONTEXT_COMPOSER_MAX_HEIGHT_WEB = 84;

const publicRoutes = new Set([
  "/welcome",
  "/login",
  "/signup",
  "/verify-email",
  "/reset-password",
  "/pending",
  "/auth-callback",
]);

const categoryLabelById: Record<InsightsCategory, string> = {
  reports: "Relatórios",
  absences: "Faltas consecutivas",
  nfc: "Presença NFC",
  attendance: "Queda de presença",
  engagement: "Risco de engajamento",
  regulation: "Regulamento atualizado",
};

const signalToCategory = (signalType: CopilotSignal["type"]): SignalInsightsCategory => {
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
  if (!value) return { message: "Ação concluída." };
  if (typeof value === "string") return { message: value };
  return value;
};

const extractEmbeddedErrorMessage = (value: string) => {
  const normalized = String(value ?? "").trim();
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
  const raw = String(value ?? "").trim();
  if (!raw) return "Falha ao executar a ação.";
  const normalized = raw.toLowerCase();
  if (normalized.includes("entrada invalida") || normalized.includes("invalid input")) {
    return "Não consegui interpretar essa solicitação no contexto atual.";
  }
  if (normalized.includes("timeout")) {
    return "A resposta demorou mais que o esperado. Tente novamente.";
  }
  if (normalized.includes("failed to fetch") || normalized.includes("network request failed")) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }
  if (normalized.includes("token") || normalized.includes("auth")) {
    return "Sessão expirada. Faça login novamente.";
  }
  return "Falha ao executar a ação.";
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

const buildContextSignature = (input: CopilotContextData | null) => {
  if (!input) return "__none__";
  const signal = input.activeSignal;
  return JSON.stringify({
    screen: input.screen ?? "",
    title: input.title ?? "",
    subtitle: input.subtitle ?? "",
    activeSignal: signal
      ? {
          id: signal.id,
          type: signal.type,
          severity: signal.severity,
          classId: signal.classId ?? null,
          studentId: signal.studentId ?? null,
          detectedAt: signal.detectedAt,
          title: signal.title,
          summary: signal.summary,
        }
      : null,
  });
};

const buildSignalsSignature = (signals: CopilotSignal[]) =>
  [...(signals ?? [])]
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
  const { activeOrganizationId } = useOptionalOrganization() ?? {};
  const insets = useSafeAreaInsets();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();

  const pulseAnim = useRef(new Animated.Value(0)).current;
  const lastSeenSnapshotRef = useRef<CentralSnapshot | null>(null);
  const lastComputedSnapshotRef = useRef<CentralSnapshot | null>(null);
  const currentSnapshotRef = useRef<CentralSnapshot | null>(null);
  const operationalContextRef = useRef<OperationalContextResult | null>(null);

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
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const pendingReplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useRenderDiagnostic("CopilotProvider", {
    "state.open": state.open,
    "state.hasUnreadUpdates": state.hasUnreadUpdates,
    "state.unreadCount": state.unreadCount,
    "state.signals.length": state.signals.length,
    "state.actions.length": state.actions.length,
    "state.history.length": state.history.length,
    activeOrganizationId,
    pathname,
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    markRender("screen.copilot.render.provider", { open: state.open ? 1 : 0 });
  }, [state.open]);

  const {
    contextRegistryRef,
    actionsRegistryRef,
    signalsRegistryRef,
    activeOwnerRef,
    setContext,
    clearContext,
    setActions,
    clearActions,
    setSignals,
    clearSignals,
    setActiveSignal,
  } = useRegistryManager(setState);

  const { loadRegulationUpdates } = useRegulationUpdates(setState, activeOrganizationId, session, state.open);

  useEffect(() => {
    if (!state.open) return;

    setNowMs(Date.now());
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);
    return () => clearInterval(timer);
  }, [state.open]);

  useEffect(() => {
    const shouldLoadScheduleWindows = state.open || Boolean(state.context);
    let cancelled = false;

    if (!shouldLoadScheduleWindows) {
      setScheduleWindows([]);
      return;
    }

    (async () => {
      const organizationId = activeOrganizationId ?? "";
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
            startTime: item.startTime ?? null,
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
  }, [activeOrganizationId, state.context, state.open]);

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
    state.signals.find((item) => item.id === state.selectedSignalId) ?? null;
  const operationalContext = useMemo(
    () =>
      buildOperationalContext({
        screen: state.context?.screen ?? null,
        contextTitle: state.context?.title ?? null,
        contextSubtitle: state.context?.subtitle ?? null,
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
  operationalContextRef.current = operationalContext;

  const currentSnapshot = useMemo(() => {
    return buildCentralSnapshot({
      screenKey: state.context?.screen ?? "__none__",
      snapshotHash: operationalContext.snapshot.snapshotHash,
      signals: state.signals,
      ruleUpdates: state.regulationUpdates.map((item) => ({
        id: item.id,
        publishedAt: item.publishedAt ?? null,
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
      lastComputedSnapshotRef.current ?? currentSnapshotRef.current;
    if (latestSnapshot) {
      lastSeenSnapshotRef.current = latestSnapshot;
    }
    clearPendingReplyTimer();
    setAssistantTyping(false);
    const currentState = stateRef.current;
    const currentOpCtx = operationalContextRef.current;
    setContextPreview({
      actionTitle: "",
      message: buildDefaultContextReply({
        screen: currentState.context?.screen ?? null,
        panel: currentOpCtx?.panel ?? operationalContext.panel,
        actions: currentState.actions,
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
  }, [clearPendingReplyTimer, operationalContext.panel]);

  const close = useCallback(() => {
    clearPendingReplyTimer();
    setAssistantTyping(false);
    setState((prev) => ({ ...prev, open: false }));
  }, [clearPendingReplyTimer]);

  useEffect(() => {
    const previousSnapshot = lastComputedSnapshotRef.current;
    lastComputedSnapshotRef.current = currentSnapshot;

    const unreadResolution = resolveUnreadState({
      previousSnapshot,
      currentSnapshot,
      lastSeenSnapshot: lastSeenSnapshotRef.current,
      isOpen: state.open,
      hasUnreadUpdates: state.hasUnreadUpdates,
      unreadCount: state.unreadCount,
    });

    lastSeenSnapshotRef.current = unreadResolution.nextSeenSnapshot;
    if (!unreadResolution.statePatch) return;

    setState((prev) => {
      if (
        prev.hasUnreadUpdates === unreadResolution.statePatch?.hasUnreadUpdates &&
        prev.unreadCount === unreadResolution.statePatch?.unreadCount
      ) {
        return prev;
      }
      return {
        ...prev,
        ...unreadResolution.statePatch,
      };
    });
  }, [currentSnapshot, state.hasUnreadUpdates, state.open, state.unreadCount]);

  const runAction = useCallback(async (action: CopilotAction) => {
    const currentState = stateRef.current;
    const selectedSignal =
      currentState.signals.find((item) => item.id === currentState.selectedSignalId) ?? null;
    const actionContext: CopilotContextData | null = selectedSignal
      ? {
          ...(currentState.context ?? { screen: "assistant" }),
          activeSignal: selectedSignal,
        }
      : currentState.context ?? null;

    const requirementError = action.requires?.(actionContext);
    if (requirementError) {
      enqueueContextReply(action.title, { message: requirementError }, "error");
      return;
    }

    const nfcQuickReply = buildNfcQuickActionReply({
      actionId: action.id,
      screen: currentState.context?.screen ?? null,
      signals: currentState.signals,
    });
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
    [
      operationalContext,
      state.context,
      state.actions,
      state.signals,
      state.regulationUpdates,
      state.regulationRuleSets,
      state.selectedSignalId,
      state.open,
      state.runningActionId,
      state.history,
      state.hasUnreadUpdates,
      state.unreadCount,
    ]
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
  const scopedAssistantPath = useMemo(
    () => getScopedAssistantPath(normalizedPath),
    [normalizedPath]
  );
  const signalsByCategory = useMemo<Record<SignalInsightsCategory, CopilotSignal[]>>(
    () => {
      const grouped: Record<SignalInsightsCategory, CopilotSignal[]> = {
        reports: [],
        absences: [],
        nfc: [],
        attendance: [],
        engagement: [],
      };
      state.signals.forEach((item) => {
        grouped[signalToCategory(item.type)].push(item);
      });
      return grouped;
    },
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
  const latestRegulationUpdate = useMemo<RegulationUpdate | null>(() => {
    let latest: RegulationUpdate | null = null;
    let latestAt = "";
    state.regulationUpdates.forEach((item) => {
      const createdAt = String(item.createdAt ?? "");
      if (!latest || createdAt.localeCompare(latestAt) > 0) {
        latest = item;
        latestAt = createdAt;
      }
    });
    return latest;
  }, [state.regulationUpdates]);
  const detailSignal = useMemo(() => {
    if (insightsView.mode !== "detail") return null;
    if (insightsView.category === "regulation") return null;
    return state.signals.find((item) => item.id === insightsView.itemId) ?? null;
  }, [insightsView, state.signals]);
  const detailRegulationUpdate = useMemo(() => {
    if (insightsView.mode !== "detail") return null;
    if (insightsView.category !== "regulation") return null;
    return state.regulationUpdates.find((item) => item.id === insightsView.itemId) ?? null;
  }, [insightsView, state.regulationUpdates]);
  const activeDrawerSignal =
    insightsView.mode === "detail" && insightsView.category === "regulation"
      ? null
      : detailSignal ?? selectedSignal;
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
          setInsightsView((prev) => prev.mode === "root" ? prev : { mode: "root" });
        }
        return;
      }
      const signalCategory = insightsView.category as SignalInsightsCategory;
      if (!signalsByCategory[signalCategory].length) {
        setInsightsView((prev) => prev.mode === "root" ? prev : { mode: "root" });
      }
      return;
    }
    if (insightsView.category === "regulation") {
      if (detailRegulationUpdate) return;
      if (unreadRegulationCount) {
        setInsightsView((prev) =>
          prev.mode === "category" && prev.category === "regulation"
            ? prev
            : { mode: "category", category: "regulation" }
        );
      } else {
        setInsightsView((prev) => prev.mode === "root" ? prev : { mode: "root" });
      }
      return;
    }
    if (!detailSignal) {
      const signalCategory = insightsView.category as SignalInsightsCategory;
      if (signalsByCategory[signalCategory].length) {
        setInsightsView((prev) =>
          prev.mode === "category" && prev.category === insightsView.category
            ? prev
            : { mode: "category", category: insightsView.category }
        );
      } else {
        setInsightsView((prev) => prev.mode === "root" ? prev : { mode: "root" });
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
  const latestRegulationSourceUrl = latestRegulationUpdate?.sourceUrl ?? "";
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
      ? "Crítico"
      : activeDrawerSignal?.severity === "high"
        ? "Alto"
        : activeDrawerSignal?.severity === "medium"
          ? "Médio"
          : "Baixo";
  const activeCategoryLabel = activeCategoryForActions
    ? categoryLabelById[activeCategoryForActions]
    : null;
  const showFab =
    Boolean(session) &&
    !publicRoutes.has(normalizedPath) &&
    normalizedPath !== "/" &&
    normalizedPath !== "/index" &&
    !isAssistantRoutePath(normalizedPath) &&
    normalizedPath !== "/prof/home" &&
    normalizedPath !== "/student/home" &&
    normalizedPath !== "/coord/dashboard" &&
    !normalizedPath.startsWith("/home") &&
    !normalizedPath.startsWith("/invite");
  const fabHint = useMemo(() => {
    return resolveCopilotFabHint({
      showFab,
      panel: operationalContext.panel,
    });
  }, [
    operationalContext.panel.attentionSignals,
    operationalContext.panel.topImpactAreas,
    operationalContext.panel.unreadRegulationCount,
    showFab,
  ]);
  const shouldPulseFab = useMemo(
    () =>
      shouldPulseCopilotFab({
        fabHint,
        hasUnreadUpdates: state.hasUnreadUpdates,
        isOpen: state.open,
      }),
    [fabHint, state.hasUnreadUpdates, state.open]
  );

  useEffect(() => {
    const mustHideCopilot =
      !session ||
      publicRoutes.has(normalizedPath) ||
      normalizedPath.startsWith("/invite");
    if (!mustHideCopilot) return;
    setState((prev) => (prev.open ? { ...prev, open: false } : prev));
  }, [normalizedPath, session]);
  const fabBottomOffset = Math.max(insets.bottom + 92, 108);
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
    pulseLoopRef.current?.stop();
    pulseLoopRef.current = null;

    if (Platform.OS === "web" || !shouldPulseFab) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
      return;
    }

    pulseAnim.setValue(0);
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
    pulseLoopRef.current = loop;
    loop.start();

    return () => {
      if (pulseLoopRef.current === loop) {
        pulseLoopRef.current.stop();
        pulseLoopRef.current = null;
      }
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
    };
  }, [pulseAnim, shouldPulseFab]);

  const submitComposer = useCallback(() => {
    const prompt = composerValue.trim();
    if (!prompt) return;

    const composerResolution = resolveComposerSubmission({
      prompt,
      screen: state.context?.screen ?? null,
      panel: operationalContext.panel,
      actions: state.actions,
    });

    setComposerValue("");
    setComposerInputHeight(CONTEXT_COMPOSER_MIN_HEIGHT);

    if (composerResolution.mode === "context_reply") {
      enqueueContextReply(
        "",
        { message: composerResolution.message },
        "success"
      );
      return;
    }

    close();
    router.push({
      pathname: scopedAssistantPath,
      params: {
        prompt,
        source: state.context?.screen ?? "insights",
      },
    });
  }, [close, composerValue, enqueueContextReply, operationalContext.panel, router, scopedAssistantPath, state.actions, state.context?.screen]);

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
        <CopilotFab
          showPulse={shouldPulseFab}
          pulseAnim={pulseAnim}
          primaryBgColor={colors.primaryBg}
          fabBottomOffset={fabBottomOffset}
          hintMessage={fabHint?.message ?? null}
          onPress={open}
        />
      ) : null}

      <CopilotModal
        visible={state.open}
        isWebModal={isWebModal}
        viewportWidth={viewportWidth}
        viewportHeight={viewportHeight}
        sheetMaxWidth={sheetMaxWidth}
        sheetMaxHeight={sheetMaxHeight}
        sheetMinHeight={sheetMinHeight}
        sheetContentBottomPadding={sheetContentBottomPadding}
        colors={colors}
        insightsView={insightsView}
        setInsightsView={setInsightsView}
        operationalContext={operationalContext}
        state={state}
        signalsByCategory={signalsByCategory}
        hasRegulationDetails={hasRegulationDetails}
        latestRegulationSourceUrl={latestRegulationSourceUrl}
        detailRegulationUpdate={detailRegulationUpdate}
        activeDrawerSignal={activeDrawerSignal}
        activeCategoryLabel={activeCategoryLabel}
        selectedSeverityColor={selectedSeverityColor}
        selectedSeverityLabel={selectedSeverityLabel}
        recommendedActionIds={recommendedActionIds}
        orderedActions={orderedActions}
        recommendedActions={recommendedActions}
        rootQuickActions={rootQuickActions}
        canExpandRootActions={canExpandRootActions}
        showAllRootActions={showAllRootActions}
        setShowAllRootActions={setShowAllRootActions}
        assistantTyping={assistantTyping}
        thinkingPulse={thinkingPulse}
        contextPreview={contextPreview}
        composerValue={composerValue}
        setComposerValue={setComposerValue}
        composerInputHeight={composerInputHeight}
        setComposerInputHeight={setComposerInputHeight}
        nowMs={nowMs}
        setActiveSignal={setActiveSignal}
        runAction={runAction}
        close={close}
        onNavigateToHistory={() => { close(); router.push(scopedAssistantPath); }}
        onNavigateToAssistant={() => { close(); router.push(scopedAssistantPath); }}
        onNavigateToRegulationHistory={() => { close(); router.push("/regulation-history"); }}
        onNavigateToImpactAction={(route) => { close(); router.push(route as never); }}
        submitComposer={submitComposer}
        handleComposerKeyPress={handleComposerKeyPress}
      />
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
      state.signals.find((item) => item.id === state.selectedSignalId) ?? null,
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
      state.signals.find((item) => item.id === state.selectedSignalId) ?? null,
    setActiveSignal: actionsContext.setActiveSignal,
    context: state.context,
    history: state.history,
    operationalContext,
    appSnapshot: operationalContext.snapshot,
  };
}

export function useCopilotContext(input: CopilotContextData | null) {
  const context = useContext(CopilotActionsContext);
  const ownerIdRef = useRef(`copilot_ctx_${Math.random().toString(36).slice(2, 10)}`);
  const contextSignature = useMemo(() => buildContextSignature(input), [input]);
  const payload = useMemo<CopilotContextData | null>(() => {
    if (!input) return null;
    return {
      screen: input.screen,
      title: input.title,
      subtitle: input.subtitle,
      activeSignal: input.activeSignal ?? undefined,
    };
  }, [contextSignature]);

  useEffect(() => {
    if (!context) return;
    const ownerId = ownerIdRef.current;
    context.setContext(ownerId, payload);
  }, [context, payload]);

  useEffect(
    () => () => {
      if (!context) return;
      context.clearContext(ownerIdRef.current);
    },
    [context]
  );
}

export function useCopilotActions(actions: CopilotAction[]) {
  const context = useContext(CopilotActionsContext);
  const ownerIdRef = useRef(`copilot_actions_${Math.random().toString(36).slice(2, 10)}`);
  const stableActions = useMemo(() => actions, [actions]);

  useEffect(() => {
    if (!context) return;
    const ownerId = ownerIdRef.current;
    context.setActions(ownerId, stableActions);
    return () => {
      context.clearActions(ownerId);
    };
  }, [context, stableActions]);
}

export function useCopilotSignals(signals: CopilotSignal[]) {
  const context = useContext(CopilotActionsContext);
  const ownerIdRef = useRef(`copilot_signals_${Math.random().toString(36).slice(2, 10)}`);
  const signalsSignature = useMemo(() => buildSignalsSignature(signals), [signals]);
  const stableSignals = useMemo(
    () => sortCopilotSignals((signals ?? []).filter(isValidCopilotSignal)),
    [signalsSignature]
  );

  useEffect(() => {
    if (!context) return;
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
    zIndex: 5200,
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

export type { CopilotAction, CopilotActionResult, CopilotContextData, CopilotSignal, InsightsCategory, InsightsView } from "./types";

