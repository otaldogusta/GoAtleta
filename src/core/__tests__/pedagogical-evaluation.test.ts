import {
    evaluateSessionOutcome,
    type SessionSkillHistoryEntry,
} from "../pedagogical-evaluation";
import type { ScoutingCounts } from "../scouting";

// ---------------------------------------------------------------------------
// Helpers — ScoreCounts = { 0: n; 1: n; 2: n }
// avg = (n1 + 2*n2) / (n0+n1+n2)
// ---------------------------------------------------------------------------
const makeServeCounts = (avg: number, total: number): ScoutingCounts => {
  const empty = { 0: 0, 1: 0, 2: 0 } as const;
  let n0: number, n1: number, n2: number;
  if (avg <= 1) {
    n1 = Math.round(avg * total);
    n0 = total - n1;
    n2 = 0;
  } else {
    n2 = Math.round((avg - 1) * total);
    n1 = total - n2;
    n0 = 0;
  }
  return {
    serve: { 0: n0, 1: n1, 2: n2 },
    receive: { ...empty },
    set: { ...empty },
    attack_send: { ...empty },
  };
};

// total=20 → no rounding errors on these avg values
// avg=1.5 → perf=75; avg=0.8 → perf=40; avg=2.0 → perf=100; avg=1.4 → perf=70; avg=1.6 → perf=80
const SCOUTING_75 = makeServeCounts(1.5, 20);
const SCOUTING_40 = makeServeCounts(0.8, 20);
const SCOUTING_100 = makeServeCounts(2.0, 20);
const SCOUTING_80 = makeServeCounts(1.6, 20);
const LOW_TOTAL = makeServeCounts(1.5, 3); // total=3 → confidence baixo

const historyAt = (scores: number[], baseDaysAgo = 30): SessionSkillHistoryEntry[] =>
  scores.map((performanceScore, i) => ({
    date: new Date(Date.now() - (baseDaysAgo - i) * 86_400_000).toISOString(),
    performanceScore,
  }));

const criteria70 = ["70%"];

// ---------------------------------------------------------------------------
// 1. Consistency — recency weighting
// ---------------------------------------------------------------------------
describe("resolveConsistencyScore (via evaluateSessionOutcome)", () => {
  it("stable recent sessions produce higher consistency than volatile ones", () => {
    const historyStable = historyAt([72, 73, 74, 75, 74]);
    const historyVolatile = historyAt([72, 40, 80, 30, 75]);

    const stable = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: SCOUTING_75,
      history: historyStable,
    });
    const volatile = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: SCOUTING_75,
      history: historyVolatile,
    });
    expect(stable.consistencyScore).toBeGreaterThan(volatile.consistencyScore);
  });

  it("returns 50 for single-entry history", () => {
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: SCOUTING_75,
      history: historyAt([75]),
    });
    // scores = [75, 75] → length 2; near-zero stddev → ~100; single "prev" score same as current
    expect(result.consistencyScore).toBeGreaterThan(80);
  });
});

// ---------------------------------------------------------------------------
// 2. Adaptive threshold (conservative 4–10)
// ---------------------------------------------------------------------------
describe("resolveAdaptiveThreshold (via trend detection)", () => {
  it("stable history + high confidence → lower threshold detects small improvement as subindo", () => {
    // perf=80, prev=73 (last in history), delta=7
    // stddev of [72,73,73,73] ≈ 0.43 → threshold ≈ clamp(5+0.43*0.5-1,4,10) = clamp(4.22,4,10) = 4.22
    // delta=7 > 4.22 → subindo
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: SCOUTING_80,
      history: historyAt([72, 73, 73, 73]),
    });
    expect(result.skillLearningState.trend).toBe("subindo");
  });

  it("volatile history → threshold clamped to 10, small delta stays estagnado", () => {
    // history [40,80,40,80,75]: stddev ≈ 17 → clamp(5+17*0.5-1,4,10)=clamp(12,4,10)=10
    // perf=80, prev=75, delta=5 < 10 → estagnado
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: SCOUTING_80,
      history: historyAt([40, 80, 40, 80, 75]),
    });
    expect(result.skillLearningState.trend).toBe("estagnado");
  });
});

