import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { AppliedPlanReferencesSection } from "../AppliedPlanReferencesSection";
import {
  buildAppliedPlanReferencesPresentation,
  type AppliedPlanReferenceInput,
} from "../applied-plan-references-presentation";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const collectText = (node: unknown): string[] => {
  if (node == null) return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === "object") {
    const candidate = node as {
      children?: unknown;
      props?: { children?: unknown };
    };
    return collectText(candidate.children ?? candidate.props?.children);
  }
  return [];
};

const renderedText = (renderer: TestRenderer.ReactTestRenderer) =>
  collectText(renderer.toJSON()).join(" ").replace(/\s+/g, " ");

const references: AppliedPlanReferenceInput[] = [
  {
    id: "reference-1",
    sourceDocumentId: "document-1",
    sourceScope: "user_academic",
    title: "Tendências Pedagógicas e Didática",
    origin: "Faculdade",
    discipline: "Didática",
    materialType: "university_handout",
    evidenceLevel: "institutional_academic_material",
    sourceLocation: "Unidade 3",
    excerpt: "A resolução de problemas favorece escolhas do estudante.",
    influence: "A atividade principal passou a oferecer duas possibilidades de decisão.",
  },
  {
    id: "reference-2",
    sourceDocumentId: "document-2",
    sourceScope: "realized_history",
    title: "Relatório da aula anterior",
    origin: "Turma Primeiros Saques",
    materialType: "personal_note",
    evidenceLevel: "personal_note",
    excerpt: "A turma ainda perde continuidade após o primeiro passe.",
    influence: "O plano manteve a progressão anterior antes de avançar.",
  },
];

describe("buildAppliedPlanReferencesPresentation", () => {
  it("normalizes canonical metadata and legacy field aliases without exposing source links", () => {
    const input = [
      {
        sourceDocumentId: "doc-1",
        documentTitle: "Prática de Ensino",
        sourceScope: "user_academic",
        origin: "Universidade",
        discipline: "Educação Infantil",
        sourceKind: "university_handout",
        evidenceLevel: "institutional_academic_material",
        sourceText: "O brincar organiza a experiência infantil.",
        influence: "Aquecimento estruturado como atividade lúdica.",
        sourceUrl: "https://drive.example/documento",
      },
    ];

    const presentation = buildAppliedPlanReferencesPresentation(input);

    expect(presentation.countLabel).toBe("1 referência considerada");
    expect(presentation.items[0]).toEqual({
      id: "doc-1",
      title: "Prática de Ensino",
      originLabel: "Universidade · Educação Infantil",
      scopeLabel: "Base acadêmica pessoal",
      materialTypeLabel: "Material institucional da universidade",
      evidenceLevelLabel: "Material acadêmico institucional",
      documentType: "",
      sourceDateLabel: "",
      confidenceLabel: "",
      periodLabel: "",
      isPrimaryPlanningSource: false,
      sourceLocation: "",
      excerpt: "O brincar organiza a experiência infantil.",
      influence: "Aquecimento estruturado como atividade lúdica.",
    });
    expect(JSON.stringify(presentation)).not.toContain("drive.example");
    expect(JSON.stringify(presentation)).not.toContain("sourceUrl");
  });

  it("highlights the confirmed monthly plan as the planning source", () => {
    const presentation = buildAppliedPlanReferencesPresentation([
      {
        id: "report-1",
        sourceDocumentId: "report-document-1",
        sourceScope: "realized_history",
        title: "Relatório de 14 de julho",
        origin: "Primeiros Saques",
        materialType: "realized_report",
        evidenceLevel: "realized_report",
        documentType: "realized_report",
        sourceDate: "2026-07-14",
      },
      {
        id: "monthly-1",
        sourceDocumentId: "monthly-document-1",
        sourceScope: "class_planning",
        title: "Planejamento de Julho",
        origin: "Rede Esperança",
        materialType: "monthly_plan",
        evidenceLevel: "confirmed_plan",
        documentType: "monthly_plan",
        sourceDate: "2026-07-01",
        confidence: 0.94,
        period: "2026-07",
        isPrimaryPlanningSource: true,
      },
      {
        id: "institutional-1",
        sourceDocumentId: "institutional-document-1",
        sourceScope: "institutional",
        title: "Ações institucionais",
        origin: "Rede Esperança",
        materialType: "institutional_actions",
        evidenceLevel: "institutional_guidance",
        documentType: "institutional_actions",
      },
    ]);

    expect(presentation.planningSource).toMatchObject({
      id: "monthly-1",
      title: "Planejamento de Julho",
      scopeLabel: "Planejamento da turma",
      materialTypeLabel: "Planejamento mensal",
      evidenceLevelLabel: "Planejamento confirmado",
      documentType: "monthly_plan",
      sourceDateLabel: "01/07/2026",
      confidenceLabel: "Confiança alta",
      periodLabel: "Julho de 2026",
      isPrimaryPlanningSource: true,
    });
  });

  it.each([
    ["user_academic", "Base acadêmica pessoal"],
    ["workspace_academic", "Base acadêmica da organização"],
    ["institutional", "Base institucional"],
    ["class_planning", "Planejamento da turma"],
    ["realized_history", "Histórico realizado"],
    ["scientific", "Fonte científica"],
    ["system_general", "Base geral do sistema"],
  ])("recognizes the canonical source scope %s", (sourceScope, expectedLabel) => {
    const presentation = buildAppliedPlanReferencesPresentation([
      { sourceDocumentId: "doc", sourceScope },
    ]);

    expect(presentation.items[0].scopeLabel).toBe(expectedLabel);
  });

  it.each([
    ["official_norm", "Norma oficial"],
    ["scientific_article", "Artigo científico"],
    ["book_or_chapter", "Livro ou capítulo"],
    ["university_handout", "Material institucional da universidade"],
    ["lecture_presentation", "Apresentação de aula"],
    ["student_summary", "Resumo produzido pelo estudante"],
    ["personal_note", "Anotação pessoal"],
    ["unknown", "Material acadêmico de apoio"],
  ])("recognizes the canonical material type %s", (materialType, expectedLabel) => {
    const presentation = buildAppliedPlanReferencesPresentation([
      { sourceDocumentId: "doc", materialType },
    ]);

    expect(presentation.items[0].materialTypeLabel).toBe(expectedLabel);
  });

  it.each([
    ["official_norm", "Norma oficial"],
    ["scientific_research", "Pesquisa científica"],
    ["published_book", "Livro publicado"],
    ["institutional_academic_material", "Material acadêmico institucional"],
    ["classroom_academic_material", "Material acadêmico de aula"],
    ["student_authored_summary", "Resumo autoral do estudante"],
    ["personal_note", "Anotação pessoal"],
    ["unknown_support", "Apoio sem classificação"],
  ])("recognizes the canonical evidence level %s", (evidenceLevel, expectedLabel) => {
    const presentation = buildAppliedPlanReferencesPresentation([
      { sourceDocumentId: "doc", evidenceLevel },
    ]);

    expect(presentation.items[0].evidenceLevelLabel).toBe(expectedLabel);
  });
});

