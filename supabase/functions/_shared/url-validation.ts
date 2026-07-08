// ─── DNS resolution cache (keyed by hostname, NOT by full URL) ───────────────
// Rationale: https://a.com/page1 and https://a.com/page2 resolve identically.
// Storing full URLs wastes memory and defeats the cache.
//
// ⚠ Operational constraints (important for future maintainers):
//
//   1. ISOLATE-SCOPED: This cache lives on globalThis inside a single Deno isolate.
//      Each Edge Function invocation may run in a fresh isolate — cache hits only
//      occur when the runtime reuses the same isolate for multiple requests, which
//      Supabase does for warm invocations but cannot be guaranteed.
//
//   2. NO CROSS-FUNCTION SYNC: Two concurrent Edge Function instances do not share
//      this cache. Each instance resolves DNS independently until their caches warm up.
//
//   3. RESTART CLEARS CACHE: Any isolate restart (deploy, crash, scale-down) discards
//      the cache. This is safe — the default behaviour is conservative rejection.
//
//   4. DNS REBINDING (partial defense): This cache provides a limited defense against
//      DNS rebinding. If a hostname is first resolved to a public IP and cached, it
//      will remain "allowed" for up to TTL_MS (60s) even if the attacker rotates the
//      DNS record to a private IP in the interim. For long-lived isolates this window
//      is finite but non-zero. A complete mitigation would require re-resolving on
//      every request (which defeats the cache) or using a trusted DNS-over-HTTPS
//      resolver with pinned roots. The current trade-off (performance vs. rebinding
//      risk) is documented and accepted.
type DnsCacheEntry = { addresses: string[]; expiresAt: number };
const DNS_CACHE_TTL_MS = 60_000;
const DNS_CACHE: Map<string, DnsCacheEntry> =
  ((globalThis as any).__urlValidationDnsCache as Map<string, DnsCacheEntry>) ??
  new Map<string, DnsCacheEntry>();
(globalThis as any).__urlValidationDnsCache = DNS_CACHE;

export const isPrivateIpv4 = (host: string) => {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const parts = host.split(".").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true;
  }
  const [first, second] = parts;
  if (first === 10 || first === 127 || first === 0) return true;
  if (first === 169 && second === 254) return true;
  if (first === 192 && second === 168) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 100 && second >= 64 && second <= 127) return true;
  return false;
};

export const isPrivateIpv6 = (host: string) => {
  const normalized = host.toLowerCase();
  const withoutBrackets = normalized.replace(/^\[(.*)\]$/, "$1");
  if (!withoutBrackets.includes(":")) return false;
  if (withoutBrackets === "::1" || withoutBrackets === "::") return true;
  if (withoutBrackets.startsWith("fc") || withoutBrackets.startsWith("fd")) return true;
  if (withoutBrackets.startsWith("fe80")) return true;
  return false;
};

export const isPrivateHost = (host: string) => {
  const normalized = host.toLowerCase();
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }
  if (isPrivateIpv4(normalized) || isPrivateIpv6(normalized)) return true;
  return false;
};

export const normalizePublicUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    if (!url.hostname || isPrivateHost(url.hostname)) return "";
    return url.toString();
  } catch {
    return "";
  }
};

export const resolveAndCheckPublicUrl = async (value: string) => {
  try {
    const url = new URL(value);
    const hostname = url.hostname;

    // ── DNS cache lookup (keyed by hostname, TTL 60 s) ─────────────────────
    const now = Date.now();
    const cached = DNS_CACHE.get(hostname);
    let addresses: string[];

    if (cached && now < cached.expiresAt) {
      addresses = cached.addresses;
    } else {
      addresses = [];
      try {
        // Deno.resolveDns may not exist in all runtimes; guard access.
        // @ts-ignore
        if (typeof Deno !== "undefined" && typeof (Deno as any).resolveDns === "function") {
          // @ts-ignore
          const a = await (Deno as any).resolveDns(hostname, "A");
          if (Array.isArray(a)) addresses.push(...a);
          // @ts-ignore
          const a6 = await (Deno as any).resolveDns(hostname, "AAAA");
          if (Array.isArray(a6)) addresses.push(...a6);
        }
      } catch {
        // resolution failed — conservative rejection (do NOT cache failures)
        return "";
      }
      // Cache resolved addresses (including empty = unresolvable) with TTL.
      DNS_CACHE.set(hostname, { addresses, expiresAt: now + DNS_CACHE_TTL_MS });
    }

    if (addresses.length === 0) return "";
    for (const addr of addresses) {
      if (isPrivateIpv4(addr) || isPrivateIpv6(addr)) return "";
    }
    return url.toString();
  } catch {
    return "";
  }
};
