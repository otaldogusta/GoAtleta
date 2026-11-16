import React, { useEffect, useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Platform, Text } from "react-native";
import { FamilyScreenShell } from "../FamilyScreenShell";
import { AppRefreshControl } from "../../../ui/AppRefreshControl";

// Exercise the actual RN Web wrapper change that remounted the selected athlete.
jest.mock("react-native", () => Object.defineProperties({}, {
  ...Object.getOwnPropertyDescriptors(jest.requireActual("react-native")),
  ScrollView: { configurable: true, enumerable: true, value: jest.requireActual("react-native-web/dist/cjs/exports/ScrollView") },
}));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: jest.requireActual("react-native").View }));
jest.mock("../../../ui/RefreshFeedbackProvider", () => ({ useRefreshFeedback: () => null }));
jest.mock("../../../ui/native-sidebar-controller", () => ({ useNativeSidebarController: () => ({ openMobileSidebar: jest.fn() }) }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { text: "#fff", background: "#123" } }) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/use-responsive-layout", () => ({ useResponsiveLayout: () => ({
  usesWorkspaceShell: false, maxContentWidth: 440, gutter: 16,
  density: { pageGap: 16, pageTitleFontSize: 16, pageTitleLineHeight: 22 },
}) }));

const platform = Object.getOwnPropertyDescriptor(Platform, "OS")!;
let view: ReactTestRenderer | undefined;
beforeEach(() => Object.defineProperty(Platform, "OS", { configurable: true, value: "web" }));
afterEach(() => {
  if (view) act(() => view!.unmount());
  view = undefined;
  Object.defineProperty(Platform, "OS", platform);
});

test("preserves child identity and state when the next athlete cannot refresh this section", () => {
  const mounts = jest.fn();
  let changeDraft!: (value: string) => void;
  function Child() {
    const [draft, setDraft] = useState("Ana");
    changeDraft = setDraft;
    useEffect(() => { mounts(); }, []);
    return React.createElement(Text, { testID: "retained-child" }, draft);
  }
  const refresh = jest.fn();
  const tree = (onRefresh?: () => void) => React.createElement(FamilyScreenShell, { title: "Pagamentos", onRefresh }, React.createElement(Child));
  act(() => { view = create(tree(refresh)); });
  act(() => changeDraft("Estado preservado"));
  act(() => view!.update(tree(undefined)));
  expect(mounts).toHaveBeenCalledTimes(1);
  expect(view!.root.findAllByType(Text).find(node => node.props.testID === "retained-child")?.props.children).toBe("Estado preservado");
  expect(view!.root.findByType(AppRefreshControl).props.enabled).toBe(false);
  act(() => view!.root.findByType(AppRefreshControl).props.onRefresh());
  expect(refresh).not.toHaveBeenCalled();
  act(() => view!.update(tree(refresh)));
  expect(mounts).toHaveBeenCalledTimes(1);
  expect(view!.root.findByType(AppRefreshControl).props.enabled).toBe(true);
  act(() => view!.root.findByType(AppRefreshControl).props.onRefresh());
  expect(refresh).toHaveBeenCalledTimes(1);
});
