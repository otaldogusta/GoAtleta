import AsyncStorage from "@react-native-async-storage/async-storage";
import { Dispatch, SetStateAction, useCallback, useEffect, useRef } from "react";

import type { RegulationRuleSet } from "../../api/regulation-rule-sets";
import { listRegulationRuleSets } from "../../api/regulation-rule-sets";
import type { RegulationUpdate } from "../../api/regulation-updates";
import { listRegulationUpdates } from "../../api/regulation-updates";
import { addNotification } from "../../notificationsInbox";
import { measureAsync } from "../../observability/perf";

const REGULATION_NOTIFIED_STORAGE_PREFIX = "reg_updates_notified_v1";
const REGULATION_POLL_INTERVAL_MS = 90_000;

const buildRegulationNotificationKey = (userId: string, organizationId: string) =>
  `${REGULATION_NOTIFIED_STORAGE_PREFIX}:${userId}:${organizationId}`;

const normalizeNotificationIds = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const item of value) {
    const id = String(item ?? "").trim();
    if (id) unique.add(id);
  }
  return Array.from(unique);
};

type RegulationStatePatch = {
  regulationUpdates: RegulationUpdate[];
  regulationRuleSets: RegulationRuleSet[];
};

type Session = {
  user?: { id?: string };
} | null;

export type RegulationUpdatesManager = {
  loadRegulationUpdates: () => Promise<void>;
};

export function useRegulationUpdates<S extends RegulationStatePatch>(
  setState: Dispatch<SetStateAction<S>>,
  activeOrganizationId: string | null | undefined,
  session: Session,
  isOpen: boolean
): RegulationUpdatesManager {
  const notifiedUpdatesCacheKeyRef = useRef<string | null>(null);
  const notifiedUpdateIdsRef = useRef<Set<string>>(new Set());

  const loadNotifiedRegulationIds = useCallback(async () => {
    const userId = session?.user?.id ?? "";
    const organizationId = activeOrganizationId ?? "";
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
    const organizationId = activeOrganizationId ?? "";
    if (!organizationId) {
      setState((prev) => ({ ...prev, regulationUpdates: [], regulationRuleSets: [] } as S));
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
      } as S));

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
      setState((prev) => ({ ...prev, regulationUpdates: [], regulationRuleSets: [] } as S));
    }
  }, [activeOrganizationId, loadNotifiedRegulationIds, persistNotifiedRegulationIds, setState]);

  useEffect(() => {
    void loadRegulationUpdates();
  }, [loadRegulationUpdates]);

  useEffect(() => {
    if (!isOpen) return;
    void loadRegulationUpdates();
    const timer = setInterval(() => {
      void loadRegulationUpdates();
    }, REGULATION_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadRegulationUpdates, isOpen]);

  return { loadRegulationUpdates };
}
