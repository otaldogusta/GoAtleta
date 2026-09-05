import { getValidAccessToken } from "../auth/session";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

const STUDENT_PHOTO_BUCKET = "student-photos";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_URL_CACHE_MS = 50 * 60 * 1000;

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

const encodeObjectPath = (path: string) =>
  path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const toObjectPath = (organizationId: string, studentId: string) =>
  `${organizationId}/${studentId}/avatar`;

const toPublicUrl = (path: string, cacheVersion?: number) => {
  const base = SUPABASE_URL.replace(/\/$/, "");
  const encodedPath = encodeObjectPath(path);
  const cacheQuery =
    typeof cacheVersion === "number" ? `?v=${cacheVersion}` : "";
  return `${base}/storage/v1/object/public/${STUDENT_PHOTO_BUCKET}/${encodedPath}${cacheQuery}`;
};

export const getStudentPhotoObjectPath = (photoUrl: string | null | undefined) => {
  const value = photoUrl?.trim();
  if (!value) return null;

  try {
    const parsed = new URL(value);
    const base = new URL(SUPABASE_URL);
    if (parsed.origin !== base.origin) return null;

    const markers = [
      `/storage/v1/object/public/${STUDENT_PHOTO_BUCKET}/`,
      `/storage/v1/object/authenticated/${STUDENT_PHOTO_BUCKET}/`,
      `/storage/v1/object/sign/${STUDENT_PHOTO_BUCKET}/`,
    ];
    const marker = markers.find((candidate) => parsed.pathname.startsWith(candidate));
    if (!marker) return null;

    return parsed.pathname
      .slice(marker.length)
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return null;
  }
};

export const getStudentPhotoAccessUrl = async (
  photoUrl: string | null | undefined
): Promise<string | null> => {
  const value = photoUrl?.trim();
  if (!value) return null;

  const objectPath = getStudentPhotoObjectPath(value);
  if (!objectPath) return value;

  const cached = signedUrlCache.get(value);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const headers = await getAuthHeaders("application/json");
  const base = SUPABASE_URL.replace(/\/$/, "");
  const response = await fetch(
    `${base}/storage/v1/object/sign/${STUDENT_PHOTO_BUCKET}/${encodeObjectPath(objectPath)}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    }
  );

  if (!response.ok) {
    const text = await readErrorText(response);
    throw new Error(text || "Failed to authorize student photo");
  }

  const payload = (await response.json()) as { signedURL?: string; signedUrl?: string };
  const signedPath = payload.signedURL ?? payload.signedUrl;
  if (!signedPath) throw new Error("Student photo signed URL was not returned");

  const signedUrlBase = /^https?:\/\//i.test(signedPath)
    ? signedPath
    : `${base}/storage/v1${signedPath.startsWith("/") ? "" : "/"}${signedPath}`;
  // Keep the stored version on the signed URL so replacing an avatar invalidates image caches.
  const version = new URL(value).searchParams.get("v");
  const signedUrl = version
    ? `${signedUrlBase}${signedUrlBase.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`
    : signedUrlBase;
  signedUrlCache.set(value, {
    url: signedUrl,
    expiresAt: Date.now() + SIGNED_URL_CACHE_MS,
  });
  return signedUrl;
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

export const uploadStudentPhoto = async (params: {
  organizationId: string;
  studentId: string;
  uri: string;
  contentType?: string | null;
}): Promise<string> => {
  const organizationId = params.organizationId.trim();
  const studentId = params.studentId.trim();
  if (!organizationId || !studentId) {
    throw new Error("Missing organization or student id");
  }

  const path = toObjectPath(organizationId, studentId);
  const objectPath = encodeObjectPath(path);
  const body = await blobFromUri(params.uri);
  const headers = await getAuthHeaders(params.contentType ?? "image/jpeg");
  const base = SUPABASE_URL.replace(/\/$/, "");

  const res = await fetch(
    `${base}/storage/v1/object/${STUDENT_PHOTO_BUCKET}/${objectPath}`,
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
    throw new Error(text || "Failed to upload student photo");
  }

  return toPublicUrl(path, Date.now());
};

export const removeStudentPhotoObject = async (params: {
  organizationId: string;
  studentId: string;
}) => {
  const organizationId = params.organizationId.trim();
  const studentId = params.studentId.trim();
  if (!organizationId || !studentId) return;

  const path = toObjectPath(organizationId, studentId);
  const objectPath = encodeObjectPath(path);
  const headers = await getAuthHeaders();
  const base = SUPABASE_URL.replace(/\/$/, "");

  const res = await fetch(
    `${base}/storage/v1/object/${STUDENT_PHOTO_BUCKET}/${objectPath}`,
    {
      method: "DELETE",
      headers,
    }
  );

  if (!res.ok && res.status !== 404) {
    const text = await readErrorText(res);
    throw new Error(text || "Failed to remove student photo");
  }
};
