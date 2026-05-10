jest.mock("../qr-code", () => ({
  generateQrDataUri: jest.fn(async (value: string) =>
    value ? "data:image/png;base64,mock-qr" : null,
  ),
}));

import {
  registerExerciseMediaAsset,
  resetExerciseMediaRegistry,
} from "../../exercise-media/exercise-media-registry";
import { enrichSessionPlanWithMedia } from "../enrich-session-plan-with-media";

describe("enrichSessionPlanWithMedia", () => {
  beforeEach(() => {
    resetExerciseMediaRegistry();
  });

  it("keeps data equivalent when no media exists", async () => {
    const data = {
      className: "Turma 16+",
      dateLabel: "05/05/2026",
      blocks: [
        {
          key: "main",
          label: "Treino resistido",
          activities: [{ name: "Stiff", sets: "3", reps: "8", rest: "75s" }],
        },
      ],
    };

    await expect(enrichSessionPlanWithMedia(data as any)).resolves.toEqual(data);
  });

  it("adds demo qr when approved media exists", async () => {
    registerExerciseMediaAsset({
      id: "stiff-video",
      exerciseKey: "stiff",
      title: "Demonstração do stiff",
      kind: "video",
      source: "seed",
      status: "approved",
      uri: "https://example.com/stiff-demo.mp4",
      createdAt: "2026-05-08T00:00:00.000Z",
    });

    const data = {
      className: "Turma 16+",
      dateLabel: "05/05/2026",
      blocks: [
        {
          key: "main",
          label: "Treino resistido",
          activities: [{ name: "Stiff", sets: "3", reps: "8", rest: "75s" }],
        },
      ],
    };

    const result = await enrichSessionPlanWithMedia(data as any);
    const activity = result.blocks[0].activities?.[0];

    expect(activity?.demoUrl).toBe("https://example.com/stiff-demo.mp4");
    expect(activity?.demoLabel).toBe("Demonstração");
    expect(activity?.demoQrDataUri).toMatch(/^data:image\/png;base64,/);
  });

  it("does not throw when qr generation path fails", async () => {
    registerExerciseMediaAsset({
      id: "blank-uri-video",
      exerciseKey: "agachamento",
      title: "Demonstração do agachamento",
      kind: "video",
      source: "seed",
      status: "approved",
      uri: "",
      createdAt: "2026-05-08T00:00:00.000Z",
    });

    const data = {
      className: "Turma 16+",
      dateLabel: "05/05/2026",
      blocks: [
        {
          key: "main",
          label: "Treino resistido",
          activities: [{ name: "Agachamento", sets: "3", reps: "8", rest: "75s" }],
        },
      ],
    };

    const result = await enrichSessionPlanWithMedia(data as any);
    expect(result.blocks[0].activities?.[0].demoQrDataUri).toBeUndefined();
  });
});
