import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export type LinkMetadata = {
  title: string;
  author: string;
  host: string;
  image: string;
  description: string;
  publishedAt: string;
  url: string;
};

export const LINK_METADATA_FALLBACK_STATUS = "Preview básico usado para este link.";

export const getLinkKey = (url: string) => url.trim();

export const requestLinkMetadata = async (
  url: string,
  accessToken: string
): Promise<LinkMetadata> => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/link-metadata`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ url: url.trim() }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(LINK_METADATA_FALLBACK_STATUS);
  }
  let data: Partial<LinkMetadata>;
  try {
    data = JSON.parse(text) as Partial<LinkMetadata>;
  } catch {
    throw new Error(LINK_METADATA_FALLBACK_STATUS);
  }
  return {
    title: data.title ?? "",
    author: data.author ?? "",
    host: data.host ?? "",
    image: data.image ?? "",
    description: data.description ?? "",
    publishedAt: data.publishedAt ?? "",
    url: data.url ?? url.trim(),
  };
};
