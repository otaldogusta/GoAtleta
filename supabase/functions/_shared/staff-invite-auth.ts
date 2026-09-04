export function buildStaffInviteEmailLink(baseLink: string, code: string, tokenHash: string, type: string, email: string) {
  if (!tokenHash || !["magiclink", "signup", "invite"].includes(type)) throw new Error("AUTH_LINK_UNAVAILABLE");
  const url = new URL("/staff-invite", baseLink);
  // Credentials stay in the fragment, not server URLs/referrers or the coordinator response.
  url.hash = new URLSearchParams({ code, token_hash: tokenHash, type, email }).toString();
  return url.toString();
}

export function assertStaffInviteRecipient(invitedEmail: string, verifiedEmail?: string) {
  if (!verifiedEmail || invitedEmail.trim().toLowerCase() !== verifiedEmail.trim().toLowerCase()) {
    throw new Error("INVITE_EMAIL_MISMATCH");
  }
}