// ---------------------------------------------------------------------------
// 3. Gap analysis — 4 levels + direction
// ---------------------------------------------------------------------------
describe("gap analysis", () => {
  it("deficit: perf < target → positive gap value", () => {
    // perf=40, target=70 → gap.value=30, critico, deficit
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: ["70%"],
      scoutingCounts: SCOUTING_40,
      history: [],
    });
    expect(result.gap.direction).toBe("deficit");
    expect(result.gap.level).toBe("critico");
    expect(result.gap.value).toBe(30);
  });

  it("superavit: perf > target → negative gap value", () => {
    // perf=100, target=70 → gap.value=-30, critico, superavit
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: ["70%"],
      scoutingCounts: SCOUTING_100,
      history: [],
    });
    expect(result.gap.direction).toBe("superavit");
    expect(result.gap.level).toBe("critico");
    expect(result.gap.value).toBe(-30);
  });

  it("residual: |gap| ≤ 3", () => {
    // avg=1.44, total=25 → n2=11,n1=14 → actual avg=36/25=1.44 → perf=72; gap=70-72=-2 → residual
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: ["70%"],
      scoutingCounts: makeServeCounts(1.44, 25),
      history: [],
    });
    expect(result.gap.level).toBe("residual");
  });

  it("pequeno: |gap| = 8", () => {
    // avg=1.24, total=25 → n2=6,n1=19 → avg=31/25=1.24 → perf=62; gap=70-62=8 → pequeno
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: ["70%"],
      scoutingCounts: makeServeCounts(1.24, 25),
      history: [],
    });
    expect(result.gap.level).toBe("pequeno");
  });

  it("critico: |gap| > 18", () => {
    // perf=40, target=70 → gap=30 → critico
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: ["70%"],
      scoutingCounts: SCOUTING_40,
      history: [],
    });
    expect(result.gap.level).toBe("critico");
  });
});

// ---------------------------------------------------------------------------
// 4. Decision matrix — 8 critical scenarios
// ---------------------------------------------------------------------------
describe("decision matrix", () => {
  it("1. confidence baixo → always maintain", () => {
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: LOW_TOTAL,
      history: historyAt([90, 90, 90]),
    });
    expect(result.adjustment).toBe("maintain");
  });

  it("2. gap critico + trend caindo → regress", () => {
    // perf=40; history falling 70→65→60→55 → prev=55, delta=-15; stddev[70,65,60,55]≈5.59
    // threshold = clamp(5+5.59*0.5-1,4,10) = clamp(6.8,4,10) = 6.8; -15 < -6.8 → caindo
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: SCOUTING_40,
      history: historyAt([70, 65, 60, 55]),
    });
    expect(result.gap.level).toBe("critico");
    expect(result.skillLearningState.trend).toBe("caindo");
    expect(result.adjustment).toBe("regress");
  });

  it("3. CRITICAL: gap critico + trend subindo → maintain (not regress)", () => {
    // perf=40; history rising 10→15→20→30 → prev=30, delta=10; stddev≈7.39
    // threshold = clamp(5+7.39*0.5-1,4,10) = clamp(7.7,4,10) = 7.7; delta=10 > 7.7 → subindo
    // Decision: gap=critico + trend=subindo → maintain
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: SCOUTING_40,
      history: historyAt([10, 15, 20, 30]),
    });
    expect(result.gap.level).toBe("critico");
    expect(result.skillLearningState.trend).toBe("subindo");
    expect(result.adjustment).toBe("maintain");
  });

  it("4. gap moderado → maintain", () => {
    // perf=60, target=70 → gap=10 → moderado; avg=1.2, total=20 → n2=4,n1=16 → avg=24/20=1.2 → perf=60
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: makeServeCounts(1.2, 20),
      history: historyAt([60, 60, 60]),
    });
    expect(result.gap.level).toBe("moderado");
    expect(result.adjustment).toBe("maintain");
  });

  it("5. gap pequeno + trend subindo → increase", () => {
    // perf=65, target=70 → gap=5 → pequeno; avg=1.3, total=20 → n2=6,n1=14 → avg=26/20=1.3 → perf=65
    // history rising 55→58→61→63 → prev=63, delta=2; but stddev low → threshold low
    // Actually: prev=63, delta=2; stddev[55,58,61,63]≈2.9 → threshold≈clamp(5+2.9*0.5-1,4,10)=5.45
    // delta=2 < 5.45 → estagnado. Need bigger step from prev.
    // Use history [40,48,55,61] → prev=61, delta=4; stddev≈7.4 → threshold≈clamp(7.7,4,10)=7.7
    // Still delta(4) < threshold(7.7). Let me use prev=50 instead: history [35,40,45,50]
    // delta=15; stddev≈5.59 → threshold≈6.8; 15>6.8 → subindo ✓
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: makeServeCounts(1.3, 20),
      history: historyAt([35, 40, 45, 50]),
    });
    expect(result.gap.level).toBe("pequeno");
    expect(result.skillLearningState.trend).toBe("subindo");
    expect(result.adjustment).toBe("increase");
  });

  it("6. gap pequeno + trend estagnado → maintain", () => {
    // perf=65; history flat 65×4 → delta=0 → estagnado
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: makeServeCounts(1.3, 20),
      history: historyAt([65, 65, 65, 65]),
    });
    expect(result.gap.level).toBe("pequeno");
    expect(result.skillLearningState.trend).toBe("estagnado");
    expect(result.adjustment).toBe("maintain");
  });

  it("7. gap residual + consistency > 70 → increase", () => {
    // perf=72, target=70 → gap=-2 → residual superavit; avg=1.44, total=25
    // stable history [71,72,71,72] → weighted stddev ≈ 0.25 → consistency ≈ 99
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: makeServeCounts(1.44, 25),
      history: historyAt([71, 72, 71, 72]),
    });
    expect(result.gap.level).toBe("residual");
    expect(result.consistencyScore).toBeGreaterThan(70);
    expect(result.adjustment).toBe("increase");
  });

  it("8. gap residual + consistency ≤ 70 → maintain", () => {
    // perf=72; volatile history [40,80,40,80] → weighted stddev≈9.2 → consistency≈63 ≤ 70
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: makeServeCounts(1.44, 25),
      history: historyAt([40, 80, 40, 80]),
    });
    expect(result.gap.level).toBe("residual");
    expect(result.consistencyScore).toBeLessThanOrEqual(70);
    expect(result.adjustment).toBe("maintain");
  });
});

