// Local, advisory estimate only: no composition requirement or server policy.
// This is not an entropy calculation or a breached-password lookup.
export function estimatePasswordStrength(password: string) {
  if (!password) return { score: 0, label: "" };
  const normalized = password.normalize("NFKC").toLocaleLowerCase();
  const length = Array.from(password).length;
  const compact = normalized.replace(/[^\p{L}\p{N}]/gu, "");
  const common = /^(?:password|senha|secret|qwerty|admin|goatleta|letmein|welcome)\d*$/;
  const repeated = /^(.{1,6})\1+$/u.test(compact);
  const sequence = compact.length >= 4 && [
    "01234567890123456789", "98765432109876543210",
    "abcdefghijklmnopqrstuvwxyz", "zyxwvutsrqponmlkjihgfedcba",
    "qwertyuiopasdfghjklzxcvbnm",
  ].some((row) => row.includes(compact));
  const predictable = !compact || common.test(compact) || repeated || sequence || new Set(compact).size < 4;
  const score = predictable ? 0.2 : length < 8 ? 0.3 : length < 14 ? 0.6 : 1;
  return { score, label: score <= 0.33 ? "Fraca" : score <= 0.66 ? "Média" : "Forte" };
}
