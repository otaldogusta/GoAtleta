import { usePathname } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
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
  const { height: viewportHeight } = useWindowDimensions();

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
        message: error instanceof Error ? error.message : "Falha ao executar acao do assistente.",
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
  const recommendedActions = useMemo(() => {
    return getRecommendedSignalActions(selectedSignal, state.actions);
  }, [selectedSignal, state.actions]);
  const showFab =
    Boolean(session) &&
    !publicRoutes.has(normalizedPath) &&
    normalizedPath !== "/" &&
    normalizedPath !== "/index" &&
    !normalizedPath.startsWith("/home") &&
    !normalizedPath.startsWith("/invite");
  const unreadBadgeLabel = state.unreadCount > 9 ? "9+" : String(state.unreadCount);
  const sheetContentBottomPadding = Math.max(
    insets.bottom + 10,
    Platform.OS === "web" ? 16 : 14
  );
  const sheetMaxHeight = Math.max(
    420,
    Math.min(viewportHeight * 0.82, viewportHeight - 16)
  );
  const sheetMinHeight = Math.min(sheetMaxHeight, Math.max(340, viewportHeight * 0.52));

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
            accessibilityLabel="Abrir assistente"
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.primaryText, fontWeight: "800", fontSize: 13 }}>
                Insights
              </Text>
              {state.unreadCount > 0 ? (
                <View
                  style={{
                    borderRadius: 999,
                    minWidth: 20,
                    height: 20,
                    paddingHorizontal: 6,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.background,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }}>{unreadBadgeLabel}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={state.open} transparent animationType="slide" onRequestClose={close}>
        <View style={styles.backdrop}>
          <Pressable onPress={close} style={styles.overlayCloseArea} />
          <View
            style={{
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              maxHeight: sheetMaxHeight,
              minHeight: sheetMinHeight,
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
                  {state.context?.title ?? state.context?.screen ?? "Assistente contextual"}
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

            {state.context?.chips?.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {state.context.chips.map((chip) => (
                  <View
                    key={`${chip.label}:${chip.value}`}
                    style={{
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                      {chip.label}: {chip.value}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>{`Sinais do momento: ${state.signals.length}`}</Text>
              {state.signals.length ? (
                <>
                  <ScrollView style={{ maxHeight: 160 }} contentContainerStyle={{ gap: 8 }}>
                    {state.signals.map((signal) => {
                      const isSelected = signal.id === selectedSignal?.id;
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
                          }}
                          style={{
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: isSelected ? colors.primaryBg : colors.border,
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
                  </ScrollView>
                  {recommendedActions.length ? (
                    <View style={{ gap: 6 }}>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                        Acoes rapidas do sinal
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {recommendedActions.map((action) => (
                          <Pressable
                            key={`signal_action_${action.id}`}
                            onPress={() => {
                              void runAction(action);
                            }}
                            disabled={Boolean(state.runningActionId)}
                            style={{
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.secondaryBg,
                              paddingHorizontal: 10,
                              paddingVertical: 7,
                              opacity: state.runningActionId ? 0.7 : 1,
                            }}
                          >
                            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{action.title}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={{ color: colors.muted }}>Sem sinais relevantes neste momento.</Text>
              )}
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>Acoes disponiveis</Text>
              <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ gap: 8 }}>
                {state.actions.length ? (
                  state.actions.map((action) => (
                    <Pressable
                      key={action.id}
                      onPress={() => {
                        void runAction(action);
                      }}
                      disabled={Boolean(state.runningActionId)}
                      style={{
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        padding: 12,
                        opacity: state.runningActionId && state.runningActionId !== action.id ? 0.6 : 1,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700" }}>
                        {state.runningActionId === action.id ? "Executando..." : action.title}
                      </Text>
                      {action.description ? (
                        <Text style={{ color: colors.muted, marginTop: 3, fontSize: 12 }}>{action.description}</Text>
                      ) : null}
                    </Pressable>
                  ))
                ) : (
                  <Text style={{ color: colors.muted }}>Sem ações disponíveis neste contexto.</Text>
                )}
              </ScrollView>
            </View>

            <View style={{ gap: 8, flexShrink: 1, maxHeight: 220 }}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>Histórico</Text>
              <ScrollView style={{ maxHeight: 188 }} contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
                {state.history.length ? (
                  state.history.map((item) => (
                    <View
                      key={item.id}
                      style={{
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        padding: 10,
                        gap: 4,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700" }}>{item.actionTitle}</Text>
                      <Text style={{ color: item.status === "success" ? colors.successText : colors.dangerText, fontSize: 12 }}>
                        {item.status === "success" ? "Concluído" : "Erro"}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>{item.message}</Text>
                      {(typeof item.confidence === "number" || typeof item.citationsCount === "number") ? (
                        <Text style={{ color: colors.muted, fontSize: 11 }}>
                          {typeof item.confidence === "number" ? `Confiança: ${Math.round(item.confidence * 100)}%` : ""}
                          {typeof item.confidence === "number" && typeof item.citationsCount === "number" ? " • " : ""}
                          {typeof item.citationsCount === "number" ? `Referências: ${item.citationsCount}` : ""}
                        </Text>
                      ) : null}
                    </View>
                  ))
                ) : (
                  <Text style={{ color: colors.muted }}>Nenhuma execução ainda.</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
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
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(4, 8, 16, 0.42)",
  },
  overlayCloseArea: {
    flex: 1,
  },
});

export type { CopilotAction, CopilotActionResult, CopilotContextData, CopilotSignal };
