import type {
  StudentFinancialStatus,
  StudentMembershipStatus,
} from "../../../core/models";

export const STUDENT_FINANCIAL_STATUS_OPTIONS: readonly {
  value: StudentFinancialStatus;
  label: string;
}[] = [
  { value: "regular", label: "Em dia" },
  { value: "delinquent", label: "Inadimplente" },
  { value: "exempt", label: "Isento" },
  { value: "pending", label: "Pendente" },
  { value: "unknown", label: "Não informado" },
];

export const getStudentFinancialStatusLabel = (
  status: StudentFinancialStatus,
) =>
  STUDENT_FINANCIAL_STATUS_OPTIONS.find((option) => option.value === status)
    ?.label ?? "Não informado";

export const getStudentMembershipStatusLabel = (
  status: StudentMembershipStatus,
) => (status === "inactive" ? "Inativo" : "Ativo");
