import { parseAgeBandRange } from "../age-band";
import { buildLudicAdaptation } from "./ludic-adapter";
import { buildPerformanceAdaptation } from "./performance-adapter";

export type MethodologyMode = "ludic" | "balanced" | "performance";

export type MethodologyTranslationRequest = {
  ageBand: string;
  pedagogicalTemperature?: number;
  classSize?: number;
  sessionDurationMinutes?: number;
  objectiveHint?: string;
};

export type MethodologyTranslation = {
  mode: MethodologyMode;
  pedagogicalTemperature: number;
  tags: string[];
  tips: string[];
  blockFormats: {
    warmup: string;
    main: string;
    cooldown: string;
  };
  coachPrompt: string;
  requiresHumanApproval: true;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const inferTemperatureByAgeBand = (ageBand: string) => {
  const range = parseAgeBandRange(ageBand);
  if (!Number.isFinite(range.start) || range.start === Number.MAX_SAFE_INTEGER) return 55;
  if (range.start <= 8) return 25;
  if (range.start <= 11) return 45;
  if (range.start <= 14) return 65;
  return 82;
};

const resolveMode = (pedagogicalTemperature: number): MethodologyMode => {
  if (pedagogicalTemperature <= 40) return "ludic";
  if (pedagogicalTemperature >= 70) return "performance";
  return "balanced";
};

const unique = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(value.trim());
  });
  return result;
};

export const translateMethodology = (
  request: MethodologyTranslationRequest
): MethodologyTranslation => {
  const classSize = request.classSize ?? 12;
  const duration = request.sessionDurationMinutes ?? 60;
  const objectiveHint = request.objectiveHint?.trim() ?? "";

  const temperature = clamp(
    Number.isFinite(Number(request.pedagogicalTemperature))
      ? Number(request.pedagogicalTemperature)
      : inferTemperatureByAgeBand(request.ageBand),
    0,
    100
  );

  const mode = resolveMode(temperature);

  const ludic = buildLudicAdaptation({
    ageStart: parseAgeBandRange(request.ageBand).start,
    classSize,
    sessionDurationMinutes: duration,
    objectiveHint,
  });
  const performance = buildPerformanceAdaptation({
    classSize,
    sessionDurationMinutes: duration,
    objectiveHint,
  });

  if (mode === "ludic") {
    return {
      mode,
      pedagogicalTemperature: temperature,
      tags: ludic.tags,
      tips: ludic.tips,
      blockFormats: ludic.blockFormats,
      coachPrompt: "Modo lúdico ativo: priorize engajamento, clareza e progressão por missão.",
      requiresHumanApproval: true,
    };
  }

  if (mode === "performance") {
    return {
      mode,
      pedagogicalTemperature: temperature,
      tags: performance.tags,
      tips: performance.tips,
      blockFormats: performance.blockFormats,
      coachPrompt: "Modo rendimento ativo: mantenha critério técnico, métricas e controle de carga.",
      requiresHumanApproval: true,
    };
  }

  return {
    mode,
    pedagogicalTemperature: temperature,
    tags: unique([...ludic.tags.slice(0, 3), ...performance.tags.slice(0, 3)]),
    tips: unique([...ludic.tips.slice(0, 3), ...performance.tips.slice(0, 3)]),
    blockFormats: {
      warmup: `${ludic.blockFormats.warmup} + ${performance.blockFormats.warmup}`,
      main: `${ludic.blockFormats.main} + ${performance.blockFormats.main}`,
      cooldown: `${ludic.blockFormats.cooldown} + ${performance.blockFormats.cooldown}`,
    },
    coachPrompt: "Modo híbrido ativo: equilibrar ludicidade e exigência técnica com critérios claros.",
    requiresHumanApproval: true,
  };
};
