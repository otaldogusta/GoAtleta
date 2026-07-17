/* eslint-disable import/first */
const mockGetValidAccessToken = jest.fn();

jest.mock("../../auth/session", () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
}));

jest.mock("../../api/config", () => ({
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
}));

import { retrieveDocumentPlanningSupport } from "../document-context";

const readOnlyActionContract = {
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
};

describe("document context client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("maps operational document layers and keeps a read-only action contract", async () => {
    mockGetValidAccessToken.mockResolvedValue("header.payload.signature");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        actionDate: "2026-07-16",
        documents: [
          {
            id: "chunk-monthly",
            sourceDocumentId: "document-monthly",
            sourceRevisionId: "revision-monthly",
            contentHash: "hash-monthly",
            layer: "periodization",
            sourceScope: "class_planning",
            title: "Planejamento de Julho",
            institution: "Rede Esperança",
            materialType: "unknown",
            evidenceKind: "unknown_support",
            sourceExcerpt: "Consolidar passe e manchete durante o mês.",
            sourceLocation: "Semana 3",
            effectiveDate: "2026-07-01",
            confidence: 0.95,
            metadata: {
              document_class: "monthly_plan",
              month_key: "2026-07",
            },
          },
          {
            id: "chunk-monthly-2",
            sourceDocumentId: "document-monthly",
            sourceRevisionId: "revision-monthly",
            contentHash: "hash-monthly",
            layer: "periodization",
            sourceScope: "class_planning",
            title: "Planejamento de Julho",
            institution: "Rede Esperança",
            materialType: "unknown",
            evidenceKind: "unknown_support",
            sourceExcerpt: "Segundo trecho do mesmo planejamento.",
            sourceLocation: "Semana 4",
            confidence: 0.91,
            metadata: {
              document_class: "monthly_plan",
              month_key: "2026-07",
            },
          },
          {
            id: "chunk-report",
            sourceDocumentId: "document-report",
            layer: "realized_history",
            sourceScope: "class_history",
            title: "Relatório de 14 de julho",
            source: "Primeiros Saques",
            sourceExcerpt: "A turma manteve três trocas com apoio.",
            effectiveDate: "2026-07-14",
            confidence: 0.88,
            metadata: { document_class: "realized_report" },
          },
          {
            id: "chunk-institutional",
            sourceDocumentId: "document-institutional",
            layer: "institutional",
            sourceScope: "workspace_institutional",
            title: "Ações institucionais",
            institution: "Rede Esperança",
            sourceExcerpt: "Priorizar cooperação e participação.",
            effectiveDate: "2026-07-05",
            confidence: 0.9,
            metadata: { document_class: "institutional_actions" },
          },
        ],
      }),
    } as Response);

    const support = await retrieveDocumentPlanningSupport({
      organizationId: "org-1",
      classId: "class-1",
      context: {
        modality: "voleibol",
        ageBand: "08-11",
        objective: "Passe e continuidade",
        skill: "passe",
        sessionDate: "2026-07-16",
      },
    });

    expect(support.status).toBe("available");
    expect(support.retrievalMode).toBe("contextual");
    expect(support.actionDate).toBe("2026-07-16");
    expect(support.actionContract).toEqual(readOnlyActionContract);
    expect(support.references).toEqual([
      expect.objectContaining({
        id: "chunk-monthly",
        sourceDocumentId: "document-monthly",
        sourceScope: "class_planning",
        materialType: "monthly_plan",
        evidenceLevel: "contextual_support",
        documentType: "monthly_plan",
        sourceDate: "2026-07-01",
        period: "2026-07",
        isPrimaryPlanningSource: true,
      }),
      expect.objectContaining({
        id: "chunk-report",
        sourceDocumentId: "document-report",
        sourceScope: "realized_history",
        materialType: "realized_report",
        evidenceLevel: "realized_report",
        documentType: "realized_report",
        sourceDate: "2026-07-14",
      }),
      expect.objectContaining({
        id: "chunk-institutional",
        sourceDocumentId: "document-institutional",
        sourceScope: "institutional",
        materialType: "institutional_actions",
        evidenceLevel: "institutional_guidance",
        documentType: "institutional_actions",
        sourceDate: "2026-07-05",
      }),
    ]);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://project.supabase.co/functions/v1/document-context-resolve",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "anon-key",
          Authorization: "Bearer header.payload.signature",
        }),
      })
    );
    const request = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(request.body))).toMatchObject({
      organizationId: "org-1",
      classId: "class-1",
      actionDate: "2026-07-16",
      maxDocuments: 8,
    });
  });

  it("returns unavailable support instead of blocking when retrieval fails", async () => {
    mockGetValidAccessToken.mockResolvedValue("header.payload.signature");
    global.fetch = jest.fn().mockRejectedValue(new Error("network unavailable"));

    await expect(
      retrieveDocumentPlanningSupport({
        organizationId: "org-1",
        classId: "class-1",
        context: {
          objective: "Passe e continuidade",
          sessionDate: "2026-07-16",
        },
      })
    ).resolves.toEqual({
      status: "unavailable",
      references: [],
      warnings: [
        "Contexto documental temporariamente indisponível; o plano seguirá com o contexto operacional já salvo.",
      ],
      actionContract: readOnlyActionContract,
    });
  });

  it("does not call the endpoint without an organization scope", async () => {
    global.fetch = jest.fn();

    const support = await retrieveDocumentPlanningSupport({
      organizationId: "",
      classId: "class-1",
      context: {
        objective: "Passe e continuidade",
        sessionDate: "2026-07-16",
      },
    });

    expect(support).toEqual({
      status: "unavailable",
      references: [],
      warnings: ["Workspace sem escopo documental válido."],
      actionContract: readOnlyActionContract,
    });
    expect(mockGetValidAccessToken).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
