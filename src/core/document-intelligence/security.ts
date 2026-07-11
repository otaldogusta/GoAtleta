const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);

const isIpv4 = (hostname: string) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);

const isBlockedIpv4 = (hostname: string) => {
  if (!isIpv4(hostname)) return false;
  const octets = hostname.split(".").map(Number);
  if (octets.some((value) => value < 0 || value > 255)) return true;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
};

const isBlockedIpv6 = (hostname: string) => {
  const value = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    value === "::" ||
    value === "::1" ||
    value.startsWith("fe80:") ||
    value.startsWith("fc") ||
    value.startsWith("fd")
  );
};

export function assertDocumentOrganizationScope(organizationId: string) {
  if (!organizationId.trim()) {
    throw new Error("organizationId é obrigatório para ingerir documentos.");
  }
}
export function assertSafeDocumentSourceUrl(sourceUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error("URL de documento inválida.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("A fonte deve usar HTTP ou HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URLs com credenciais não são permitidas.");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    isBlockedIpv4(hostname) ||
    (hostname.includes(":") && isBlockedIpv6(hostname))
  ) {
    throw new Error("A URL aponta para uma rede privada ou reservada.");
  }

  return parsed;
}
