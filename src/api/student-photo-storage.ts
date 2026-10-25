import { assertSessionIdentity, getSessionIdentity, getValidAccessToken, SessionIdentityChangedError } from "../auth/session";
import { getActiveOrganizationId, getReadCacheGeneration } from "../db/client";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

const STUDENT_PHOTO_BUCKET = "student-photos";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_URL_CACHE_MS = 50 * 60 * 1000;
const SIGNED_URL_CACHE_LIMIT = 512;
const PHOTO_REQUEST_TIMEOUT_MS = 20_000;

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const pendingSignedUrls = new Map<string, { promise: Promise<string>; consumers: Set<AbortSignal | undefined>; state: { started: boolean } }>();
const photoQueue: (() => void)[] = [];
const activePhotoControllers = new Set<AbortController>();
let activePhotoRequests = 0;
let signedUrlContext = "";

const pruneSignedUrls = () => {
  const now = Date.now();
  for (const [key, cached] of signedUrlCache) {
    if (cached.expiresAt <= now) signedUrlCache.delete(key);
  }
  while (signedUrlCache.size > SIGNED_URL_CACHE_LIMIT) {
    signedUrlCache.delete(signedUrlCache.keys().next().value!);
  }
};

// Bound cold directories without changing Storage's authorization endpoint.
const enqueuePhotoRequest = (run: () => Promise<string>) => new Promise<string>((resolve, reject) => {
  const start = () => {
    activePhotoRequests += 1;
    void run().then(resolve, reject).finally(() => {
      activePhotoRequests -= 1;
      photoQueue.shift()?.();
    });
  };
  if (activePhotoRequests < 6) start();
  else photoQueue.push(start);
});

const waitForPhoto = async (promise: Promise<string>, signal?: AbortSignal) => {
  if (!signal) return promise;
  if (signal.aborted) throw new Error("Photo request cancelled");
  let onAbort: () => void = () => undefined;
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new Error("Photo request cancelled"));
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([promise, cancelled]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
};

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
  photoUrl: string | null | undefined,
  options: { organizationId?: string; signal?: AbortSignal } = {},
): Promise<string | null> => {
  const value = photoUrl?.trim();
  if (!value) return null;

  const objectPath = getStudentPhotoObjectPath(value);
  if (!objectPath) return value;

  const identity = getSessionIdentity();
  const generation = getReadCacheGeneration();
  const organizationId = await getActiveOrganizationId();
  const assertContext = async () => {
    assertSessionIdentity(identity);
    if (!identity.userId || generation !== getReadCacheGeneration()) throw new SessionIdentityChangedError();
    const currentOrganizationId = await getActiveOrganizationId();
    assertSessionIdentity(identity);
    if (generation !== getReadCacheGeneration() || currentOrganizationId !== organizationId ||
      (options.organizationId !== undefined && (options.organizationId !== organizationId || objectPath.split("/")[0] !== options.organizationId))) {
      throw new SessionIdentityChangedError();
    }
  };
  await assertContext();
  if (options.signal?.aborted) throw new Error("Photo request cancelled");
  const context = JSON.stringify([identity.userId, identity.generation, generation, organizationId]);
  if (signedUrlContext !== context) {
    signedUrlContext = context;
    signedUrlCache.clear();
    pendingSignedUrls.clear();
    activePhotoControllers.forEach(controller => controller.abort());
  }
  const key = JSON.stringify([context, value]);
  pruneSignedUrls();
  const cached = signedUrlCache.get(key);
  if (cached) {
    // Map order is least recently used first; a hit never extends the grant TTL.
    signedUrlCache.delete(key);
    signedUrlCache.set(key, cached);
    return cached.url;
  }

  const existing = pendingSignedUrls.get(key);
  if (existing && (existing.state.started || [...existing.consumers].some((signal) => !signal?.aborted))) {
    existing.consumers.add(options.signal);
    const url = await waitForPhoto(existing.promise, options.signal);
    await assertContext();
    return url;
  }
  const consumers = new Set([options.signal]);
  const state = { started: false };
  const promise = enqueuePhotoRequest(async () => {
    await assertContext();
    // A page that left the screen must not start queued work; another consumer
    // sharing this URL can still use the same request.
    if (![...consumers].some((signal) => !signal?.aborted)) throw new Error("Photo request cancelled");
    const headers = await getAuthHeaders("application/json");
    await assertContext();
    if (![...consumers].some((signal) => !signal?.aborted)) throw new Error("Photo request cancelled");
    const base = SUPABASE_URL.replace(/\/$/, "");
    const controller = new AbortController();
    activePhotoControllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), PHOTO_REQUEST_TIMEOUT_MS);
    try {
      state.started = true;
      const response = await fetch(
        `${base}/storage/v1/object/sign/${STUDENT_PHOTO_BUCKET}/${encodeObjectPath(objectPath)}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
          signal: controller.signal,
        }
      );
      await assertContext();

      if (!response.ok) {
        const text = await readErrorText(response);
        throw new Error(text || "Failed to authorize student photo");
      }

      const payload = (await response.json()) as { signedURL?: string; signedUrl?: string };
      await assertContext();
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
      signedUrlCache.set(key, {
        url: signedUrl,
        expiresAt: Date.now() + SIGNED_URL_CACHE_MS,
      });
      pruneSignedUrls();
      return signedUrl;
    } finally {
      clearTimeout(timeout);
      activePhotoControllers.delete(controller);
    }
  });
  const pending = { promise, consumers, state };
  pendingSignedUrls.set(key, pending);
  const clearPending = () => {
    if (pendingSignedUrls.get(key) === pending) pendingSignedUrls.delete(key);
  };
  void promise.then(clearPending, clearPending);
  const url = await waitForPhoto(promise, options.signal);
  await assertContext();
  return url;
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
