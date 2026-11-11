package com.goatleta.cameraprobe;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Identifies a standard rear lens by optics, independent of vendor camera IDs and zoom labels. */
final class RearLensSelection {
  private static final double FULL_FRAME_DIAGONAL_MM = Math.hypot(36, 24);
  private static final double STANDARD_TARGET_MM = 24;
  private static final double AMBIGUOUS_SCORE_MM = .5;

  record Lens(String cameraId, String physicalId, double focalLengthMm, double sensorDiagonalMm,
      double equivalentMm) {
    double distanceFromStandard() { return Math.abs(equivalentMm - STANDARD_TARGET_MM); }
  }

  static Lens standard(String cameraId, String physicalId, float[] focalLengths,
      double sensorWidthMm, double sensorHeightMm) {
    if (focalLengths == null || focalLengths.length != 1 || !Float.isFinite(focalLengths[0])
        || focalLengths[0] <= 0 || sensorWidthMm <= 0 || sensorHeightMm <= 0) return null;
    double diagonal = Math.hypot(sensorWidthMm, sensorHeightMm);
    double equivalent = FULL_FRAME_DIAGONAL_MM * focalLengths[0] / diagonal;
    if (!Double.isFinite(equivalent) || equivalent < 22 || equivalent > 32) return null;
    return new Lens(cameraId, physicalId, focalLengths[0], diagonal, equivalent);
  }

  static Lens choose(List<Lens> candidates) {
    List<Lens> physical = new ArrayList<>();
    Lens standalone = null;
    int standaloneCount = 0;
    for (Lens lens : candidates) {
      if (lens.physicalId() != null) {
        physical.add(lens);
      } else {
        standalone = lens;
        standaloneCount++;
      }
    }
    if (physical.isEmpty()) return standaloneCount == 1 ? standalone : null;
    physical.sort(Comparator.comparingDouble(Lens::distanceFromStandard));
    Lens best = physical.get(0);
    if (physical.size() > 1 && physical.get(1).distanceFromStandard() - best.distanceFromStandard() < AMBIGUOUS_SCORE_MM) {
      return null;
    }
    return best;
  }

  private RearLensSelection() {}
}
