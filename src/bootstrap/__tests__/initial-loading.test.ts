import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Platform } from "react-native";
import RootHtml from "../../../app/+html";
import { BootstrapGate } from "../BootstrapGate";

jest.mock("expo-router/html", () => ({ ScrollViewStyleReset: () => null }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { text: "#fff" } }) }));
jest.mock("../../ui/Pressable", () => ({ Pressable: "Pressable" }));
jest.mock("../BootstrapProvider", () => ({
  useBootstrap: () => ({ ready: false, loading: true, error: null, retry: jest.fn() }),
}));

describe("initial web loading", () => {
  it("includes a loading status before application content in the initial document", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => { tree = TestRenderer.create(React.createElement(RootHtml, null, React.createElement("main", { id: "app-content" }))); });
    const body = tree!.root.findByType("body");
    const first = body.children[0] as TestRenderer.ReactTestInstance;
    expect(first.props).toMatchObject({ id: "goatleta-initial-loading", role: "status" });
    expect(first.findAllByType("span").map(node => node.children).flat()).toContain("Carregando...");
    expect((body.children[1] as TestRenderer.ReactTestInstance).props.id).toBe("app-content");
    act(() => tree!.unmount());
  });

  it("hands loading to React only after its gate mounts", () => {
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    const originalPlatform = Platform.OS;
    const dataset: Record<string, string> = {};
    Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: { dataset } } });
    Platform.OS = "web";
    try {
      expect(dataset.goatletaReactMounted).toBeUndefined();
      let tree: TestRenderer.ReactTestRenderer;
      act(() => { tree = TestRenderer.create(React.createElement(BootstrapGate, null, "Application")); });
      expect(dataset.goatletaReactMounted).toBe("true");
      expect(JSON.stringify(tree!.toJSON())).toContain("Carregando");
      act(() => tree!.unmount());
    } finally {
      Platform.OS = originalPlatform;
      if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
      else Reflect.deleteProperty(globalThis, "document");
    }
  });
});
