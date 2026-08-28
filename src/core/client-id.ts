type RuntimeCrypto = {
  randomUUID?: () => string;
  getRandomValues?: (values: Uint8Array) => Uint8Array;
};

let fallbackSequence = 0;

const formatUuidBytes = (bytes: Uint8Array) => {
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export function createClientId(runtimeCrypto?: RuntimeCrypto | null) {
  const cryptoSource = runtimeCrypto === undefined
    ? (globalThis as typeof globalThis & { crypto?: RuntimeCrypto }).crypto
    : runtimeCrypto;

  try {
    const uuid = cryptoSource?.randomUUID?.();
    if (uuid) return uuid;
  } catch {
    // Alguns runtimes expõem crypto parcialmente, sem randomUUID funcional.
  }

  try {
    if (cryptoSource?.getRandomValues) {
      return formatUuidBytes(cryptoSource.getRandomValues(new Uint8Array(16)));
    }
  } catch {
    // O identificador abaixo ainda combina tempo, sequência e aleatoriedade local.
  }

  fallbackSequence = (fallbackSequence + 1) % 0x100000;
  return [
    Date.now().toString(36),
    fallbackSequence.toString(36).padStart(4, "0"),
    Math.random().toString(36).slice(2, 12),
  ].join("-");
}
