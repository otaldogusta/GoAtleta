// Extract only the code. Never navigate to or fetch a pasted URL, and never
// interpret its role/organization parameters as authorization.
import { parseStaffInviteFragment } from "./staff-invite-link";

export function getPastedStaffInviteProof(value: string) {
  try {
    const url = new URL(value.trim(), "https://input.invalid");
    if (url.pathname.toLowerCase().replace(/\/$/, "") !== "/staff-invite") return null;
    return parseStaffInviteFragment(url.hash);
  } catch { return null; }
}

export function getInviteEmailSuggestion(value: string): string | undefined {
  if (!value.includes("?") && !value.includes("#")) return undefined;
  try {
    const url = new URL(value.trim(), "https://input.invalid");
    if (url.pathname.replace(/\/$/, "").toLowerCase() !== "/staff-invite") return undefined;
    if (!/^[A-Z0-9-]{4,128}$/.test(normalizeInviteCodeInput(value))) return undefined;
    const emails: string[] = [];
    for (const params of [url.searchParams, new URLSearchParams(url.hash.slice(1))]) {
      params.forEach((email, key) => { if (key.toLowerCase() === "email") emails.push(email.trim()); });
    }
    if (emails.length === 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emails[0])) return emails[0];
  } catch { /* A pasted email is only an optional form suggestion. */ }
  return undefined;
}

export function normalizeInviteCodeInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.includes("?") && !trimmed.includes("#")) return trimmed.toUpperCase();
  try {
    const url = new URL(trimmed, "https://input.invalid");
    const codes: string[] = [];
    const staffInvite = url.pathname.replace(/\/$/, "").toLowerCase() === "/staff-invite";
    url.searchParams.forEach((code, key) => {
      if (key.toLowerCase() === "invitecode" || (staffInvite && key.toLowerCase() === "code")) {
        codes.push(code.trim().toUpperCase());
      }
    });
    if (staffInvite) {
      new URLSearchParams(url.hash.slice(1)).forEach((code, key) => {
        if (key.toLowerCase() === "code") codes.push(code.trim().toUpperCase());
      });
    }
    if (codes.length === 1 && /^[A-Z0-9-]{4,128}$/.test(codes[0])) return codes[0];
  } catch {
    // Invalid input remains visible for correction and is rejected by validation.
  }
  return trimmed.toUpperCase();
}
