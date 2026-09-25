import { useEffect, useState } from "react";

import { isPlatformAdmin } from "../api/organization-access-requests";
import { useAuth } from "./auth";

export function usePlatformAdminAccessState() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [result, setResult] = useState<{
    userId: string | null;
    allowed: boolean;
    loading: boolean;
  }>({ userId: null, allowed: false, loading: Boolean(userId) });

  useEffect(() => {
    let active = true;

    if (!userId) {
      return () => {
        active = false;
      };
    }

    void isPlatformAdmin()
      .then((isAllowed) => {
        if (active) {
          setResult({ userId, allowed: isAllowed, loading: false });
        }
      })
      .catch(() => {
        if (active) {
          setResult({ userId, allowed: false, loading: false });
        }
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const resultMatchesCurrentUser = result.userId === userId;
  return {
    allowed:
      Boolean(userId) && resultMatchesCurrentUser ? result.allowed : false,
    loading: Boolean(userId) && (!resultMatchesCurrentUser || result.loading),
  };
}

export function usePlatformAdminAccess() {
  return usePlatformAdminAccessState().allowed;
}
