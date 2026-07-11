import type {
  AppPlanningSnapshot,
  DocumentInterpretation,
  DocumentMergeItem,
} from "./pedagogical-types";

const item = (value: DocumentMergeItem) => value;

export function reconcilePedagogicalDocument(params: {
  interpretation: DocumentInterpretation;
  snapshot: AppPlanningSnapshot;
}): DocumentMergeItem[] {
  const { interpretation, snapshot } = params;
  if (!snapshot.version) throw new Error("Snapshot atual e versionado é obrigatório.");
  const items: DocumentMergeItem[] = [];

  items.push(
    item({
      id: "keep-current-focus",
      kind: "complement",
      targetType: "cycle",
      category: "keep",
      currentValue: snapshot.currentFocus,
      proposedValue: snapshot.currentFocus,
      recommendation: "keep_current",
      reason: "O foco atual é sustentado pelo planejamento e pelas evidências realizadas.",
      recommendationConfidence: 0.96,
    })
  );

  for (const lesson of interpretation.lessons) {
    if (!snapshot.plannedSessionDates.includes(lesson.date)) {
      items.push(
        item({
          id: `complement-session-${lesson.date}`,
          kind: "new_information",
          targetType: "session",
          category: "complement",
          currentValue: null,
          proposedValue: lesson,
          recommendation: "apply",
          reason: "A data e os detalhes pedagógicos ainda não constam no planejamento atual.",
          recommendationConfidence: 0.93,
        })
      );
    }
  }

  const readinessEvidence = snapshot.completedReports.find(
    (report) => report.successfulDirectReceptionCount !== undefined
  );
  if (/2x2/i.test(snapshot.progression) && readinessEvidence?.successfulDirectReceptionCount !== undefined) {
    items.push(
      item({
        id: "adjust-2x2-readiness",
        kind: "conflict",
        targetType: "cycle",
        category: "adjust",
        currentValue: snapshot.progression,
        proposedValue: "Mini 2x2 condicionado a nova evidência de prontidão.",
        recommendation: "apply",
        reason: `Em ${readinessEvidence.date}, apenas ${readinessEvidence.successfulDirectReceptionCount} participantes executaram a recepção direta adequadamente; o avanço deve depender de nova evidência de estabilidade.`,
        recommendationConfidence: 0.98,
      })
    );
  }

  if (interpretation.duplicateBlocksIgnored > 0) {
    items.push(
      item({
        id: "ignore-duplicate-blocks",
        kind: "duplicate",
        targetType: "report",
        category: "ignore",
        currentValue: interpretation.duplicateBlocksIgnored,
        proposedValue: null,
        recommendation: "ignore",
        reason: "Blocos repetidos não podem gerar sessões ou relatórios duplicados.",
        recommendationConfidence: 1,
      })
    );
  }

  return items;
}
