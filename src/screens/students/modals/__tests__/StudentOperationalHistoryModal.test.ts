import React from "react";
import { ScrollView, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import type { ThemeColors } from "../../../../ui/app-theme";
import { ModalSheet } from "../../../../ui/ModalSheet";
import { StudentOperationalHistoryModal } from "../StudentOperationalHistoryModal";

jest.mock("../../../../ui/ModalSheet", () => {
  const ReactModule = require("react");

  return {
    ModalSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? ReactModule.createElement(ReactModule.Fragment, null, children) : null,
  };
});

const colors = {
  text: "#0f172a",
  muted: "#64748b",
  card: "#ffffff",
  border: "#cbd5e1",
  primaryBg: "#15803d",
  secondaryBg: "#f1f5f9",
} as ThemeColors;

describe("StudentOperationalHistoryModal", () => {
  it("shows a concise retry action when loading fails", async () => {
    const onRetry = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(StudentOperationalHistoryModal, {
          visible: true,
          loading: false,
          events: [],
          errorMessage: "Não foi possível carregar o histórico.",
          colors,
          onClose: jest.fn(),
          onRetry,
        }),
      );
    });

    const text = renderer!.root
      .findAllByType(Text)
      .flatMap((node) => node.props.children)
      .filter((value) => typeof value === "string")
      .join(" ");
    expect(text).toContain("Não foi possível carregar o histórico.");
    expect(text).not.toContain("Nenhuma alteração registrada.");

    const retry = renderer!.root.findByProps({
      accessibilityLabel: "Tentar carregar o histórico novamente",
    });
    act(() => retry.props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("bounds long content inside the modal scroll region", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(StudentOperationalHistoryModal, {
          visible: true,
          loading: false,
          events: [],
          errorMessage: "",
          colors,
          onClose: jest.fn(),
          onRetry: jest.fn(),
        }),
      );
    });

    const modal = renderer!.root.findByType(ModalSheet);
    expect(modal.props.cardStyle).toEqual(
      expect.objectContaining({ overflow: "hidden" }),
    );

    const scroll = renderer!.root.findByType(ScrollView);
    expect(scroll.props.style).toEqual(
      expect.objectContaining({ minHeight: 0, flexShrink: 1 }),
    );
    expect(scroll.props.showsVerticalScrollIndicator).toBe(true);
  });
});
