import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import {
  buildDefenseBase6BackPreset,
  build5x1ServingPreset,
  buildRotation5x1Preset,
} from "../../../core/visual-court";
import { VisualCourtTimelineControls } from "../VisualCourtTimelineControls";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

const collectChildrenText = (value: unknown): string[] => {
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(collectChildrenText);
  return [];
};

const collectRenderedTextAndLabels = (root: TestRenderer.ReactTestInstance) =>
  root
    .findAll(() => true)
    .flatMap((node) => {
      const children = node.props.children;
      return [
        typeof node.props.accessibilityLabel === "string"
          ? node.props.accessibilityLabel
          : "",
        ...collectChildrenText(children),
      ];
    })
    .filter(Boolean);

describe("VisualCourtTimelineControls", () => {
  it("renders timeline controls and triggers navigation callbacks", async () => {
    const payload = buildRotation5x1Preset();
    const onPrevious = jest.fn();
    const onNext = jest.fn();
    const onTogglePlay = jest.fn();
    const onSelectStep = jest.fn();
    const onSetSpeed = jest.fn();

    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(VisualCourtTimelineControls, {
          payload,
          stepIndex: 0,
          isPlaying: false,
          speed: 1,
          mode: "rotation_phase",
          onPrevious,
          onNext,
          onTogglePlay,
          onSelectStep,
          onSetSpeed,
        })
      );
    });

    const text = collectRenderedTextAndLabels(tree!.root).join(" ").replace(/\s+/g, " ");
    expect(text).toContain("P1 - antes do saque");
    expect(text).toContain("P1 - Antes do saque");
    expect(text).toContain("Posição do levantador");
    expect(text).not.toContain("Momento");
    expect(text).not.toContain("Após o saque");
    expect(text).toContain("P6");
    expect(text).toContain("P2");
    expect(text).not.toContain("Passo 1 de 24");
    expect(text).not.toContain("Ataque");
    expect(text).toContain("Reproduzir animação");
    expect(text).toContain("1.5");

    const root = tree!.root;
    act(() => {
      root.findByProps({ accessibilityLabel: "Próximo passo" }).props.onPress();
    });
    expect(onNext).toHaveBeenCalledTimes(1);

    act(() => {
      root.findByProps({ accessibilityLabel: "Reproduzir animação" }).props.onPress();
    });
    expect(onTogglePlay).toHaveBeenCalledTimes(1);

    act(() => {
      root.findByProps({ accessibilityLabel: "P6" }).props.onPress();
    });
    expect(onSelectStep).toHaveBeenCalledWith(2);
  });

  it("renders defense controls by attack origin and defensive adjustment", async () => {
    const payload = buildDefenseBase6BackPreset();
    const onSelectStep = jest.fn();

    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(VisualCourtTimelineControls, {
          payload,
          stepIndex: 0,
          isPlaying: false,
          speed: 1,
          mode: "rotation_phase",
          onPrevious: jest.fn(),
          onNext: jest.fn(),
          onTogglePlay: jest.fn(),
          onSelectStep,
          onSetSpeed: jest.fn(),
        })
      );
    });

    const text = collectRenderedTextAndLabels(tree!.root).join(" ").replace(/\s+/g, " ");
    expect(text).toContain("P1 - Entrada / Paralela");
    expect(text).toContain("Posição do levantador");
    expect(text).toContain("Origem do ataque adversário");
    expect(text).toContain("Entrada");
    expect(text).toContain("Meio");
    expect(text).toContain("Saída");
    expect(text).toContain("Ajuste defensivo");
    expect(text).toContain("Paralela");
    expect(text).toContain("Diagonal");
    expect(text).toContain("Fundo");
    expect(text).toContain("Curta/largada");

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Saída" }).props.onPress();
    });
    expect(onSelectStep).toHaveBeenCalledWith(8);

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Diagonal" }).props.onPress();
    });
    expect(onSelectStep).toHaveBeenCalledWith(1);
  });

  it("renders serving controls in the same compact moment style as reception", async () => {
    const payload = build5x1ServingPreset();
    const onSelectStep = jest.fn();

    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(VisualCourtTimelineControls, {
          payload,
          stepIndex: 0,
          isPlaying: false,
          speed: 1,
          mode: "rotation_phase",
          onPrevious: jest.fn(),
          onNext: jest.fn(),
          onTogglePlay: jest.fn(),
          onSelectStep,
          onSetSpeed: jest.fn(),
        })
      );
    });

    const text = collectRenderedTextAndLabels(tree!.root).join(" ").replace(/\s+/g, " ");
    expect(text).toContain("P1 - saque");
    expect(text).toContain("P1 - Antes do saque");
    expect(text).toContain("Posição do levantador");
    expect(text).toContain("P6");
    expect(text).toContain("P2");
    expect(text).not.toContain("Momento");
    expect(text).not.toContain("Após o saque");

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "P6" }).props.onPress();
    });
    expect(onSelectStep).toHaveBeenCalledWith(2);
  });

  it("disables play when the current frame has no animation", async () => {
    const payload = buildRotation5x1Preset();
    const onTogglePlay = jest.fn();

    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(VisualCourtTimelineControls, {
          payload,
          stepIndex: 0,
          isPlaying: false,
          canPlay: false,
          speed: 1,
          mode: "rotation_phase",
          onPrevious: jest.fn(),
          onNext: jest.fn(),
          onTogglePlay,
          onSelectStep: jest.fn(),
          onSetSpeed: jest.fn(),
        })
      );
    });

    const playButton = tree!.root.findByProps({
      accessibilityLabel: "Sem animação disponível",
    });
    expect(playButton.props.accessibilityState).toEqual({ disabled: true });

    act(() => {
      playButton.props.onPress?.();
    });
    expect(onTogglePlay).not.toHaveBeenCalled();
  });
});
