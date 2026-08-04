import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import type { SyncStatus } from "../../core/smart-sync";
import { useSmartSync } from "../use-smart-sync";

const mockRemoveAppStateListener = jest.fn();
const mockAddAppStateListener = jest.fn(() => ({
  remove: mockRemoveAppStateListener,
}));
const mockUnsubscribe = jest.fn();
const mockSubscribe = jest.fn();

const initialStatus: SyncStatus = {
  syncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,
  syncPausedReason: null,
  lastFlushMs: null,
  lastFlushBatchSize: 0,
  lastFlushedCount: 0,
};

jest.mock("react-native/Libraries/AppState/AppState", () => ({
  __esModule: true,
  default: {
    addEventListener: (...args: unknown[]) => mockAddAppStateListener(...args),
  },
}));

jest.mock("../../core/smart-sync", () => ({
  smartSync: {
    getStatus: () => initialStatus,
    subscribe: (listener: (status: SyncStatus) => void) => mockSubscribe(listener),
    syncNow: jest.fn(),
    refreshPendingCount: jest.fn(),
    resumeSync: jest.fn(),
    syncOnAppForeground: jest.fn(),
  },
}));

function SmartSyncConsumer() {
  useSmartSync();
  return null;
}

describe("useSmartSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscribe.mockImplementation((listener: (status: SyncStatus) => void) => {
      listener(initialStatus);
      return mockUnsubscribe;
    });
  });

  test("keeps a single AppState subscription across status updates", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(React.createElement(SmartSyncConsumer));
      await Promise.resolve();
    });

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockAddAppStateListener).toHaveBeenCalledTimes(1);

    const statusListener = mockSubscribe.mock.calls[0][0] as (status: SyncStatus) => void;
    await act(async () => {
      statusListener({ ...initialStatus, pendingCount: 2 });
      await Promise.resolve();
    });

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockAddAppStateListener).toHaveBeenCalledTimes(1);

    act(() => renderer!.unmount());

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockRemoveAppStateListener).toHaveBeenCalledTimes(1);
  });
});
