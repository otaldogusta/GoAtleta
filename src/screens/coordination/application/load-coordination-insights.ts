import { getSignals } from "../../../ai/signal-engine";
import { listAdminRecentActivity } from "../../../api/reports";
import type { ClassGroup } from "../../../core/models";
import { getSessionLogsByRange } from "../../../db/session";
import { buildCoordinationRadar } from "./coordination-radar";

// Optional intelligence has its own result and failure boundary. It never
// prevents the critical operational snapshot from opening the workspace.
export async function loadCoordinationInsights(
  organizationId: string,
  classes: readonly ClassGroup[],
  now = new Date(),
) {
  if (!organizationId.trim()) throw new Error("Organização não informada.");
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [recentActivity, sessionLogs, signals] = await Promise.all([
    listAdminRecentActivity({ organizationId, limit: 12 }),
    getSessionLogsByRange(start.toISOString(), now.toISOString(), { organizationId }),
    getSignals({ organizationId }),
  ]);
  return { recentActivity, signals, classRadarItems: buildCoordinationRadar(classes, sessionLogs) };
}

export type CoordinationInsights = Awaited<ReturnType<typeof loadCoordinationInsights>>;
