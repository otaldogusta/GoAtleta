export type GifFrame = {
  progress: number;
  delayMs: number;
};

const GIF_FRAMES_PER_SECOND = 12;
const GIF_MIN_FRAMES = 8;
const GIF_MAX_FRAMES = 120;

export function buildGifFramePlan(durationMs: number): GifFrame[] {
  const safeDuration = Math.max(450, Math.min(30_000, Number.isFinite(durationMs) ? durationMs : 2_000));
  const frameCount = Math.min(
    GIF_MAX_FRAMES,
    Math.max(GIF_MIN_FRAMES, Math.round((safeDuration / 1_000) * GIF_FRAMES_PER_SECOND)),
  );
  const durationUnits = Math.round(safeDuration / 10);
  const baseDelayUnits = Math.max(2, Math.floor(durationUnits / frameCount));
  const extraDelayFrames = Math.max(0, durationUnits - baseDelayUnits * frameCount);

  return Array.from({ length: frameCount }, (_, index) => ({
    progress: frameCount === 1 ? 1 : index / (frameCount - 1),
    delayMs: (baseDelayUnits + (index < extraDelayFrames ? 1 : 0)) * 10,
  }));
}

export function gifStepFilename(stepIndex: number, label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return `etapa-${String(stepIndex + 1).padStart(2, "0")}${slug ? `-${slug}` : ""}.gif`;
}

const SERVE_ROTATION_BY_POSITION: Record<string, string> = {
  P1: "Levantador",
  P6: "Ponteiro 1",
  P5: "Central 1",
  P4: "Oposto",
  P3: "Ponteiro 2",
  P2: "Central 2",
};

export function serveRotationLabel(label: string): string | null {
  const position = label.trim().match(/^P[1-6]\b/)?.[0];
  if (!position) return null;
  const player = SERVE_ROTATION_BY_POSITION[position];
  return player ? `Posição de saque: ${position} - ${player}` : null;
}

type PositionedStep = {
  actorPositions?: Record<string, { x: number; y: number }>;
  baselineActorPositions?: Record<string, { x: number; y: number }>;
};

export function usesSingleLowerCourtSide(steps: PositionedStep[]): boolean {
  const positions = steps.flatMap(step => Object.values(step.baselineActorPositions ?? step.actorPositions ?? {}));
  return positions.length > 0 && positions.every(position => position.y >= 0.42);
}
