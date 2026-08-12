import type {
  TrainingPlan,
  TrainingPlanPedagogy,
  TrainingPlanSessionBlock,
} from "../../../core/models";
import type {
  PlanningPdfAnalysis,
  PlanningPdfConfirmedBatch,
  PlanningPdfConfirmedPlan,
} from "../../../core/training-plan-pdf-import";
import { createPlanningWorkspaceDraft } from "./planning-library-bridge";

export type {
  PlanningPdfAnalysis,
  PlanningPdfConfirmedBatch,
  PlanningPdfConfirmedDraft,
  PlanningPdfConfirmedPlan,
  PlanningPdfDetectedPlan,
  PlanningPdfEvidence,
  PlanningPdfReviewItem,
} from "../../../core/training-plan-pdf-import";

const stringValue = (value: unknown) => String(value ?? "").trim();

const stringList = (value: unknown) =>
  Array.isArray(value)
    ? value.map((item) => stringValue(item)).filter(Boolean)
    : [];

const normalizedBlock = (value: unknown): TrainingPlanSessionBlock | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const activities = Array.isArray(record.activities)
    ? record.activities
        .map((activity) => {
          if (!activity || typeof activity !== "object" || Array.isArray(activity)) return null;
          const item = activity as Record<string, unknown>;
          const name = stringValue(item.name);
          if (!name) return null;
          return {
            name,
            description: stringValue(item.description),
            ...(stringList(item.materials).length ? { materials: stringList(item.materials) } : {}),
            ...(stringValue(item.adaptation) ? { adaptation: stringValue(item.adaptation) } : {}),
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];
  return {
    summary: stringValue(record.summary),
    activities,
  };
};

const applyBlock = (
  pedagogy: TrainingPlanPedagogy,
  blockKey: "warmup" | "main" | "cooldown",
  value: unknown
) => {
  const block = normalizedBlock(value);
  if (!block) return pedagogy;
  return {
    ...pedagogy,
    blocks: {
      warmup: pedagogy.blocks?.warmup ?? { summary: "", activities: [] },
      main: pedagogy.blocks?.main ?? { summary: "", activities: [] },
      cooldown: pedagogy.blocks?.cooldown ?? { summary: "", activities: [] },
      [blockKey]: block,
    },
  };
};

export const buildPlanningDraftFromPdfConfirmation = ({
  basePlan,
  confirmation,
  confirmedPlan = confirmation.plans[0],
  nowIso = new Date().toISOString(),
}: {
  basePlan: TrainingPlan;
  confirmation: PlanningPdfConfirmedBatch;
  confirmedPlan?: PlanningPdfConfirmedPlan;
  nowIso?: string;
}): TrainingPlan => {
  if (!confirmedPlan) throw new Error("Nenhum plano foi confirmado para importação.");
  const values = confirmedPlan.approvedValues;
  let pedagogy: TrainingPlanPedagogy = {
    ...(basePlan.pedagogy ?? {}),
    learningObjectives: {
      general: basePlan.pedagogy?.learningObjectives?.general ?? "",
      specific: basePlan.pedagogy?.learningObjectives?.specific ?? [""],
      ...(basePlan.pedagogy?.learningObjectives ?? {}),
    },
  };

  if ("pedagogy.sessionObjective" in values) {
    pedagogy.sessionObjective = stringValue(values["pedagogy.sessionObjective"]);
    pedagogy.sessionObjectiveSource = "manual";
  }
  if ("pedagogy.learningObjectives.general" in values) {
    pedagogy.learningObjectives = {
      ...pedagogy.learningObjectives!,
      general: stringValue(values["pedagogy.learningObjectives.general"]),
    };
  }
  if ("pedagogy.learningObjectives.specific" in values) {
    pedagogy.learningObjectives = {
      ...pedagogy.learningObjectives!,
      specific: stringList(values["pedagogy.learningObjectives.specific"]),
    };
  }
  if ("pedagogy.learningObjectives.pedagogicalGuidelines" in values) {
    pedagogy.learningObjectives = {
      ...pedagogy.learningObjectives!,
      pedagogicalGuidelines: stringList(
        values["pedagogy.learningObjectives.pedagogicalGuidelines"]
      ),
    };
  }
  if ("pedagogy.lessonPlanObservations" in values) {
    pedagogy.lessonPlanObservations = stringValue(
      values["pedagogy.lessonPlanObservations"]
    );
  }

  (["warmup", "main", "cooldown"] as const).forEach((blockKey) => {
    const targetField = `pedagogy.blocks.${blockKey}`;
    if (targetField in values) {
      pedagogy = applyBlock(pedagogy, blockKey, values[targetField]);
    }
  });

  const importedReference = {
    id: `planning_pdf_${confirmation.provenance.sourceRevisionId}_${confirmedPlan.planId}`,
    sourceDocumentId: confirmation.provenance.sourceDocumentId,
    sourceRevisionId: confirmation.provenance.sourceRevisionId,
    contentHash: confirmation.provenance.contentHash,
    sourceScope: "class_planning" as const,
    title: confirmation.provenance.filename,
    origin: "upload",
    materialType: "lesson_plan" as const,
    evidenceLevel: "contextual_support" as const,
    documentType: "lesson_plan" as const,
    confidence: confirmation.provenance.confidence,
    isPrimaryPlanningSource: true,
    sourceKind: "pdf_upload",
    sourceLocation:
      confirmedPlan.pageStart === confirmedPlan.pageEnd
        ? `PDF: página ${confirmedPlan.pageStart}`
        : `PDF: páginas ${confirmedPlan.pageStart}-${confirmedPlan.pageEnd}`,
    excerpt: "Conteúdo estruturado a partir do PDF enviado pelo professor.",
    influence: "O documento foi aberto como rascunho editável e ainda não está vinculado a uma turma.",
    appliedAt: nowIso,
  };
  pedagogy.appliedReferences = [
    importedReference,
    ...(pedagogy.appliedReferences ?? []).filter(
      (reference) => reference.id !== importedReference.id
    ),
  ];
  pedagogy.preserveEmptyFields = true;

  const warmupBlock = pedagogy.blocks?.warmup;
  const mainBlock = pedagogy.blocks?.main;
  const cooldownBlock = pedagogy.blocks?.cooldown;

  return {
    ...basePlan,
    id: `draft_pdf_${Date.now()}_${confirmedPlan.order}`,
    title: "title" in values ? stringValue(values.title) : basePlan.title,
    applyDate: "applyDate" in values ? stringValue(values.applyDate) : basePlan.applyDate,
    warmupTime:
      "warmupTime" in values ? stringValue(values.warmupTime) : basePlan.warmupTime,
    mainTime: "mainTime" in values ? stringValue(values.mainTime) : basePlan.mainTime,
    cooldownTime:
      "cooldownTime" in values ? stringValue(values.cooldownTime) : basePlan.cooldownTime,
    warmup: warmupBlock?.activities.map((activity) => activity.name) ?? basePlan.warmup,
    main: mainBlock?.activities.map((activity) => activity.name) ?? basePlan.main,
    cooldown: cooldownBlock?.activities.map((activity) => activity.name) ?? basePlan.cooldown,
    tags: Array.from(new Set([...(basePlan.tags ?? []), "importado", "pdf"])),
    origin: "imported",
    inputHash: confirmation.provenance.contentHash,
    createdAt: nowIso,
    version: 0,
    status: "final",
    pedagogy,
  };
};

export const buildPlanningDraftsFromPdfConfirmation = ({
  basePlan,
  confirmation,
  nowIso = new Date().toISOString(),
}: {
  basePlan: TrainingPlan;
  confirmation: PlanningPdfConfirmedBatch;
  nowIso?: string;
}) => {
  const emptyBasePlan: TrainingPlan = {
    ...basePlan,
    title: "Plano importado",
    tags: [],
    warmup: [],
    main: [],
    cooldown: [],
    warmupTime: "",
    mainTime: "",
    cooldownTime: "",
    applyDate: "",
    applyDays: [],
    pedagogy: {
      learningObjectives: { general: "", specific: [], pedagogicalGuidelines: [] },
      blocks: {
        warmup: { summary: "", activities: [] },
        main: { summary: "", activities: [] },
        cooldown: { summary: "", activities: [] },
      },
      preserveEmptyFields: true,
    },
  };
  return confirmation.plans.map((confirmedPlan) =>
    buildPlanningDraftFromPdfConfirmation({
      basePlan: emptyBasePlan,
      confirmation,
      confirmedPlan,
      nowIso,
    })
  );
};

export const buildPlanningDraftsFromPdfAnalysis = ({
  analysis,
  nowIso = new Date().toISOString(),
}: {
  analysis: PlanningPdfAnalysis;
  nowIso?: string;
}) => {
  const provenance = analysis.provenance ?? {
    sourceDocumentId: "",
    sourceRevisionId: "",
    contentHash: "",
    filename: analysis.filename,
    confidence: analysis.extractionConfidence,
  };
  const confirmation: PlanningPdfConfirmedBatch = {
    proposalId: analysis.proposalId,
    snapshotVersion: analysis.snapshotVersion,
    provenance,
    plans: analysis.plans.map((plan) => ({
      planId: plan.id,
      order: plan.order,
      pageStart: plan.pageStart,
      pageEnd: plan.pageEnd,
      approvedValues: Object.fromEntries(
        plan.items
          .filter(
            (item) =>
              item.recommendation !== "ignore" &&
              item.proposedValue != null &&
              item.proposedValue !== ""
          )
          .map((item) => [item.targetField, item.proposedValue])
      ),
    })),
  };
  const drafts = buildPlanningDraftsFromPdfConfirmation({
    basePlan: createPlanningWorkspaceDraft(),
    confirmation,
    nowIso,
  });
  return drafts.map((draft, index) => ({
    ...draft,
    classId: "",
    title: draft.title || analysis.plans[index]?.title || `Plano ${index + 1}`,
    applyDate: draft.applyDate || analysis.plans[index]?.lessonDate || "",
  }));
};

export const defaultSelectedPlanningPdfItemIds = (analysis: PlanningPdfAnalysis) =>
  analysis.plans
    .flatMap((plan) => plan.items)
    .filter(
      (item) =>
        item.recommendation === "apply" &&
        item.confidence >= 0.72 &&
        item.proposedValue != null &&
        item.proposedValue !== ""
    )
    .map((item) => item.id);
