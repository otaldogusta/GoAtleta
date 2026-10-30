import { useEffect, useState } from "react";

import { isPlatformAdmin } from "../api/organization-access-requests";
import { useAuth } from "./auth";
import { getSessionIdentity, isSessionIdentityCurrent } from "./session";

export function usePlatformAdminAccessState() {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  const identity = getSessionIdentity();
  const identityUserId = identity.userId;
  const identityGeneration = identity.generation;
  const [result, setResult] = useState<{
    userId: string | null;
    generation: number | null;
    allowed: boolean;
    loading: boolean;
  }>({ userId: null, generation: null, allowed: false, loading: Boolean(userId) });

  useEffect(() => {
    let active = true;

    const requestIdentity = getSessionIdentity();
    if (authLoading || !userId || identityUserId !== userId || requestIdentity.userId !== userId || requestIdentity.generation !== identityGeneration) {
      return () => {
        active = false;
      };
    }

    void isPlatformAdmin()
      .then((isAllowed) => {
        if (active && isSessionIdentityCurrent(requestIdentity)) {
          setResult({ userId, generation: requestIdentity.generation, allowed: isAllowed, loading: false });
        }
      })
      .catch(() => {
        if (active && isSessionIdentityCurrent(requestIdentity)) {
          setResult({ userId, generation: requestIdentity.generation, allowed: false, loading: false });
        }
      });

    return () => {
      active = false;
    };
  }, [authLoading, userId, identityUserId, identityGeneration]);

  const resultMatchesCurrentUser = result.userId === userId &&
    identityUserId === userId && result.generation === identityGeneration;
  return {
    allowed:
      !authLoading && Boolean(userId) && resultMatchesCurrentUser ? result.allowed : false,
    loading: authLoading || (Boolean(userId) && (!resultMatchesCurrentUser || result.loading)),
  };
}

export function usePlatformAdminAccess() {
  return usePlatformAdminAccessState().allowed;
}
