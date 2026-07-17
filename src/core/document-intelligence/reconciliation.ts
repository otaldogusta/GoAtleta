import type {
  AppStateSnapshot,
  DocumentEligibleEvidence,
  DocumentEvidenceSourceKind,
  DocumentMergeItem,
  DocumentPlanningContext,
  DocumentProposalDecision,
  DocumentReadOnlyActionContract,
  DocumentReconciliationBundle,
  DocumentReconciliationSource,
  DocumentRejectedEvidence,
  ReconciliationKind,
} from "./types";

export const DOCUMENT_SOURCE_PRECEDENCE: Readonly<
  Record<DocumentEvidenceSourceKind, number>
> = Object.freeze({
  safety_or_legal: 900,
  workspace_rule: 800,
  confirmed_teacher_decision: 700,
  confirmed_plan: 600,
  realized_history: 500,
  institutional_guidance: 400,
  periodization: 300,
  academic_reference: 200,
  general_system: 100,
});

export const DOCUMENT_SOURCE_PRECEDENCE_ORDER: readonly DocumentEvidenceSourceKind[] =
  Object.freeze(
    (Object.keys(DOCUMENT_SOURCE_PRECEDENCE) as DocumentEvidenceSourceKind[]).sort(
      (left, right) =>
        DOCUMENT_SOURCE_PRECEDENCE[right] - DOCUMENT_SOURCE_PRECEDENCE[left]
    )
  );

export const DOCUMENT_READ_ONLY_ACTION_CONTRACT: DocumentReadOnlyActionContract =
  Object.freeze({
    mode: "read_only",
    allowedActions: Object.freeze(["answer", "explain", "compare", "propose"] as const),
    forbiddenActions: Object.freeze(
      [
        "apply",
        "persist",
        "mutate_plan",
        "regenerate_pdf",
        "create_global_memory",
      ] as const
    ),
    requiresExplicitConfirmation: true,
    canWrite: false,
  });

export type BuildDocumentPlanningContextParams = {
  snapshot: AppStateSnapshot;
  sessionStartsAt: string;
  sources: DocumentReconciliationSource[];
  minimumConfidence?: number;
  expectedSnapshotVersion?: string;
};

export type BuildReadOnlyDocumentReconciliationParams =
  BuildDocumentPlanningContextParams & {
    currentValues: Record<string, unknown>;
    previousDecisions?: DocumentProposalDecision[];
  };

const clampConfidence = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

const parseTimestamp = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const sourceTimestamp = (evidence: DocumentEligibleEvidence) =>
  parseTimestamp(evidence.realizedAt ?? evidence.sourceModifiedAt ?? "") ?? 0;

const unique = <T>(values: T[]) => Array.from(new Set(values));

