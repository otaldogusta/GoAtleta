export type ImportantStudentProfileField = "birthDate" | "phone";

export type ImportantStudentProfileInput = {
  birthDate?: string | null;
  phone?: string | null;
};

const importantFieldLabels: Record<ImportantStudentProfileField, string> = {
  birthDate: "data de nascimento",
  phone: "telefone de contato",
};

export function getMissingImportantStudentFields(
  student: ImportantStudentProfileInput
): ImportantStudentProfileField[] {
  const missing: ImportantStudentProfileField[] = [];
  if (!String(student.birthDate ?? "").trim()) missing.push("birthDate");
  if (!String(student.phone ?? "").replace(/\D/g, "")) missing.push("phone");
  return missing;
}

export function formatImportantStudentFields(
  fields: ImportantStudentProfileField[]
): string {
  const labels = fields.map((field) => importantFieldLabels[field]);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}`;
}

export function buildIncompleteStudentConfirmationMessage(
  fields: ImportantStudentProfileField[]
): string {
  const missing = formatImportantStudentFields(fields);
  return `Faltam ${missing}. O aluno será cadastrado com o aviso “Cadastro incompleto” até esses dados serem preenchidos. Deseja salvar mesmo assim?`;
}
