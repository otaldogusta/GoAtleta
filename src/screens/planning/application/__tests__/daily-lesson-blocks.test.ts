import type { LessonBlock } from "../../../../core/models";
import { ensureLessonBlocksMatchSessionEnvironment } from "../daily-lesson-blocks";

const courtBlocks: LessonBlock[] = [
  {
    key: "warmup",
    label: "Aquecimento",
    durationMinutes: 10,
    activities: [{ name: "Recepção leve", description: "Manchete em duplas." }],
  },
  {
    key: "main",
    label: "Parte principal",
    durationMinutes: 45,
    activities: [
      {
        name: "Recepção de saque direcionado",
        description: "Recepção e transição para contra-ataque em quadra.",
      },
    ],
  },
  {
    key: "cooldown",
    label: "Volta à calma",
    durationMinutes: 5,
    activities: [{ name: "Roda final", description: "Fechamento em quadra." }],
  },
];

describe("ensureLessonBlocksMatchSessionEnvironment", () => {
  it("substitui conteúdo de quadra quando o tipo é academia", () => {
    const result = ensureLessonBlocksMatchSessionEnvironment(courtBlocks, "academia", 60);

    expect(result.map((block) => block.label)).toEqual([
      "Preparação",
      "Treino resistido",
      "Fechamento",
    ]);
    expect(result[1]?.activities.map((activity) => activity.name)).toEqual(
      expect.arrayContaining(["Leg Press 45°", "Stiff com halteres"])
    );
    expect(result[1]?.activities.map((activity) => activity.name).join(" ")).not.toMatch(
      /recepção|saque|jogo/i
    );
  });

  it("mantém bloco de academia válido", () => {
    const academyBlocks = ensureLessonBlocksMatchSessionEnvironment(courtBlocks, "academia", 60);

    expect(ensureLessonBlocksMatchSessionEnvironment(academyBlocks, "academia", 60)).toEqual(
      academyBlocks
    );
  });
});
