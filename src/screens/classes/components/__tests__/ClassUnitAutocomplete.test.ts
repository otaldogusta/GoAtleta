import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, TextInput } from "react-native";

import type { ThemeColors } from "../../../../ui/app-theme";
import {
  buildExistingUnitOptions,
  ClassUnitAutocomplete,
  filterExistingUnitOptions,
} from "../ClassUnitAutocomplete";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: (props: Record<string, unknown>) => {
    const ReactRuntime = require("react");
    return ReactRuntime.createElement("Ionicons", props);
  },
}));

const colors = {
  background: "#0f172a",
  border: "#253247",
  card: "#111827",
  inputText: "#f8fafc",
  muted: "#94a3b8",
  placeholder: "#64748b",
  primaryBg: "#22c55e",
  primaryText: "#052e16",
  text: "#f8fafc",
} as ThemeColors;

describe("ClassUnitAutocomplete", () => {
  it("deduplicates units and ignores the placeholder unit", () => {
    expect(
      buildExistingUnitOptions([
        "Rede Esperança",
        "rede esperanca",
        " UniBrasil ",
        "Sem unidade",
        "",
      ])
    ).toEqual(["Rede Esperança", "UniBrasil"]);
  });

  it("filters existing units ignoring accents and casing", () => {
    expect(
      filterExistingUnitOptions(
        ["Cidadania Boa Vista", "Rede Esperança", "UniBrasil"],
        "esperanca"
      )
    ).toEqual(["Rede Esperança"]);
  });

  it("shows matching units while typing and applies the selected value", () => {
    const onChangeText = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(ClassUnitAutocomplete, {
          colors,
          value: "",
          units: ["Cidadania Boa Vista", "Rede Esperança", "UniBrasil"],
          onChangeText,
        })
      );
    });

    const input = renderer!.root.findByType(TextInput);
    act(() => input.props.onFocus());
    expect(renderer!.root.findAllByProps({ children: "Unidades existentes" })).toHaveLength(0);
    const suggestions = renderer!.root.findByProps({
      accessibilityLabel: "Sugestões de unidades existentes",
    });
    expect(StyleSheet.flatten(suggestions.props.style)).toEqual(
      expect.objectContaining({ position: "absolute", top: "100%" })
    );
    expect(
      renderer!.root.findByProps({ accessibilityLabel: "Usar unidade Rede Esperança" })
    ).toBeTruthy();

    act(() => input.props.onChangeText("rede"));
    expect(onChangeText).toHaveBeenLastCalledWith("rede");

    const option = renderer!.root.findByProps({
      accessibilityLabel: "Usar unidade Rede Esperança",
    });
    act(() => option.props.onPressIn());
    expect(onChangeText).toHaveBeenLastCalledWith("Rede Esperança");
  });

  it("keeps keyboard activation available when there is no pointer press", () => {
    const onChangeText = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(ClassUnitAutocomplete, {
          colors,
          value: "rede",
          units: ["Rede Esperança"],
          onChangeText,
        })
      );
    });

    const input = renderer!.root.findByType(TextInput);
    act(() => input.props.onFocus());
    const option = renderer!.root.findByProps({
      accessibilityLabel: "Usar unidade Rede Esperança",
    });
    act(() => option.props.onPress());
    expect(onChangeText).toHaveBeenLastCalledWith("Rede Esperança");
  });
});
