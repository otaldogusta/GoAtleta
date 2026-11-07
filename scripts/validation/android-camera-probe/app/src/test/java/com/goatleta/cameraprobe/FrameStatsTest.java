package com.goatleta.cameraprobe;

/** JVM-only checks; run with javac/java, no Android device, Gradle test framework or dependency. */
public final class FrameStatsTest {
  private static void check(boolean value, String message) {
    if (!value) throw new AssertionError(message);
  }

  private static FrameStats series(int frames, double fps) {
    FrameStats stats = new FrameStats();
    for (int index = 0; index < frames; index++) stats.addMicroseconds(Math.round(index * 1_000_000d / fps));
    return stats;
  }

  public static void main(String[] args) {
    FrameStats.Result sixty = series(601, 60).snapshot();
    FrameStats.Result fractional = series(601, 59.94).snapshot();
    check(sixty.uniqueSamples == 601 && sixty.durationUs == 10_000_000L, "PTS span/count");
    check(Math.abs(sixty.framesPerSecond - 60) < 0.0001, "N-1 intervals, not N/span");
    check(FrameStats.proves1080p60(1920, 1080, sixty, fractional), "60 and 59.94 accepted");
    check(FrameStats.proves1080p60(1080, 1920, fractional, sixty), "portrait Full HD accepted");
    check(!FrameStats.proves1080p60(1280, 720, sixty, sixty), "720p is not Full HD");
    check(!FrameStats.proves1080p60(1920, 1080, sixty, series(301, 30).snapshot()), "30 fps sensor cannot prove 60 fps");
    check(!FrameStats.proves1080p60(1920, 1080, series(301, 30).snapshot(), sixty), "30 fps file cannot prove 60 fps");
    check(!FrameStats.proves1080p60(1920, 1080, series(61, 60).snapshot(), sixty), "short sample cannot pass");

    FrameStats reordered = new FrameStats();
    for (int index = 0; index < 600; index += 3) {
      reordered.addMicroseconds(Math.round(index * 1_000_000d / 60));
      reordered.addMicroseconds(Math.round((index + 2) * 1_000_000d / 60));
      reordered.addMicroseconds(Math.round((index + 1) * 1_000_000d / 60));
    }
    FrameStats.Result bFrames = reordered.snapshot();
    check(bFrames.outOfOrderSamples > 0 && bFrames.isLongEnoughNear60(), "B-frame decode order is not a failed proof");
    FrameStats duplicated = new FrameStats();
    for (int index = 0; index < 301; index++) {
      long time = Math.round(index * 1_000_000d / 30);
      duplicated.addMicroseconds(time); duplicated.addMicroseconds(time);
    }
    FrameStats.Result duplicateResult = duplicated.snapshot();
    check(duplicateResult.duplicateSamples == 301 && duplicateResult.uniqueSamples == 301, "duplicate PTS counted separately");
    check(Math.abs(duplicateResult.framesPerSecond - 30) < 0.001, "duplicate PTS cannot inflate 30 to 60");
    check(!duplicateResult.isLongEnoughNear60(), "duplicates are not synthetic CFR proof");
    check(new FrameStats().snapshot().framesPerSecond == 0, "empty evidence");
    FrameStats invalid = series(601, 60); invalid.addMicroseconds(-1);
    check(!invalid.snapshot().isLongEnoughNear60(), "invalid timestamps cannot certify");
    FrameStats capped = series(FrameStats.MAX_SAMPLES + 1, 60);
    check(capped.snapshot().samples == FrameStats.MAX_SAMPLES && capped.snapshot().ignoredSamples == 1, "sample bound");
    check(!capped.snapshot().isLongEnoughNear60(), "truncated analysis cannot certify");
    FrameStats stalled = new FrameStats();
    for (int index = 0; index < 480; index++) stalled.addMicroseconds(index * 8_333L);
    stalled.addMicroseconds(8_000_000L);
    FrameStats.Result burstAndGap = stalled.snapshot();
    check(Math.abs(burstAndGap.framesPerSecond - 60) < .001, "the adversarial average looks exactly like 60 fps");
    check(burstAndGap.maxIntervalUs > 4_000_000L && !burstAndGap.isLongEnoughNear60(), "a 4-second stall cannot certify a 120fps burst as 60fps");
    check(sixty.medianIntervalUs >= 16_666 && sixty.medianIntervalUs <= 16_667
        && sixty.p95IntervalUs <= 16_667 && sixty.maxIntervalUs <= 16_667, "regular 60 fps interval distribution");
    check(fractional.isLongEnoughNear60() && fractional.p95IntervalUs < 17_000, "59.94 fps remains valid");
    FrameStats rareDrop = new FrameStats();
    for (int index = 0; index <= 600; index++) if (index != 200) rareDrop.addMicroseconds(Math.round(index * 1_000_000d / 60));
    check(rareDrop.snapshot().isLongEnoughNear60() && rareDrop.snapshot().maxIntervalUs < 34_000, "one dropped frame in ten seconds remains near 60 fps");
    FrameStats longDrop = new FrameStats();
    for (int index = 0; index <= 600; index++) if (index < 200 || index > 204) longDrop.addMicroseconds(Math.round(index * 1_000_000d / 60));
    check(!longDrop.snapshot().isLongEnoughNear60(), "a substantial stall fails even if its average remains near 60");
    FrameStats alternatingBurst = new FrameStats(); long time = 0; alternatingBurst.addMicroseconds(time);
    for (int index = 0; index < 600; index++) { time += index % 2 == 0 ? 8_333L : 25_000L; alternatingBurst.addMicroseconds(time); }
    FrameStats.Result uneven = alternatingBurst.snapshot();
    check(uneven.framesPerSecond > 59 && uneven.framesPerSecond < 61 && uneven.maxIntervalUs < 50_000,
        "the burst fixture passes average and maximum-gap limits alone");
    check(uneven.p95IntervalUs == 25_000 && !uneven.isLongEnoughNear60(), "p95 rejects sustained uneven bursts");
    System.out.println("FrameStats checks passed");
  }
}
