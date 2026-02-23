import { buildOperationalContext } from "../operational-context";

describe("operational context builder", () => {
  test("builds snapshot v2 with regulation context and hash", () => {
    const result = buildOperationalContext({
      screen: "coordination",
      contextTitle: "Coordenação",
      contextSubtitle: "Visão operacional",
      signals: [
        {
          id: "s_1",
          type: "report_delay",
          severity: "high",
          scope: "class",
          organizationId: "org_1",
          classId: "class_1",
          studentId: undefined,
          title: "Relatório em atraso",
          summary: "Turma sem fechamento recente.",
          evidence: {},
          recommendedActionIds: ["a_1"],
          detectedAt: "2026-02-20T10:00:00.000Z",
        },
      ],
      selectedSignalId: "s_1",
      regulationUpdates: [
        {
          id: "ru_1",
          organizationId: "org_1",
          ruleSetId: "rs_1",
          sourceId: "src_1",
          documentId: "doc_1",
          publishedAt: "2026-02-20T09:00:00.000Z",
          changedTopics: ["substituições"],
          diffSummary: "Novo adendo.",
          sourceUrl: "https://example.com/fonte.pdf",
          checksumSha256: "abc",
          status: "published",
          createdAt: "2026-02-20T09:10:00.000Z",
          sourceLabel: "FIVB 2026",
          sourceAuthority: "FIVB",
          readAt: null,
          isRead: false,
          title: "Regulamento atualizado - FIVB (FIVB 2026)",
          impactAreas: ["Torneios"],
          impactActions: [{ label: "Ver torneios", route: "/events" }],
        },
      ],
      regulationRuleSets: [
        {
          id: "rs_1",
          organizationId: "org_1",
          sport: "volleyball",
          versionLabel: "FIVB-2026",
          status: "active",
          activationPolicy: "new_cycles_only",
          effectiveFrom: null,
          sourceAuthority: "FIVB",
          publishedAt: null,
          createdAt: "2026-02-20T08:00:00.000Z",
          updatedAt: "2026-02-20T08:00:00.000Z",
          clausesCount: 3,
          updatesCount: 1,
        },
      ],
      history: [
        {
          actionTitle: "Plano de intervenção",
          status: "success",
          createdAt: "2026-02-20T10:05:00.000Z",
        },
      ],
    });

    expect(result.snapshot.snapshotVersion).toBe(2);
    expect(result.snapshot.snapshotHash).toContain("v2_");
    expect(result.snapshot.regulationContext.activeRuleSetId).toBe("rs_1");
    expect(result.snapshot.regulationContext.impactAreas).toEqual(["Torneios"]);
    expect(result.panel.unreadRegulationCount).toBe(1);
    expect(result.panel.attentionSignals[0]?.id).toBe("s_1");
  });
});
