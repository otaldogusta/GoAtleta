import { act, render, waitFor } from "@testing-library/react-native";
import * as Network from "expo-network";
import { createElement } from "react";
import { Text } from "react-native";

import { useIsOnline } from "../use-is-online";

jest.mock("expo-network", () => ({
  addNetworkStateListener: jest.fn(),
  getNetworkStateAsync: jest.fn(),
}));

const addNetworkStateListener = Network.addNetworkStateListener as jest.Mock;
const getNetworkStateAsync = Network.getNetworkStateAsync as jest.Mock;

function NetworkStatus() {
  const isOnline = useIsOnline();
  return createElement(Text, null, isOnline ? "online" : "offline");
}

describe("useIsOnline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reads the initial state and reacts to native connection changes", async () => {
    let listener: ((state: Network.NetworkState) => void) | undefined;
    const remove = jest.fn();

    getNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    addNetworkStateListener.mockImplementation((nextListener) => {
      listener = nextListener;
      return { remove };
    });

    const { getByText, unmount } = render(createElement(NetworkStatus));

    await waitFor(() => expect(getByText("online")).toBeTruthy());

    act(() => {
      listener?.({ isConnected: false, isInternetReachable: false });
    });

    expect(getByText("offline")).toBeTruthy();

    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
