import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestContextualInsight } from "../../api/contextual-insight";
import { buildWorkspaceScopeKey } from "../../core/ai-workspace-context";

export type ContextualInsight = {
  insight: string;
  confidence: number;
  based_on: string[];
  action?: {
    type: string;
    label: string;
    params: {
      phone: string;
      message: string;
    };
  } | null;
};

type ClassSnapshot = {
  name?: string | null;
  ageBand?: string | null;
  modality?: string | null;
  goal?: string | null;
  daysOfWeek?: number[] | null;
  mvLevel?: string | null;
};

type UseContextualInsightResult = {
  insight: ContextualInsight | null;
  loading: boolean;
  dismiss: () => void;
};

const PROACTIVE_DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const buildDismissKey = (scopeKey: string) =>
  `contextual_insight_dismissed_v2:${scopeKey}`;

const parseInsightAction = (
  value: unknown
): ContextualInsight["action"] => {
  if (!value || typeof value !== "object") return null;

  const action = value as {
    type?: unknown;
    label?: unknown;
    params?: {
      phone?: unknown;
      message?: unknown;
    };
  };

  if (
    typeof action.type !== "string" ||
    typeof action.label !== "string" ||
    !action.params ||
    typeof action.params.phone !== "string" ||
    typeof action.params.message !== "string"
  ) {
    return null;
  }

  return {
    type: action.type,
    label: action.label,
    params: {
      phone: action.params.phone,
      message: action.params.message,
    },
  };
};

const isDismissedToday = async (scopeKey: string): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(buildDismissKey(scopeKey));
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { dismissedAt: number; insight: string };
    return Date.now() - parsed.dismissedAt < PROACTIVE_DISMISS_TTL_MS;
  } catch {
    return false;
  }
};

const persistDismiss = async (scopeKey: string, insight: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      buildDismissKey(scopeKey),
      JSON.stringify({ dismissedAt: Date.now(), insight })
    );
  } catch {
    // Non-blocking — dismissal state is best-effort
  }
};

export function useContextualInsight(
  organizationId: string | null | undefined,
  classId: string | null | undefined,
  classSnapshot: ClassSnapshot | null | undefined
): UseContextualInsightResult {
  const [insight, setInsight] = useState<ContextualInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fetchedForRef = useRef<string | null>(null);

  const fetchInsight = useCallback(async (
    workspaceId: string,
    id: string,
    snapshot: ClassSnapshot
  ) => {
    const scopeKey = buildWorkspaceScopeKey(workspaceId, id);
    if (fetchedForRef.current === scopeKey) return;
    fetchedForRef.current = scopeKey;

    const alreadyDismissed = await isDismissedToday(scopeKey);
    if (alreadyDismissed) return;

    setLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const payload = await requestContextualInsight({
        organizationId: workspaceId,
        classId: id,
        classSnapshot: snapshot,
        signal: controller.signal,
      });

      if (
        payload?.insight &&
        typeof payload.insight === "string" &&
        typeof payload.confidence === "number" &&
        payload.confidence >= 0.60
      ) {
        setInsight({
          insight: payload.insight,
          confidence: payload.confidence,
          based_on: Array.isArray(payload.based_on) ? payload.based_on : [],
          action: parseInsightAction(payload.action),
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    Promise.resolve().then(() => {
      setInsight(null);
    });
    Promise.resolve().then(() => {
      setLoading(false);
    });
    fetchedForRef.current = null;

    if (!organizationId || !classId || !classSnapshot) return;
    const timer = setTimeout(() => {
      void fetchInsight(organizationId, classId, classSnapshot);
    }, 1500);
    return () => clearTimeout(timer);
  }, [organizationId, classId, classSnapshot, fetchInsight]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const dismiss = useCallback(() => {
    if (insight && organizationId && classId) {
      const scopeKey = buildWorkspaceScopeKey(organizationId, classId);
      void persistDismiss(scopeKey, insight.insight);
    }
    setInsight(null);
  }, [insight, organizationId, classId]);

  return { insight, loading, dismiss };
}