const stableSerialize = (value: unknown, seen = new WeakSet<object>()): string => {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? String(value);
  }
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (seen.has(value)) return JSON.stringify("[Circular]");

  seen.add(value);
  if (Array.isArray(value)) {
    const serialized = `[${value.map((item) => stableSerialize(item, seen)).join(",")}]`;
    seen.delete(value);
    return serialized;
  }

  const record = value as Record<string, unknown>;
  const serialized = `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key], seen)}`)
    .join(",")}}`;
  seen.delete(value);
  return serialized;
};

const valuesEqual = (left: unknown, right: unknown) =>
  stableSerialize(left) === stableSerialize(right);

const hashText = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const isMissingValue = (value: unknown) => value === null || value === undefined;

const isComplement = (currentValue: unknown, proposedValue: unknown) => {
  if (Array.isArray(currentValue) && Array.isArray(proposedValue)) {
    return (
      proposedValue.length > currentValue.length &&
      currentValue.every((currentItem) =>
        proposedValue.some((proposedItem) => valuesEqual(currentItem, proposedItem))
      )
    );
  }

  if (
    currentValue &&
    proposedValue &&
    typeof currentValue === "object" &&
    typeof proposedValue === "object" &&
    !Array.isArray(currentValue) &&
    !Array.isArray(proposedValue)
  ) {
    const current = currentValue as Record<string, unknown>;
    const proposed = proposedValue as Record<string, unknown>;
    const currentKeys = Object.keys(current);
    return (
      Object.keys(proposed).length > currentKeys.length &&
      currentKeys.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(proposed, key) &&
          valuesEqual(current[key], proposed[key])
      )
    );
  }

  return false;
};

export const getDocumentSourcePrecedence = (sourceKind: DocumentEvidenceSourceKind) =>
  DOCUMENT_SOURCE_PRECEDENCE[sourceKind];

export const isRealizedEvidenceBeforeSession = (
  realizedAt: string,
  sessionStartsAt: string
) => {
  const realizedTimestamp = parseTimestamp(realizedAt);
  const sessionTimestamp = parseTimestamp(sessionStartsAt);
  return (
    realizedTimestamp !== null &&
    sessionTimestamp !== null &&
    realizedTimestamp < sessionTimestamp
  );
};

const assertValidSnapshot = (
  snapshot: AppStateSnapshot,
  expectedSnapshotVersion?: string
) => {
  if (!snapshot.id.trim()) throw new Error("snapshotId é obrigatório para reconciliar.");
  if (!snapshot.organizationId.trim()) {
    throw new Error("organizationId é obrigatório para reconciliar.");
  }
  if (!snapshot.classId.trim()) throw new Error("classId é obrigatório para reconciliar.");
  if (!snapshot.version.trim()) {
    throw new Error("A versão do snapshot é obrigatória para reconciliar.");
  }
  if (parseTimestamp(snapshot.capturedAt) === null) {
    throw new Error("capturedAt do snapshot é inválido.");
  }
  if (snapshot.state === null || snapshot.state === undefined) {
    throw new Error("O estado atual é obrigatório para reconciliar.");
  }
  if (expectedSnapshotVersion && expectedSnapshotVersion !== snapshot.version) {
    throw new Error("O snapshot atual não corresponde à versão esperada.");
  }
};

const resolveSourceRejection = (params: {
  snapshot: AppStateSnapshot;
  source: DocumentReconciliationSource;
  sessionStartsAt: string;
  minimumConfidence: number;
}): DocumentRejectedEvidence | null => {
  const { binding, interpretation } = params.source;

  if (
    binding.organizationId !== params.snapshot.organizationId ||
    (binding.classId && binding.classId !== params.snapshot.classId)
  ) {
    return {
      sourceDocumentId: interpretation.sourceDocumentId,
      reasonCode: "scope_mismatch",
      reason: "A fonte não pertence ao workspace ou à turma do snapshot atual.",
    };
  }

  if (binding.status !== "confirmed") {
    return {
      sourceDocumentId: interpretation.sourceDocumentId,
      reasonCode: "binding_not_confirmed",
      reason:
        binding.status === "ambiguous"
          ? "O vínculo contextual está ambíguo e exige revisão."
          : "O vínculo contextual ainda não foi resolvido.",
      confidence: clampConfidence(binding.confidence),
    };
  }

  if (params.source.sourceKind === "realized_history") {
    if (!params.source.realizedAt) {
      return {
        sourceDocumentId: interpretation.sourceDocumentId,
        reasonCode: "missing_realized_date",
        reason: "Evidência realizada sem data não pode compor uma sessão.",
      };
    }
    if (parseTimestamp(params.source.realizedAt) === null) {
      return {
        sourceDocumentId: interpretation.sourceDocumentId,
        reasonCode: "invalid_realized_date",
        reason: "A data da evidência realizada é inválida.",
      };
    }
    if (
      !isRealizedEvidenceBeforeSession(
        params.source.realizedAt,
        params.sessionStartsAt
      )
    ) {
      return {
        sourceDocumentId: interpretation.sourceDocumentId,
        reasonCode: "not_before_session",
        reason:
          "Somente evidências realizadas estritamente anteriores à sessão podem compor o contexto.",
      };
    }
  }

  const sourceConfidence = Math.min(
    clampConfidence(binding.confidence),
    clampConfidence(interpretation.extractionConfidence)
  );
  if (sourceConfidence < params.minimumConfidence) {
    return {
      sourceDocumentId: interpretation.sourceDocumentId,
      reasonCode: "low_confidence",
      reason:
        "A extração ou o vínculo contextual tem baixa confiança e não entrou na proposta.",
      confidence: sourceConfidence,
    };
  }

  if (!Object.keys(interpretation.fields).length) {
    return {
      sourceDocumentId: interpretation.sourceDocumentId,
      reasonCode: "empty_interpretation",
      reason: "A interpretação não possui campos reconciliáveis.",
    };
  }

  return null;
};

export const buildDocumentPlanningContext = (
  params: BuildDocumentPlanningContextParams
): DocumentPlanningContext => {
  assertValidSnapshot(params.snapshot, params.expectedSnapshotVersion);
  if (parseTimestamp(params.sessionStartsAt) === null) {
    throw new Error("sessionStartsAt é inválido.");
  }

  const minimumConfidence = params.minimumConfidence ?? 0.55;
  if (
    !Number.isFinite(minimumConfidence) ||
    minimumConfidence < 0 ||
    minimumConfidence > 1
  ) {
    throw new Error("minimumConfidence deve estar entre 0 e 1.");
  }

  const eligibleEvidence: DocumentEligibleEvidence[] = [];
  const rejectedEvidence: DocumentRejectedEvidence[] = [];

  params.sources.forEach((source) => {
    const sourceDocumentId = source.interpretation.sourceDocumentId.trim();
    const sourceRejection = resolveSourceRejection({
      snapshot: params.snapshot,
      source,
      sessionStartsAt: params.sessionStartsAt,
      minimumConfidence,
    });
    if (sourceRejection) {
      rejectedEvidence.push(sourceRejection);
      return;
    }

    Object.entries(source.interpretation.fields)
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([fieldKey, field]) => {
        const fieldConfidence = clampConfidence(field.confidence);
        const extractionConfidence = clampConfidence(
          source.interpretation.extractionConfidence
        );
        const bindingConfidence = clampConfidence(source.binding.confidence);
        const effectiveConfidence = Math.min(
          fieldConfidence,
          extractionConfidence,
          bindingConfidence
        );

        if (effectiveConfidence < minimumConfidence) {
          rejectedEvidence.push({
            sourceDocumentId,
            fieldKey,
            reasonCode: "low_confidence",
            reason:
              "O campo foi preservado como aviso, mas não entrou na proposta por baixa confiança.",
            confidence: effectiveConfidence,
          });
          return;
        }

        eligibleEvidence.push({
          id: `${sourceDocumentId}:${fieldKey}`,
          sourceDocumentId,
          sourceKind: source.sourceKind,
          sourcePrecedence: getDocumentSourcePrecedence(source.sourceKind),
          targetType: source.targetType ?? "session",
          targetId: source.targetId,
          fieldKey,
          value: field.value,
          sourceText: field.sourceText,
          sourceLocation: field.sourceLocation,
          realizedAt: source.realizedAt,
          sourceModifiedAt: source.sourceModifiedAt,
          extractionConfidence,
          bindingConfidence,
          fieldConfidence,
          effectiveConfidence,
          warnings: unique([
            ...source.interpretation.warnings,
            ...field.warnings,
          ]),
        });
      });
  });

  eligibleEvidence.sort((left, right) => {
    if (right.sourcePrecedence !== left.sourcePrecedence) {
      return right.sourcePrecedence - left.sourcePrecedence;
    }
    if (right.effectiveConfidence !== left.effectiveConfidence) {
      return right.effectiveConfidence - left.effectiveConfidence;
    }
    const timestampDifference = sourceTimestamp(right) - sourceTimestamp(left);
    if (timestampDifference !== 0) return timestampDifference;
    return left.id.localeCompare(right.id);
  });

  const warnings = unique([
    "O contexto documental é somente leitura e não altera o plano atual.",
    ...(rejectedEvidence.length
      ? [
          `${rejectedEvidence.length} evidência(s) foram excluídas por escopo, temporalidade, vínculo ou confiança.`,
        ]
      : []),
  ]);

  return {
    organizationId: params.snapshot.organizationId,
    classId: params.snapshot.classId,
    sessionStartsAt: params.sessionStartsAt,
    snapshotId: params.snapshot.id,
    snapshotVersion: params.snapshot.version,
    sourcePrecedence: [...DOCUMENT_SOURCE_PRECEDENCE_ORDER],
    eligibleEvidence,
    rejectedEvidence,
    warnings,
  };
};

const resolveKind = (params: {
  hasCurrentField: boolean;
  currentValue: unknown;
  proposedValue: unknown;
}): ReconciliationKind => {
  if (isMissingValue(params.proposedValue)) return "missing_in_document";
  if (!params.hasCurrentField) return "missing_in_app";
  if (isMissingValue(params.currentValue)) return "new_information";
  if (valuesEqual(params.currentValue, params.proposedValue)) return "duplicate";
  if (isComplement(params.currentValue, params.proposedValue)) return "complement";
  return "conflict";
};

const resolveItemReason = (params: {
  kind: ReconciliationKind;
  chosen: DocumentEligibleEvidence;
  group: DocumentEligibleEvidence[];
  priorRejection?: DocumentProposalDecision;
}) => {
  if (params.priorRejection) {
    const detail = params.priorRejection.reason?.trim();
    return `Uma proposta equivalente já foi rejeitada pelo professor${
      detail ? `: ${detail}` : "."
    }`;
  }
  if (params.kind === "missing_in_document") {
    return "A ausência no documento foi registrada sem gerar exclusão ou substituição.";
  }
  if (params.kind === "duplicate") {
    return "A evidência repete o estado atual e não exige mudança.";
  }

  const realized = params.group.find(
    (evidence) => evidence.sourceKind === "realized_history"
  );
  const planned = params.group.find((evidence) =>
    ["periodization", "academic_reference", "general_system"].includes(
      evidence.sourceKind
    )
  );
  if (
    realized &&
    planned &&
    !valuesEqual(realized.value, planned.value) &&
    params.chosen.id === realized.id
  ) {
    return (
      "A evidência realizada anterior à sessão prevaleceu sobre a intenção planejada " +
      "ou referência de apoio. A diferença permanece apenas como proposta para revisão."
    );
  }

  if (params.chosen.sourceKind === "confirmed_plan") {
    return (
      "O plano confirmado tem precedência sobre fontes inferiores e foi preservado " +
      "como proposta explicável, sem aplicação automática."
    );
  }

  const conflictingSource = params.group.find(
    (evidence) =>
      evidence.id !== params.chosen.id &&
      !valuesEqual(evidence.value, params.chosen.value)
  );
  if (conflictingSource) {
    return (
      `A fonte ${params.chosen.sourceKind} tem precedência sobre ` +
      `${conflictingSource.sourceKind}; a divergência exige revisão do professor.`
    );
  }

  return "A informação foi organizada como proposta explicável e exige confirmação explícita.";
};

const buildMergeItems = (params: {
  context: DocumentPlanningContext;
  currentValues: Record<string, unknown>;
  previousDecisions: DocumentProposalDecision[];
}) => {
  const evidenceByField = new Map<string, DocumentEligibleEvidence[]>();
  params.context.eligibleEvidence.forEach((evidence) => {
    const current = evidenceByField.get(evidence.fieldKey) ?? [];
    current.push(evidence);
    evidenceByField.set(evidence.fieldKey, current);
  });

  return Array.from(evidenceByField.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([fieldKey, group]): DocumentMergeItem => {
      const chosen =
        group.find((evidence) => !isMissingValue(evidence.value)) ?? group[0];
      const hasCurrentField = Object.prototype.hasOwnProperty.call(
        params.currentValues,
        fieldKey
      );
      const currentValue = params.currentValues[fieldKey];
      const kind = resolveKind({
        hasCurrentField,
        currentValue,
        proposedValue: chosen.value,
      });
      const priorRejection = params.previousDecisions.find(
        (decision) =>
          decision.decision === "rejected" &&
          decision.targetField === fieldKey &&
          valuesEqual(decision.proposedValue, chosen.value)
      );
      const supportingEvidenceIds = group
        .filter((evidence) => valuesEqual(evidence.value, chosen.value))
        .map((evidence) => evidence.id);
      const conflictingEvidenceIds = group
        .filter((evidence) => !valuesEqual(evidence.value, chosen.value))
        .map((evidence) => evidence.id);

      const recommendation = priorRejection
        ? ("ignore" as const)
        : kind === "missing_in_document"
          ? ("keep_current" as const)
          : kind === "duplicate"
            ? ("ignore" as const)
            : ("review" as const);

      return {
        id: `merge_${hashText(
          [
            params.context.snapshotId,
            params.context.snapshotVersion,
            fieldKey,
            stableSerialize(chosen.value),
            chosen.sourceDocumentId,
          ].join("|")
        )}`,
        kind,
        targetType: chosen.targetType,
        targetId: chosen.targetId,
        targetField: fieldKey,
        currentValue,
        proposedValue: chosen.value,
        recommendation,
        reason: resolveItemReason({
          kind,
          chosen,
          group,
          priorRejection,
        }),
        recommendationConfidence: chosen.effectiveConfidence,
        sourceDocumentId: chosen.sourceDocumentId,
        sourceKind: chosen.sourceKind,
        sourceLocation: chosen.sourceLocation,
        sourceText: chosen.sourceText,
        supportingEvidenceIds,
        conflictingEvidenceIds,
      };
    });
};

export const buildReadOnlyDocumentReconciliation = (
  params: BuildReadOnlyDocumentReconciliationParams
): DocumentReconciliationBundle => {
  const context = buildDocumentPlanningContext(params);
  const items = buildMergeItems({
    context,
    currentValues: params.currentValues,
    previousDecisions: params.previousDecisions ?? [],
  });
  const sourceDocumentIds = unique(
    items.map((item) => item.sourceDocumentId).filter(Boolean)
  );
  const sourceDocumentId =
    sourceDocumentIds.length === 1
      ? sourceDocumentIds[0]
      : `document_context_${hashText(
          [...sourceDocumentIds, context.snapshotId, context.snapshotVersion].join("|")
        )}`;
  const rejectedDecisionCount = items.filter(
    (item) =>
      item.recommendation === "ignore" &&
      item.reason.startsWith("Uma proposta equivalente")
  ).length;
  const warnings = unique([
    ...context.warnings,
    "Nenhuma mudança foi aplicada automaticamente.",
    ...(rejectedDecisionCount
      ? [
          `${rejectedDecisionCount} proposta(s) foram silenciadas por decisão anterior do professor.`,
        ]
      : []),
  ]);

  return {
    context,
    result: {
      sourceDocumentId,
      snapshotId: context.snapshotId,
      items,
      rejectedEvidence: [...context.rejectedEvidence],
      warnings,
    },
    proposal: {
      id: `proposal_${hashText(
        [
          sourceDocumentId,
          context.organizationId,
          context.classId,
          context.snapshotVersion,
          ...items.map((item) => item.id),
        ].join("|")
      )}`,
      sourceDocumentId,
      organizationId: context.organizationId,
      classId: context.classId,
      snapshotVersion: context.snapshotVersion,
      items,
      status: "draft",
    },
    actionContract: DOCUMENT_READ_ONLY_ACTION_CONTRACT,
  };
};
