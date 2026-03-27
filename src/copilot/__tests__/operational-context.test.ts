import type { Signal as CopilotSignal } from "../../ai/signal-engine";
import { buildOperationalContext } from "../operational-context";

const baseSignal = (overrides: Partial<CopilotSignal>): CopilotSignal => ({
  id: "s_base",
  type: "report_delay",
  severity: "medium",
  scope: "class",
  organizationId: "org_1",
  classId: "class_1",
  studentId: undefined,
  title: "Signal",
  summary: "Resumo",
  evidence: {},
  recommendedActionIds: [],
  detectedAt: "2026-02-20T10:00:00.000Z",
  ...overrides,
});

describe("operational context builder", () => {
  test("keeps severity dominant over screen relevance", () => {
    const result = buildOperationalContext({
      screen: "classes_index",
      contextTitle: "Turmas",
      contextSubtitle: "Gestao",
      signals: [
        baseSignal({
          id: "low_relevant",
          type: "repeated_absence",
          severity: "low",
          detectedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        }),
        baseSignal({
          id: "high_generic",
          type: "report_delay",
          severity: "high",
          detectedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        }),
      ],
      selectedSignalId: null,
      regulationUpdates: [],
      regulationRuleSets: [],
      history: [],
    });

    expect(result.panel.attentionSignals[0]?.id).toBe("high_generic");
  });

  test("prioritizes relevant and recent items within close severities", () => {
    const nowIso = new Date().toISOString();
    const twoDaysAgoIso = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const result = buildOperationalContext({
      screen: "nfc_attendance",
      contextTitle: "Presenca NFC",
      contextSubtitle: "Check-ins",
      signals: [
        baseSignal({
          id: "nfc_pattern",
          type: "unusual_presence_pattern",
          severity: "medium",
          detectedAt: nowIso,
        }),
        baseSignal({
          id: "report_delay_old",
          type: "report_delay",
          severity: "medium",
          detectedAt: twoDaysAgoIso,
        }),
      ],
      selectedSignalId: null,
      regulationUpdates: [],
      regulationRuleSets: [],
      history: [],
    });

    expect(result.panel.attentionSignals[0]?.id).toBe("nfc_pattern");
  });

  test("builds stable snapshot v2 with regulation context", () => {
    const result = buildOperationalContext({
      screen: "coordination_dashboard",
      contextTitle: "Coordenacao",
      contextSubtitle: "Visao operacional",
      signals: [
        baseSignal({
          id: "s_1",
          type: "report_delay",
          severity: "high",
        }),
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
          changedTopics: ["substituicoes"],
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
        } as any,
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
        } as any,
      ],
      history: [
        {
          actionTitle: "Plano de intervencao",
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
  });

  test("marks day as concluded after last class + 1h grace window", () => {
    const now = new Date(2026, 1, 24, 22, 5, 0, 0);
    const weekday = now.getDay();
    const result = buildOperationalContext({
      screen: "assistant_home",
      contextTitle: "Assistant",
      contextSubtitle: "Visao operacional",
      signals: [],
      selectedSignalId: null,
      regulationUpdates: [],
      regulationRuleSets: [],
      history: [],
      nowMs: now.getTime(),
      scheduleWindows: [
        {
          daysOfWeek: [weekday],
          startTime: "20:00",
          durationMinutes: 60,
        },
      ],
    });

    expect(result.snapshot.dayScheduleStatus).toBe("concluded");
    expect(result.panel.dayScheduleStatus).toBe("concluded");
  });

  test("keeps day in progress while within class grace window", () => {
    const now = new Date(2026, 1, 24, 21, 30, 0, 0);
    const weekday = now.getDay();
    const result = buildOperationalContext({
      screen: "assistant_home",
      contextTitle: "Assistant",
      contextSubtitle: "Visao operacional",
      signals: [],
      selectedSignalId: null,
      regulationUpdates: [],
      regulationRuleSets: [],
      history: [],
      nowMs: now.getTime(),
      scheduleWindows: [
        {
          daysOfWeek: [weekday],
          startTime: "20:00",
          durationMinutes: 60,
        },
      ],
    });

    expect(result.snapshot.dayScheduleStatus).toBe("in_progress");
  });
});
