import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import {
  getMyFamilyFinance,
  getMyFamilyOverview,
  type FamilyFinanceData,
  type FamilyOverview,
} from "../../../api/family-access";
import { useRole } from "../../../auth/role";
import { useFamilyFinanceData } from "../FamilyPaymentsScreen";
import { useFamilyOverview } from "../useFamilyOverview";

jest.mock("../../../api/family-access", () => ({
  getMyFamilyFinance: jest.fn(),
  getMyFamilyOverview: jest.fn(),
}));

jest.mock("../../../auth/role", () => ({
  useRole: jest.fn(),
}));

jest.mock("../../../observability/perf", () => ({
  markRender: jest.fn(),
  measureAsync: (
    _name: string,
    operation: () => Promise<unknown>,
  ) => operation(),
}));

const mockGetMyFamilyFinance = getMyFamilyFinance as jest.MockedFunction<
  typeof getMyFamilyFinance
>;
const mockGetMyFamilyOverview = getMyFamilyOverview as jest.MockedFunction<
  typeof getMyFamilyOverview
>;
const mockUseRole = useRole as jest.MockedFunction<typeof useRole>;

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const buildOverview = (
  relationshipId: string,
  studentId: string,
): FamilyOverview => ({
  relationshipId,
  organizationId: "org-1",
  organizationName: "GoAtleta",
  studentId,
  studentName: studentId,
  classId: "class-1",
  className: "Turma",
  canViewSchedule: true,
  canViewAttendance: true,
  canViewProgress: true,
  nextSchedule: [],
  attendance: {
    available: false,
    reason: null,
    total: 0,
    present: 0,
    absent: 0,
    attendanceRatePercent: 0,
    lastRecordedOn: null,
    history: [],
  },
  progress: { available: false, reason: null },
});

const buildFinanceData = (
  invoiceId: string,
  paymentUrl: string,
): FamilyFinanceData => ({
  summary: {
    currency: "BRL",
    openAmountMinor: 10_000,
    overdueAmountMinor: 0,
    paidAmountMinor: 0,
    dueSoonAmountMinor: 10_000,
    openCount: 1,
    overdueCount: 0,
  },
  invoices: [
    {
      id: invoiceId,
      title: `Mensalidade ${invoiceId}`,
      reference: null,
      dueDate: "2026-09-10",
      amountMinor: 10_000,
      paidAmountMinor: 0,
      outstandingAmountMinor: 10_000,
      currency: "BRL",
      status: "open",
      paidAt: null,
      paymentUrl,
    },
  ],
});

