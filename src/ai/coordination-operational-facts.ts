import type { AdminPendingAttendance, AdminPendingSessionLogs, AdminRecentActivity } from "../api/reports";
import type { CopilotOperationalFact } from "../copilot/types";
import type { ActivityCatalogAuditReport } from "../core/volleyball/activity-catalog-audit";

type CoordinationOperationalFactsInput = {
  pendingAttendance: AdminPendingAttendance[];
  pendingReports: AdminPendingSessionLogs[];
  recentActivity: AdminRecentActivity[];
  healthScore: number | null;
  catalogAuditReport: ActivityCatalogAuditReport | null;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "sem data";
  const parsed = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
};

const activityLabel = (kind: AdminRecentActivity["kind"]) =>
  kind === "attendance" ? "Chamada registrada" : "Registro de aula criado";

export const buildCoordinationOperationalFacts = ({
  pendingAttendance,
  pendingReports,
  recentActivity,
  healthScore,
  catalogAuditReport,
}: CoordinationOperationalFactsInput): CopilotOperationalFact[] => {
  const catalogUsage = catalogAuditReport?.usage;

  return [
    {
      key: "attendance_pending",
      label: "Chamadas pendentes",
      value: pendingAttendance.length,
      status: pendingAttendance.length ? "attention" : "ok",
      details: pendingAttendance
        .slice(0, 5)
        .map((item) => `${item.className} - ${formatDate(item.targetDate)}`),
    },
    {
      key: "class_records_pending",
      label: "Registros de aula atrasados",
      value: pendingReports.length,
      status: pendingReports.some((item) => item.daysWithoutReport >= 14)
        ? "critical"
        : pendingReports.length
          ? "attention"
          : "ok",
      details: pendingReports
        .slice(0, 5)
        .map((item) => `${item.className} - ${item.daysWithoutReport} dias sem registro`),
    },
    {
      key: "recent_execution",
      label: "Execução recente",
      value: recentActivity.length,
      status: "info",
      details: recentActivity
        .slice(0, 5)
        .map((item) => `${activityLabel(item.kind)} em ${item.className} - ${formatDate(item.occurredAt)}`),
    },
    {
      key: "catalog_usage",
      label: "Uso do catálogo nos planos",
      value: catalogUsage?.totalCatalogActivitiesUsed ?? "disponível sob demanda",
      status: catalogUsage?.unknownCatalogReferences.length ? "attention" : "info",
      details: catalogUsage
        ? [
            `${catalogUsage.unusedVariants.length} variações ainda não usadas`,
            `${catalogUsage.unknownCatalogReferences.length} referências antigas para revisar`,
          ]
        : [
            "A análise em Gestão mede cobertura, uso real, itens nunca usados e referências antigas.",
            "Ela não mede a qualidade da aula.",
          ],
    },
    {
      key: "coordination_health",
      label: "Saúde operacional",
      value: healthScore === null ? "calculando" : `${healthScore}%`,
      status:
        healthScore === null ? "info" : healthScore >= 80 ? "ok" : healthScore >= 55 ? "attention" : "critical",
    },
  ];
};
