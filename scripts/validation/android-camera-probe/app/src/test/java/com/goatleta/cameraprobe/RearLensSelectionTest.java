package com.goatleta.cameraprobe;

import java.util.List;

/** JVM checks for the optical classification used before Camera2 binding. */
public final class RearLensSelectionTest {
  private static void check(boolean value, String message) {
    if (!value) throw new AssertionError(message);
  }

  public static void main(String[] args) {
    check(RearLensSelection.standard("rear", "ultra", new float[]{2.2f}, 5.2, 3.9) == null,
        "ultrawide is not the standard lens");
    check(RearLensSelection.standard("rear", "tele", new float[]{7.5f}, 4.8, 3.6) == null,
        "telephoto is not the standard lens");
    check(RearLensSelection.standard("rear", "variable", new float[]{2.2f, 5.5f}, 7.92, 5.94) == null,
        "multi-focal metadata cannot pin an unambiguous lens");
    check(RearLensSelection.standard("rear", "unknown", new float[]{5.5f}, 0, 0) == null,
        "missing sensor geometry does not establish optics");
    var main = RearLensSelection.standard("rear", "wide", new float[]{5.5f}, 7.92, 5.94);
    var other = RearLensSelection.standard("rear", "wide2", new float[]{6.1f}, 7.92, 5.94);
    var standalone = RearLensSelection.standard("single", null, new float[]{5.5f}, 7.92, 5.94);
    check(main != null && Math.abs(main.equivalentMm() - 24) < .1, "standard physical optics");
    check(RearLensSelection.choose(List.of(other, standalone, main)) == main,
        "closest physical standard lens wins independent of IDs/order");
    check(RearLensSelection.choose(List.of(standalone)) == standalone, "one standalone standard rear is unambiguous");
    var ambiguous = RearLensSelection.standard("rear", "wide3", new float[]{5.51f}, 7.92, 5.94);
    check(RearLensSelection.choose(List.of(main, ambiguous, standalone)) == null,
        "competing physical lenses fail closed without standalone fallback");
    check(RearLensSelection.choose(List.of(standalone, standalone)) == null, "competing standalone lenses fail closed");
    System.out.println("RearLensSelection checks passed");
  }
}
