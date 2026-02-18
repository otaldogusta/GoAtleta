import { Platform } from "react-native";

type LocalAuthenticationModule = {
  hasHardwareAsync: () => Promise<boolean>;
  isEnrolledAsync: () => Promise<boolean>;
  supportedAuthenticationTypesAsync: () => Promise<number[]>;
  authenticateAsync: (options: {
    promptMessage: string;
    cancelLabel: string;
    disableDeviceFallback: boolean;
  }) => Promise<{ success: boolean; error?: string; warning?: string }>;
};

export type BiometricsSupport = {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedAuthTypes: number[];
};

let localAuthModule: LocalAuthenticationModule | null | undefined;

const getLocalAuthModule = (): LocalAuthenticationModule | null => {
  if (Platform.OS === "web") return null;
  if (localAuthModule !== undefined) return localAuthModule;
  try {
    // Lazy require prevents crash when native module is missing in old binaries.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    localAuthModule = require("expo-local-authentication") as LocalAuthenticationModule;
  } catch {
    localAuthModule = null;
  }
  return localAuthModule;
};

export async function isBiometricsSupported(): Promise<BiometricsSupport> {
  const mod = getLocalAuthModule();
  if (!mod) {
    return { hasHardware: false, isEnrolled: false, supportedAuthTypes: [] };
  }
  const [hasHardware, isEnrolled, supportedAuthTypes] = await Promise.all([
    mod.hasHardwareAsync(),
    mod.isEnrolledAsync(),
    mod.supportedAuthenticationTypesAsync(),
  ]);
  return { hasHardware, isEnrolled, supportedAuthTypes };
}

export async function promptBiometrics(reason = "Confirmar identidade") {
  const mod = getLocalAuthModule();
  if (!mod) {
    return { success: false, error: "not_available" } as const;
  }
  const result = await mod.authenticateAsync({
    promptMessage: reason,
    cancelLabel: "Cancelar",
    disableDeviceFallback: false,
  });
  return {
    success: Boolean(result.success),
    error: result.error,
    warning: result.warning,
  };
}
