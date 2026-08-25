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

type WebNfcReadingEvent = Event & {
  serialNumber?: string;
  message?: unknown;
};

type WebNfcReader = {
  scan: (options?: { signal?: AbortSignal }) => Promise<void>;
  addEventListener: (
    type: "reading" | "readingerror",
    listener: (event: WebNfcReadingEvent) => void,
    options?: { once?: boolean }
  ) => void;
};

type WebNfcReaderConstructor = new () => WebNfcReader;

let nfcModuleCache: NfcManagerModule | null | undefined;
let technologyRequestOpen = false;
let webScanController: AbortController | null = null;

const getWebNfcReaderConstructor = (): WebNfcReaderConstructor | null => {
  if (Platform.OS !== "web") return null;
  const constructor = (globalThis as typeof globalThis & { NDEFReader?: unknown }).NDEFReader;
  return typeof constructor === "function" ? (constructor as WebNfcReaderConstructor) : null;
};

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
    .replace(/[:-]/g, "");
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
  if (Platform.OS === "web") {
    if (!getWebNfcReaderConstructor()) {
      throw new NfcError(
        NFC_ERRORS.NOT_AVAILABLE,
        "Este navegador ou aparelho não oferece leitura NFC. Use o app ou o Chrome em um celular Android com NFC."
      );
    }
    return;
  }
  const mod = getNfcModule();
  if (!mod) {
    throw new NfcError(
      NFC_ERRORS.NOT_AVAILABLE,
      "A leitura NFC não está disponível neste aplicativo."
    );
  }
  await mod.default.start();
}

export async function stopScan() {
  if (Platform.OS === "web") {
    webScanController?.abort();
    webScanController = null;
    return;
  }
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
  if (Platform.OS === "web") {
    if (globalThis.isSecureContext === false) {
      return {
        available: false,
        enabled: false,
        reason: "A leitura NFC exige uma conexão segura.",
      };
    }
    if (!getWebNfcReaderConstructor()) {
      return {
        available: false,
        enabled: false,
        reason: "Este navegador ou aparelho não oferece leitura NFC. Use o app ou o Chrome em um celular Android com NFC.",
      };
    }
    return { available: true, enabled: true };
  }

  const mod = getNfcModule();
  if (!mod) {
    return {
      available: false,
      enabled: false,
      reason: "A leitura NFC não está disponível neste aplicativo.",
    };
  }
  try {
    await mod.default.start();
    const available = await mod.default.isSupported();
    if (!available) {
      return { available: false, enabled: false, reason: "Este aparelho não oferece leitura NFC." };
    }
    const enabled = await mod.default.isEnabled();
    if (!enabled) {
      return { available: true, enabled: false, reason: "Ative o NFC nas configurações do aparelho." };
    }
    return { available: true, enabled: true };
  } catch {
    return {
      available: false,
      enabled: false,
      reason: "Não foi possível verificar o NFC deste aparelho.",
    };
  }
}

async function readWebTagUid(): Promise<NfcScanResult> {
  const Reader = getWebNfcReaderConstructor();
  if (!Reader) {
    throw new NfcError(
      NFC_ERRORS.NOT_AVAILABLE,
      "Este navegador ou aparelho não oferece leitura NFC. Use o app ou o Chrome em um celular Android com NFC."
    );
  }

  const reader = new Reader();
  const controller = new AbortController();
  webScanController?.abort();
  webScanController = controller;

  return new Promise<NfcScanResult>((resolve, reject) => {
    let settled = false;

    const clear = () => {
      if (webScanController === controller) webScanController = null;
    };
    const finishWithError = (error: unknown) => {
      if (settled) return;
      settled = true;
      clear();
      reject(error);
    };

    controller.signal.addEventListener("abort", () => {
      finishWithError(new NfcError(NFC_ERRORS.CANCELLED, "Leitura NFC cancelada."));
    }, { once: true });

    reader.addEventListener("reading", (event) => {
      const uid = normalizeUid(event.serialNumber);
      if (!uid) {
        finishWithError(new NfcError(NFC_ERRORS.TAG_UID_MISSING, "A tag foi lida, mas não informou um identificador."));
        return;
      }
      if (settled) return;
      settled = true;
      clear();
      resolve({ uid, rawTag: event });
      controller.abort();
    }, { once: true });

    reader.addEventListener("readingerror", () => {
      finishWithError(new NfcError(NFC_ERRORS.READ_FAILED, "Não foi possível ler esta tag. Use uma tag NFC compatível com NDEF."));
    }, { once: true });

    void reader.scan({ signal: controller.signal }).catch((error: unknown) => {
      if (settled || isCancelledError(error)) return;
      const name = (error as { name?: string } | null)?.name;
      if (name === "NotAllowedError") {
        finishWithError(new NfcError(NFC_ERRORS.READ_FAILED, "Permita o acesso ao NFC para continuar."));
        return;
      }
      if (name === "NotSupportedError") {
        finishWithError(new NfcError(NFC_ERRORS.NOT_AVAILABLE, "Este aparelho não oferece leitura NFC pelo navegador."));
        return;
      }
      if (name === "InvalidStateError") {
        finishWithError(new NfcError(NFC_ERRORS.READ_FAILED, "Mantenha esta página aberta para ler a tag NFC."));
        return;
      }
      finishWithError(new NfcError(NFC_ERRORS.READ_FAILED, "Não foi possível iniciar a leitura NFC."));
    });
  });
}

export async function readTagUid(): Promise<NfcScanResult> {
  if (Platform.OS === "web") return readWebTagUid();

  const mod = getNfcModule();
  if (!mod) {
    throw new NfcError(
      NFC_ERRORS.NOT_AVAILABLE,
      "A leitura NFC não está disponível neste aplicativo."
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
      alertMessage: "Aproxime a tag NFC para registrar presença",
    });
    technologyRequestOpen = true;
    const tag = await manager.getTag();
    const uid = extractUid(tag);
    if (!uid) {
      throw new NfcError(NFC_ERRORS.TAG_UID_MISSING, "A tag foi lida, mas não informou um identificador.");
    }
    return { uid, rawTag: tag };
  } catch (error) {
    if (isCancelledError(error)) {
      throw new NfcError(NFC_ERRORS.CANCELLED, "Leitura NFC cancelada.");
    }
    if (error instanceof NfcError) throw error;
    throw new NfcError(NFC_ERRORS.READ_FAILED, "Não foi possível ler a tag NFC.");
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
