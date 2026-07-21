export type UserRole = "trainer" | "student" | "pending";

export type SelectableUserRole = Extract<UserRole, "trainer" | "student">;
