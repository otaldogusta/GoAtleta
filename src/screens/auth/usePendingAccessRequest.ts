import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  listMyOrganizationAccessRequests,
  type OrganizationAccessRequest,
} from "../../api/organization-access-requests";

type ReadState = {
  identity: string | null;
  request: OrganizationAccessRequest | null;
  error: string;
  loading: boolean;
  observedPending: boolean;
};

const emptyState = (identity: string | null): ReadState => ({
  identity, request: null, error: "", loading: false, observedPending: false,
});

/** Read feedback belongs to the current session, independently of invite actions. */
export function usePendingAccessRequest(identity: string | null) {
  const [state, setState] = useState<ReadState>(() => emptyState(identity));
  const currentIdentity = useRef(identity);
  useLayoutEffect(() => { currentIdentity.current = identity; }, [identity]);
  const generation = useRef(0);
  const alive = useRef(true);
  const inFlight = useRef<{ identity: string; promise: Promise<void> } | null>(null);

  const reload = useCallback((): Promise<void> => {
    if (!identity) return Promise.resolve();
    if (inFlight.current?.identity === identity) return inFlight.current.promise;
    const requestGeneration = ++generation.current;
    const current = () => alive.current && currentIdentity.current === identity && generation.current === requestGeneration;
    setState(previous => ({ ...(previous.identity === identity ? previous : emptyState(identity)), loading: true, error: "" }));
    const promise = Promise.resolve().then(async () => {
      try {
        if (!current()) return;
        const requests = await listMyOrganizationAccessRequests();
        if (!current()) return;
        const relevant = requests.filter(item => item.requestKind === "athlete" || item.requestKind === "guardian");
        const next = relevant.find(item => item.status === "pending")
          ?? requests.find(item => item.status === "pending" && item.requestKind === "staff")
          ?? relevant[0] ?? null;
        setState(previous => ({
          identity, request: next, loading: false, error: "",
          observedPending: (previous.identity === identity && previous.observedPending) || next?.status === "pending",
        }));
      } catch {
        if (!current()) return;
        setState(previous => ({
          ...(previous.identity === identity ? previous : emptyState(identity)),
          loading: false, error: "Não foi possível consultar a solicitação. Tente novamente.",
        }));
      } finally {
        if (inFlight.current?.promise === promise) inFlight.current = null;
      }
    });
    inFlight.current = { identity, promise };
    return promise;
  }, [identity]);

  useEffect(() => {
    alive.current = true;
    void reload();
    return () => {
      alive.current = false;
      generation.current += 1;
      inFlight.current = null;
    };
  }, [reload]);

  const owned = state.identity === identity ? state : emptyState(identity);
  return { ...owned, reload };
}
