import type { Student } from "../core/models";
import { supabasePost } from "../db/client";

/** Self-service projection: never send enrollment, ownership or administrative fields. */
export async function saveMyStudentProfile(student: Student) {
  const cpf = student.cpfMasked?.trim();
  const receipt = await supabasePost<{ student_id: string; organization_id: string }>(
    "/rpc/save_my_student_profile",
    {
      p_student_id: student.id,
      p_profile: {
        name: student.name.trim(), birthdate: student.birthDate,
        phone: student.phone ?? "", rg: student.rg ?? "",
        address: student.address ?? "", gender_identity: student.genderIdentity ?? "",
        guardian_name: student.guardianName ?? "", guardian_phone: student.guardianPhone ?? "",
        guardian_relation: student.guardianRelation ?? "",
        position_primary: student.positionPrimary, position_secondary: student.positionSecondary,
        health_issue: student.healthIssue ?? false, health_issue_notes: student.healthIssueNotes ?? "",
        medication_use: student.medicationUse ?? false, medication_notes: student.medicationNotes ?? "",
        health_observations: student.healthObservations ?? "",
        ...(cpf && !cpf.includes("*") ? { cpf_input: cpf.replace(/\D/g, "") } : {}),
      },
    },
  );
  if (receipt?.student_id !== student.id || receipt.organization_id !== student.organizationId) {
    throw new Error("Não foi possível salvar. Tente novamente.");
  }
}
