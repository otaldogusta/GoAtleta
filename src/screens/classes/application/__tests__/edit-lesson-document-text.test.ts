import type { ClassGroup, TrainingPlan } from "../../../../core/models";
import { buildClassPlanPdfData } from "../build-class-plan-pdf-data";
import { editLessonDocumentText } from "../edit-lesson-document-text";
import { sessionPlanHtml, buildSessionMonthlyPlanData } from "../../../../pdf/templates/session-plan";

const plan = { id: "plan", classId: "class", title: "Aula", warmup: [], main: [], cooldown: [], warmupTime: "10", mainTime: "40", cooldownTime: "10", tags: [] } as TrainingPlan;
const classGroup = { id: "class", name: "Raposas", ageBand: "10-12", startTime: "14:00", durationMinutes: 60 } as ClassGroup;

it("preserves document edits, including empty values, without changing the class or scheduled plan", () => {
  let edited = editLessonDocumentText(plan, "professor", "Professor revisado");
  edited = editLessonDocumentText(edited, "date", "Data especial");
  edited = editLessonDocumentText(edited, "class", "");
  edited = editLessonDocumentText(edited, "labelProfessor", "Responsável:");
  const data = buildClassPlanPdfData({ plan: JSON.parse(JSON.stringify(edited)), classGroup, lessonDate: "2026-09-30" });
  const html = sessionPlanHtml(data, { editable: true });
  expect(html).toContain("Professor revisado");
  expect(html).toContain("Responsável:");
  expect(html).toContain("Data especial");
  expect(data.className).toBe("Raposas");
  expect(edited.classId).toBe(plan.classId);
  expect(edited.applyDate).toBe(plan.applyDate);
  expect(plan.pedagogy?.lessonDocumentText).toBeUndefined();
  expect(buildSessionMonthlyPlanData(data).lessons[0].documentText?.class).toBe("");
});

it("makes every table cell editable and escapes edited document text", () => {
  const edited = editLessonDocumentText(plan, "documentTitle", '<script>alert("x")</script>');
  const data = buildClassPlanPdfData({ plan: edited, classGroup, lessonDate: "2026-09-30", periodizationSource: { weekLabel: "40", phaseLabel: "Base", focusLabel: "Bola", loadLabel: "3", roleLabel: "Jogo", classLevelLabel: "Iniciação" } });
  const html = sessionPlanHtml(data, { editable: true });
  const cells = html.match(/<(?:th|td)\b[^>]*>/g) ?? [];
  expect(cells.length).toBeGreaterThan(20);
  expect(cells.every(cell => cell.includes('contenteditable="true"'))).toBe(true);
  expect(html).not.toContain('<script>alert("x")</script>');
  expect(editLessonDocumentText(plan, "__proto__", "x")).toBe(plan);
  expect(editLessonDocumentText(plan, "date", "x".repeat(12000)).pedagogy?.lessonDocumentText?.date).toHaveLength(10000);
});
