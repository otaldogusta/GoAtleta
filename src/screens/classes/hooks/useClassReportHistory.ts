import { useCallback, useEffect, useMemo, useState } from "react";
import { getClassReportHistory, type SessionReportSummary } from "../../../db/session-report-history";
import { buildReportHistory } from "../application/report-history";

export function useClassReportHistory({ enabled, classId, organizationId, userId }: {
  enabled: boolean; classId: string; organizationId: string; userId: string;
}) {
  const scope = `${userId}:${organizationId}:${classId}`;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ scope: string; logs: SessionReportSummary[]; loading: boolean; error: boolean }>({ scope, logs: [], loading: true, error: false });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setState(current => ({ scope, logs: current.scope === scope ? current.logs : [], loading: true, error: false }));
      return getClassReportHistory({ classId, organizationId, userId, signal: controller.signal });
    })
      .then(logs => {
        if (!controller.signal.aborted && logs) setState({ scope, logs, loading: false, error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ scope, logs: [], loading: false, error: true });
      });
    return () => controller.abort();
  }, [enabled, classId, organizationId, userId, scope, revision]);
  const entries = useMemo(() => state.scope === scope ? buildReportHistory(state.logs) : [], [state.logs, state.scope, scope]);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  return { entries, loading: state.scope !== scope || state.loading, error: state.scope === scope && state.error, reload };
}
