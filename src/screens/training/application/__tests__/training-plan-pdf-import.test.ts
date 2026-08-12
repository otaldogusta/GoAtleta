import type { TrainingPlan } from "../../../../core/models";
import {
  buildPlanningDraftFromPdfConfirmation,
  buildPlanningDraftsFromPdfAnalysis,
  buildPlanningDraftsFromPdfConfirmation,
  defaultSelectedPlanningPdfItemIds,
  type PlanningPdfAnalysis,
  type PlanningPdfConfirmedDraft,
} from "../training-plan-pdf-import";

const basePlan = (): TrainingPlan => ({
  id: "draft-current",
  classId: "class-1",
  title: "Plano atual",
  tags: ["manual"],
  warmup: [],
  main: [],
  cooldown: [],
  warmupTime: "",
  mainTime: "",
  cooldownTime: "",
  applyDate: "2026-08-11",
  applyDays: [],
  createdAt: "2026-08-11T10:00:00.000Z",
  origin: "manual",
  pedagogy: {
    learningObjectives: {
      general: "",
      specific: [""],
      pedagogicalGuidelines: [""],
    },
    blocks: {
      warmup: { summary: "", activities: [] },
      main: { summary: "", activities: [] },
      cooldown: { summary: "", activities: [] },
    },
  },
});

const confirmation = (): PlanningPdfConfirmedDraft => ({
  proposalId: "proposal-1",
  snapshotVersion: "a".repeat(64),
  plans: [{
    planId: "plan-1",
    order: 1,
    pageStart: 1,
    pageEnd: 2,
    approvedValues: {
      title: "Recepção e continuidade",
      "pedagogy.learningObjectives.general": "Manter a bola jogável.",
      "pedagogy.learningObjectives.specific": ["Orientar a plataforma", "Cooperar em dupla"],
      "pedagogy.learningObjectives.pedagogicalGuidelines": ["Como sustentar três trocas?"],
      "pedagogy.blocks.main": {
        summary: "Recepção em duplas",
        activities: [
          {
            name: "Alvo de recepção",
            description: "Receber para uma zona marcada.",
            materials: ["cones", "bolas"],
            adaptation: "Aproximar o alvo.",
          },
        ],
      },
      mainTime: "35",
    },
  }],
  provenance: {
    sourceDocumentId: "source-1",
    sourceRevisionId: "revision-1",
    contentHash: "b".repeat(64),
    filename: "plano-recepcao.pdf",
    confidence: 0.91,
  },
});

describe("training plan PDF import", () => {
  it("creates an editable draft only with the explicitly approved values", () => {
    const draft = buildPlanningDraftFromPdfConfirmation({
      basePlan: basePlan(),
      confirmation: confirmation(),
      nowIso: "2026-08-11T12:00:00.000Z",
    });

    expect(draft).toMatchObject({
      classId: "class-1",
      title: "Recepção e continuidade",
      applyDate: "2026-08-11",
      main: ["Alvo de recepção"],
      mainTime: "35",
      origin: "imported",
      inputHash: "b".repeat(64),
      pedagogy: {
        learningObjectives: {
          general: "Manter a bola jogável.",
          specific: ["Orientar a plataforma", "Cooperar em dupla"],
          pedagogicalGuidelines: ["Como sustentar três trocas?"],
        },
        blocks: {
          main: {
            summary: "Recepção em duplas",
            activities: [
              {
                name: "Alvo de recepção",
                description: "Receber para uma zona marcada.",
                materials: ["cones", "bolas"],
                adaptation: "Aproximar o alvo.",
              },
            ],
          },
        },
      },
    });
    expect(draft.pedagogy?.appliedReferences?.[0]).toMatchObject({
      sourceDocumentId: "source-1",
      sourceRevisionId: "revision-1",
      sourceScope: "class_planning",
      documentType: "lesson_plan",
      sourceLocation: "PDF: páginas 1-2",
    });
    expect(draft.warmup).toEqual([]);
  });

  it("does not import unapproved fields from the model result", () => {
    const approved = confirmation();
    approved.plans[0].approvedValues = { title: "Somente o título" };

    const draft = buildPlanningDraftFromPdfConfirmation({
      basePlan: basePlan(),
      confirmation: approved,
    });

    expect(draft.title).toBe("Somente o título");
    expect(draft.main).toEqual([]);
    expect(draft.pedagogy?.learningObjectives?.general).toBe("");
  });

  it("preselects only high-confidence apply recommendations", () => {
    const analysis = {
      plans: [{ items: [
          { id: "high", recommendation: "apply", confidence: 0.9, proposedValue: "A" },
          { id: "review", recommendation: "review", confidence: 0.8, proposedValue: "B" },
          { id: "low", recommendation: "apply", confidence: 0.6, proposedValue: "C" },
          { id: "empty", recommendation: "apply", confidence: 0.95, proposedValue: "" },
        ] }],
    } as PlanningPdfAnalysis;

    expect(defaultSelectedPlanningPdfItemIds(analysis)).toEqual(["high"]);
  });

  it("creates one independent draft for each confirmed plan", () => {
    const batch = confirmation();
    batch.plans.push({
      planId: "plan-2",
      order: 2,
      pageStart: 3,
      pageEnd: 3,
      approvedValues: {
        title: "Saque direcionado",
        applyDate: "2026-08-13",
        "pedagogy.blocks.main": {
          summary: "Saque para zonas",
          activities: [{ name: "Alvos numerados", description: "", materials: [], adaptation: "" }],
        },
      },
    });

    const drafts = buildPlanningDraftsFromPdfConfirmation({
      basePlan: basePlan(),
      confirmation: batch,
      nowIso: "2026-08-11T12:00:00.000Z",
    });

    expect(drafts).toHaveLength(2);
    expect(drafts.map((draft) => draft.title)).toEqual([
      "Recepção e continuidade",
      "Saque direcionado",
    ]);
    expect(drafts[1]).toMatchObject({ applyDate: "2026-08-13", main: ["Alvos numerados"] });
    expect(drafts[0].id).not.toBe(drafts[1].id);
  });

  it("opens analyzed PDF pages as editable drafts without binding a class", () => {
    const analyzed = {
      proposalId: "",
      snapshotVersion: "c".repeat(64),
      filename: "planejamento-agosto.pdf",
      documentType: "monthly_plan",
      extractionMode: "pdf_text_and_pages",
      extractionConfidence: 0.88,
      classBinding: {
        classId: "",
        selectedClassName: "",
        extractedClassName: "Primeiros Saques",
        status: "unresolved",
      },
      provenance: confirmation().provenance,
      warnings: [],
      plans: [{
        id: "plan-1",
        order: 1,
        pageStart: 1,
        pageEnd: 1,
        title: "Passe e recepção",
        lessonDate: "2026-08-15",
        extractedClassName: "Primeiros Saques",
        extractionConfidence: 0.88,
        warnings: [],
        items: [{
          id: "item-1",
          targetField: "title",
          label: "Título",
          category: "complement",
          recommendation: "apply",
          currentValue: "",
          proposedValue: "Passe e recepção",
          reason: "Conteúdo reconhecido",
          confidence: 0.88,
          evidence: [],
          warnings: [],
        }],
      }],
    } satisfies PlanningPdfAnalysis;

    const [draft] = buildPlanningDraftsFromPdfAnalysis({ analysis: analyzed });

    expect(draft).toMatchObject({
      classId: "",
      title: "Passe e recepção",
      applyDate: "2026-08-15",
      origin: "imported",
    });
  });
});
