// Visual tooling only; this never grants backend permissions.
// Keep the existing development account exception out of ordinary accounts.
export function canUseProfilePreview(email?: string | null, development = __DEV__) {
  return development && email?.trim().toLowerCase() === "gusantinho753@gmail.com";
}
