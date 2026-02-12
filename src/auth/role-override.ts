import { getDevProfilePreview, setDevProfilePreview } from "../dev/profile-preview";

export type RoleOverride = "trainer" | "student";

export async function getRoleOverride(): Promise<RoleOverride | null> {
  if (!__DEV__) return null;
  const preview = await getDevProfilePreview();
  if (preview === "student") return "student";
  if (preview === "professor" || preview === "admin") return "trainer";
  return null;
}

export async function setRoleOverride(value: RoleOverride | null) {
  if (!__DEV__) return;
  if (!value) {
    await setDevProfilePreview("auto");
    return;
  }
  await setDevProfilePreview(value === "student" ? "student" : "professor");
}
