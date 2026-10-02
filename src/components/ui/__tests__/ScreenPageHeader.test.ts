import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, View } from "react-native";
import { ScreenPageHeader } from "../ScreenPageHeader";
import { SectionLoadingState } from "../SectionLoadingState";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { text: "#fff", muted: "#aaa" } }) }));
jest.mock("../ScreenTopChrome", () => ({ ScreenTopChrome: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("../BackTitleHeader", () => ({ BackTitleHeader: ({ title }: { title: string }) => jest.requireActual("react").createElement(jest.requireActual("react-native").Text, { testID: "title" }, title) }));

it("keeps actions on the title row when an organization subtitle is present", () => {
  let rendered!: TestRenderer.ReactTestRenderer;
  act(() => { rendered = TestRenderer.create(React.createElement(ScreenPageHeader, { title: "Financeiro", subtitle: "Rede Esportes Pinhais", onBack: jest.fn(), right: React.createElement(View, { testID: "actions" }) })); });
  const row = rendered.root.findAllByType(View).find(node => node.props.style?.justifyContent === "space-between")!;
  expect(row.findAllByProps({ testID: "title" }).length).toBeGreaterThan(0);
  expect(row.findAllByProps({ testID: "actions" }).length).toBeGreaterThan(0);
  expect(row.findAllByType(Text).some(node => node.props.children === "Rede Esportes Pinhais")).toBe(false);
  expect(rendered.root.findAllByType(Text).some(node => node.props.children === "Rede Esportes Pinhais")).toBe(true);
  act(() => rendered.unmount());
});

it("announces section loading as progress without skeleton placeholders", () => {
  let rendered!: TestRenderer.ReactTestRenderer;
  act(() => { rendered = TestRenderer.create(React.createElement(SectionLoadingState)); });
  expect(rendered.root.findByProps({ accessibilityRole: "progressbar" }).props.accessibilityLabel).toBe("Carregando");
  expect(JSON.stringify(rendered.toJSON())).toContain("Carregando...");
  act(() => rendered.unmount());
});
