import type { FamilyPlanKind, FamilyPlanRequestStatus } from "../../api/family-plans";
import { formatMoneyFromCents } from "./finance-format";

export const familyPlanKindLabel: Record<FamilyPlanKind, string> = {
  enrollment: "Matrícula",
  monthly: "Mensalidade",
};

export const familyPlanStatusLabel: Record<FamilyPlanRequestStatus, string> = {
  pending: "Aguardando instituição",
  accepted: "Aceito pela instituição",
  declined: "Recusado pela instituição",
};

export const formatFamilyPlanTerms = (amountCents: number, billingDay: number | null) => {
  const amount = formatMoneyFromCents(amountCents);
  return billingDay === null ? `${amount} · valor único` : `${amount} por mês · vence dia ${billingDay}`;
};
