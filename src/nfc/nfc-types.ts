export type NfcSupportInfo = {
  available: boolean;
  enabled: boolean;
  reason?: string;
};

export type NfcScanResult = {
  uid: string;
  rawTag: unknown;
};
