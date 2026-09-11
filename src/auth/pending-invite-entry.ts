export type PendingInviteEntry =
  | { kind: "route"; href: string }
  | { kind: "staff_code"; code: string };

// Current organization codes are generated as two groups of four characters.
// Reject loose text locally before starting any authenticated invite flow.
const STAFF_CODE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

export function resolvePendingInviteEntry(value: string): PendingInviteEntry | null {
  const input = value.trim();
  if (!input) return null;

  if (STAFF_CODE_PATTERN.test(input)) {
    return { kind: "staff_code", code: input };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const inviteCode = url.searchParams.get("inviteCode")?.trim() ||
    (pathname === "/staff-invite" ? url.searchParams.get("code")?.trim() : "");
  if (inviteCode && STAFF_CODE_PATTERN.test(inviteCode)) {
    return { kind: "staff_code", code: inviteCode };
  }

  if (/^\/(invite|family-invite)\/[^/]+$/i.test(pathname)) {
    return { kind: "route", href: `${pathname}${url.search}${url.hash}` };
  }

  return null;
}
