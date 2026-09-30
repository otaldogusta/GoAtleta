import {
  PERIODIZATION_GAME_LEVELS,
  type PeriodizationGameLevel,
} from "../../../core/periodization-policy";

export const REFERENCE_COURT = {
  length: 18,
  width: 9,
  netX: 9,
  attackLinesX: [6, 12],
} as const;

/** Metres, centred across the net and sharing the bottom sideline as in the PDF. */
export function getPeriodizationCourtGeometry(level: PeriodizationGameLevel) {
  const format = PERIODIZATION_GAME_LEVELS.find((item) => item.value === level)!;
  return {
    x: (REFERENCE_COURT.length - format.lengthMeters) / 2,
    y: REFERENCE_COURT.width - format.widthMeters,
    length: format.lengthMeters,
    width: format.widthMeters,
    depthPerSide: format.lengthMeters / 2,
  };
}

export function formatCourtMetres(value: number) {
  return String(value).replace(".", ",");
}

export function getCourtDimensionsLabel(level: PeriodizationGameLevel) {
  const court = getPeriodizationCourtGeometry(level);
  return `${formatCourtMetres(court.length)} × ${formatCourtMetres(court.width)} m`;
}
