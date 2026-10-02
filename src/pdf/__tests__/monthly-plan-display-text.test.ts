import { formatMonthlyLessonPlanText } from "../templates/monthly-plan";
import { monthlyPlanHtml, type MonthlyLessonPlanItem } from "../templates/monthly-plan";

const lesson: MonthlyLessonPlanItem = {
  id: "plan_main_precisao", weekLabel: "Semana 40", dateLabel: "02/10/2026",
  generalObjective: "Desenvolver precisao e estabilizacao tecnica, com adaptacao a pressao / main.",
  specificObjective: "Conceitual: consistencia\nAtitudinal: cooperacao\nProcedimental: transicao",
  blocks: [{ period: "Parte principal", activities: "Recepcao", time: "45 min", description: "Variacao com oposicao." }],
};

describe("monthly and lesson PDF presentation", () => {
  it("corrects legacy records without mutating their content or identifiers", () => {
    const snapshot = JSON.stringify(lesson);
    const result = formatMonthlyLessonPlanText(lesson);
    expect(result.id).toBe(lesson.id);
    expect(result.generalObjective).toContain("precisão e estabilização técnica, com adaptação à pressão / parte principal");
    expect(result.specificObjective.split("\n")).toHaveLength(3);
    expect(result.blocks[0].activities).toBe("Recepção");
    expect(JSON.stringify(lesson)).toBe(snapshot);
    expect(formatMonthlyLessonPlanText(result)).toEqual(result);
  });
  it("exports accented HTML while preserving names and escaping markup", () => {
    const html = monthlyPlanHtml({ className: "Clube Transicao", professorName: "Max", monthLabel: "Outubro", generatedAt: "", totalWeeks: 1, totalSessions: 1, lessons: [{ ...lesson, observations: "Precisao <script>alert(1)</script>" }] });
    expect(html).toContain('charset="utf-8"');
    expect(html).toContain("Clube Transicao");
    expect(html).toContain("estabilização técnica");
    expect(html).toContain("parte principal");
    expect(html).toContain("Precisão &lt;script&gt;");
    expect(html).not.toContain("/ main");
  });
});
