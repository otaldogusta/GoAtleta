export type StudentOperationalHistoryScope = {
  organizationId: string | null;
  studentId: string | null;
  includeFinancial: boolean;
};

export const buildStudentOperationalHistoryScopeKey = ({
  organizationId,
  studentId,
  includeFinancial,
}: StudentOperationalHistoryScope) =>
  `${organizationId ?? ""}:${studentId ?? ""}:${includeFinancial ? "financial" : "membership"}`;

export const isStudentOperationalHistoryScopeCurrent = (
  requestScopeKey: string,
  currentScopeKey: string,
) => requestScopeKey === currentScopeKey;
