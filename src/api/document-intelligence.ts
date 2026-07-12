import { forceRefreshAccessToken, getValidAccessToken } from "../auth/session";
import type { DocumentMergeItem } from "../core/document-intelligence";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export type DocumentSyncProposal = {
  proposalId: string;
  snapshotVersion: string;
  sourceTitle: string;
  className: string;
  periodLabel: string;
  summary: string;
  items: DocumentMergeItem[];
};

export type DocumentApplicationReceipt = {
  applicationId: string;
  appliedItemIds: string[];
  resultingVersion: string;
  appliedAt: string;
  undoneAt?: string | null;
};

type DocumentApiResponse = {
  connected?: boolean;
  authorizationUrl?: string;
  proposal?: DocumentSyncProposal;
  receipt?: DocumentApplicationReceipt;
  error?: string;
};

const endpoint = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/document-intelligence`;

async function postDocumentAction(body: Record<string, unknown>): Promise<DocumentApiResponse> {
  let token = await getValidAccessToken();
  if (!token) throw new Error("Entre novamente para usar a sincronização inteligente.");
  const request = (accessToken: string) =>
    fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  let response = await request(token);
  if (response.status === 401) {
    token = await forceRefreshAccessToken();
    if (token) response = await request(token);
  }
  const payload = (await response.json().catch(() => ({}))) as DocumentApiResponse;
  if (!response.ok) throw new Error(payload.error || "Não foi possível processar o documento.");
  return payload;
}

export const getDriveConnection = (organizationId: string, redirectTo: string) =>
  postDocumentAction({ action: "drive_connection", organizationId, redirectTo });

export const analyzeDriveDocument = (params: {
  organizationId: string;
  classId: string;
  month: string;
  sourceUrl: string;
}) => postDocumentAction({ action: "analyze", ...params });

export const applyDocumentProposal = (params: {
  proposalId: string;
  approvedItemIds: string[];
  expectedStateVersion: string;
  idempotencyKey: string;
}) => postDocumentAction({ action: "apply", ...params });

export const undoDocumentApplication = (applicationId: string) =>
  postDocumentAction({ action: "undo", applicationId });
