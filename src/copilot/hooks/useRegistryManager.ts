import { Dispatch, MutableRefObject, SetStateAction, useCallback, useRef } from "react";

import type { Signal as CopilotSignal } from "../../ai/signal-engine";
import { isValidCopilotSignal, sortCopilotSignals } from "../signal-utils";

// Local copies of the types that this hook works with — kept in sync with CopilotProvider.tsx
export type CopilotContextData = {
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

export type CopilotAction = {
  id: string;
  title: string;
  description?: string;
  requires?: (ctx: CopilotContextData | null) => string | null;
  run: (ctx: CopilotContextData | null) => Promise<CopilotActionResult | string | void> | CopilotActionResult | string | void;
};

// Minimal shape of the parent state that this hook reads/writes
type RegistryStatePatch = {
  context: CopilotContextData | null;
  actions: CopilotAction[];
  signals: CopilotSignal[];
  selectedSignalId: string | null;
};

export type RegistryManager = {
  contextRegistryRef: MutableRefObject<Map<string, CopilotContextData | null>>;
  actionsRegistryRef: MutableRefObject<Map<string, CopilotAction[]>>;
  signalsRegistryRef: MutableRefObject<Map<string, CopilotSignal[]>>;
  activeOwnerRef: MutableRefObject<string | null>;
  setContext: (ownerId: string, context: CopilotContextData | null) => void;
  clearContext: (ownerId: string) => void;
  setActions: (ownerId: string, actions: CopilotAction[]) => void;
  clearActions: (ownerId: string) => void;
  setSignals: (ownerId: string, signals: CopilotSignal[]) => void;
  clearSignals: (ownerId: string) => void;
  setActiveSignal: (signalId: string | null) => void;
};

export function useRegistryManager<S extends RegistryStatePatch>(
  setState: Dispatch<SetStateAction<S>>
): RegistryManager {
  const contextRegistryRef = useRef<Map<string, CopilotContextData | null>>(new Map());
  const actionsRegistryRef = useRef<Map<string, CopilotAction[]>>(new Map());
  const signalsRegistryRef = useRef<Map<string, CopilotSignal[]>>(new Map());
  const activeOwnerRef = useRef<string | null>(null);

  const setContext = useCallback((ownerId: string, context: CopilotContextData | null) => {
    contextRegistryRef.current.set(ownerId, context);
    activeOwnerRef.current = ownerId;
    setState((prev) => ({ ...prev, context } as S));
  }, [setState]);

  const clearContext = useCallback((ownerId: string) => {
    contextRegistryRef.current.delete(ownerId);
    const activeOwner = activeOwnerRef.current;
    if (activeOwner === ownerId) {
      const nextContext = contextRegistryRef.current.size
        ? Array.from(contextRegistryRef.current.values())[contextRegistryRef.current.size - 1] ?? null
        : null;
      setState((prev) => ({ ...prev, context: nextContext } as S));
    }
  }, [setState]);

  const setActions = useCallback((ownerId: string, actions: CopilotAction[]) => {
    actionsRegistryRef.current.set(ownerId, actions);
    activeOwnerRef.current = ownerId;
    setState((prev) => ({ ...prev, actions } as S));
  }, [setState]);

  const clearActions = useCallback((ownerId: string) => {
    actionsRegistryRef.current.delete(ownerId);
    const activeOwner = activeOwnerRef.current;
    if (activeOwner === ownerId) {
      const nextActions = actionsRegistryRef.current.size
        ? Array.from(actionsRegistryRef.current.values())[actionsRegistryRef.current.size - 1] ?? []
        : [];
      setState((prev) => ({ ...prev, actions: nextActions } as S));
    }
  }, [setState]);

  const setSignals = useCallback((ownerId: string, signals: CopilotSignal[]) => {
    const sortedSignals = sortCopilotSignals((signals ?? []).filter(isValidCopilotSignal));
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
      } as S;
    });
  }, [setState]);

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
      } as S));
    }
  }, [setState]);

  const setActiveSignal = useCallback((signalId: string | null) => {
    setState((prev) => {
      if (!signalId) return { ...prev, selectedSignalId: null } as S;
      const exists = prev.signals.some((item) => item.id === signalId);
      return { ...prev, selectedSignalId: exists ? signalId : prev.selectedSignalId } as S;
    });
  }, [setState]);

  return {
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
  };
}
