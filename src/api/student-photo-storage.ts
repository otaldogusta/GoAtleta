import { getValidAccessToken } from "../auth/session";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

const STUDENT_PHOTO_BUCKET = "student-photos";

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
