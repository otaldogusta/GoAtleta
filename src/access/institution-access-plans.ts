import type { AccessProduct, AccessRequestOrganization } from "../api/organization-access-requests";

export type InstitutionAccessPlan = {
  id: string;
  product: AccessProduct;
  name: string;
  enrollmentLabel: string;
  installmentLabel: string;
  frequencyLabel: string;
  modalities: string[];
  billingDay: number;
  periodicityLabel: string;
  paymentMethodLabel: string;
  lateFeePercent: number;
  cancellationTerms: string;
};

const REDE_ESPORTES_DEMO_PLANS: InstitutionAccessPlan[] = [
  {
    id: "rede-mensal-1x",
    product: "goatleta",
    name: "Plano mensal · 1x por semana",
    enrollmentLabel: "R$ 100 de matrícula",
    installmentLabel: "11x de R$ 60",
    frequencyLabel: "1 treino semanal",
    modalities: ["Vôlei de quadra"],
    billingDay: 10,
    periodicityLabel: "Mensal",
    paymentMethodLabel: "Combinado com a instituição",
    lateFeePercent: 2,
    cancellationTerms: "O cancelamento segue os termos da instituição.",
  },
  {
    id: "rede-mensal-2x",
    product: "goatleta",
    name: "Plano mensal · 2x por semana",
    enrollmentLabel: "R$ 150 de matrícula",
    installmentLabel: "11x de R$ 110",
    frequencyLabel: "2 treinos semanais",
    modalities: ["Vôlei de quadra"],
    billingDay: 10,
    periodicityLabel: "Mensal",
    paymentMethodLabel: "Combinado com a instituição",
    lateFeePercent: 2,
    cancellationTerms: "O cancelamento segue os termos da instituição.",
  },
  {
    id: "rede-mensal-3x",
    product: "goatleta_pro",
    name: "Plano mensal · 3x por semana",
    enrollmentLabel: "R$ 205 de matrícula",
    installmentLabel: "11x de R$ 165",
    frequencyLabel: "3 treinos semanais",
    modalities: ["Vôlei de quadra", "Vôlei de praia"],
    billingDay: 10,
    periodicityLabel: "Mensal",
    paymentMethodLabel: "Combinado com a instituição",
    lateFeePercent: 2,
    cancellationTerms: "O cancelamento segue os termos da instituição.",
  },
];

const PREVIEW_INSTITUTIONS: AccessRequestOrganization[] = [
  { id: "preview-rede-esportes-pinhais", name: "Rede Esportes Pinhais" },
  { id: "preview-instituto-campeoes", name: "Instituto Campeões" },
  { id: "preview-centro-esportivo-sul", name: "Centro Esportivo Sul" },
];

export function getPreviewAccessOrganizations(query: string): AccessRequestOrganization[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  if (!normalizedQuery) return PREVIEW_INSTITUTIONS;
  return PREVIEW_INSTITUTIONS.filter((institution) =>
    institution.name.toLocaleLowerCase("pt-BR").includes(normalizedQuery)
  );
}

export function getPreviewInstitutionModalities(institutionName: string): string[] {
  const normalizedName = institutionName.trim().toLocaleLowerCase("pt-BR");
  if (normalizedName.includes("rede esportes")) return ["Vôlei de quadra", "Vôlei de praia"];
  if (normalizedName.includes("instituto campeões")) return ["Futsal", "Vôlei de quadra"];
  if (normalizedName.includes("centro esportivo sul")) return ["Futebol", "Preparação física"];
  return [];
}

export function getPreviewInstitutionAccessPlans(
  institutionName: string
): InstitutionAccessPlan[] {
  if (institutionName.trim().toLocaleLowerCase("pt-BR").includes("rede esportes")) {
    return REDE_ESPORTES_DEMO_PLANS;
  }
  return [];
}
