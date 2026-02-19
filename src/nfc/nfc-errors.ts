export const NFC_ERRORS = {
  NOT_AVAILABLE: "NFC_NOT_AVAILABLE",
  NOT_ENABLED: "NFC_NOT_ENABLED",
  READ_FAILED: "NFC_READ_FAILED",
  CANCELLED: "NFC_CANCELLED",
  TAG_UID_MISSING: "NFC_TAG_UID_MISSING",
} as const;

export type NfcErrorCode = (typeof NFC_ERRORS)[keyof typeof NFC_ERRORS];

export class NfcError extends Error {
  code: NfcErrorCode;

  constructor(code: NfcErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
