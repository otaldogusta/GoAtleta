import { resolveAttendanceSaveIndicator } from "../attendance-save-feedback";

describe("resolveAttendanceSaveIndicator", () => {
  it("avisa antes do salvamento que a chamada offline será sincronizada depois", () => {
    expect(
      resolveAttendanceSaveIndicator({ phase: "idle", isOnline: false })
    ).toEqual({
      status: "offline",
      message: "Offline · ao salvar, será enviada quando a internet voltar",
    });
  });

  it("diferencia o salvamento local durante uma operação offline", () => {
    expect(
      resolveAttendanceSaveIndicator({ phase: "saving", isOnline: false })
    ).toEqual({
      status: "saving",
      message: "Salvando no dispositivo...",
    });
  });

  it("mantém explícito que o registro local ainda será enviado", () => {
    expect(
      resolveAttendanceSaveIndicator({ phase: "saved_local", isOnline: true })
    ).toEqual({
      status: "saved_local",
      message: "Salva no dispositivo · será enviada quando a internet voltar",
    });
  });

  it("só informa sincronização quando o servidor confirmou", () => {
    expect(
      resolveAttendanceSaveIndicator({ phase: "synced", isOnline: true })
    ).toEqual({
      status: "synced",
      message: "Chamada sincronizada",
    });
  });

  it("não adiciona informação quando a tela está ociosa e online", () => {
    expect(
      resolveAttendanceSaveIndicator({ phase: "idle", isOnline: true })
    ).toBeNull();
  });
});
