export type AttendanceSavePhase =
  | "idle"
  | "saving"
  | "saved_local"
  | "synced"
  | "error";

type AttendanceSaveIndicator = {
  status: "saving" | "saved_local" | "synced" | "error" | "offline";
  message: string;
};

export function resolveAttendanceSaveIndicator({
  phase,
  isOnline,
}: {
  phase: AttendanceSavePhase;
  isOnline: boolean;
}): AttendanceSaveIndicator | null {
  if (phase === "saving") {
    return {
      status: "saving",
      message: isOnline ? "Salvando chamada..." : "Salvando no dispositivo...",
    };
  }
  if (phase === "saved_local") {
    return {
      status: "saved_local",
      message: "Salva no dispositivo · será enviada quando a internet voltar",
    };
  }
  if (phase === "synced") {
    return {
      status: "synced",
      message: "Chamada sincronizada",
    };
  }
  if (phase === "error") {
    return {
      status: "error",
      message: "Não foi possível salvar a chamada",
    };
  }
  if (!isOnline) {
    return {
      status: "offline",
      message: "Offline · ao salvar, será enviada quando a internet voltar",
    };
  }
  return null;
}
