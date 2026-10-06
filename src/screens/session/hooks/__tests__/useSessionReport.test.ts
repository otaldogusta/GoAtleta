import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { saveSessionLog } from "../../../../db/seed";
import {
  buildSessionReportDraftKey,
  type SessionReportDraft,
} from "../../application/session-report-draft";
import { useSessionReport } from "../useSessionReport";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("../../../../db/seed", () => ({
  saveSessionLog: jest.fn(),
}));

type HookSnapshot = ReturnType<typeof useSessionReport>;

const scope = {
  userId: "user-1",
  organizationId: "org-1",
  classId: "class-1",
  sessionDate: "2026-07-29",
  isSessionReady: true,
};

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

function renderReportHook(onSnapshot: (snapshot: HookSnapshot) => void) {
  function Harness() {
    const snapshot = useSessionReport({
      ...scope,
      sessionLog: null,
      setSessionLog: jest.fn(),
      attendancePercent: 75,
    });
    onSnapshot(snapshot);
    return null;
  }

  return TestRenderer.create(React.createElement(Harness));
}

describe("useSessionReport draft recovery", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (saveSessionLog as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("waits for the saved report before creating a draft from attendance", async () => {
    const storage = new Map<string, string>();
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async key => storage.get(key) ?? null);
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key, value) => { storage.set(key, value); });
    const savedReport = {
      classId: scope.classId, createdAt: "2026-07-29T12:00:00.000Z",
      PSE: 6, technique: "boa" as const, attendance: 75, participantsCount: 17,
      activity: "Recepção e deslocamento", conclusion: "Boa evolução da turma.",
    };
    let latest!: HookSnapshot;
    let renderer!: TestRenderer.ReactTestRenderer;
    function Harness({ ready }: { ready: boolean }) {
      const params = { ...scope, isSessionReady: ready, sessionLog: ready ? savedReport : null,
        setSessionLog: jest.fn(), attendancePercent: 75, attendancePresentCount: 17 };
      latest = useSessionReport(params);
      return null;
    }
    await act(async () => { renderer = TestRenderer.create(React.createElement(Harness, { ready: false })); });
    await flushPromises();
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    await act(async () => { renderer.update(React.createElement(Harness, { ready: true })); });
    await flushPromises();
    expect(latest).toMatchObject({ activity: savedReport.activity, conclusion: savedReport.conclusion,
      PSE: 6, participantsCount: "17", reportHasChanges: false });
    await act(async () => renderer.unmount());
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(saveSessionLog).not.toHaveBeenCalled();
  });

  it("flushes the final edit when returning to history before the debounce", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    let snapshot!: HookSnapshot;
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = renderReportHook(value => { snapshot = value; }); });
    await flushPromises();
    act(() => snapshot.setActivity("Última alteração antes de voltar"));
    await act(async () => renderer.unmount());
    const writes = (AsyncStorage.setItem as jest.Mock).mock.calls;
    expect(writes.some(([key, value]) => key === buildSessionReportDraftKey(scope) && JSON.parse(value).values.activity === "Última alteração antes de voltar")).toBe(true);
  });

  it("restores an unsaved local draft after the screen is recreated", async () => {
    const storedDraft: SessionReportDraft = {
      version: 1,
      savedAt: "2026-07-29T12:00:00.000Z",
      values: {
        PSE: 6,
        technique: "boa",
        activity: "Saque e recepção",
        conclusion: "A turma evoluiu durante a aula.",
        participantsCount: "18",
        photos: "",
      },
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(storedDraft));
    let latest: HookSnapshot | null = null;

    await act(async () => {
      renderReportHook((snapshot) => {
        latest = snapshot;
      });
    });
    await flushPromises();

    expect(AsyncStorage.getItem).toHaveBeenCalledWith(
      buildSessionReportDraftKey(scope)
    );
    expect(latest).toMatchObject({
      activity: "Saque e recepção",
      conclusion: "A turma evoluiu durante a aula.",
      participantsCount: "",
      reportHasChanges: true,
      reportDraftStatus: "restored",
    });
    await act(async () => { await latest!.saveReport(); });
    expect(saveSessionLog).toHaveBeenCalledWith(
      expect.objectContaining({ participantsCount: undefined, activity: "Saque e recepção" })
    );
  });

  it("autosaves changes and removes the draft only after the report is saved", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const setSessionLog = jest.fn();
    let latest: HookSnapshot | null = null;

    function Harness() {
      const snapshot = useSessionReport({
        ...scope,
        sessionLog: null,
        setSessionLog,
        attendancePercent: 75,
      });
      latest = snapshot;
      return null;
    }

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await flushPromises();

    act(() => {
      latest!.setConclusion("Relatório que não pode ser perdido.");
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      buildSessionReportDraftKey(scope),
      expect.stringContaining("Relatório que não pode ser perdido.")
    );
    expect(latest!.reportDraftStatus).toBe("saved");

    await act(async () => {
      await latest!.saveReport();
    });

    expect(saveSessionLog).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      buildSessionReportDraftKey(scope)
    );
    expect(setSessionLog).toHaveBeenCalledTimes(1);
  });

  it("does not recreate a pending draft after a successful immediate save", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    let latest: HookSnapshot | null = null;

    function Harness() {
      latest = useSessionReport({
        ...scope,
        sessionLog: null,
        setSessionLog: jest.fn(),
        attendancePercent: 75,
      });
      return null;
    }

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await flushPromises();

    act(() => {
      latest!.setConclusion("Salvar antes do temporizador.");
    });
    await act(async () => {
      await latest!.saveReport();
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      buildSessionReportDraftKey(scope)
    );
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("returns to the clean baseline after adding and removing the last photo", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    let latest: HookSnapshot | null = null;
    await act(async () => { renderReportHook(snapshot => { latest = snapshot; }); });
    await flushPromises();
    expect(latest!.reportHasChanges).toBe(false);
    act(() => { latest!.setPhotos(JSON.stringify(["file:///photo.jpg"])); });
    expect(latest!.reportHasChanges).toBe(true);
    await act(async () => { jest.advanceTimersByTime(1000); await Promise.resolve(); });
    act(() => { latest!.setPhotos("[]"); });
    await flushPromises();
    expect(latest!.reportHasChanges).toBe(false);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(buildSessionReportDraftKey(scope));
    expect(saveSessionLog).not.toHaveBeenCalled();
  });

  it.each([0, 12])("uses attendance count %s as the report participant total", async (presentCount) => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const setSessionLog = jest.fn();
    let latest: HookSnapshot | null = null;

    function Harness() {
      latest = useSessionReport({
        ...scope,
        sessionLog: null,
        setSessionLog,
        attendancePercent: 75,
        attendancePresentCount: presentCount,
      });
      return null;
    }

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await flushPromises();

    expect(latest?.participantsCount).toBe(String(presentCount));
    expect(latest?.reportHasChanges).toBe(true);

    await act(async () => {
      await latest!.saveReport();
    });

    expect(saveSessionLog).toHaveBeenCalledWith(
      expect.objectContaining({ participantsCount: presentCount })
    );
  });

  it("leaves participants empty without attendance, ignoring old report and draft counts", async () => {
    const oldReport = {
      classId: scope.classId, createdAt: "2026-07-29T12:00:00.000Z",
      PSE: 6, technique: "boa" as const, attendance: 75,
      activity: "Saque e recepção", conclusion: "Boa evolução", participantsCount: 18,
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({
      version: 1, savedAt: "2026-07-29T12:00:00.000Z",
      values: { PSE: 6, technique: "boa", activity: oldReport.activity,
        conclusion: oldReport.conclusion, participantsCount: "25", photos: "" },
    }));
    let latest: HookSnapshot | null = null;
    function Harness() {
      latest = useSessionReport({ ...scope, sessionLog: oldReport, setSessionLog: jest.fn(),
        attendancePercent: null, attendancePresentCount: null });
      return null;
    }
    await act(async () => { TestRenderer.create(React.createElement(Harness)); });
    await flushPromises();
    expect(latest!.participantsCount).toBe("");
    expect(latest!.reportHasChanges).toBe(false);
    expect(latest!.reportDraftStatus).toBe("idle");
    expect(saveSessionLog).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(buildSessionReportDraftKey(scope));
    act(() => { latest!.setConclusion("Próxima aula: revisar recepção."); });
    await act(async () => { await latest!.saveReport(); });
    expect(saveSessionLog).toHaveBeenCalledWith(expect.objectContaining({ participantsCount: undefined }));
  });
});
