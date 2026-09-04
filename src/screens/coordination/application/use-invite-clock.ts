import { useEffect, useState } from "react";
import { AppState } from "react-native";
import type { TrainerInviteItem } from "../../../api/trainer-invite";

// Re-evaluate even when the list stays open across an invitation's deadline.
export function useInviteClock(invites: TrainerInviteItem[]) {
  const [nowMs, setNowMs] = useState(Date.now);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      const now = Date.now();
      setNowMs(now);
      const nextExpiry = Math.min(...invites
        .filter((invite) => !invite.revoked && !invite.claimed_by && !invite.claimed_at && invite.uses < invite.max_uses)
        .map((invite) => Date.parse(invite.expires_at ?? ""))
        .filter((expiresAt) => Number.isFinite(expiresAt) && expiresAt > now));
      if (Number.isFinite(nextExpiry)) {
        timer = setTimeout(refresh, Math.min(nextExpiry - now, 2_147_483_647));
      }
    };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    if (typeof window !== "undefined") window.addEventListener?.("focus", refresh);
    return () => {
      clearTimeout(timer);
      subscription.remove();
      if (typeof window !== "undefined") window.removeEventListener?.("focus", refresh);
    };
  }, [invites]);

  return nowMs;
}
