import { getValidAccessToken } from "../auth/session";
import { normalizeProfilePhotoForUpload } from "../utils/profile-photo";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

const PROFILE_PHOTO_BUCKET = "profile-photos";

const encodeObjectPath = (path: string) =>
  path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const storageObjectPathForUser = (userId: string) => `${userId}/avatar`;

const toPublicUrl = (path: string, cacheVersion?: number) => {
  const base = SUPABASE_URL.replace(/\/$/, "");
  const encodedPath = encodeObjectPath(path);
  const cacheQuery =
    typeof cacheVersion === "number" ? `?v=${cacheVersion}` : "";
  return `${base}/storage/v1/object/public/${PROFILE_PHOTO_BUCKET}/${encodedPath}${cacheQuery}`;
};

export const getProfilePhotoStorageErrorMessage = (
  status: number,
  action: "save" | "remove" = "save"
) => {
  if (status === 401) return "Sua sessão expirou. Entre novamente.";
  if (status === 403) {
    return action === "remove"
      ? "Você não tem permissão para remover esta foto."
      : "Não foi possível alterar esta foto. Atualize a página e tente novamente.";
  }
  return action === "remove"
    ? "Não foi possível remover a foto. Tente novamente."
    : "Não foi possível salvar a foto. Tente novamente.";
};

const getAuthHeaders = async (contentType?: string) => {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Missing auth token");

  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
};

const blobFromUri = async (uri: string) => {
  const response = await fetch(uri);
  if (!response.ok) throw new Error("Failed to read selected image");
  return await response.blob();
};

export const uploadMyProfilePhoto = async (params: {
  userId: string;
  uri: string;
  contentType?: string | null;
}): Promise<string> => {
  const normalizedUserId = params.userId.trim();
  if (!normalizedUserId) {
    throw new Error("Missing user id");
  }
  const path = storageObjectPathForUser(normalizedUserId);
  const objectPath = encodeObjectPath(path);
  const normalizedPhoto = await normalizeProfilePhotoForUpload(params.uri);
  const body = await blobFromUri(normalizedPhoto.uri);
  const finalContentType =
    normalizedPhoto.contentType ?? params.contentType ?? "image/jpeg";
  const headers = await getAuthHeaders(finalContentType);

  const base = SUPABASE_URL.replace(/\/$/, "");
  const res = await fetch(
    `${base}/storage/v1/object/${PROFILE_PHOTO_BUCKET}/${objectPath}`,
    {
      method: "POST",
      headers: {
        ...headers,
        "x-upsert": "true",
      },
      body,
    }
  );

  if (!res.ok) {
    throw new Error(getProfilePhotoStorageErrorMessage(res.status));
  }

  return toPublicUrl(path, Date.now());
};

export const removeMyProfilePhotoObject = async (userId: string) => {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return;
  const path = storageObjectPathForUser(normalizedUserId);
  const objectPath = encodeObjectPath(path);
  const headers = await getAuthHeaders();
  const base = SUPABASE_URL.replace(/\/$/, "");

  const res = await fetch(
    `${base}/storage/v1/object/${PROFILE_PHOTO_BUCKET}/${objectPath}`,
    {
      method: "DELETE",
      headers,
    }
  );

  if (!res.ok && res.status !== 404) {
    throw new Error(getProfilePhotoStorageErrorMessage(res.status, "remove"));
  }
};
