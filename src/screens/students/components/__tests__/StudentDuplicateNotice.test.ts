import type { ThemeColors } from "../../../../ui/app-theme";
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import {
  StudentDuplicateBadge,
  StudentDuplicateReviewPrompt,
} from "../StudentDuplicateNotice";

const collectText = (node: unknown): string[] => {
  if (node == null) return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === "object") {
    const value = node as { props?: { children?: unknown } };
    return collectText(value.props?.children);
  }
  return [];
};

const colors = {
  text: "#fff",
  muted: "#94a3b8",
  border: "#334155",
  card: "#172033",
  warningBg: "#493d2f",
  warningText: "#f8d394",
  primaryBg: "#40df8e",
  primaryText: "#07130d",
} as ThemeColors;

describe("student duplicate review UI", () => {
  it("exposes independent review and keep actions as buttons", () => {
    const onReview = jest.fn(), onKeep = jest.fn();
    const screen = render(React.createElement(StudentDuplicateReviewPrompt, {
      colors, studentName: "Nome QA", onReview, onKeep,
    }));
    fireEvent.press(screen.getByRole("button", { name: "Revisar nome repetido" }));
    expect(onReview).toHaveBeenCalledTimes(1);
    expect(onKeep).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("button", { name: "Manter os dois cadastros" }));
    expect(onKeep).toHaveBeenCalledTimes(1);
  });

  it("keeps badge activation from opening the surrounding student row", () => {
    const onPress = jest.fn(), stopPropagation = jest.fn();
    const screen = render(React.createElement(StudentDuplicateBadge, { colors, onPress }));
    fireEvent.press(screen.getByRole("button", { name: "Revisar nome repetido" }), { stopPropagation });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it("uses a factual marker without uncertain copy", () => {
    const text = collectText(
      StudentDuplicateBadge({ colors, onPress: jest.fn() })
    ).join(" ");

    expect(text).toBe("Nome repetido");
    expect(text).not.toContain("possível");
  });

  it("keeps the review decision short and direct", () => {
    const text = collectText(
      StudentDuplicateReviewPrompt({
        colors,
        studentName: "Isadora Prost Gonçalves da Silva",
        onReview: jest.fn(),
        onKeep: jest.fn(),
      })
    ).join(" ");

    expect(text).toContain("Nome repetido");
    expect(text).toContain("Isadora Prost Gonçalves da Silva");
    expect(text).toContain("Manter os dois cadastros?");
    expect(text).toContain("Revisar");
    expect(text).toContain("Manter");
  });
});
