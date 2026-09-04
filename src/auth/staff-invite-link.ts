export type StaffInviteProof = { code: string; token_hash: string; type: "magiclink" | "signup" | "invite" };

export function parseStaffInviteFragment(fragment: string): StaffInviteProof | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  const code = params.get("code") ?? "";
  const token_hash = params.get("token_hash") ?? "";
  const type = params.get("type");
  if (!/^[a-z0-9-]{4,128}$/i.test(code) || !/^[a-f0-9]{32,128}$/i.test(token_hash) ||
      (type !== "magiclink" && type !== "signup" && type !== "invite")) return null;
  return { code: code.toUpperCase(), token_hash, type };
}