describe("AppliedPlanReferencesSection", () => {
  it("shows the planning source without requiring the references accordion", async () => {
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(AppliedPlanReferencesSection, {
          references: [
            ...references,
            {
              id: "monthly-1",
              sourceDocumentId: "monthly-document-1",
              sourceScope: "class_planning",
              title: "Planejamento de Julho",
              origin: "Rede Esperança",
              materialType: "monthly_plan",
              evidenceLevel: "confirmed_plan",
              documentType: "monthly_plan",
              period: "2026-07",
              isPrimaryPlanningSource: true,
            },
          ],
        })
      );
    });

    const text = renderedText(renderer!);
    expect(text).toContain("Fonte do planejamento");
    expect(text).toContain("Planejamento de Julho");
    expect(text).toContain("Julho de 2026 · Rede Esperança");
    expect(text).not.toContain("A resolução de problemas");
  });

  it("starts collapsed and reveals reference details only on demand", async () => {
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(AppliedPlanReferencesSection, { references })
      );
    });

    expect(renderedText(renderer!)).toContain("Referências aplicadas");
    expect(renderedText(renderer!)).toContain("2 referências consideradas");
    expect(renderedText(renderer!)).not.toContain("A resolução de problemas");

    await act(async () => {
      renderer!.root
        .findByProps({ accessibilityLabel: "Expandir referências aplicadas" })
        .props.onPress();
    });

    expect(renderedText(renderer!)).toContain("Tendências Pedagógicas e Didática");
    expect(renderedText(renderer!)).not.toContain("A resolução de problemas");

    await act(async () => {
      renderer!.root
        .findByProps({
          accessibilityLabel:
            "Expandir referência Tendências Pedagógicas e Didática",
        })
        .props.onPress();
    });

    expect(renderedText(renderer!)).toContain("Trecho utilizado");
    expect(renderedText(renderer!)).toContain("A resolução de problemas");
    expect(renderedText(renderer!)).toContain("duas possibilidades de decisão");
  });

  it("keeps only one reference expanded at a time", async () => {
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(AppliedPlanReferencesSection, { references })
      );
    });

    await act(async () => {
      renderer!.root
        .findByProps({ accessibilityLabel: "Expandir referências aplicadas" })
        .props.onPress();
    });

    await act(async () => {
      renderer!.root
        .findByProps({
          accessibilityLabel:
            "Expandir referência Tendências Pedagógicas e Didática",
        })
        .props.onPress();
    });

    expect(renderedText(renderer!)).toContain("A resolução de problemas");

    await act(async () => {
      renderer!.root
        .findByProps({
          accessibilityLabel: "Expandir referência Relatório da aula anterior",
        })
        .props.onPress();
    });

    const text = renderedText(renderer!);
    expect(text).toContain("A turma ainda perde continuidade");
    expect(text).not.toContain("A resolução de problemas");
  });

  it("renders nothing when no applied references are available", async () => {
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(AppliedPlanReferencesSection, { references: [] })
      );
    });

    expect(renderer!.toJSON()).toBeNull();
  });
});
