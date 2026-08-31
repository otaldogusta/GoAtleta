export type UserRole = "trainer" | "student" | "family" | "pending";

export type SelectableUserRole = Extract<
  UserRole,
  "trainer" | "student" | "family"
>;
