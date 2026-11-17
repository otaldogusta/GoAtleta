import { getValidAccessToken } from "../auth/session";
import { encodeProfileJxl } from "../utils/profile-jxl";
import { normalizeProfilePhotoForUpload } from "../utils/profile-photo";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

const PROFILE_PHOTO_BUCKET = "profile-photos";
const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PROFILE_PHOTO_SIZE_ERROR = "A foto excede o limite de 2 MB. Escolha uma imagem menor.";

const encodeObjectPath = (path: string) =>
  path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const storageObjectPathForUser = (userId: string) => `${userId}/avatar`;
const pendingPhotoWrites = new Map<string, Promise<unknown>>();

const serializePhotoWrite = async <T>(
  userId: string,
  write: () => Promise<T>
): Promise<T> => {
  const previous = pendingPhotoWrites.get(userId);
  const current = previous ? previous.catch(() => undefined).then(write) : write();
  pendingPhotoWrites.set(userId, current);
  try {
    return await current;
  } finally {
    if (pendingPhotoWrites.get(userId) === current) pendingPhotoWrites.delete(userId);
  }
};

const toPublicUrl = (path: string, cacheVersion: number, hasJxl: boolean) => {
  const base = SUPABASE_URL.replace(/\/$/, "");
  const encodedPath = encodeObjectPath(path);
  const cacheQuery = `?v=${cacheVersion}${hasJxl ? "&jxl=1" : ""}`;
  return `${base}/storage/v1/object/public/${PROFILE_PHOTO_BUCKET}/${encodedPath}${cacheQuery}`;
};

export const getProfilePhotoStorageErrorMessage = (
  status: number,
  action: "save" | "remove" = "save"
) => {
  if (status === 401) return "Sua sessão expirou. Entre novamente.";
  if (status === 413 && action === "save") return PROFILE_PHOTO_SIZE_ERROR;
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

const storageObjectUrl = (path: string) =>
  `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${PROFILE_PHOTO_BUCKET}/${encodeObjectPath(path)}`;

const writePhoto = (path: string, headers: Record<string, string>, body: Blob) =>
  fetch(storageObjectUrl(path), {
    method: "POST",
    headers: { ...headers, "x-upsert": "true" },
    body,
  });

const deletePhoto = async (path: string, headers: Record<string, string>) => {
  const response = await fetch(storageObjectUrl(path), { method: "DELETE", headers });
  if (response.ok || response.status === 404) return;
  if (response.status === 400) {
    const error = await response.json?.().catch(() => null);
    if (error?.message === "Object not found") return;
  }
  throw new Error(getProfilePhotoStorageErrorMessage(response.status, "remove"));
};

const isSmallerJxl = async (variant: Blob, jpeg: Blob) => {
  if (variant.type !== "image/jxl" || variant.size < 2 || variant.size >= jpeg.size) return false;
  const signature = new Uint8Array(await variant.slice(0, 12).arrayBuffer());
  const codestream = signature[0] === 0xff && signature[1] === 0x0a;
  const container = [0, 0, 0, 12, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a];
  return codestream || container.every((byte, index) => signature[index] === byte);
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
  const variantPath = `${path}.jxl`;
  return serializePhotoWrite(normalizedUserId, async () => {
    const normalizedPhoto = await normalizeProfilePhotoForUpload(params.uri);
    const body = await blobFromUri(normalizedPhoto.uri).finally(() => {
      if (normalizedPhoto.normalized && normalizedPhoto.uri.startsWith("blob:")) {
        URL.revokeObjectURL?.(normalizedPhoto.uri);
      }
    });
    if (body.size > PROFILE_PHOTO_MAX_BYTES) throw new Error(PROFILE_PHOTO_SIZE_ERROR);
    const finalContentType =
      normalizedPhoto.contentType ?? params.contentType ?? "image/jpeg";
    const headers = await getAuthHeaders();
    const response = await writePhoto(path, { ...headers, "Content-Type": finalContentType }, body);

    if (!response.ok) {
      throw new Error(getProfilePhotoStorageErrorMessage(response.status));
    }

    let hasJxl = false;
    if (normalizedPhoto.normalized && finalContentType === "image/jpeg") {
      try {
        const variant = await encodeProfileJxl(body);
        if (variant && await isSmallerJxl(variant, body)) {
          hasJxl = (await writePhoto(variantPath, { ...headers, "Content-Type": "image/jxl" }, variant)).ok;
        }
      } catch {
        // JPEG was already accepted, so an optional variant failure can fall back.
      }
    }
    if (!hasJxl) await deletePhoto(variantPath, headers).catch(() => undefined);
    return toPublicUrl(path, Date.now(), hasJxl);
  });
};

export const removeMyProfilePhotoObject = async (userId: string) => {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return;
  const path = storageObjectPathForUser(normalizedUserId);
  await serializePhotoWrite(normalizedUserId, async () => {
    const headers = await getAuthHeaders();
    await deletePhoto(`${path}.jxl`, headers);
    await deletePhoto(path, headers);
  });
};
