import { Platform } from "react-native";

import { NFC_ERRORS, NfcError } from "./nfc-errors";
import type { NfcScanResult, NfcSupportInfo } from "./nfc-types";

type NfcManagerModule = {
  default: {
    start: () => Promise<void>;
    isSupported: () => Promise<boolean>;
    isEnabled: () => Promise<boolean>;
    requestTechnology: (tech: unknown, options?: { alertMessage?: string }) => Promise<void>;
    getTag: () => Promise<any>;
    cancelTechnologyRequest: () => Promise<void>;
  };
  NfcTech?: Record<string, unknown>;
};

let nfcModuleCache: NfcManagerModule | null | undefined;
let technologyRequestOpen = false;

const getNfcModule = (): NfcManagerModule | null => {
  if (Platform.OS === "web") return null;
  if (nfcModuleCache !== undefined) return nfcModuleCache;
  try {
    // Lazy import keeps Expo Go / unsupported runtimes from crashing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nfcModuleCache = require("react-native-nfc-manager") as NfcManagerModule;
  } catch {
    nfcModuleCache = null;
  }
  return nfcModuleCache;
};

const normalizeUid = (value: unknown): string => {
  const raw = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "");
  return raw.toUpperCase();
};

const extractUid = (tag: any): string => {
  const candidates = [tag?.id, tag?.uid, tag?.identifier, tag?.serialNumber];
  for (const candidate of candidates) {
    const uid = normalizeUid(candidate);
    if (uid) return uid;
  }
  return "";
};

const isCancelledError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  return (
    lower.includes("cancel") ||
    lower.includes("cancelled") ||
    lower.includes("canceled") ||
    lower.includes("user canceled")
  );
};

export async function startScan() {
  const mod = getNfcModule();
  if (!mod) {
    throw new NfcError(
      NFC_ERRORS.NOT_AVAILABLE,
      "NFC indisponivel neste build. Use um Dev Client com modulo NFC."
    );
  }
  await mod.default.start();
}

export async function stopScan() {
  const mod = getNfcModule();
  if (!mod) return;
  try {
    await mod.default.cancelTechnologyRequest();
  } catch {
    // ignore
  } finally {
    technologyRequestOpen = false;
  }
}

export async function isNfcSupported(): Promise<NfcSupportInfo> {
  const mod = getNfcModule();
  if (!mod) {
    return {
      available: false,
      enabled: false,
      reason: "NFC indisponivel (web/Expo Go ou modulo nativo ausente).",
    };
  }
  try {
    await mod.default.start();
    const available = await mod.default.isSupported();
    if (!available) {
      return { available: false, enabled: false, reason: "Este aparelho nao suporta NFC." };
    }
    const enabled = await mod.default.isEnabled();
    if (!enabled) {
      return { available: true, enabled: false, reason: "Ative o NFC nas configuracoes do aparelho." };
    }
    return { available: true, enabled: true };
  } catch {
    return {
      available: false,
      enabled: false,
      reason: "Nao foi possivel inicializar NFC neste dispositivo.",
    };
  }
}

export async function readTagUid(): Promise<NfcScanResult> {
  const mod = getNfcModule();
  if (!mod) {
    throw new NfcError(
      NFC_ERRORS.NOT_AVAILABLE,
      "NFC indisponivel neste build. Use um Dev Client com modulo NFC."
    );
  }
  const manager = mod.default;
  const nfcTech = mod.NfcTech ?? {};
  await manager.start();

  const candidates = [
    nfcTech.NfcA,
    nfcTech.IsoDep,
    nfcTech.MifareUltralight,
    nfcTech.MifareClassic,
    nfcTech.Ndef,
    nfcTech.NfcV,
  ].filter(Boolean);
  const requestedTech = candidates.length > 1 ? candidates : nfcTech.Ndef ?? candidates;

  try {
    await manager.requestTechnology(requestedTech, {
      alertMessage: "Aproxime a tag NFC para registrar presenca",
    });
    technologyRequestOpen = true;
    const tag = await manager.getTag();
    const uid = extractUid(tag);
    if (!uid) {
      throw new NfcError(NFC_ERRORS.TAG_UID_MISSING, "Tag lida sem UID/serial disponivel.");
    }
    return { uid, rawTag: tag };
  } catch (error) {
    if (isCancelledError(error)) {
      throw new NfcError(NFC_ERRORS.CANCELLED, "Leitura NFC cancelada.");
    }
    if (error instanceof NfcError) throw error;
    throw new NfcError(NFC_ERRORS.READ_FAILED, "Falha ao ler tag NFC.");
  } finally {
    try {
      if (technologyRequestOpen) {
        await manager.cancelTechnologyRequest();
      }
    } catch {
      // ignore
    } finally {
      technologyRequestOpen = false;
    }
  }
}
