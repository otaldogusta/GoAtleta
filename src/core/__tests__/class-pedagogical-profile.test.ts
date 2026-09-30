import { emptyProfile, profilePlanningGuidance, reconcileProfileInterpretation, validateEvolution, type ProfileFact, type ProfileRecord } from "../class-pedagogical-profile";
import { applyProfileToWeeklyPlan, profileDiagnosticValues, resolveClassProfile } from "../profile-planning";
import { buildAutoPlanForCycleDay } from "../../screens/session/application/build-auto-plan-for-cycle-day";
import { generateMonthlyBlueprint } from "../../screens/planning/application/generate-monthly-blueprint";
import { buildAutoDailyLessonPlan } from "../../screens/planning/application/regenerate-daily-lesson-plan";
import type { ClassGroup, ClassPlan } from "../models";

const fact = (value: string): ProfileFact => ({ value, quote: value, sourceId: "message", authorId: "coach", updatedAt: "2026-09-29", origin: "teacher" });
const record: ProfileRecord = { organization_id: "org", class_id: "raposas", version: 7, updated_at: "2026-09-29", profile: { schemaVersion: 1, facts: {
  gameFormat: { ...fact("6x6"), origin: "selector" }, bounce: fact("a bola pode pingar uma vez"), fundamentals: fact("domina bem os fundamentos"), priorities: fact("cobertura após a defesa"),
} } };
const cls: ClassGroup = { id: "raposas", organizationId: "org", name: "Raposas", modality: "voleibol", ageBand: "10-12", gender: "misto", unit: "Centro", unitId: "u", colorKey: "blue", startTime: "14:00", endTime: "15:00", durationMinutes: 60, daysOfWeek: [1,3], daysPerWeek: 2, goal: "fundamentos", equipment: "quadra", level: 1, mvLevel: "iniciante", cycleStartDate: "2026-09-01", cycleLengthWeeks: 52, acwrLow: .8, acwrHigh: 1.3, createdAt: "2026-01-01", pedagogicalProfile: record };
const week: ClassPlan = { id: "week", classId: "raposas", startDate: "2026-10-05", weekNumber: 1, phase: "desenvolvimento", theme: "Mini 2x2", technicalFocus: "Passe", physicalFocus: "Coordenação", constraints: "", mvFormat: "2x2", warmupProfile: "dinâmico", jumpTarget: "baixo", rpeTarget: "PSE 4", source: "AUTO", createdAt: "2026-09-29", updatedAt: "2026-09-29" };

