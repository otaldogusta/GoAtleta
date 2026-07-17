import {
  DOCUMENT_READ_ONLY_ACTION_CONTRACT,
  DOCUMENT_SOURCE_PRECEDENCE_ORDER,
  buildDocumentPlanningContext,
  buildReadOnlyDocumentReconciliation,
  isRealizedEvidenceBeforeSession,
  type AppStateSnapshot,
  type DocumentContextBinding,
  type DocumentEvidenceSourceKind,
  type DocumentInterpretation,
  type DocumentProposalDecision,
  type DocumentReconciliationSource,
} from "..";

const snapshot: AppStateSnapshot = {
  id: "snapshot-1",
  organizationId: "org-1",
  classId: "class-1",
  capturedAt: "2026-07-15T18:00:00.000Z",
  version: "version-7",
  state: { planId: "plan-1" },
};

const buildSource = (params: {
  id: string;
  sourceKind: DocumentEvidenceSourceKind;
  fieldKey?: string;
  value?: unknown;
  fieldConfidence?: number;
  extractionConfidence?: number;
  bindingConfidence?: number;
  bindingStatus?: DocumentContextBinding["status"];
  organizationId?: string;
  classId?: string;
  realizedAt?: string;
  sourceModifiedAt?: string;
}): DocumentReconciliationSource => {
  const fieldKey = params.fieldKey ?? "progression";
  const interpretation: DocumentInterpretation = {
    sourceDocumentId: params.id,
    documentType:
      params.sourceKind === "realized_history"
        ? "report"
        : params.sourceKind === "academic_reference"
          ? "academic_reference"
          : "monthly_plan",
    fields: {
      [fieldKey]: {
        value: params.value === undefined ? "maintain" : params.value,
        confidence: params.fieldConfidence ?? 0.9,
        sourceText: `${fieldKey}: ${String(params.value ?? "maintain")}`,
        sourceLocation: "página 1",
        warnings: [],
      },
    },
    warnings: [],
    extractionConfidence: params.extractionConfidence ?? 0.9,
  };

  return {
    interpretation,
    binding: {
      organizationId: params.organizationId ?? "org-1",
      classId: params.classId === undefined ? "class-1" : params.classId,
      confidence: params.bindingConfidence ?? 0.9,
      status: params.bindingStatus ?? "confirmed",
    },
    sourceKind: params.sourceKind,
    targetType: "session",
    targetId: "plan-1",
    realizedAt: params.realizedAt,
    sourceModifiedAt: params.sourceModifiedAt,
  };
};

