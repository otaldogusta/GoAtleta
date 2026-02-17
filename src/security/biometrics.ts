import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

export type BiometricsSupport = {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedAuthTypes: LocalAuthentication.AuthenticationType[];
};

export async function isBiometricsSupported(): Promise<BiometricsSupport> {
  if (Platform.OS === "web") {
    return { hasHardware: false, isEnrolled: false, supportedAuthTypes: [] };
  }
  const [hasHardware, isEnrolled, supportedAuthTypes] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  return { hasHardware, isEnrolled, supportedAuthTypes };
}

export async function promptBiometrics(reason = "Confirmar identidade") {
  if (Platform.OS === "web") {
    return { success: false, error: "not_available" } as const;
  }
  const result = await LocalAuthentication.authenticateAsync({
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
