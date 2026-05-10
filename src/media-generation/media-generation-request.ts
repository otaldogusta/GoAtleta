import type { MediaGenerationKind, MediaGenerationRequest } from "./media-generation.types";

const EXERCISE_KINDS: MediaGenerationKind[] = ["exercise_video", "exercise_image"];

export function getMediaGenerationRequestErrors(request: MediaGenerationRequest): string[] {
  const errors: string[] = [];

  if (!request.kind) {
    errors.push("kind is required");
  }

  if (EXERCISE_KINDS.includes(request.kind)) {
    if (!String(request.exerciseName ?? request.exerciseKey ?? "").trim()) {
      errors.push("exerciseName or exerciseKey is required for exercise media");
    }
  }

  if (request.kind === "coach_avatar" && !String(request.coachId ?? "").trim()) {
    errors.push("coachId is required for coach avatar media");
  }

  if (request.kind === "marketing_card" && !String(request.campaignKey ?? "").trim()) {
    errors.push("campaignKey is required for marketing media");
  }

  return errors;
}

export function isValidMediaGenerationRequest(request: MediaGenerationRequest): boolean {
  return getMediaGenerationRequestErrors(request).length === 0;
}

export function buildMediaGenerationRequestId(request: MediaGenerationRequest): string {
  if (String(request.requestId ?? "").trim()) {
    return String(request.requestId).trim();
  }

  const seed = String(
    request.exerciseKey ?? request.exerciseName ?? request.campaignKey ?? request.coachId ?? request.kind,
  )
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `media-gen-${seed || "request"}`;
}
