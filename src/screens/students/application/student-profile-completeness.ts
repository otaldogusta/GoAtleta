export type ImportantStudentProfileField = "name" | "phone" | "birthDate" | "cpf";

export type ImportantStudentProfileInput = {
  name?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  cpfMasked?: string | null;
};

const importantFieldLabels: Record<ImportantStudentProfileField, string> = {
  name: "nome completo",
  phone: "celular",
  birthDate: "data de nascimento",
  cpf: "CPF",
};

export function getMissingImportantStudentFields(
  student: ImportantStudentProfileInput
): ImportantStudentProfileField[] {
  const missing: ImportantStudentProfileField[] = [];
  if (String(student.name ?? "").trim().length < 2) missing.push("name");
  if (!String(student.phone ?? "").replace(/\D/g, "")) missing.push("phone");
  if (!String(student.birthDate ?? "").trim()) missing.push("birthDate");
  if (!String(student.cpfMasked ?? "").trim()) missing.push("cpf");
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
