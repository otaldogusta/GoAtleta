import { buildMonthPlanningInsightBullets } from "../month-planning-insights";

describe("buildMonthPlanningInsightBullets", () => {
  it("renderiza microcopy mensal com aulas reais e removidas", () => {
    const bullets = buildMonthPlanningInsightBullets({
      selectedClass: {
        name: "Turma Sub-11",
        ageBand: "09-11",
        mvLevel: "iniciante",
        level: 1,
      },
      weeklyItems: [
        {
          plan: {
            generationContextSnapshotJson: JSON.stringify({
              monthlyBlueprint: {
                classContextSnapshot: {
                  calendar: {
                    sessionCount: 8,
                    skippedSessionCount: 1,
                  },
                  roster: {
                    densityProfile: "large",
                  },
                  health: {
                    hasIncompleteHealthData: true,
                  },
                  evidenceQuality: {
                    hasRosterData: true,
                    hasRecentAttendanceData: false,
                    hasRecentSessionLogs: false,
                  },
                },
              },
            }),
          },
          sessions: [],
          skippedSessions: [],
        },
      ],
    });

    expect(bullets).toEqual([
      "8 aulas reais no mês.",
      "1 aula removida por exceção de calendário.",
      "Turma numerosa",
      "Dados parciais: decisão conservadora.",
    ]);
  });

  it("usa fallback seguro para snapshot mensal antigo", () => {
    const bullets = buildMonthPlanningInsightBullets({
      selectedClass: {
        name: "Turma Sub-11",
        ageBand: "09-11",
        mvLevel: "iniciante",
        level: 1,
      },
      weeklyItems: [
        {
          plan: { generationContextSnapshotJson: "{}" },
          sessions: [
            {
              sessionIndex: 1,
              weekday: 2,
              weekdayLabel: "Ter",
              date: "2026-06-02",
              dateLabel: "02/06/2026",
              shortLabel: "Ter 02/06",
            },
          ],
          skippedSessions: [],
        },
      ],
    });

    expect(bullets).toContain("1 aula real no mês.");
    expect(bullets).toContain("Turma 09-11 iniciante.");
  });

  it("nao mostra bloco sem semanas carregadas", () => {
    expect(buildMonthPlanningInsightBullets({ weeklyItems: [], selectedClass: null })).toEqual([]);
  });
});
