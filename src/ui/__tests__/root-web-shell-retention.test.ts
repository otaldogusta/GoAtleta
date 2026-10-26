import React, { useEffect, useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Platform, Text } from "react-native";
import { RootWebShell } from "../RootWebShell";

let mockPath = "/coord/classes";
jest.mock("expo-router", () => ({ usePathname: () => mockPath }));
jest.mock("../../hooks/use-effective-profile", () => ({ useEffectiveProfile: () => "admin" }));
jest.mock("../app-theme", () => ({ useAppTheme: () => ({ colors: { background: "#fff" } }) }));
jest.mock("../use-responsive-layout", () => ({ useResponsiveLayout: () => ({ usesWorkspaceShell: true }) }));
jest.mock("../AdaptiveSidebar", () => ({ AdaptiveSidebar: () => jest.requireActual<typeof import("react")>("react").createElement(jest.requireActual<typeof import("react-native")>("react-native").Text, { testID: "sidebar" }, "Sidebar") }));
jest.mock("../NativeSidebar", () => ({ NativeSidebar: () => null, NATIVE_SIDEBAR_EXPANDED_WIDTH: 292 }));

let mounts = 0, unmounts = 0;
function Navigator() {
  const [visit] = useState(() => ++mounts);
  useEffect(() => () => { unmounts++; }, []);
  return React.createElement(Text, { testID: "retained-navigator" }, `Visit ${visit}`);
}
const tree = () => React.createElement(RootWebShell, null, React.createElement(Navigator));

test("switches shell chrome without remounting the root navigator across repeated class visits", () => {
  const descriptor = Object.getOwnPropertyDescriptor(Platform, "OS")!;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  let view!: ReactTestRenderer;
  mounts = 0; unmounts = 0;
  try {
    act(() => { view = create(tree()); });
    for (let index = 0; index < 3; index++) {
      mockPath = "/class/class-a";
      act(() => view.update(tree()));
      expect(view.root.findAllByType(Text).filter(node => node.props.testID === "sidebar")).toHaveLength(1);
      mockPath = "/coord/classes";
      act(() => view.update(tree()));
      expect(view.root.findAllByType(Text).filter(node => node.props.testID === "sidebar")).toHaveLength(0);
    }
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);
    expect(view.root.findAllByType(Text).find(node => node.props.testID === "retained-navigator")!.props.children).toBe("Visit 1");
  } finally {
    act(() => view?.unmount());
    Object.defineProperty(Platform, "OS", descriptor);
    mockPath = "/coord/classes";
  }
});