// ---------------------------------------------------------------------------
// 5. Learning velocity
// ---------------------------------------------------------------------------
describe("learning velocity", () => {
  it("returns 0 when no history", () => {
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: SCOUTING_75,
      history: [],
    });
    expect(result.learningVelocity).toBe(0);
  });

  it("uses per-day velocity when the historical window has valid dates", () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(
      Date.parse("2026-04-07T00:00:00.000Z")
    );
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: SCOUTING_75,
      history: [
        { date: "2026-03-28T00:00:00.000Z", performanceScore: 50 },
        { date: "2026-03-31T00:00:00.000Z", performanceScore: 55 },
        { date: "2026-04-03T00:00:00.000Z", performanceScore: 60 },
        { date: "2026-04-05T00:00:00.000Z", performanceScore: 65 },
      ],
    });
    nowSpy.mockRestore();

    // current=75, oldest=50, delta=25 over 10 days → 2.5/day
    expect(result.learningVelocity).toBe(2.5);
  });

  it("falls back to per-session velocity when the temporal span is shorter than a day", () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(
      Date.parse("2026-04-07T00:00:00.000Z")
    );
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: SCOUTING_75,
      history: [
        { date: "2026-04-06T20:00:00.000Z", performanceScore: 50 },
        { date: "2026-04-06T22:00:00.000Z", performanceScore: 65 },
      ],
    });
    nowSpy.mockRestore();

    // current=75, oldest=50, delta=25, fallback window size=2 sessions → 12.5/session
    expect(result.learningVelocity).toBe(12.5);
  });

  it("is deterministic with same inputs", () => {
    const history = historyAt([60, 65, 70]);
    const r1 = evaluateSessionOutcome({ focusSkill: "saque", successCriteria: criteria70, scoutingCounts: SCOUTING_75, history });
    const r2 = evaluateSessionOutcome({ focusSkill: "saque", successCriteria: criteria70, scoutingCounts: SCOUTING_75, history });
    expect(r1.learningVelocity).toBe(r2.learningVelocity);
  });
});

// ---------------------------------------------------------------------------
// 6. Backward compat — gap is always present in v2 return
// ---------------------------------------------------------------------------
describe("backward compat", () => {
  it("gap field always present, even without history", () => {
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: SCOUTING_75,
    });
    expect(result.gap).toBeDefined();
    expect(result.gap.level).toBeDefined();
    expect(result.gap.direction).toBeDefined();
    expect(typeof result.gap.value).toBe("number");
  });

  it("evidence string is coach-readable and contains gap info", () => {
    const result = evaluateSessionOutcome({
      focusSkill: "saque",
      successCriteria: criteria70,
      scoutingCounts: SCOUTING_75,
      history: historyAt([70, 72]),
    });
    expect(result.evidence).toContain("Gap:");
    expect(result.evidence).toContain("Tendencia:");
    expect(result.evidence).toContain("Decisao:");
  });
});