describe("document context reconciliation", () => {
  it("usa somente evidência realizada estritamente anterior à sessão", () => {
    const context = buildDocumentPlanningContext({
      snapshot,
      sessionStartsAt: "2026-07-16",
      sources: [
        buildSource({
          id: "report-before",
          sourceKind: "realized_history",
          value: "maintain",
          realizedAt: "2026-07-14T16:00:00.000Z",
        }),
        buildSource({
          id: "report-same-day",
          sourceKind: "realized_history",
          value: "advance",
          realizedAt: "2026-07-16T10:00:00.000Z",
        }),
        buildSource({
          id: "report-future",
          sourceKind: "realized_history",
          value: "advance",
          realizedAt: "2026-07-17T10:00:00.000Z",
        }),
      ],
    });

    expect(context.eligibleEvidence.map((item) => item.sourceDocumentId)).toEqual([
      "report-before",
    ]);
    expect(
      context.rejectedEvidence.filter((item) => item.reasonCode === "not_before_session")
    ).toHaveLength(2);
    expect(isRealizedEvidenceBeforeSession("2026-07-14", "2026-07-16")).toBe(true);
    expect(isRealizedEvidenceBeforeSession("2026-07-16", "2026-07-16")).toBe(false);
  });

  it("explica quando evidência realizada não possui data utilizável", () => {
    const context = buildDocumentPlanningContext({
      snapshot,
      sessionStartsAt: "2026-07-16",
      sources: [
        buildSource({
          id: "report-without-date",
          sourceKind: "realized_history",
        }),
        buildSource({
          id: "report-invalid-date",
          sourceKind: "realized_history",
          realizedAt: "ontem",
        }),
      ],
    });

    expect(context.eligibleEvidence).toEqual([]);
    expect(context.rejectedEvidence.map((item) => item.reasonCode)).toEqual([
      "missing_realized_date",
      "invalid_realized_date",
    ]);
  });

  it("mantém uma precedência estável e explícita entre as fontes", () => {
    expect(DOCUMENT_SOURCE_PRECEDENCE_ORDER).toEqual([
      "safety_or_legal",
      "workspace_rule",
      "confirmed_teacher_decision",
      "confirmed_plan",
      "realized_history",
      "institutional_guidance",
      "periodization",
      "academic_reference",
      "general_system",
    ]);
  });

  it("faz o realizado anterior prevalecer sobre a intenção de periodização", () => {
    const bundle = buildReadOnlyDocumentReconciliation({
      snapshot,
      sessionStartsAt: "2026-07-16",
      currentValues: { progression: "advance" },
      sources: [
        buildSource({
          id: "monthly-plan",
          sourceKind: "periodization",
          value: "advance",
          sourceModifiedAt: "2026-07-01",
        }),
        buildSource({
          id: "previous-report",
          sourceKind: "realized_history",
          value: "maintain",
          realizedAt: "2026-07-14",
        }),
      ],
    });

    expect(bundle.proposal.items[0]).toMatchObject({
      proposedValue: "maintain",
      sourceDocumentId: "previous-report",
      sourceKind: "realized_history",
      recommendation: "review",
    });
    expect(bundle.proposal.items[0]?.reason).toContain(
      "evidência realizada anterior à sessão prevaleceu"
    );
    expect(bundle.proposal.items[0]?.conflictingEvidenceIds).toEqual([
      "monthly-plan:progression",
    ]);
  });

  it("preserva um plano confirmado mesmo quando o realizado diverge", () => {
    const bundle = buildReadOnlyDocumentReconciliation({
      snapshot,
      sessionStartsAt: "2026-07-16",
      currentValues: { progression: "maintain" },
      sources: [
        buildSource({
          id: "confirmed-plan",
          sourceKind: "confirmed_plan",
          value: "adapt",
        }),
        buildSource({
          id: "previous-report",
          sourceKind: "realized_history",
          value: "regress",
          realizedAt: "2026-07-14",
        }),
      ],
    });

    expect(bundle.proposal.items[0]).toMatchObject({
      proposedValue: "adapt",
      sourceDocumentId: "confirmed-plan",
      sourceKind: "confirmed_plan",
      recommendation: "review",
    });
    expect(bundle.proposal.items[0]?.reason).toContain("plano confirmado");
  });

  it("rejeita baixa confiança sem resolvê-la silenciosamente", () => {
    const bundle = buildReadOnlyDocumentReconciliation({
      snapshot,
      sessionStartsAt: "2026-07-16",
      currentValues: { objective: "Controle do passe" },
      sources: [
        buildSource({
          id: "low-confidence-field",
          sourceKind: "academic_reference",
          fieldKey: "objective",
          value: "Tomada de decisão",
          fieldConfidence: 0.49,
        }),
        buildSource({
          id: "low-confidence-binding",
          sourceKind: "institutional_guidance",
          fieldKey: "objective",
          value: "Participação",
          bindingConfidence: 0.4,
        }),
      ],
    });

    expect(bundle.context.eligibleEvidence).toEqual([]);
    expect(bundle.proposal.items).toEqual([]);
    expect(bundle.context.rejectedEvidence).toHaveLength(2);
    expect(
      bundle.context.rejectedEvidence.every(
        (item) => item.reasonCode === "low_confidence"
      )
    ).toBe(true);
    expect(bundle.result.warnings).toContain("Nenhuma mudança foi aplicada automaticamente.");
  });

  it("rejeita vínculo ambíguo e qualquer mistura de workspace ou turma", () => {
    const context = buildDocumentPlanningContext({
      snapshot,
      sessionStartsAt: "2026-07-16",
      sources: [
        buildSource({
          id: "ambiguous",
          sourceKind: "institutional_guidance",
          bindingStatus: "ambiguous",
        }),
        buildSource({
          id: "other-workspace",
          sourceKind: "workspace_rule",
          organizationId: "org-2",
        }),
        buildSource({
          id: "other-class",
          sourceKind: "realized_history",
          classId: "class-2",
          realizedAt: "2026-07-14",
        }),
      ],
    });

    expect(context.eligibleEvidence).toEqual([]);
    expect(context.rejectedEvidence.map((item) => item.reasonCode)).toEqual([
      "binding_not_confirmed",
      "scope_mismatch",
      "scope_mismatch",
    ]);
  });

  it("não repete como ajuste uma proposta equivalente já rejeitada", () => {
    const previousDecisions: DocumentProposalDecision[] = [
      {
        targetField: "objective",
        proposedValue: "Avançar para 2x2",
        decision: "rejected",
        decidedAt: "2026-07-15T12:00:00.000Z",
        decidedBy: "teacher-1",
        reason: "A turma ainda não domina a recepção.",
      },
    ];
    const bundle = buildReadOnlyDocumentReconciliation({
      snapshot,
      sessionStartsAt: "2026-07-16",
      currentValues: { objective: "Consolidar recepção" },
      previousDecisions,
      sources: [
        buildSource({
          id: "academic-source",
          sourceKind: "academic_reference",
          fieldKey: "objective",
          value: "Avançar para 2x2",
        }),
      ],
    });

    expect(bundle.proposal.items[0]).toMatchObject({
      recommendation: "ignore",
      proposedValue: "Avançar para 2x2",
    });
    expect(bundle.proposal.items[0]?.reason).toContain("já foi rejeitada");
    expect(bundle.result.warnings).toContain(
      "1 proposta(s) foram silenciadas por decisão anterior do professor."
    );
  });

  it("trata ausência no documento como observação e nunca como exclusão", () => {
    const bundle = buildReadOnlyDocumentReconciliation({
      snapshot,
      sessionStartsAt: "2026-07-16",
      currentValues: { observations: "Manter atenção à inclusão." },
      sources: [
        buildSource({
          id: "monthly-plan",
          sourceKind: "periodization",
          fieldKey: "observations",
          value: null,
        }),
      ],
    });

    expect(bundle.proposal.items[0]).toMatchObject({
      kind: "missing_in_document",
      currentValue: "Manter atenção à inclusão.",
      proposedValue: null,
      recommendation: "keep_current",
    });
    expect(bundle.proposal.items[0]?.reason).toContain("sem gerar exclusão");
  });

  it("expõe um contrato de ação estritamente read-only", () => {
    const bundle = buildReadOnlyDocumentReconciliation({
      snapshot,
      sessionStartsAt: "2026-07-16",
      currentValues: {},
      sources: [],
    });

    expect(bundle.actionContract).toBe(DOCUMENT_READ_ONLY_ACTION_CONTRACT);
    expect(bundle.actionContract).toEqual({
      mode: "read_only",
      allowedActions: ["answer", "explain", "compare", "propose"],
      forbiddenActions: [
        "apply",
        "persist",
        "mutate_plan",
        "regenerate_pdf",
        "create_global_memory",
      ],
      requiresExplicitConfirmation: true,
      canWrite: false,
    });
    expect(bundle.proposal.status).toBe("draft");
    expect(bundle.proposal.items.some((item) => item.recommendation === "apply")).toBe(
      false
    );
  });

  it("é determinístico e não altera os valores de entrada", () => {
    const currentValues = {
      adaptations: ["bola leve"],
    };
    const source = buildSource({
      id: "academic-adaptation",
      sourceKind: "academic_reference",
      fieldKey: "adaptations",
      value: ["bola leve", "distância reduzida"],
    });
    const inputSnapshot = JSON.parse(JSON.stringify(snapshot)) as AppStateSnapshot;
    const before = JSON.stringify({ currentValues, source, inputSnapshot });

    const first = buildReadOnlyDocumentReconciliation({
      snapshot: inputSnapshot,
      sessionStartsAt: "2026-07-16",
      currentValues,
      sources: [source],
    });
    const second = buildReadOnlyDocumentReconciliation({
      snapshot: inputSnapshot,
      sessionStartsAt: "2026-07-16",
      currentValues,
      sources: [source],
    });

    expect(first.proposal.id).toBe(second.proposal.id);
    expect(first.proposal.items[0]?.kind).toBe("complement");
    expect(JSON.stringify({ currentValues, source, inputSnapshot })).toBe(before);
  });

  it("recusa reconciliar sobre uma versão de snapshot diferente da esperada", () => {
    expect(() =>
      buildDocumentPlanningContext({
        snapshot,
        expectedSnapshotVersion: "version-8",
        sessionStartsAt: "2026-07-16",
        sources: [],
      })
    ).toThrow("O snapshot atual não corresponde à versão esperada.");
  });
});
