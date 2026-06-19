import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import type { TrainingPlan } from "../../../../core/models";
import { TrainingPlanDetailsModalContent } from "../TrainingPlanDetailsModalContent";

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

describe("TrainingPlanDetailsModalContent", () => {
  it("prioritizes pedagogy blocks and shows catalog source as UI label", async () => {
    const plan: TrainingPlan = {
      id: "plan_1",
      classId: "class_1",
      title: "Plano",
      tags: [],
      warmup: ["Aquecimento legado"],
      main: ["Parte principal legada"],
      cooldown: [],
      warmupTime: "10",
      mainTime: "40",
      cooldownTime: "10",
      createdAt: "2026-06-15T00:00:00.000Z",
      pedagogy: {
        blocks: {
          warmup: {
            summary: "",
            activities: [
              {
                name: "Caça da bola jogável",
                description: "Aumentar cooperação e primeiro contato jogável.",
                catalog: {
                  source: "goAtletaCatalog",
                  familyId: "continuity",
                  variantId: "playable-ball",
                  addedAt: "2026-06-15T00:00:00.000Z",
                },
              },
            ],
          },
          main: { summary: "", activities: [] },
          cooldown: { summary: "", activities: [] },
        },
      },
    };

    let renderer: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(TrainingPlanDetailsModalContent, {
          plan,
        })
      );
    });

    const text = collectRenderedText(renderer!);

    expect(text).toContain("Caça da bola jogável");
    expect(text).toContain("Aumentar cooperação");
    expect(text).toContain("Catálogo GoAtleta");
    expect(text).not.toContain("Aquecimento legado");
    expect(text).not.toContain("goAtletaCatalog");
    expect(text).not.toContain("variantId");
  });

  it("normalizes imported text accents in the visible plan detail", async () => {
    const plan: TrainingPlan = {
      id: "plan_legacy",
      classId: "class_1",
      title: "Plano legado",
      tags: [],
      warmup: [],
      main: [
        "Objetivo geral: Desenvolver coordenacao motora com adaptacoes.",
        "Lancar + palmas",
      ],
      cooldown: [],
      warmupTime: "10",
      mainTime: "40",
      cooldownTime: "10",
      createdAt: "2026-06-15T00:00:00.000Z",
    };

    let renderer: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(TrainingPlanDetailsModalContent, {
          plan,
        })
      );
    });

    const text = collectRenderedText(renderer!);

    expect(text).toContain("coordenação");
    expect(text).toContain("adaptações");
    expect(text).toContain("Lançar + palmas");
    expect(text).not.toContain("coordenacao");
    expect(text).not.toContain("adaptacoes");
    expect(text).not.toContain("Lancar");
  });
});
