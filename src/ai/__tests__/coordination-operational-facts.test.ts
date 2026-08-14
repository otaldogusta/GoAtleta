import { buildCoordinationOperationalFacts } from "../coordination-operational-facts";

describe("coordination operational facts", () => {
  test("translates the retired dashboard data into organization-scoped facts", () => {
    const facts = buildCoordinationOperationalFacts({
      pendingAttendance: [
        {
          organizationId: "org_1",
          classId: "class_1",
          className: "Sub 15",
          unit: "Centro",
          targetDate: "2026-08-14",
          studentCount: 12,
          hasAttendanceToday: false,
        },
      ],
      pendingReports: [
        {
          organizationId: "org_1",
          classId: "class_1",
          className: "Sub 15",
          unit: "Centro",
          gender: null,
          periodStart: "2026-08-07",
          suggestedDate: "2026-08-14",
          daysWithoutReport: 15,
          hasReportHistory: true,
          reportsLast7d: 0,
          lastReportAt: "2026-07-30T12:00:00.000Z",
        },
      ],
      recentActivity: [
        {
          organizationId: "org_1",
          kind: "session_log",
          classId: "class_2",
          className: "Águias",
          unit: "Centro",
          occurredAt: "2026-08-13T18:00:00.000Z",
          actorUserId: "user_1",
          affectedRows: 1,
          referenceDate: "2026-08-13",
        },
      ],
      healthScore: 61,
      catalogAuditReport: null,
    });

    expect(facts.find((fact) => fact.key === "class_records_pending")).toMatchObject({
      label: "Registros de aula atrasados",
      value: 1,
      status: "critical",
    });
    expect(facts.find((fact) => fact.key === "recent_execution")?.details).toContain(
      "Registro de aula criado em Águias - 13/08/2026"
    );
    expect(facts.find((fact) => fact.key === "catalog_usage")?.details).toContain(
      "Ela não mede a qualidade da aula."
    );
  });
});
