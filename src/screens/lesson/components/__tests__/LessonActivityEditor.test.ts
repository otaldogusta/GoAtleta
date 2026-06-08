import TestRenderer, { act } from "react-test-renderer";
import React from "react";

import { LessonActivityEditor } from "../LessonActivityEditor";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const collectText = (node: unknown): string[] => {
  if (node == null) return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap((item) => collectText(item));
  if (typeof node === "object") {
    const maybeNode = node as {
      props?: {
        children?: unknown;
        placeholder?: unknown;
      };
    };
    return [
      typeof maybeNode.props?.placeholder === "string" ? maybeNode.props.placeholder : "",
      ...collectText(maybeNode.props?.children),
    ].filter(Boolean);
  }
  return [];
};

const collectRendererText = (renderer: TestRenderer.ReactTestRenderer | null) => {
  if (!renderer) return "";
  return renderer.root
    .findAll((node) => Boolean(node.props?.children || node.props?.placeholder))
    .flatMap((node) =>
      [
        typeof node.props?.placeholder === "string" ? node.props.placeholder : "",
        ...collectText(node.props?.children),
      ].filter(Boolean)
    )
    .join(" ");
};

const activity = {
  id: "activity_1",
  name: "Passe em duplas",
  description: "Duplas espalhadas na quadra.",
  organization: "Organizar duplas em meia quadra.",
  execution: "Um aluno lança e o outro devolve jogável.",
  coachFocus: "Observar comunicação.",
  successCriteria: "A bola volta jogável.",
  adaptation: "Aproximar as duplas.",
};

describe("LessonActivityEditor", () => {
  it("hides structured internal fields in standard plan view", async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(LessonActivityEditor, {
          activities: [activity],
          onChange: jest.fn(),
          showStructuredDetails: false,
        })
      );
    });

    const text = collectRendererText(tree);

    expect(text).toContain("Atividades");
    expect(text).toContain("Atividade");
    expect(text).toContain("Descrição");
    expect(text).not.toContain("Foco do professor");
    expect(text).not.toContain("Critério de sucesso");
    expect(text).not.toContain("Adaptação");
  });

  it("keeps structured fields available by default for advanced editors", async () => {
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(LessonActivityEditor, {
          activities: [activity],
          onChange: jest.fn(),
        })
      );
    });

    const text = collectRendererText(tree);

    expect(text).toContain("Organização");
    expect(text).toContain("Execução");
    expect(text).toContain("Foco do professor");
    expect(text).toContain("Critério de sucesso");
    expect(text).toContain("Adaptação");
  });
});
