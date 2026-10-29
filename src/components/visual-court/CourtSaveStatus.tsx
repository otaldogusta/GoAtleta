import { ActivityIndicator, Platform, View } from "react-native";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import type { useCourtEditor } from "./useCourtEditor";

type Props = {
  status: ReturnType<typeof useCourtEditor>["autosaveStatus"];
  onRetry: () => void;
  disabled?: boolean;
  error?: string;
};

const labels = {
  idle: "Salvamento automático",
  pending: "Alterações aguardando salvamento",
  saving: "Salvando jogada automaticamente",
  saved: "Jogada salva",
  local: "Salvo neste dispositivo. Tentar sincronizar",
  error: "Não foi possível salvar. Tentar novamente",
};
const icons: Record<Exclude<Props["status"], "saving">, GoAtletaIconName> = {
  idle: "checkmarkOutline", pending: "sync", saved: "checkmarkOutline", local: "cloudOffline", error: "warningCircle",
};

/** Passive save feedback; only a failed or local save exposes an action. */
export function CourtSaveStatus({ status, onRetry, disabled = false, error }: Props) {
  const { colors } = useAppTheme();
  const label = status === "error" && error ? `${error} Tentar novamente.` : labels[status];
  const retry = status === "local" || status === "error";
  const color = status === "error" ? colors.dangerText : colors.muted;
  const icon = status === "saving"
    ? <ActivityIndicator size={12} color={colors.muted} />
    : <GoAtletaIcon name={icons[status]} size={15} color={color} />;
  if (retry) return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} disabled={disabled} hitSlop={6}
    suppressWebHoverFeedback disableWebPressScale onPress={() => { if (!disabled) onRetry(); }}
    {...(Platform.OS === "web" ? { title: label } : {})}
    style={{ width: 24, height: 32, alignItems: "center", justifyContent: "center", opacity: disabled ? .55 : 1 }}>
    {icon}
  </Pressable>;
  return <View accessible={status !== "idle"} accessibilityLabel={status === "idle" ? undefined : label}
    accessibilityLiveRegion="polite" {...(Platform.OS === "web" ? { title: label, role: "status" as const } : {})}
    style={{ width: 24, height: 32, alignItems: "center", justifyContent: "center", opacity: status === "idle" ? 0 : .7 }}>
    {icon}
  </View>;
}
