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
      participantsCount: "18",
      reportHasChanges: true,
      reportDraftStatus: "restored",
    });
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
});
