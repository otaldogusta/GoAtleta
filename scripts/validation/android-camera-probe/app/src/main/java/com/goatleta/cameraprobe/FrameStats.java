package com.goatleta.cameraprobe;

import java.util.Arrays;

/** Timestamp evidence only. Neither a configured frame rate nor decode order proves FPS. */
public final class FrameStats {
  public static final int MAX_SAMPLES = 15_000;
  public static final long MIN_PROOF_DURATION_US = 8_000_000L;
  private static final int MAX_STUDIO_SAMPLES = 500_000;
  private static final long WINDOW_DURATION_US = 60_000_000L;
  private final int maxSamples;
  private long[] timestamps = new long[MAX_SAMPLES];
  private int size;
  private int invalidSamples;
  private int ignoredSamples;
  private int outOfOrderSamples;
  private long previous = Long.MIN_VALUE;

  public FrameStats() { this(MAX_SAMPLES); }

  private FrameStats(int maxSamples) { this.maxSamples = maxSamples; }

  static FrameStats forStudio() { return new FrameStats(MAX_STUDIO_SAMPLES); }

  public synchronized boolean addMicroseconds(long timestampUs) {
    if (timestampUs < 0) { invalidSamples++; return true; }
    if (size == maxSamples) { ignoredSamples++; return false; }
    if (size == timestamps.length) timestamps = Arrays.copyOf(timestamps, Math.min(maxSamples, size * 2));
    if (previous != Long.MIN_VALUE && timestampUs < previous) outOfOrderSamples++;
    previous = timestampUs;
    timestamps[size++] = timestampUs;
    return true;
  }

  public synchronized Result snapshot() {
    long[] sorted = Arrays.copyOf(timestamps, size);
    Arrays.sort(sorted);
    int unique = 0;
    for (long value : sorted) {
      if (unique == 0 || sorted[unique - 1] != value) sorted[unique++] = value;
    }
    long first = unique == 0 ? 0 : sorted[0];
    long last = unique == 0 ? 0 : sorted[unique - 1];
    long duration = last - first;
    double fps = unique >= 2 && duration > 0 ? (unique - 1) * 1_000_000d / duration : 0d;
    int cadenceWindows = 0, failedCadenceWindows = 0, windowStart = 0;
    for (int index = 1; index < unique; index++) {
      long span = sorted[index] - sorted[windowStart];
      boolean tail = index == unique - 1 && cadenceWindows > 0 && span >= MIN_PROOF_DURATION_US;
      if (span >= WINDOW_DURATION_US || tail) {
        cadenceWindows++;
        long[] window = intervals(sorted, windowStart, index);
        if (!nearSixty((index - windowStart) * 1_000_000d / span, window)) failedCadenceWindows++;
        windowStart = index;
      }
    }
    long[] intervals = intervals(sorted, 0, Math.max(0, unique - 1));
    long median = intervals.length == 0 ? 0 : intervals[intervals.length / 2];
    long p95 = percentile(intervals, .95);
    long maximum = percentile(intervals, 1);
    return new Result(size, unique, size - unique, invalidSamples, ignoredSamples,
        outOfOrderSamples, first, last, duration, fps, median, p95, maximum, cadenceWindows, failedCadenceWindows);
  }

  private static long[] intervals(long[] sorted, int start, int end) {
    long[] result = new long[end - start];
    for (int index = start; index < end; index++) result[index - start] = sorted[index + 1] - sorted[index];
    Arrays.sort(result);
    return result;
  }

  private static long percentile(long[] intervals, double fraction) {
    return intervals.length == 0 ? 0 : intervals[(int) Math.ceil(intervals.length * fraction) - 1];
  }

  private static boolean nearSixty(double fps, long[] intervals) {
    return fps >= 59 && fps <= 61 && percentile(intervals, .95) <= 22_000L && percentile(intervals, 1) <= 50_000L;
  }

  public static boolean proves1080p60(int width, int height, Result file, Result sensor) {
    return Math.max(width, height) == 1920 && Math.min(width, height) == 1080
        && file != null && sensor != null && file.isLongEnoughNear60() && sensor.isLongEnoughNear60();
  }

  public static final class Result {
    public final int samples;
    public final int uniqueSamples;
    public final int duplicateSamples;
    public final int invalidSamples;
    public final int ignoredSamples;
    public final int outOfOrderSamples;
    public final long firstTimestampUs;
    public final long lastTimestampUs;
    public final long durationUs;
    public final double framesPerSecond;
    public final long medianIntervalUs;
    public final long p95IntervalUs;
    public final long maxIntervalUs;
    public final int cadenceWindows;
    public final int failedCadenceWindows;

    private Result(int samples, int uniqueSamples, int duplicateSamples, int invalidSamples,
        int ignoredSamples, int outOfOrderSamples, long first, long last, long duration, double fps,
        long median, long p95, long maximum, int cadenceWindows, int failedCadenceWindows) {
      this.samples = samples; this.uniqueSamples = uniqueSamples; this.duplicateSamples = duplicateSamples;
      this.invalidSamples = invalidSamples; this.ignoredSamples = ignoredSamples;
      this.outOfOrderSamples = outOfOrderSamples; this.firstTimestampUs = first;
      this.lastTimestampUs = last; this.durationUs = duration; this.framesPerSecond = fps;
      this.medianIntervalUs = median; this.p95IntervalUs = p95; this.maxIntervalUs = maximum;
      this.cadenceWindows = cadenceWindows; this.failedCadenceWindows = failedCadenceWindows;
    }

    public boolean isLongEnoughNear60() {
      return ignoredSamples == 0 && invalidSamples == 0 && failedCadenceWindows == 0 && uniqueSamples >= 2
          && durationUs >= MIN_PROOF_DURATION_US && Double.isFinite(framesPerSecond)
          && framesPerSecond >= 59d && framesPerSecond <= 61d
          && medianIntervalUs > 0 && p95IntervalUs <= 22_000L && maxIntervalUs <= 50_000L;
    }
  }
}
