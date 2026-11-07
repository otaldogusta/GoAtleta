package com.goatleta.cameraprobe;

import java.util.Arrays;

/** Timestamp evidence only. Neither a configured frame rate nor decode order proves FPS. */
public final class FrameStats {
  public static final int MAX_SAMPLES = 15_000;
  public static final long MIN_PROOF_DURATION_US = 8_000_000L;
  private final long[] timestamps = new long[MAX_SAMPLES];
  private int size;
  private int invalidSamples;
  private int ignoredSamples;
  private int outOfOrderSamples;
  private long previous = Long.MIN_VALUE;

  public synchronized void addMicroseconds(long timestampUs) {
    if (timestampUs < 0) { invalidSamples++; return; }
    if (size == timestamps.length) { ignoredSamples++; return; }
    if (previous != Long.MIN_VALUE && timestampUs < previous) outOfOrderSamples++;
    previous = timestampUs;
    timestamps[size++] = timestampUs;
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
    long[] intervals = new long[Math.max(0, unique - 1)];
    for (int index = 1; index < unique; index++) intervals[index - 1] = sorted[index] - sorted[index - 1];
    Arrays.sort(intervals);
    long median = intervals.length == 0 ? 0 : intervals[intervals.length / 2];
    long p95 = intervals.length == 0 ? 0 : intervals[(int) Math.ceil(intervals.length * .95) - 1];
    long maximum = intervals.length == 0 ? 0 : intervals[intervals.length - 1];
    return new Result(size, unique, size - unique, invalidSamples, ignoredSamples,
        outOfOrderSamples, first, last, duration, fps, median, p95, maximum);
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

    private Result(int samples, int uniqueSamples, int duplicateSamples, int invalidSamples,
        int ignoredSamples, int outOfOrderSamples, long first, long last, long duration, double fps,
        long median, long p95, long maximum) {
      this.samples = samples; this.uniqueSamples = uniqueSamples; this.duplicateSamples = duplicateSamples;
      this.invalidSamples = invalidSamples; this.ignoredSamples = ignoredSamples;
      this.outOfOrderSamples = outOfOrderSamples; this.firstTimestampUs = first;
      this.lastTimestampUs = last; this.durationUs = duration; this.framesPerSecond = fps;
      this.medianIntervalUs = median; this.p95IntervalUs = p95; this.maxIntervalUs = maximum;
    }

    public boolean isLongEnoughNear60() {
      return ignoredSamples == 0 && invalidSamples == 0 && uniqueSamples >= 2
          && durationUs >= MIN_PROOF_DURATION_US && Double.isFinite(framesPerSecond)
          && framesPerSecond >= 59d && framesPerSecond <= 61d
          && medianIntervalUs > 0 && p95IntervalUs <= 22_000L && maxIntervalUs <= 50_000L;
    }
  }
}
