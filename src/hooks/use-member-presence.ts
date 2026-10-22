import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { supabasePost } from "../db/client";
import { getSessionIdentity } from "../auth/session";

export type MemberPresence = "online" | "offline" | "unknown";
const foreground = () => AppState.currentState === "active" && (Platform.OS !== "web" || document.visibilityState === "visible");
const missingRpc = (error: unknown) => /PGRST202|42883/.test(String(error));

/** One activity signal per active account/institution, not per profile viewed. */
export function useMemberPresenceHeartbeat(organizationId: string | null, userId?: string) {
  useEffect(() => {
    if (!organizationId || !userId) return;
    const identity = getSessionIdentity();
    if (identity.userId !== userId) return;
    let stopped = false;
    let busy = false;
    const tick = () => {
      if (stopped || busy || !foreground()) return;
      busy = true;
      void supabasePost("/rpc/touch_my_org_presence", { p_org_id: organizationId }, undefined, identity)
        .catch(error => { if (missingRpc(error)) stopped = true; })
        .finally(() => { busy = false; });
    };
    tick();
    const timer = setInterval(tick, 30_000);
    const subscription = AppState.addEventListener("change", tick);
    if (Platform.OS === "web") document.addEventListener("visibilitychange", tick);
    return () => {
      stopped = true;
      clearInterval(timer);
      subscription.remove();
      if (Platform.OS === "web") document.removeEventListener("visibilitychange", tick);
    };
  }, [organizationId, userId]);
}

/** A missing signal or failed/stale read is unknown, never a fabricated offline. */
export function useMemberPresence(organizationId?: string, userId?: string): MemberPresence {
  const scope = `${organizationId ?? ""}:${userId ?? ""}`;
  const [result, setResult] = useState<{ scope: string; status: MemberPresence; at: number } | null>(null);
  useEffect(() => {
    if (!organizationId || !userId) return;
    const identity = getSessionIdentity();
    let active = true;
    let busy = false;
    let unavailable = false;
    const tick = () => {
      setResult(current => current && Date.now() - current.at > 45_000 ? null : current);
      if (busy || unavailable || !foreground()) return;
      busy = true;
      void supabasePost<{ status: MemberPresence }[]>("/rpc/get_org_member_presence", { p_org_id: organizationId, p_user_id: userId }, { Prefer: "return=representation" }, identity)
        .then(rows => {
          if (!active) return;
          const status = rows?.[0]?.status;
          setResult({ scope, status: status === "online" || status === "offline" ? status : "unknown", at: Date.now() });
        })
        .catch(error => { if (active) { unavailable = missingRpc(error); setResult(null); } })
        .finally(() => { busy = false; });
    };
    // Keep updates asynchronous and scoped when mounting/changing identities.
    void Promise.resolve().then(() => { if (active) tick(); });
    const timer = setInterval(tick, 20_000);
    const subscription = AppState.addEventListener("change", tick);
    if (Platform.OS === "web") document.addEventListener("visibilitychange", tick);
    return () => {
      active = false;
      clearInterval(timer);
      subscription.remove();
      if (Platform.OS === "web") document.removeEventListener("visibilitychange", tick);
    };
  }, [organizationId, scope, userId]);
  return result?.scope === scope ? result.status : "unknown";
}
