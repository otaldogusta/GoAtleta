import { buildGifFramePlan, gifStepFilename, serveRotationLabel, usesSingleLowerCourtSide } from "../court-export-utils";

describe("court GIF export", () => {
  it("covers the full stage animation and preserves its duration", () => {
    const frames = buildGifFramePlan(2_200);

    expect(frames[0].progress).toBe(0);
    expect(frames.at(-1)?.progress).toBe(1);
    expect(frames).toHaveLength(26);
    expect(frames.reduce((total, frame) => total + frame.delayMs, 0)).toBeCloseTo(2_200, -1);
  });

  it("limits long animations to a practical browser export size", () => {
    const frames = buildGifFramePlan(30_000);

    expect(frames).toHaveLength(120);
    expect(frames[0].progress).toBe(0);
    expect(frames.at(-1)?.progress).toBe(1);
  });

  it("creates a stable and readable filename for the selected stage", () => {
    expect(gifStepFilename(1, "P1 · Organização da recepção")).toBe(
      "etapa-02-p1-organizacao-da-recepcao.gif",
    );
  });

  it.each([
    ["P1 · Organização da recepção", "Posição de saque: P1 - Levantador"],
    ["P6 · Após o saque", "Posição de saque: P6 - Ponteiro 1"],
    ["P5 · Organização da recepção", "Posição de saque: P5 - Central 1"],
    ["P4 · Após o saque", "Posição de saque: P4 - Oposto"],
    ["P3 · Organização da recepção", "Posição de saque: P3 - Ponteiro 2"],
    ["P2 · Após o saque", "Posição de saque: P2 - Central 2"],
  ])("describes the 5x1 server for %s", (label, expected) => {
    expect(serveRotationLabel(label)).toBe(expected);
  });

  it("does not invent a server for a custom stage", () => {
    expect(serveRotationLabel("Exercício livre")).toBeNull();
  });

  it("uses the vertical half-court only when every initial position is on the same lower side", () => {
    expect(usesSingleLowerCourtSide([{ baselineActorPositions: { a: { x: 0.2, y: 0.56 }, b: { x: 0.8, y: 0.86 } } }])).toBe(true);
    expect(usesSingleLowerCourtSide([{ baselineActorPositions: { a: { x: 0.2, y: 0.2 }, b: { x: 0.8, y: 0.86 } } }])).toBe(false);
    expect(usesSingleLowerCourtSide([])).toBe(false);
  });
});
