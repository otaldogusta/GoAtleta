import type { UserRole } from "../auth/role";

export type EffectiveProfile = "student" | "professor" | "admin";

export const resolveEffectiveProfile = (params: {
  role: UserRole | null;
  orgRoleLevel?: number | null;
}): EffectiveProfile => {
  const role = params.role;
  const orgRoleLevel = params.orgRoleLevel ?? 0;

  if (role === "student") return "student";
  if (role === "trainer" && orgRoleLevel >= 50) return "admin";
  return "professor";
};
