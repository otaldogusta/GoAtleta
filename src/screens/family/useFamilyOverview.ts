import { useCallback, useEffect, useRef, useState } from "react";

import {
  getMyFamilyOverview,
  type FamilyOverview,
} from "../../api/family-access";
import { useRole } from "../../auth/role";
import { measureAsync } from "../../observability/perf";

type FamilyOverviewRequestState = {
  relationshipId: string | null;
  overview: FamilyOverview | null;
  loading: boolean;
  failed: boolean;
};

const emptyOverviewRequestState: FamilyOverviewRequestState = {
  relationshipId: null,
  overview: null,
  loading: false,
  failed: false,
};

export function useFamilyOverview() {
  const { selectedFamilyStudent } = useRole();
  const relationshipId = selectedFamilyStudent?.relationshipId ?? null;
  const requestIdRef = useRef(0);
  const [requestState, setRequestState] = useState<FamilyOverviewRequestState>(
    emptyOverviewRequestState,
  );

  const refresh = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!relationshipId) {
      setRequestState(emptyOverviewRequestState);
      return;
    }

    setRequestState((current) => ({
      relationshipId,
      overview:
        current.relationshipId === relationshipId ? current.overview : null,
      loading: true,
      failed: false,
    }));

    try {
      const nextOverview = await measureAsync(
        "screen.familyOverview.load.summary",
        () => getMyFamilyOverview(relationshipId),
        { relationshipId },
      );

      if (requestIdRef.current !== requestId) return;
      setRequestState({
        relationshipId,
        overview: nextOverview,
        loading: false,
        failed: false,
      });
    } catch {
      if (requestIdRef.current !== requestId) return;
      setRequestState({
        relationshipId,
        overview: null,
        loading: false,
        failed: true,
      });
    }
  }, [relationshipId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [refresh]);

  const stateMatchesSelection =
    Boolean(relationshipId) && requestState.relationshipId === relationshipId;
  const overview = stateMatchesSelection ? requestState.overview : null;
  const loading =
    Boolean(relationshipId) &&
    (!stateMatchesSelection || requestState.loading);
  const failed = stateMatchesSelection && requestState.failed;

  return { overview, loading, failed, refresh };
}
