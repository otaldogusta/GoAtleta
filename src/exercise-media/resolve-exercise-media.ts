import { listExerciseMediaAssets } from "./exercise-media-registry";
import { normalizeExerciseMediaKey } from "./exercise-media-normalization";
import type {
  ExerciseMediaAsset,
  ExerciseMediaResolutionInput,
  ExerciseMediaResolutionReason,
  ExerciseMediaResolutionResult,
} from "./exercise-media.types";

function hasPreferredKind(
  asset: ExerciseMediaAsset,
  preferredKind?: ExerciseMediaResolutionInput["preferredKind"]
): boolean {
  return !preferredKind || asset.kind === preferredKind;
}

function normalizeTags(tags?: string[]): string[] {
  return (tags ?? []).map(normalizeExerciseMediaKey).filter(Boolean);
}

function scoreContextMatch(
  asset: ExerciseMediaAsset,
  input: ExerciseMediaResolutionInput
): number {
  let score = 0;

  if (input.modality && asset.modality === input.modality) {
    score += 4;
  }
  if (input.sport && asset.sport === input.sport) {
    score += 4;
  }
  if (input.ageBand && asset.ageBand === input.ageBand) {
    score += 2;
  }
  if (input.level && asset.level === input.level) {
    score += 1;
  }

  return score;
}

function sortCandidates(
  assets: ExerciseMediaAsset[],
  input: ExerciseMediaResolutionInput
): ExerciseMediaAsset[] {
  return [...assets].sort((left, right) => {
    const kindDelta =
      Number(hasPreferredKind(right, input.preferredKind)) -
      Number(hasPreferredKind(left, input.preferredKind));

    if (kindDelta !== 0) {
      return kindDelta;
    }

    const contextDelta = scoreContextMatch(right, input) - scoreContextMatch(left, input);
    if (contextDelta !== 0) {
      return contextDelta;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

function buildResult(
  asset: ExerciseMediaAsset | null,
  reason: ExerciseMediaResolutionReason,
  candidates: ExerciseMediaAsset[]
): ExerciseMediaResolutionResult {
  return {
    asset,
    reason,
    candidates,
  };
}

export function resolveExerciseMedia(
  input: ExerciseMediaResolutionInput
): ExerciseMediaResolutionResult {
  const normalizedName = normalizeExerciseMediaKey(input.exerciseName);

  if (!normalizedName) {
    return buildResult(null, "not_found", []);
  }

  const assets = listExerciseMediaAssets().filter(
    (asset) => asset.status === "approved"
  );

  const exactMatches = sortCandidates(
    assets.filter(
      (asset) =>
        asset.exerciseKey === normalizedName &&
        hasPreferredKind(asset, input.preferredKind)
    ),
    input
  );

  if (exactMatches.length > 0) {
    return buildResult(exactMatches[0], "exact_match", exactMatches);
  }

  const normalizedNameMatches = sortCandidates(
    assets.filter(
      (asset) =>
        normalizeExerciseMediaKey(asset.exerciseKey) === normalizedName &&
        hasPreferredKind(asset, input.preferredKind)
    ),
    input
  );

  if (normalizedNameMatches.length > 0) {
    return buildResult(
      normalizedNameMatches[0],
      "normalized_name_match",
      normalizedNameMatches
    );
  }

  const inputTags = normalizeTags(input.tags);
  const tagMatches = sortCandidates(
    assets.filter((asset) => {
      if (!hasPreferredKind(asset, input.preferredKind)) {
        return false;
      }

      const assetTags = normalizeTags(asset.tags);
      return inputTags.some((tag) => assetTags.includes(tag));
    }),
    input
  );

  if (tagMatches.length > 0) {
    return buildResult(tagMatches[0], "tag_match", tagMatches);
  }

  const fallbackMatches = sortCandidates(
    assets.filter((asset) => hasPreferredKind(asset, input.preferredKind)),
    input
  );

  if (fallbackMatches.length > 0) {
    return buildResult(fallbackMatches[0], "fallback_match", fallbackMatches);
  }

  return buildResult(null, "not_found", []);
}
