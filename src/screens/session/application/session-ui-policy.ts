import type { SessionEnvironment } from "../../../core/models";

export function shouldShowUnavailableResistanceNotice(params: {
  dismissed: boolean;
  sessionEnvironment?: SessionEnvironment | null;
  hasPersistedResistanceData: boolean;
}) {
  if (params.dismissed || params.hasPersistedResistanceData) return false;
  return params.sessionEnvironment === "academia" || params.sessionEnvironment === "mista";
}
