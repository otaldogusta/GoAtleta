import AsyncStorage from "@react-native-async-storage/async-storage";
import { safeJsonParse } from "../utils/safe-json";
import { safeNumber } from "../utils/safe-number";

export type NfcMetricKey =
  | "totalScans"
  | "duplicateScans"
  | "checkinsSynced"
  | "checkinsPending"
  | "syncRuns"
  | "syncFlushed"
  | "syncErrors"
  | "bindCreated"
  | "bindDenied"
  | "readErrors";

export type NfcMetrics = {
  totalScans: number;
  duplicateScans: number;
  checkinsSynced: number;
  checkinsPending: number;
  syncRuns: number;
  syncFlushed: number;
  syncErrors: number;
  bindCreated: number;
  bindDenied: number;
  readErrors: number;
  updatedAt: string;
};

const KEY_PREFIX = "nfc_metrics_v1";

const buildStorageKey = (organizationId: string) => `${KEY_PREFIX}:${organizationId}`;

const emptyMetrics = (): NfcMetrics => ({
  totalScans: 0,
  duplicateScans: 0,
  checkinsSynced: 0,
  checkinsPending: 0,
  syncRuns: 0,
  syncFlushed: 0,
  syncErrors: 0,
  bindCreated: 0,
  bindDenied: 0,
  readErrors: 0,
  updatedAt: new Date().toISOString(),
});

export async function getNfcMetrics(organizationId: string): Promise<NfcMetrics> {
  if (!organizationId) return emptyMetrics();
  try {
    const raw = await AsyncStorage.getItem(buildStorageKey(organizationId));
    if (!raw) return emptyMetrics();
    const parsed = safeJsonParse<Partial<NfcMetrics>>(raw, {});
    return {
      ...emptyMetrics(),
      ...parsed,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return emptyMetrics();
  }
}

export async function incrementNfcMetric(
  organizationId: string,
  key: NfcMetricKey,
  delta = 1
): Promise<NfcMetrics> {
  const current = await getNfcMetrics(organizationId);
  const next: NfcMetrics = {
    ...current,
    [key]: Math.max(0, safeNumber(current[key], 0) + delta),
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(buildStorageKey(organizationId), JSON.stringify(next));
  return next;
}
