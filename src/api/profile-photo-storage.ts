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

const readErrorText = async (res: Response) => {
  try {
    return (await res.text()) || "";
  } catch {
    return "";
  }
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
    const text = await readErrorText(res);
    throw new Error(text || "Failed to upload profile photo");
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
    const text = await readErrorText(res);
    throw new Error(text || "Failed to remove profile photo");
  }
};
