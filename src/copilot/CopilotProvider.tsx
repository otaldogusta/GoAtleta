import { usePathname } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../auth/auth";
import type { Signal as CopilotSignal } from "../ai/signal-engine";
import {
  getRecommendedSignalActions,
  sortCopilotSignals,
} from "./signal-utils";
import {
  buildCentralSnapshot,
  countUnreadFromSnapshot,
  hasSnapshotChanged,
  type CentralSnapshot,
} from "./updates-utils";
import { Pressable } from "../ui/Pressable";
import { ModalSheet } from "../ui/ModalSheet";
import { useAppTheme } from "../ui/app-theme";

type CopilotContextData = {
  screen: string;
  title?: string;
  subtitle?: string;
  chips?: { label: string; value: string }[];
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
  | "engagement";

type InsightsView =
  | { mode: "root" }
  | { mode: "category"; category: InsightsCategory }
  | { mode: "detail"; category: InsightsCategory; signalId: string };

type CopilotState = {
  context: CopilotContextData | null;
  actions: CopilotAction[];
  signals: CopilotSignal[];
  selectedSignalId: string | null;
  open: boolean;
  runningActionId: string | null;
  history: CopilotHistoryItem[];
  hasUnreadUpdates: boolean;
  unreadCount: number;
};

type CopilotInternalContext = {
  state: CopilotState;
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

const CopilotContext = createContext<CopilotInternalContext | null>(null);

const MAX_HISTORY_ITEMS = 12;

const publicRoutes = new Set(["/welcome", "/login", "/signup", "/reset-password"]);

const categoryLabelById: Record<InsightsCategory, string> = {
  reports: "Relatorios",
  absences: "Faltas consecutivas",
  nfc: "Presenca NFC",
  attendance: "Queda de presenca",
  engagement: "Risco de engajamento",
};

const categorySortOrder: InsightsCategory[] = [
  "reports",
  "absences",
  "nfc",
  "attendance",
  "engagement",
];

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

const toActionResult = (value: CopilotActionResult | string | void): CopilotActionResult => {
  if (!value) return { message: "Acao concluida." };
  if (typeof value === "string") return { message: value };
  return value;
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

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const pathname = usePathname();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();

  const contextRegistryRef = useRef<Map<string, CopilotContextData | null>>(new Map());
  const actionsRegistryRef = useRef<Map<string, CopilotAction[]>>(new Map());
  const signalsRegistryRef = useRef<Map<string, CopilotSignal[]>>(new Map());
  const activeOwnerRef = useRef<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const lastSeenSnapshotRef = useRef<CentralSnapshot | null>(null);
  const lastComputedSnapshotRef = useRef<CentralSnapshot | null>(null);

  const [state, setState] = useState<CopilotState>({
    context: null,
    actions: [],
    signals: [],
    selectedSignalId: null,
    open: false,
    runningActionId: null,
    history: [],
    hasUnreadUpdates: false,
    unreadCount: 0,
  });
  const [insightsView, setInsightsView] = useState<InsightsView>({ mode: "root" });

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
        ? Array.from(contextRegistryRef.current.values())[contextRegistryRef.current.size - 1] ?? null
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
        ? Array.from(actionsRegistryRef.current.values())[actionsRegistryRef.current.size - 1] ?? []
        : [];
      setState((prev) => ({ ...prev, actions: nextActions }));
    }
  }, []);

  const setSignals = useCallback((ownerId: string, signals: CopilotSignal[]) => {
    const sortedSignals = sortCopilotSignals(signals);
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
          : sortedSignals[0]?.id ?? null,
      };
    });
  }, []);

  const clearSignals = useCallback((ownerId: string) => {
    signalsRegistryRef.current.delete(ownerId);
    const activeOwner = activeOwnerRef.current;
    if (activeOwner === ownerId) {
      const nextSignals = signalsRegistryRef.current.size
        ? Array.from(signalsRegistryRef.current.values())[signalsRegistryRef.current.size - 1] ?? []
        : [];
      setState((prev) => ({
        ...prev,
        signals: nextSignals,
        selectedSignalId: nextSignals[0]?.id ?? null,
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

  const currentSnapshot = useMemo(() => {
    return buildCentralSnapshot({
      screenKey: state.context?.screen ?? "__none__",
      signals: state.signals,
      actions: state.actions,
      historyHead: state.history[0]
        ? { id: state.history[0].id, createdAt: state.history[0].createdAt }
        : null,
    });
  }, [state.actions, state.context?.screen, state.history, state.signals]);

  const open = useCallback(() => {
    const latestSnapshot = lastComputedSnapshotRef.current ?? currentSnapshot;
    lastSeenSnapshotRef.current = latestSnapshot;
    setInsightsView({ mode: "root" });
    setState((prev) => ({
      ...prev,
      open: true,
      hasUnreadUpdates: false,
      unreadCount: 0,
    }));
  }, [currentSnapshot]);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

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

  const runAction = useCallback(async (action: CopilotAction) => {
    const selectedSignal =
      state.signals.find((item) => item.id === state.selectedSignalId) ?? null;
    const actionContext: CopilotContextData | null = selectedSignal
      ? {
          ...(state.context ?? { screen: "assistant" }),
          activeSignal: selectedSignal,
        }
      : state.context ?? null;

    const requirementError = action.requires?.(actionContext);
    if (requirementError) {
      const result = { message: requirementError };
      setState((prev) => ({
        ...prev,
        history: [buildHistoryItem({ actionTitle: action.title, result, status: "error" }), ...prev.history].slice(
          0,
          MAX_HISTORY_ITEMS
        ),
      }));
      return;
    }

    setState((prev) => ({ ...prev, runningActionId: action.id }));
    try {
      const output = await action.run(actionContext);
      const normalized = toActionResult(output);
      setState((prev) => ({
        ...prev,
        runningActionId: null,
        history: [buildHistoryItem({ actionTitle: action.title, result: normalized, status: "success" }), ...prev.history].slice(
          0,
          MAX_HISTORY_ITEMS
        ),
      }));
    } catch (error) {
      const result: CopilotActionResult = {
        message: error instanceof Error ? error.message : "Falha ao executar acao.",
      };
      setState((prev) => ({
        ...prev,
        runningActionId: null,
        history: [buildHistoryItem({ actionTitle: action.title, result, status: "error" }), ...prev.history].slice(
          0,
          MAX_HISTORY_ITEMS
        ),
      }));
    }
  }, [state.context, state.selectedSignalId, state.signals]);

  const value = useMemo<CopilotInternalContext>(
    () => ({
      state,
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
      state,
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
    ]
  );

  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const selectedSignal =
    state.signals.find((item) => item.id === state.selectedSignalId) ?? null;
  const signalsByCategory = useMemo<Record<InsightsCategory, CopilotSignal[]>>(
    () => ({
      reports: state.signals.filter((item) => signalToCategory(item.type) === "reports"),
      absences: state.signals.filter((item) => signalToCategory(item.type) === "absences"),
      nfc: state.signals.filter((item) => signalToCategory(item.type) === "nfc"),
      attendance: state.signals.filter((item) => signalToCategory(item.type) === "attendance"),
      engagement: state.signals.filter((item) => signalToCategory(item.type) === "engagement"),
    }),
    [state.signals]
  );
  const categoriesWithSignals = useMemo(
    () => categorySortOrder.filter((category) => signalsByCategory[category].length > 0),
    [signalsByCategory]
  );
  const detailSignal = useMemo(() => {
    if (insightsView.mode !== "detail") return null;
    return state.signals.find((item) => item.id === insightsView.signalId) ?? null;
  }, [insightsView, state.signals]);
  const activeDrawerSignal = detailSignal ?? selectedSignal;
  const activeCategoryForActions =
    insightsView.mode === "category" || insightsView.mode === "detail"
      ? insightsView.category
      : activeDrawerSignal
        ? signalToCategory(activeDrawerSignal.type)
        : null;

  useEffect(() => {
    if (insightsView.mode === "root") return;
    if (insightsView.mode === "category") {
      if (!signalsByCategory[insightsView.category].length) {
        setInsightsView({ mode: "root" });
      }
      return;
    }
    if (!detailSignal) {
      if (signalsByCategory[insightsView.category].length) {
        setInsightsView({ mode: "category", category: insightsView.category });
      } else {
        setInsightsView({ mode: "root" });
      }
    }
  }, [detailSignal, insightsView, signalsByCategory]);

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
      ? "Critico"
      : activeDrawerSignal?.severity === "high"
        ? "Alto"
        : activeDrawerSignal?.severity === "medium"
          ? "Medio"
          : "Baixo";
  const activeCategoryLabel = activeCategoryForActions
    ? categoryLabelById[activeCategoryForActions]
    : null;
  const showFab =
    Boolean(session) &&
    !publicRoutes.has(normalizedPath) &&
    normalizedPath !== "/" &&
    normalizedPath !== "/index" &&
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

  useEffect(() => {
    if (!(showFab && state.hasUnreadUpdates)) {
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
  }, [pulseAnim, showFab, state.hasUnreadUpdates]);

  return (
    <CopilotContext.Provider value={value}>
      {children}
      {showFab ? (
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
            accessibilityLabel="Abrir insights"
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.primaryBg,
              paddingHorizontal: 16,
              paddingVertical: 12,
              minHeight: 44,
              minWidth: 112,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOpacity: 0.22,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 5,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ color: colors.primaryText, fontWeight: "800", fontSize: 13 }}>
                Insights
              </Text>
              {state.hasUnreadUpdates ? (
                <View
                  style={{
                    borderRadius: 999,
                    width: 8,
                    height: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.primaryText,
                  }}
                />
              ) : null}
            </View>
          </Pressable>
        </View>
      ) : null}

      <ModalSheet
        visible={state.open}
        onClose={close}
        backdropOpacity={0.62}
        cardStyle={{
          width: Platform.OS === "web" ? "96%" : "100%",
          maxWidth: sheetMaxWidth,
          alignSelf: "center",
          maxHeight: sheetMaxHeight,
          minHeight: sheetMinHeight,
          marginBottom: Platform.OS === "web" ? 16 : 0,
          borderBottomLeftRadius: Platform.OS === "web" ? 18 : 0,
          borderBottomRightRadius: Platform.OS === "web" ? 18 : 0,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          overflow: "hidden",
          padding: 14,
          paddingBottom: sheetContentBottomPadding,
          gap: 12,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Insights</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {state.context?.title ?? state.context?.screen ?? "Visao operacional"}
            </Text>
          </View>
          <Pressable
            onPress={close}
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Fechar</Text>
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator
          contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
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
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>Temas do momento</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {categoriesWithSignals.length
                  ? "Selecione um tema para abrir os insights."
                  : "Nenhum insight relevante neste momento."}
              </Text>
              {categoriesWithSignals.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {categoriesWithSignals.map((category) => (
                    <Pressable
                      key={category}
                      onPress={() => setInsightsView({ mode: "category", category })}
                      style={{
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.secondaryBg,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                        {categoryLabelById[category]}
                      </Text>
                    </Pressable>
                  ))}
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
                Toque em um insight para ver detalhes e acoes relacionadas.
              </Text>
              {signalsByCategory[insightsView.category].map((signal) => {
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
                        signalId: signal.id,
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

          {insightsView.mode === "detail" && activeDrawerSignal ? (
            <>
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: "800" }}>
                  {activeCategoryLabel ?? "Insight selecionado"}
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
                <Text style={{ color: colors.text, fontWeight: "800" }}>Acoes gerais</Text>
                {recommendedActions.length ? (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    As acoes recomendadas para este insight aparecem primeiro.
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
                  <Text style={{ color: colors.muted }}>Sem acoes disponiveis neste contexto.</Text>
                )}
              </View>
            </>
          ) : null}
        </ScrollView>
      </ModalSheet>
    </CopilotContext.Provider>
  );
}

export function useCopilot() {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error("useCopilot must be used within CopilotProvider");
  }
  return {
    open: context.open,
    close: context.close,
    runAction: context.runAction,
    isOpen: context.state.open,
    actionCount: context.state.actions.length,
    signalCount: context.state.signals.length,
    hasUnreadUpdates: context.state.hasUnreadUpdates,
    unreadCount: context.state.unreadCount,
    signals: context.state.signals,
    activeSignal:
      context.state.signals.find((item) => item.id === context.state.selectedSignalId) ?? null,
    setActiveSignal: context.setActiveSignal,
    context: context.state.context,
    history: context.state.history,
  };
}

export function useOptionalCopilot() {
  const context = useContext(CopilotContext);
  if (!context) return null;
  return {
    open: context.open,
    close: context.close,
    runAction: context.runAction,
    isOpen: context.state.open,
    actionCount: context.state.actions.length,
    signalCount: context.state.signals.length,
    hasUnreadUpdates: context.state.hasUnreadUpdates,
    unreadCount: context.state.unreadCount,
    signals: context.state.signals,
    activeSignal:
      context.state.signals.find((item) => item.id === context.state.selectedSignalId) ?? null,
    setActiveSignal: context.setActiveSignal,
    context: context.state.context,
    history: context.state.history,
  };
}

export function useCopilotContext(input: CopilotContextData | null) {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error("useCopilotContext must be used within CopilotProvider");
  }

  const ownerIdRef = useRef(`copilot_ctx_${Math.random().toString(36).slice(2, 10)}`);
  const payload = useMemo(() => input, [input]);

  useEffect(() => {
    const ownerId = ownerIdRef.current;
    context.setContext(ownerId, payload);
    return () => {
      context.clearContext(ownerId);
    };
  }, [context, payload]);
}

export function useCopilotActions(actions: CopilotAction[]) {
  const context = useContext(CopilotContext);
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
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error("useCopilotSignals must be used within CopilotProvider");
  }

  const ownerIdRef = useRef(`copilot_signals_${Math.random().toString(36).slice(2, 10)}`);
  const stableSignals = useMemo(() => sortCopilotSignals(signals), [signals]);

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
    width: 120,
    height: 52,
    borderRadius: 999,
    borderWidth: 2,
  },
});

export type { CopilotAction, CopilotActionResult, CopilotContextData, CopilotSignal };



