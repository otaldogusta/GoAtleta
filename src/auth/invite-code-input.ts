// Extract only the code. Never navigate to or fetch a pasted URL, and never
// interpret its role/organization parameters as authorization.
export function normalizeInviteCodeInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.includes("?")) return trimmed.toUpperCase();
  try {
    const url = new URL(trimmed, "https://input.invalid");
    const codes: string[] = [];
    url.searchParams.forEach((code, key) => {
      if (key.toLowerCase() === "invitecode") codes.push(code.trim().toUpperCase());
    });
    if (codes.length === 1 && /^[A-Z0-9-]{4,128}$/.test(codes[0])) return codes[0];
  } catch {
    // Invalid input remains visible for correction and is rejected by validation.
  }
  return trimmed.toUpperCase();
}
