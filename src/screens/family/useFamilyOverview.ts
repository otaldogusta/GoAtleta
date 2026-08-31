import { useCallback, useEffect, useState } from "react";

import {
  getMyFamilyOverview,
  type FamilyOverview,
} from "../../api/family-access";
import { useRole } from "../../auth/role";
import { measureAsync } from "../../observability/perf";

export function useFamilyOverview() {
  const { selectedFamilyStudent } = useRole();
  const [overview, setOverview] = useState<FamilyOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    const relationshipId = selectedFamilyStudent?.relationshipId;
    if (!relationshipId) {
      setOverview(null);
      setFailed(false);
      return;
    }

    setLoading(true);
    setFailed(false);
    try {
      setOverview(
        await measureAsync(
          "screen.familyOverview.load.summary",
          () => getMyFamilyOverview(relationshipId),
          { relationshipId },
        ),
      );
    } catch {
      setOverview(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [selectedFamilyStudent?.relationshipId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { overview, loading, failed, refresh };
}
