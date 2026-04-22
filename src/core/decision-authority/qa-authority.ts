export type QaAuthorityRole =
  | "observes"
  | "summarizes"
  | "signals_drift"
  | "does_not_decide";

export const QA_AUTHORITY = {
  observes: true,
  summarizes: true,
  signalsDrift: true,
  decides: false,
  modifiesPlan: false,
} as const;

export function isQaObservationalOnly(): boolean {
  return QA_AUTHORITY.decides === false && QA_AUTHORITY.modifiesPlan === false;
}
