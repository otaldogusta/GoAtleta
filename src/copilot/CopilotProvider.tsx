import { usePathname } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "../auth/auth";
import { Pressable } from "../ui/Pressable";
import { useAppTheme } from "../ui/app-theme";

type CopilotContextData = {
  screen: string;
  title?: string;
  subtitle?: string;
  chips?: { label: string; value: string }[];
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
  open: boolean;
  runningActionId: string | null;
  history: CopilotHistoryItem[];
};

type CopilotInternalContext = {
  state: CopilotState;
  setContext: (ownerId: string, context: CopilotContextData | null) => void;
  clearContext: (ownerId: string) => void;
  setActions: (ownerId: string, actions: CopilotAction[]) => void;
  clearActions: (ownerId: string) => void;
  open: () => void;
  close: () => void;
  runAction: (action: CopilotAction) => Promise<void>;
};

const CopilotContext = createContext<CopilotInternalContext | null>(null);

const MAX_HISTORY_ITEMS = 12;

const publicRoutes = new Set(["/welcome", "/login", "/signup", "/reset-password"]);

const toActionResult = (value: CopilotActionResult | string | void): CopilotActionResult => {
  if (!value) return { message: "Ação concluída." };
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

  const contextRegistryRef = useRef<Map<string, CopilotContextData | null>>(new Map());
  const actionsRegistryRef = useRef<Map<string, CopilotAction[]>>(new Map());
  const activeOwnerRef = useRef<string | null>(null);

  const [state, setState] = useState<CopilotState>({
    context: null,
    actions: [],
    open: false,
    runningActionId: null,
    history: [],
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

  const open = useCallback(() => {
    setState((prev) => ({ ...prev, open: true }));
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const runAction = useCallback(async (action: CopilotAction) => {
    const requirementError = action.requires?.(state.context ?? null);
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
      const output = await action.run(state.context ?? null);
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
        message: error instanceof Error ? error.message : "Falha ao executar ação do Copilot.",
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
  }, [state.context]);

  const value = useMemo<CopilotInternalContext>(
    () => ({
      state,
      setContext,
      clearContext,
      setActions,
      clearActions,
      open,
      close,
      runAction,
    }),
    [state, setContext, clearContext, setActions, clearActions, open, close, runAction]
  );

  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const showFab =
    Boolean(session) &&
    !publicRoutes.has(normalizedPath) &&
    state.actions.length > 0 &&
    !normalizedPath.startsWith("/invite");

  return (
    <CopilotContext.Provider value={value}>
      {children}
      {showFab ? (
        <View pointerEvents="box-none" style={styles.fabWrapper}>
          <Pressable
            onPress={open}
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.primaryBg,
              paddingHorizontal: 16,
              paddingVertical: 12,
              shadowColor: "#000",
              shadowOpacity: 0.22,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 5,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "800", fontSize: 13 }}>
              Copilot
            </Text>
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
              maxHeight: "78%",
              minHeight: "52%",
              padding: 14,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ gap: 2 }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Copilot</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {state.context?.title ?? state.context?.screen ?? "Assistência contextual"}
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
              <Text style={{ color: colors.text, fontWeight: "800" }}>Ações sugeridas</Text>
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

            <View style={{ gap: 8, flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>Histórico</Text>
              <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
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

const styles = StyleSheet.create({
  fabWrapper: {
    position: "absolute",
    right: 16,
    bottom: 24,
    zIndex: 90,
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(4, 8, 16, 0.48)",
  },
  overlayCloseArea: {
    flex: 1,
  },
});

export type { CopilotAction, CopilotActionResult, CopilotContextData };