describe("family request race protection", () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (renderer) {
      act(() => renderer?.unmount());
      renderer = undefined;
    }
    jest.useRealTimers();
  });

  it("keeps the selected athlete overview when the previous request resolves last", async () => {
    const athleteARequest = createDeferred<FamilyOverview>();
    const athleteBRequest = createDeferred<FamilyOverview>();
    let selectedFamilyStudent = { relationshipId: "relationship-a" };
    let latest: ReturnType<typeof useFamilyOverview> | null = null;

    mockUseRole.mockImplementation(() => ({ selectedFamilyStudent }));
    mockGetMyFamilyOverview.mockImplementation((relationshipId: string) =>
      relationshipId === "relationship-a"
        ? athleteARequest.promise
        : athleteBRequest.promise,
    );

    function Harness({ revision }: { revision: number }) {
      latest = useFamilyOverview();
      return React.createElement("OverviewProbe", { revision });
    }

    await act(async () => {
      renderer = TestRenderer.create(React.createElement(Harness, { revision: 0 }));
      await flushPromises();
    });
    await act(async () => {
      jest.runOnlyPendingTimers();
      await flushPromises();
    });

    selectedFamilyStudent = { relationshipId: "relationship-b" };
    await act(async () => {
      renderer?.update(React.createElement(Harness, { revision: 1 }));
      await flushPromises();
    });
    await act(async () => {
      jest.runOnlyPendingTimers();
      await flushPromises();
    });

    expect(latest!.overview).toBeNull();
    expect(latest!.loading).toBe(true);
    expect(latest!.failed).toBe(false);

    await act(async () => {
      athleteBRequest.resolve(buildOverview("relationship-b", "student-b"));
      await flushPromises();
    });
    expect(latest!.overview?.studentId).toBe("student-b");
    expect(latest!.loading).toBe(false);

    await act(async () => {
      athleteARequest.resolve(buildOverview("relationship-a", "student-a"));
      await flushPromises();
    });
    expect(latest!.overview?.studentId).toBe("student-b");
    expect(latest!.loading).toBe(false);
    expect(latest!.failed).toBe(false);
  });

  it("hides the previous invoices immediately and ignores their late refresh", async () => {
    const athleteAFinance = buildFinanceData(
      "invoice-a",
      "https://payments.example/athlete-a",
    );
    const athleteBFinance = buildFinanceData(
      "invoice-b",
      "https://payments.example/athlete-b",
    );
    const staleAthleteARefresh = createDeferred<FamilyFinanceData>();
    const athleteBRequest = createDeferred<FamilyFinanceData>();
    let latest: ReturnType<typeof useFamilyFinanceData> | null = null;

    mockGetMyFamilyFinance
      .mockResolvedValueOnce(athleteAFinance)
      .mockReturnValueOnce(staleAthleteARefresh.promise)
      .mockReturnValueOnce(athleteBRequest.promise);

    function Harness({
      relationshipId,
      studentId,
    }: {
      relationshipId: string;
      studentId: string;
    }) {
      latest = useFamilyFinanceData({
        selectedRelationshipId: relationshipId,
        selectedStudentId: studentId,
        canViewFinance: true,
      });
      return React.createElement("FinanceProbe");
    }

    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(Harness, {
          relationshipId: "relationship-a",
          studentId: "student-a",
        }),
      );
      await flushPromises();
    });
    await act(async () => {
      jest.runOnlyPendingTimers();
      await flushPromises();
    });
    expect(latest!.data?.invoices[0]?.paymentUrl).toContain("athlete-a");

    await act(async () => {
      void latest!.load();
      await flushPromises();
    });
    await act(async () => {
      renderer?.update(
        React.createElement(Harness, {
          relationshipId: "relationship-b",
          studentId: "student-b",
        }),
      );
      await flushPromises();
    });

    expect(latest!.data).toBeNull();
    expect(latest!.loading).toBe(true);
    expect(latest!.failed).toBe(false);

    await act(async () => {
      jest.runOnlyPendingTimers();
      await flushPromises();
      athleteBRequest.resolve(athleteBFinance);
      await flushPromises();
    });
    expect(latest!.data?.invoices[0]?.id).toBe("invoice-b");
    expect(latest!.data?.invoices[0]?.paymentUrl).toContain("athlete-b");

    await act(async () => {
      staleAthleteARefresh.resolve(athleteAFinance);
      await flushPromises();
    });
    expect(latest!.data?.invoices[0]?.id).toBe("invoice-b");
    expect(latest!.data?.invoices[0]?.paymentUrl).toContain("athlete-b");
  });

  it("keeps the current finance request loading when a stale request fails", async () => {
    const athleteARequest = createDeferred<FamilyFinanceData>();
    const athleteBRequest = createDeferred<FamilyFinanceData>();
    let latest: ReturnType<typeof useFamilyFinanceData> | null = null;

    mockGetMyFamilyFinance
      .mockReturnValueOnce(athleteARequest.promise)
      .mockReturnValueOnce(athleteBRequest.promise);

    function Harness({
      relationshipId,
      studentId,
    }: {
      relationshipId: string;
      studentId: string;
    }) {
      latest = useFamilyFinanceData({
        selectedRelationshipId: relationshipId,
        selectedStudentId: studentId,
        canViewFinance: true,
      });
      return React.createElement("FinanceProbe");
    }

    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(Harness, {
          relationshipId: "relationship-a",
          studentId: "student-a",
        }),
      );
      await flushPromises();
    });
    await act(async () => {
      jest.runOnlyPendingTimers();
      await flushPromises();
    });
    await act(async () => {
      renderer?.update(
        React.createElement(Harness, {
          relationshipId: "relationship-b",
          studentId: "student-b",
        }),
      );
      await flushPromises();
    });
    await act(async () => {
      jest.runOnlyPendingTimers();
      await flushPromises();
      athleteARequest.reject(new Error("stale request failed"));
      await flushPromises();
    });

    expect(latest!.data).toBeNull();
    expect(latest!.loading).toBe(true);
    expect(latest!.failed).toBe(false);

    await act(async () => {
      athleteBRequest.resolve(
        buildFinanceData("invoice-b", "https://payments.example/athlete-b"),
      );
      await flushPromises();
    });
    expect(latest!.loading).toBe(false);
    expect(latest!.failed).toBe(false);
    expect(latest!.data?.invoices[0]?.id).toBe("invoice-b");
  });
});
