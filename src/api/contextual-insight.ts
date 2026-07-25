import { getValidAccessToken } from "../auth/session";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export type ContextualInsightRequestSnapshot = {
  name?: string | null;
  ageBand?: string | null;
  modality?: string | null;
  goal?: string | null;
  daysOfWeek?: number[] | null;
  mvLevel?: string | null;
};

export type ContextualInsightResponse = {
  insight?: string;
  confidence?: number;
  based_on?: unknown;
  action?: unknown;
};

const ASSISTANT_URL = `${SUPABASE_URL}/functions/v1/assistant`;

export async function requestContextualInsight(input: {
  organizationId: string;
  classId: string;
  classSnapshot: ContextualInsightRequestSnapshot;
  signal: AbortSignal;
}): Promise<ContextualInsightResponse | null> {
  const token = await getValidAccessToken();
  if (!token) return null;

  const response = await fetch(ASSISTANT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      mode: "proactive",
      organizationId: input.organizationId,
      classId: input.classId,
      sport: "volleyball",
      classSnapshot: {
        name: input.classSnapshot.name,
        ageBand: input.classSnapshot.ageBand,
        modality: input.classSnapshot.modality,
        goal: input.classSnapshot.goal,
        daysOfWeek: input.classSnapshot.daysOfWeek?.join(", "),
        mvLevel: input.classSnapshot.mvLevel,
      },
    }),
    signal: input.signal,
  });

  if (!response.ok) return null;

  const responseBody = (await response.json()) as ContextualInsightResponse & {
    data?: ContextualInsightResponse;
  };
  return responseBody.data ?? responseBody;
}
