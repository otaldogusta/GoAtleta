import type { LessonBlock } from "../../../../core/models";
import {
  ensureLessonBlocksMatchSessionEnvironment,
  resolveConservativeDailySessionEnvironment,
} from "../daily-lesson-blocks";

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

  it("estrutura sessão mista com academia antes da transferência para quadra", () => {
    const result = ensureLessonBlocksMatchSessionEnvironment(courtBlocks, "mista", 90);

    expect(result.map((block) => block.label)).toEqual([
      "Preparação",
      "Academia",
      "Transferência para quadra e fechamento",
    ]);
    expect(result[1]?.activities.map((activity) => activity.name)).toEqual(
      expect.arrayContaining(["Leg Press 45°", "Stiff com halteres"])
    );
    expect(result[2]?.activities[0]?.description).toMatch(/Após o bloco de academia/i);
  });

  it("normaliza estrutura mista antiga que começava pela quadra", () => {
    const legacyMixedBlocks: LessonBlock[] = [
      {
        key: "warmup",
        label: "Quadra inicial",
        durationMinutes: 10,
        activities: [{ name: "Ativação com bola", description: "Manchete leve em quadra." }],
      },
      {
        key: "main",
        label: "Academia",
        durationMinutes: 60,
        activities: [{ name: "Leg Press 45°", description: "3 séries de 8 repetições." }],
      },
      {
        key: "cooldown",
        label: "Transferência para quadra e fechamento",
        durationMinutes: 20,
        activities: [{ name: "Aplicação técnica", description: "Retorno para a quadra." }],
      },
    ];

    const result = ensureLessonBlocksMatchSessionEnvironment(legacyMixedBlocks, "mista", 90);

    expect(result[0]?.label).toBe("Preparação");
    expect(result[0]?.activities[0]?.name).toBe("Mobilidade e ativação para transferência");
  });
});

describe("resolveConservativeDailySessionEnvironment", () => {
  it("usa quadra quando academia veio sem evidência forte", () => {
    expect(
      resolveConservativeDailySessionEnvironment(
        {
          sessionEnvironment: "academia",
          sessionComponents: [],
          manualOverrideMaskJson: undefined,
          manualOverridesJson: undefined,
        },
        courtBlocks
      )
    ).toBe("quadra");
  });

  it("mantém academia quando professor alterou explicitamente", () => {
    expect(
      resolveConservativeDailySessionEnvironment(
        {
          sessionEnvironment: "academia",
          sessionComponents: [],
          manualOverrideMaskJson: JSON.stringify(["sessionEnvironment"]),
          manualOverridesJson: undefined,
        },
        courtBlocks
      )
    ).toBe("academia");
  });

  it("não mantém academia se componente resistido veio junto de conteúdo de quadra", () => {
    expect(
      resolveConservativeDailySessionEnvironment(
        {
          sessionEnvironment: "academia",
          sessionComponents: [
            {
              type: "academia_resistido",
              durationMin: 35,
              resistancePlan: {
                id: "r1",
                label: "Treino resistido",
                primaryGoal: "forca_base",
                transferTarget: "salto",
                estimatedDurationMin: 35,
                exercises: [],
              },
            },
          ],
          manualOverrideMaskJson: undefined,
          manualOverridesJson: undefined,
        },
        courtBlocks
      )
    ).toBe("quadra");
  });

  it("mantém academia quando componente resistido combina com bloco resistido real", () => {
    const academyBlocks = ensureLessonBlocksMatchSessionEnvironment(courtBlocks, "academia", 60);

    expect(
      resolveConservativeDailySessionEnvironment(
        {
          sessionEnvironment: "academia",
          sessionComponents: [
            {
              type: "academia_resistido",
              durationMin: 35,
              resistancePlan: {
                id: "r1",
                label: "Treino resistido",
                primaryGoal: "forca_base",
                transferTarget: "salto",
                estimatedDurationMin: 35,
                exercises: [],
              },
            } as any,
          ],
          manualOverrideMaskJson: undefined,
          manualOverridesJson: undefined,
        },
        academyBlocks
      )
    ).toBe("academia");
  });
});
