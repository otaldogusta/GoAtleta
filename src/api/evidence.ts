import { getValidAccessToken } from "../auth/session";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export type EvidenceStudy = {
  pmid: string;
  title: string;
  journal: string;
  publishedAt: string;
  abstract: string;
  url: string;
  authors: string[];
};

export type EvidenceSummary = {
  headline: string;
  practicalTakeaways: string[];
  limitations: string[];
  confidence: "low" | "medium" | "high";
  suggestedTags: string[];
};

const endpoint = `${SUPABASE_URL}/functions/v1/kb_ingest`;

const callKbIngest = async <T>(payload: Record<string, unknown>): Promise<T> => {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Sessão inválida. Faça login novamente.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    const detail = typeof data.error === "string" ? data.error : "Falha ao processar evidência.";
    throw new Error(detail);
  }

  return data as T;
};

export const evidenceSearchPubMed = async (params: {
  query: string;
  organizationId?: string | null;
  maxResults?: number;
}) => {
  const payload = await callKbIngest<{ studies: EvidenceStudy[] }>({
    action: "search",
    query: params.query,
    organizationId: params.organizationId,
    maxResults: params.maxResults ?? 8,
  });
  return payload.studies ?? [];
};

export const evidenceSummarizeStudies = async (params: {
  studies: EvidenceStudy[];
  question?: string;
  organizationId?: string | null;
}) => {
  const payload = await callKbIngest<{ summary: EvidenceSummary }>({
    action: "summarize",
    organizationId: params.organizationId,
    studies: params.studies,
    question: params.question ?? "",
  });
  return payload.summary;
};

export const evidenceApproveStudies = async (params: {
  organizationId: string;
  studies: EvidenceStudy[];
  summary: EvidenceSummary;
  sport?: string;
  level?: string;
}) => {
  const payload = await callKbIngest<{ approvedCount: number; documentIds: string[] }>({
    action: "approve",
    organizationId: params.organizationId,
    studies: params.studies,
    summary: params.summary,
    sport: params.sport ?? "volleyball",
    level: params.level ?? "general",
  });

  return {
    approvedCount: Number(payload.approvedCount ?? 0),
    documentIds: Array.isArray(payload.documentIds)
      ? payload.documentIds.map((item) => String(item))
      : [],
  };
};
