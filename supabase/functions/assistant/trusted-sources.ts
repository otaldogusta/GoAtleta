import { normalizePublicUrl } from "../_shared/url-validation.ts";

export type AssistantSourceLike = {
  title: string;
  author: string;
  url: string;
  [key: string]: unknown;
};

const normalizedTrustedUrls = (trustedUrls: string[]) =>
  new Set(
    trustedUrls
      .map((url) => normalizePublicUrl(url))
      .filter((url): url is string => Boolean(url)),
  );

/**
 * Model output may reference a source, but it cannot nominate a new network
 * destination. URLs are returned only when the server retrieved the same URL
 * before generation. This is intentionally pure and performs no DNS or HTTP.
 */
export const keepServerTrustedSources = <T extends AssistantSourceLike>(
  sources: T[],
  trustedUrls: string[],
): T[] => {
  const allowlist = normalizedTrustedUrls(trustedUrls);
  const seen = new Set<string>();

  return sources.flatMap((source) => {
    const normalized = normalizePublicUrl(source.url);
    if (!normalized || !allowlist.has(normalized)) return [];

    const identity = `${normalized}\n${source.title.trim().toLowerCase()}`;
    if (seen.has(identity)) return [];
    seen.add(identity);
    return [{ ...source, url: normalized }];
  });
};