describe("canonical class profile", () => {
  it("restores cycle selector values when undo removes the first canonical selection", () => {
    const baseline = {gameLevel: "3x3" as const, netHeightMeters: 2.2};
    expect(profileDiagnosticValues(record.profile, baseline).gameLevel).toBe("6x6");
    expect(profileDiagnosticValues(emptyProfile(), baseline)).toMatchObject(baseline);
  });
  it("keeps the teacher's general claim without inventing individual skills", () => {
    const result = reconcileProfileInterpretation({ kind: "report", changes: [{ key: "fundamentals", value: "domina bem os fundamentos", quote: "domina bem os fundamentos" }], reply: "Entendido.", question: "" }, "A turma domina bem os fundamentos", emptyProfile());
    expect(result.changes).toHaveLength(1);
    expect(() => reconcileProfileInterpretation({ ...result, changes: [{ key: "fundamentals", value: "domina saque e bloqueio", quote: "domina bem os fundamentos" }] }, "domina bem os fundamentos", emptyProfile())).toThrow("UNGROUNDED");
  });
  it.each(["question", "hypothesis"])("does not store %s or assistant suggestions as facts", kind => {
    expect(reconcileProfileInterpretation({ kind, changes: [{ key: "bounce", value: "um quique", quote: "um quique" }], reply: "Podemos avaliar.", question: "" }, "E se jogar com um quique?", emptyProfile()).changes).toEqual([]);
  });
  it("does not silently change selectors; corrections and removals remain grounded", () => {
    const result = reconcileProfileInterpretation({ kind: "report", changes: [{ key: "gameFormat", value: "4x4", quote: "4x4" }, { key: "bounce", value: null, quote: "remova o quique" }], reply: "Entendido", question: "" }, "Agora 4x4, remova o quique", record.profile);
    expect(result.changes).toEqual([{ key: "bounce", value: null, quote: "remova o quique" }]);
    expect(result.question).toContain("seletor");
  });
  it("requires two distinct executed dates per proposed change, rejects contradictions", () => {
    const reports = [{ id: "1", date: "2026-09-21", text: "mantém o rally" }, { id: "2", date: "2026-09-23", text: "mantém o rally" }];
    const candidate = { changes: [{ key: "continuity" as const, value: "mantém o rally", quote: "mantém o rally", evidence: reports.map(r => ({ id: r.id, quote: r.text })) }], evidenceIds: ["1", "2"], contradictory: false, summary: "Continuidade observada." };
    expect(validateEvolution(candidate, reports)).toBe(true);
    expect(validateEvolution(candidate, [reports[0], { ...reports[1], date: reports[0].date }])).toBe(false);
    expect(validateEvolution({ ...candidate, contradictory: true }, reports)).toBe(false);
    expect(validateEvolution({ ...candidate, changes: [{ ...candidate.changes[0], evidence: candidate.changes[0].evidence.slice(0,1) }] }, reports)).toBe(false);
  });
  it("isolates classes and organizations", () => {
    expect(resolveClassProfile({ ...cls, organizationId: "other" })).toBeUndefined();
    expect(resolveClassProfile({ ...cls, id: "other" })).toBeUndefined();
  });
  it("a delayed report cannot replace a more recent correction", () => {
    const result = reconcileProfileInterpretation({kind:"report",changes:[{key:"bounce",value:"dois quiques",quote:"dois quiques"}],reply:"Entendido",question:""}, "Agora dois quiques", record.profile, "2026-09-28");
    expect(result.changes).toEqual([]); expect(result.question).toContain("após o envio");
  });
  it("uses 6x6 with bounce as baseline, not as proof of mastery or higher load", () => {
    expect(profilePlanningGuidance(record.profile).format).toBe("6x6");
    const generated = applyProfileToWeeklyPlan(week, cls);
    expect(generated.mvFormat).toBe("6x6"); expect(generated.pedagogicalRule).toContain("pingar uma vez");
    expect(generated.theme).toContain("cobertura"); expect(generated.rpeTarget).toBe(week.rpeTarget);
    expect(applyProfileToWeeklyPlan({ ...week, source: "MANUAL" }, cls).mvFormat).toBe("2x2");
    expect(applyProfileToWeeklyPlan({ ...week, manualOverrideMaskJson: '["theme"]' }, cls).theme).toBe("Mini 2x2");
  });
  it("propagates the actual profile into monthly, daily and session activities", () => {
    const blueprint = generateMonthlyBlueprint({ classGroup: cls, monthKey: "2026-10" });
    expect(blueprint.pedagogicalProgression).toContain("6x6");
    expect(blueprint.constraintsJson).toContain("pingar uma vez");
    const weekly = applyProfileToWeeklyPlan(week, cls);
    const session = { sessionIndex: 1, weekday: 1, weekdayLabel: "Seg", date: "2026-10-05", dateLabel: "05/10/2026", shortLabel: "Seg 05/10" };
    const daily = buildAutoDailyLessonPlan(weekly, session, "2026-09-29", null, { classGroup: cls, ageBand: cls.ageBand, durationMinutes: 60 });
    expect(daily.mainPart).toContain("6x6"); expect(daily.mainPart).toContain("pingar uma vez");
    const plan = buildAutoPlanForCycleDay({ classGroup: cls, classPlan: weekly, dailyLessonPlan: daily, students: [], sessionDate: session.date, sessionIndexInWeek: 1, recentPlans: [] });
    const games = plan.package.final.main.activities.filter(activity => activity.stage === "game");
    expect(games.length).toBeGreaterThan(0);
    expect(games.every(activity => activity.name.includes("6x6"))).toBe(true);
    expect(JSON.stringify(games)).toContain("pingar uma vez");
    expect(plan.decisionTrace.influences.pedagogicalProfile?.version).toBe(7);
    expect(plan.fingerprint).toContain("profile-7");
  });
});
