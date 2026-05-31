import type { SessionEnvironment } from "../../../core/models";

export type CompactSessionPlanDetail = {
  label: string;
  value: string;
};

const cleanDetailValue = (value: string | null | undefined, fallback: string) => {
  const cleaned = String(value ?? "").trim();
  return cleaned || fallback;
};

export function buildCompactSessionPlanDetails(params: {
  focusLabel?: string | null;
  successCriterionLabel?: string | null;
  suggestedAdjustmentLabel?: string | null;
  noDataLabel?: string;
}): CompactSessionPlanDetail[] {
  const noDataLabel = params.noDataLabel ?? "Sem dado";

  return [
    {
      label: "Foco",
      value: cleanDetailValue(params.focusLabel, noDataLabel),
    },
    {
      label: "Critério de sucesso",
      value: cleanDetailValue(params.successCriterionLabel, noDataLabel),
    },
    {
      label: "Ajuste sugerido",
      value: cleanDetailValue(params.suggestedAdjustmentLabel, noDataLabel),
    },
  ];
}

export function shouldShowUnavailableResistanceNotice(params: {
  dismissed: boolean;
  sessionEnvironment?: SessionEnvironment | null;
  hasPersistedResistanceData: boolean;
}) {
  if (params.dismissed || params.hasPersistedResistanceData) return false;
  return params.sessionEnvironment === "academia" || params.sessionEnvironment === "mista";
}
