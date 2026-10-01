import React from "react";
import { MonthlyLessonPlanDocument } from "../monthly-lesson-plan-document.web";
import type { MonthlyPlanPdfData } from "../templates/monthly-plan";

jest.mock("@react-pdf/renderer", () => ({
  Document: "Document", Page: "Page", Text: "Text", View: "View",
  Font: { register: jest.fn() }, StyleSheet: { create: (styles: unknown) => styles },
}));

function visibleText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(visibleText).join("|");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    if (typeof node.type === "function") return visibleText((node.type as (props: unknown) => React.ReactNode)(node.props));
    return visibleText(node.props.children);
  }
  return "";
}

it("uses the edited document fields and labels in the downloadable PDF renderer", () => {
  const data: MonthlyPlanPdfData = {
    className: "Original", professorName: "Original", monthLabel: "Setembro", generatedAt: "", totalWeeks: 1, totalSessions: 1,
    lessons: [{ id: "one", weekLabel: "Original", dateLabel: "Original", generalObjective: "Objetivo", specificObjective: "Objetivo", blocks: [{ period: "Aquecimento", activities: "Atividade", time: "10", description: "Descrição" }],
      documentText: { professor: "Docente editado", class: "Turma editada", date: "Data editada", time: "Hora editada", week: "Semana editada", documentTitle: "Título editado", labelProfessor: "Responsável", columnActivities: "Práticas", periodWarmup: "Entrada", periodization: "Ciclo editado", context: "Contexto editado" },
      periodizationSource: { weekLabel: "40", phaseLabel: "Base", focusLabel: "Bola", loadLabel: "3", roleLabel: "Jogo", classLevelLabel: "Iniciação" },
    }],
  };
  const text = visibleText(MonthlyLessonPlanDocument({ data }));
  for (const value of Object.values(data.lessons[0].documentText!)) expect(text).toContain(value);
  expect(text).not.toContain("Original");
  expect(text).not.toContain("Responsável:");
});
