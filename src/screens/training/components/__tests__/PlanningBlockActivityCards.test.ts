import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import type { TrainingPlanActivity } from "../../../../core/models";
import { PlanningBlockActivityCards } from "../PlanningBlockActivityCards";

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});

const collectText = (node: unknown): string[] => {
  if (node == null) return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap((item) => collectText(item));
  if (typeof node === "object") {
    const maybeNode = node as { props?: { children?: unknown } };
    return collectText(maybeNode.props?.children);
  }
  return [];
};

const collectRenderedText = (renderer: TestRenderer.ReactTestRenderer) =>
  renderer.root
    .findAll(() => true)
    .flatMap((node) => collectText(node.props.children))
    .join(" ")
    .replace(/\s+/g, " ");

describe("PlanningBlockActivityCards", () => {
  it("renders source badges and block actions", () => {
    const activity: TrainingPlanActivity = {
      name: "Caça da bola jogável",
      description: "Aumentar cooperação.",
      catalog: {
        source: "goAtletaCatalog",
        familyId: "continuidade_tres_contatos",
        variantId: "caca_bola_jogavel",
        addedAt: "2026-06-16T12:00:00.000Z",
      },
    };
    const onAdd = jest.fn();
    const onView = jest.fn();
    const onRemove = jest.fn();
    const onManualTextChange = jest.fn();
    const onDurationChange = jest.fn();

    let renderer: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(PlanningBlockActivityCards, {
          blockKey: "warmup",
          activities: [activity],
          manualText: "Jogo de entrada",
          duration: "10:00",
          durationPlaceholder: "10:00",
          durationFormat: "duration",
          onAdd,
          onView,
          onRemove,
          onManualTextChange,
          onDurationChange,
        })
      );
    });

    const text = collectRenderedText(renderer!);
    expect(text).toContain("Aquecimento");
    expect(text).toContain("Caça da bola jogável");
    expect(text).toContain("Catálogo GoAtleta");
    expect(text).toContain("texto manual");
    expect(text).toContain("play-circle-outline");
    expect(text).toContain("eye-outline");
    expect(text).toContain("trash-outline");

    act(() => {
      renderer!.root.findByProps({ testID: "planning-add-activity-warmup" }).props.onPress();
    });
    expect(onAdd).toHaveBeenCalledWith("warmup");

    act(() => {
      renderer!.root.findByProps({ testID: "planning-remove-warmup-0" }).props.onPress();
    });
    expect(onRemove).toHaveBeenCalledWith("warmup", 0);

    act(() => {
      renderer!.root.findByProps({ testID: "planning-manual-text-warmup" }).props.onChangeText("Novo texto");
    });
    expect(onManualTextChange).toHaveBeenCalledWith("Novo texto");
  });

  it("renders compact block empty state", () => {
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(PlanningBlockActivityCards, {
          blockKey: "cooldown",
          activities: [],
          manualText: "",
          duration: "",
          durationPlaceholder: "05:00",
          durationFormat: "duration",
          onAdd: jest.fn(),
          onView: jest.fn(),
          onRemove: jest.fn(),
          onManualTextChange: jest.fn(),
          onDurationChange: jest.fn(),
        })
      );
    });

    expect(collectRenderedText(renderer!)).toContain("Sem atividades");
  });
});
