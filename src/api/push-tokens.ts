import { Platform } from "react-native";
import { supabaseRestRequest } from "./rest";

type PushTokenRow = {
  id: string;
  organization_id: string;
  user_id: string;
  expo_push_token: string;
  platform: "ios" | "android";
  device_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PushToken = {
  id: string;
  organizationId: string;
  userId: string;
  expoPushToken: string;
  platform: "ios" | "android";
  deviceId: string | null;
  createdAt: string;
  updatedAt: string;
};

type UpsertPushTokenInput = {
  organizationId: string;
  expoPushToken: string;
  platform?: "ios" | "android";
  deviceId?: string | null;
};

const toPushToken = (row: PushTokenRow): PushToken => ({
  id: row.id,
  organizationId: row.organization_id,
  userId: row.user_id,
  expoPushToken: row.expo_push_token,
  platform: row.platform,
  deviceId: row.device_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizePlatform = (value?: "ios" | "android"): "ios" | "android" => {
  if (value === "ios" || value === "android") return value;
  return Platform.OS === "ios" ? "ios" : "android";
};

export async function upsertMyPushToken(input: UpsertPushTokenInput): Promise<void> {
  const organizationId = String(input.organizationId ?? "").trim();
  const expoPushToken = String(input.expoPushToken ?? "").trim();
  if (!organizationId || !expoPushToken) {
    throw new Error("organizationId e expoPushToken são obrigatórios.");
  }

  await supabaseRestRequest<PushTokenRow[]>(
    "/push_tokens?on_conflict=organization_id,user_id,expo_push_token",
    {
      method: "POST",
      body: [
        {
          organization_id: organizationId,
          expo_push_token: expoPushToken,
          platform: normalizePlatform(input.platform),
          device_id: input.deviceId ?? null,
          updated_at: new Date().toISOString(),
        },
      ],
      prefer: "return=minimal",
      additionalHeaders: {
        Prefer: "resolution=merge-duplicates",
      },
    }
  );
}

export async function listMyPushTokens(organizationId: string): Promise<PushToken[]> {
  const orgId = String(organizationId ?? "").trim();
  if (!orgId) return [];
  const rows = await supabaseRestRequest<PushTokenRow[]>(
    "/push_tokens?organization_id=eq." + encodeURIComponent(orgId) + "&select=*",
    { method: "GET" }
  );
  return (rows ?? []).map(toPushToken);
}

